/**
 * 采集链路快照（反馈诊断用，旁路记录）
 *
 * 只回答一个问题：这一轮请求的用量，最后有没有变成一条历史记录；如果没有，
 * 卡在哪一步。它不参与任何业务判断，也不改变现有采集逻辑——所有调用点都包在
 * try/catch 里，只是把「发生了什么」记进一个环形缓冲，随诊断包上传。
 *
 * 阶段（按时间顺序）：
 * - fetch-start   命中对话接口，请求发出
 * - fetch-parse   响应解析完成（是否解析到 usage、usage 是否全 0）
 * - event-drop    GENERATION_ENDED 时没拿到任何有效 usage，本轮被丢弃
 * - entry-added   repository.addEntry 已调用（唯一落库点）
 * - entry-error   addEntry 抛错
 * - turn-estimated  上游没给 usage，按输出本地估算后补记
 * - turn-interrupted 用户停止或上游中断，靠估算补记并标注中断
 * - turn-unmatched  生成结束事件对不上任何请求轮次（按无主轮次估算补记，见 interception）
 * - entry-rejected  输出其实是上游错误提示（宿主把非 2xx 包成 200），明确拒绝入库
 * - install-failed  采集包装安装失败（层深上限 / 安装期间被替换 / 异常），采集可能失聪
 */
export type CaptureStage =
  | 'fetch-start'
  | 'fetch-parse'
  | 'event-drop'
  | 'entry-added'
  | 'entry-error'
  | 'turn-estimated'
  | 'turn-interrupted'
  | 'turn-unmatched'
  | 'entry-rejected'
  | 'install-failed';

export interface CaptureRecord {
  at: number;
  stage: CaptureStage;
  model?: string;
  requestId?: string;
  url?: string;
  streamed?: boolean | null;
  usageFound?: boolean;
  usageZero?: boolean;
  usage?: Record<string, number> | null;
  finishReason?: string | null;
  reason?: string;
}

/** 环形缓冲上限：够还原最近几轮的链路，又不至于撑大诊断包 */
export const CAPTURE_MAX = 24;
/**
 * 落盘镜像：真机上「没记进历史」往往发生在几轮之前，而页面一刷新内存缓冲就空了
 * （反馈包里 capture 总是空数组）。这里把同一批快照同步写进 localStorage，
 * 只含阶段名、模型名、URL 与用量数字，不含任何正文。
 */
export const CAPTURE_STORAGE_KEY = 'aus_capture_stages_v1';

const CAPTURE_STAGE_SET = new Set<string>([
  'fetch-start',
  'fetch-parse',
  'event-drop',
  'entry-added',
  'entry-error',
  'turn-estimated',
  'turn-interrupted',
  // 采集失聪的两种现场：漏掉它们，刷新后从落盘镜像读回时会被静默丢弃
  'turn-unmatched',
  // 上游错误被宿主包装成 200：不进历史，但诊断包要能查到撞了多少次
  'entry-rejected',
  'install-failed',
]);

const USAGE_KEYS = [
  'prompt_tokens',
  'completion_tokens',
  'total_tokens',
  'input_tokens',
  'output_tokens',
  'cached_tokens',
  'prompt_cache_hit_tokens',
  'prompt_cache_miss_tokens',
];

let buffer: CaptureRecord[] = [];

function readPersisted(): CaptureRecord[] {
  try {
    const text = globalThis.localStorage?.getItem(CAPTURE_STORAGE_KEY);
    if (!text) return [];
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    const out: CaptureRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const stage = String((item as any).stage || '');
      if (!CAPTURE_STAGE_SET.has(stage)) continue;
      out.push({
        at: Number((item as any).at) || 0,
        stage: stage as CaptureStage,
        model: (item as any).model ? String((item as any).model) : undefined,
        requestId: (item as any).requestId ? String((item as any).requestId) : undefined,
        url: (item as any).url ? String((item as any).url) : undefined,
        streamed: typeof (item as any).streamed === 'boolean' ? (item as any).streamed : undefined,
        usageFound: typeof (item as any).usageFound === 'boolean' ? (item as any).usageFound : undefined,
        usageZero: typeof (item as any).usageZero === 'boolean' ? (item as any).usageZero : undefined,
        usage: (item as any).usage && typeof (item as any).usage === 'object' ? (item as any).usage : null,
        finishReason: (item as any).finishReason == null ? undefined : String((item as any).finishReason),
        reason: (item as any).reason ? String((item as any).reason) : undefined,
      });
    }
    return out.slice(-CAPTURE_MAX);
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    globalThis.localStorage?.setItem(CAPTURE_STORAGE_KEY, JSON.stringify(buffer));
  } catch {}
}

