/**
 * 临时诊断日志（用于排查“API 调用未被记录”问题）
 *
 * 背景：酒馆 1.19 的聊天补全前端不会把服务端 usage 写进消息 extra，
 * 扩展只能靠自己 hook window.fetch、读取 /api/backends/chat-completions/generate
 * 的响应流来获取用量。若上游流式响应里没有 usage，扩展就无从记录。
 * 因此这里把关键节点（安装、命中、流式解析、GENERATION_ENDED、写入）全部打点，
 * 便于在用户环境一次性定位断点。
 *
 * - 默认开启，控制台前缀 [DS-DIAG]
 * - 关闭方式：localStorage.setItem('ds_diag', '0') 后刷新
 * - 导出方式：控制台执行 ApiUsageStat.dumpDiag()
 */

const PREFIX = '[DS-DIAG]';
const MAX_ITEMS = 400;
const MAX_STRING = 600;
const MAX_KEYS = 24;

export interface DiagItem {
  t: number;
  event: string;
  data?: unknown;
}

const items: DiagItem[] = [];
let sequence = 0;

function isEnabled(): boolean {
  try {
    return localStorage.getItem('ds_diag') !== '0';
  } catch {
    return true;
  }
}

function clip(value: any, depth = 0): any {
  if (value == null) return value;
  const type = typeof value;
  if (type === 'string') {
    const text = value as string;
    return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING)}…(共${text.length}字)` : text;
  }
  if (type === 'number' || type === 'boolean') return value;
  if (type !== 'object') return String(value);
  if (depth >= 3) return '[层级过深]';
  if (Array.isArray(value)) {
    const list = value.slice(0, 12).map((v) => clip(v, depth + 1));
    if (value.length > 12) list.push(`…(共${value.length}项)` as any);
    return list;
  }
  const out: any = {};
  let count = 0;
  for (const key of Object.keys(value)) {
    if (count++ >= MAX_KEYS) {
      out['…'] = '字段已截断';
      break;
    }
    try {
      out[key] = clip((value as any)[key], depth + 1);
    } catch {
      out[key] = '[不可读取]';
    }
  }
  return out;
}

/** 记录一条诊断日志（同步输出到控制台并留在内存环形缓冲里） */
export function diag(event: string, data?: any): void {
  if (!isEnabled()) return;
  let payload: any;
  try {
    payload = clip(data);
  } catch {
    payload = '[数据无法序列化]';
  }
  items.push({ t: Date.now(), event, data: payload });
  if (items.length > MAX_ITEMS) items.splice(0, items.length - MAX_ITEMS);
  try {
    console.log(PREFIX, `#${++sequence}`, event, payload === undefined ? '' : payload);
  } catch {}
}

/** 取出内存中的诊断日志（供用户复制回传） */
export function dumpDiag(): DiagItem[] {
  return items.slice();
}

/** 清空内存诊断日志 */
export function clearDiag(): void {
  items.length = 0;
}

/** 当前是否启用诊断日志 */
export function diagEnabled(): boolean {
  return isEnabled();
}
