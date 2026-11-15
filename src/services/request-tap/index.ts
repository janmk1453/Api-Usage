/**
 * 请求探针（技术验证版）—— 装配与对账
 *
 * 对账口径（用户判断）：探针抓到的请求里，现有逻辑记过账的就是常规对话请求，
 * 没记过账的才是「非常规对话请求」。因此这里不改采集链路，只订阅既有的
 * DataEvents.HISTORY_ADDED 当账本，把探针记录标成 settled / orphan。
 */
import { DataEvents, on } from '../../data/events';
import { installTapCapture, uninstallTapCapture, tapDebugRecord } from './capture';
import { findSettlement, probeKeyOf, type Settlement } from './match';
import { clearTapRecords, listTapRecords, patchTapRecord } from './store';
import type { TapRecord } from './types';

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
      model: String(entry.model || ''),
      prompt: Number(entry.prompt_tokens) || 0,
      completion: Number(entry.completion_tokens) || 0,
      total: Number(entry.total_tokens) || 0,
      ts,
    });
    if (settlements.length > SETTLEMENT_MAX) settlements = settlements.slice(-SETTLEMENT_MAX);
  } catch {}
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
    if (rec.usage) {
      hit = findSettlement(
        probeKeyOf({ model: rec.model, usage: rec.usage, at: rec.at, endedAt: rec.endedAt }),
        settlements,
        used,
      );
    }
    if (hit) {
      used.add(hit.settlement.id);
      patchTapRecord(rec.id, { state: 'settled', settledBy: hit.by, settledAt: now });
    } else {
      patchTapRecord(rec.id, { state: 'orphan', settledBy: rec.usage ? null : 'no-usage', settledAt: now });
    }
  }
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
  // 验证期调试口子：真机上不用真触发插件请求，也能造一条记录看看页面表现
  try {
    (globalThis as any).__ausTap = {
      install: installRequestTap,
      uninstall: uninstallRequestTap,
      reconcile: reconcilePending,
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
}
