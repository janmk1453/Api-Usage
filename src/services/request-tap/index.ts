/**
 * 请求探针（技术验证版）—— 装配与对账
 *
 * 对账口径（用户判断）：探针抓到的请求里，现有逻辑记过账的就是常规对话请求，
 * 没记过账的才是「非常规对话请求」。因此这里不改采集链路，只订阅既有的
 * DataEvents.HISTORY_ADDED 当账本，把探针记录标成 settled / orphan。
 */
import { DataEvents, on } from '../../data/events';
import { installTapCapture, uninstallTapCapture, tapDebugRecord } from './capture';
import { findEstimatedSettlement, findSettlement, probeKeyOf, type Settlement } from './match';
import { clearTapRecords, listTapRecords, patchTapRecord, updateTapRecords } from './store';
import { MIN_TAP_DURATION_MS, TAP_SCHEMA_VERSION, type TapRecord } from './types';

/** 入账窗口：酒馆 GENERATION_ENDED → 写库有延迟，留足时间再判定 */
export const RECONCILE_DELAY_MS = 12000;
/** 账本上限：只对账近期请求，更早的入账记录不再参与 */
const SETTLEMENT_MAX = 800;
const RECONCILE_INTERVAL_MS = 3000;

let settlements: Settlement[] = [];
const used = new Set<string>();
let reconcileTimer: any = null;
let unsubscribe: (() => void) | null = null;
let installed = false;

/** 把一条入账记录放进账本 */
export function noteSettlement(entry: any): void {
  try {
    if (!entry) return;
    const ts = Number(entry.timestamp) || Date.now();
    const id = String(entry.requestId || '') || 'auto:' + ts + ':' + settlements.length;
    settlements.push({
      id,
      // 入账侧 model 已归一（前缀留在 rawModel），探针侧是请求体原名；
      // 两侧都保留原值，由 findSettlement 的 normalizeModel 统一剥前缀后比较。
      model: String(entry.model || entry.rawModel || ''),
      prompt: Number(entry.prompt_tokens) || 0,
      completion: Number(entry.completion_tokens) || 0,
      total: Number(entry.total_tokens) || 0,
      ts,
      estimated: String(entry.usageSource || '') === 'estimated',
    });
    trimLedger();
  } catch {}
}

/**
 * 账本裁剪：settlements 只留最近 SETTLEMENT_MAX 条，同时把已经不在账本里的
 * consumed 标记一并丢掉——否则 used 会随运行时长无限增长（每个请求一个字符串）。
 */
function trimLedger(): void {
  if (settlements.length <= SETTLEMENT_MAX) return;
  settlements = settlements.slice(-SETTLEMENT_MAX);
  const alive = new Set(settlements.map((s) => s.id));
  for (const id of used) {
    if (!alive.has(id)) used.delete(id);
  }
}

/**
 * 扫描一次：到期的 pending 记录按「用量全等 → 总数相等 + 时间窗」对账。
 * 命中 → settled（现有逻辑已记过账，属常规对话请求，验证页默认不展示）；
 * 不命中 → orphan（现有逻辑没记过账，验证页重点看这些）。
 */
export function reconcilePending(now = Date.now()): void {
  let all: TapRecord[] = [];
  try { all = listTapRecords(); } catch { return; }
  for (const rec of all) {
    if (rec.state !== 'pending') continue;
    if (now - (rec.endedAt || rec.at) < RECONCILE_DELAY_MS) continue;
    let hit: { settlement: Settlement; by: string } | null = null;
    const probe = probeKeyOf({ model: rec.model, usage: rec.usage, at: rec.at, endedAt: rec.endedAt });
    if (rec.usage) {
      hit = findSettlement(probe, settlements, used);
    } else {
      // 探针没拿到用量 ≠ 没记账：上游不回 usage 的轮次会走本地估算补记，按模型+时间窗认账
      const est = findEstimatedSettlement(probe, settlements, used);
      if (est) hit = { settlement: est, by: 'estimated' };
    }
    if (hit) {
      used.add(hit.settlement.id);
      patchTapRecord(rec.id, { state: 'settled', settledBy: hit.by, settledAt: now });
    } else {
      // 过短请求单独标注：仍留在 orphan 里，但不参与「疑似正常对话没记账」的聚簇
      const durationMs = Number(rec.durationMs) || 0;
      const tooShort = durationMs > 0 && durationMs < MIN_TAP_DURATION_MS;
      patchTapRecord(rec.id, {
        state: 'orphan',
        settledBy: tooShort ? 'too-short' : rec.usage ? null : 'no-usage',
        settledAt: now,
      });
    }
  }
}

/**
 * 补齐账本：把已存历史（热 + IndexedDB 冷）也转成 settlement。
 *
 * 运行时账本只收本次会话的 HISTORY_ADDED，页面一刷新就空；旧版本遗留的孤儿探针因此
 * 永远等不到对应入账记录，只能一直挂着「没记进历史」。这里在启动后读一次全量历史，
 * 让重判有据可依（同一 timestamp+total 只入账一次，重复调用幂等）。
 */