/** 只留下数字型用量字段，避免把整块 usage 塞进诊断包 */
export function usageNumbers(usage: any): Record<string, number> | null {
  if (!usage || typeof usage !== 'object') return null;
  const out: Record<string, number> = {};
  let any = false;
  for (const key of USAGE_KEYS) {
    const v = (usage as any)[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = v;
      any = true;
    }
  }
  const cached = (usage as any)?.prompt_tokens_details?.cached_tokens;
  if (typeof cached === 'number' && Number.isFinite(cached)) {
    out.cached_tokens = cached;
    any = true;
  }
  return any ? out : null;
}

/** usage 是否存在但三项计数全为 0（上游不计量时的典型表现） */
export function isZeroUsage(usage: any): boolean {
  const n = usageNumbers(usage);
  if (!n) return false;
  const keys = ['prompt_tokens', 'completion_tokens', 'total_tokens', 'input_tokens', 'output_tokens'];
  const present = keys.filter((k) => typeof n[k] === 'number');
  if (!present.length) return false;
  return present.every((k) => n[k] === 0);
}

function clipText(v: any, max: number): string {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v);
  return s.length > max ? s.slice(0, max) : s;
}

/** 记一条链路快照（永不抛错） */
export function noteCaptureStage(stage: CaptureStage, data: Omit<CaptureRecord, 'stage' | 'at'> & { at?: number } = {}): void {
  try {
    const rec: CaptureRecord = {
      at: typeof data.at === 'number' ? data.at : Date.now(),
      stage,
      model: data.model ? clipText(data.model, 120) : undefined,
      requestId: data.requestId ? clipText(data.requestId, 80) : undefined,
      url: data.url ? clipText(data.url, 200) : undefined,
      streamed: data.streamed === undefined ? undefined : data.streamed,
      usageFound: data.usageFound,
      usageZero: data.usageZero,
      usage: data.usage || null,
      finishReason: data.finishReason === undefined ? undefined : data.finishReason,
      reason: data.reason ? clipText(data.reason, 300) : undefined,
    };
    buffer.push(rec);
    if (buffer.length > CAPTURE_MAX) buffer = buffer.slice(-CAPTURE_MAX);
    persist();
  } catch {}
}

/** 最近的链路快照（按时间正序，最后一条最新） */
export function listCaptureStages(limit = CAPTURE_MAX): CaptureRecord[] {
  try {
    const n = Math.max(1, Math.min(CAPTURE_MAX, Math.floor(limit) || CAPTURE_MAX));
    // 页面刚重载时内存是空的，回落到落盘镜像，否则「几轮之前为什么没记进历史」永远查不到
    if (!buffer.length) buffer = readPersisted();
    return buffer.slice(-n).map((r) => ({ ...r }));
  } catch {
    return [];
  }
}

/** 诊断包里的 capture 段：最近若干条快照，已裁掉空字段 */
export function captureDigest(limit = CAPTURE_MAX): Array<Record<string, unknown>> {
  return listCaptureStages(limit).map((rec) => {
    const out: Record<string, unknown> = { at: rec.at, stage: rec.stage };
    if (rec.model) out.model = rec.model;
    if (rec.requestId) out.requestId = rec.requestId;
    if (rec.url) out.url = rec.url;
    if (rec.streamed !== undefined && rec.streamed !== null) out.streamed = rec.streamed;
    if (rec.usageFound !== undefined) out.usageFound = rec.usageFound;
    if (rec.usageZero !== undefined) out.usageZero = rec.usageZero;
    if (rec.usage) out.usage = rec.usage;
    if (rec.finishReason) out.finishReason = rec.finishReason;
    if (rec.reason) out.reason = rec.reason;
    return out;
  });
}

/** 清空快照（仅测试与调试用） */
export function clearCaptureStages(): void {
  buffer = [];
  try { globalThis.localStorage?.removeItem(CAPTURE_STORAGE_KEY); } catch {}
}