export async function hydrateLedgerFromHistory(): Promise<number> {
  try {
    const mod: any = await import('../../store/persistence');
    const all = await mod.getAllHistory();
    if (!Array.isArray(all)) return settlements.length;
    const seen = new Set(settlements.map((s) => s.id));
    for (const e of all) {
      if (!e) continue;
      const ts = Number(e.timestamp) || 0;
      const total = Number(e.total_tokens) || 0;
      const id = String(e.requestId || '') || 'auto:' + ts + ':' + total;
      if (!ts || seen.has(id)) continue;
      seen.add(id);
      settlements.push({
        id,
        model: String(e.model || e.rawModel || ''),
        prompt: Number(e.prompt_tokens) || 0,
        completion: Number(e.completion_tokens) || 0,
        total,
        ts,
        estimated: String(e.usageSource || '') === 'estimated',
      });
    }
    trimLedger();
  } catch {}
  return settlements.length;
}

/**
 * 旧版本遗留孤儿探针的一次性重判。
 *
 * 旧版本的三个缺陷会留下永远消不掉的误报：模型名带方括号前缀导致对不上账、几毫秒的假探针
 * 被算成「疑似对话」、记录本身无法再复核。这些记录不会随时间自愈（reconcilePending 只管
 * pending），所以这里按新规则重判一遍：
 * - 能对上已存历史 → settled（本来就是常规对话，只是旧规则没认出来）
 * - 几毫秒的假探针 → too-short
 * - 仍对不上 → settledBy='legacy'，保留在验证页但不参与健康提示（旧数据无从复核，不再打扰）
 * 新版本写入的记录带 v=TAP_SCHEMA_VERSION，不走这里，照常按真实漏记提示。
 */
export function recheckLegacyOrphans(now = Date.now()): number {
  const usedByRecheck = new Set<string>();
  const version = TAP_SCHEMA_VERSION;
  return updateTapRecords((rec) => {
    if (!rec || rec.state !== 'orphan') return null;
    if (Number(rec.v) >= version) return null;
    if (String(rec.settledBy || '') === 'legacy') return null;
    const durationMs = Number(rec.durationMs) || 0;
    if (durationMs > 0 && durationMs < MIN_TAP_DURATION_MS) {
      return { ...rec, v: version, settledBy: 'too-short', settledAt: now };
    }
    const hit = rec.usage
      ? findSettlement(
          probeKeyOf({ model: rec.model, usage: rec.usage, at: rec.at, endedAt: rec.endedAt }),
          settlements,
          usedByRecheck,
        )
      : null;
    if (hit) {
      usedByRecheck.add(hit.settlement.id);
      return { ...rec, v: version, state: 'settled', settledBy: hit.by, settledAt: now };
    }
    return { ...rec, v: version, settledBy: 'legacy', settledAt: now };
  });
}

let legacyRecheckDone = false;

/** 等历史可读后跑一次重判；历史还没 hydrate 出来就退避重试 */
async function runLegacyRecheck(attempt = 0): Promise<void> {
  if (legacyRecheckDone) return;
  const count = await hydrateLedgerFromHistory();
  if (!count && attempt < 3) {
    setTimeout(() => { void runLegacyRecheck(attempt + 1); }, 4000);
    return;
  }
  if (legacyRecheckDone) return;
  legacyRecheckDone = true;
  try { recheckLegacyOrphans(); } catch {}
}

/** 供验证页显示的诊断信息（只读） */
export function tapDiagnostics(): { settlements: number; consumed: number } {
  return { settlements: settlements.length, consumed: used.size };
}

/** 安装探针：采集 + 对账（幂等，与现有 interception 采集完全并行、互不调用） */
export function installRequestTap(): void {
  if (installed) return;
  installed = true;
  try { installTapCapture(); } catch {}
  try { unsubscribe = on(DataEvents.HISTORY_ADDED, (entry: any) => { noteSettlement(entry); }); } catch { unsubscribe = null; }
  reconcileTimer = setInterval(() => { try { reconcilePending(); } catch {} }, RECONCILE_INTERVAL_MS);
  // 旧版本留下的误报：等历史可读后重判一次（对得上账的标 settled、几毫秒假探针标 too-short、其余标 legacy）
  void runLegacyRecheck();
  // 验证期调试口子：真机上不用真触发插件请求，也能造一条记录看看页面表现
  try {
    (globalThis as any).__ausTap = {
      install: installRequestTap,
      uninstall: uninstallRequestTap,
      reconcile: reconcilePending,
      recheckLegacy: recheckLegacyOrphans,
      hydrateLedger: hydrateLedgerFromHistory,
      note: noteSettlement,
      diagnostics: tapDiagnostics,
      record: tapDebugRecord,
      list: listTapRecords,
      clear: clearTapRecords,
    };
  } catch {}
}

/** 卸载探针（还原被包过的 fetch / XHR，停掉对账定时器） */
export function uninstallRequestTap(): void {
  if (!installed) return;
  installed = false;
  try { if (reconcileTimer) clearInterval(reconcileTimer); } catch {}
  reconcileTimer = null;
  try { unsubscribe?.(); } catch {}
  unsubscribe = null;
  try { uninstallTapCapture(); } catch {}
  try { delete (globalThis as any).__ausTap; } catch {}
}
