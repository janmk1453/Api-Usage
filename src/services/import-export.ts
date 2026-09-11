import { state } from '../store/index';
import { EXPORT_FORMAT_VERSION } from '../constants/pricing';
import { repository } from '../data/repository';
import { isDeepSeekOfficialModel } from './pricing';
import { mergeWalletCollections } from '../data/wallets';
import { historyRecordKey } from '../utils/history-key';

declare const __APP_VERSION__: string;

function isUnsafeKey(k: string) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }

function stripHistory(history: any[]) {
  return history.filter((h: any) => h && (h as any)._debug !== true).map((h: any) => {
    const c = { ...h };
    delete c.messages; delete c.fullRequest; delete c.fullResponse;
    return c;
  });
}

export async function exportHistory() {
  const doc = (window.parent as any)?.document ?? document;
  const d = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const safeSettings: any = JSON.parse(JSON.stringify(state.settings || {}));
  if (safeSettings.webdav) safeSettings.webdav = { url: '', username: '', path: '', proxy: '' };
  const _appVer: string = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.0.0') as string;
  // 含冷库全量：热 history + IndexedDB cold_history 合并去重（热溢出转冷后导出不再丢失旧记录）
  let fullHist: any[] = [];
  try { fullHist = await repository.getAllHistory(); } catch { fullHist = state.history || []; }
  const payload = {
    format: 'deepseek-stat-export' as const,
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: _appVer,
    scope: 'full' as const,
    walletFormat: 2,
    data: {
      history: stripHistory(fullHist),
      total_tokens: state.total_tokens,
      total_cost: state.total_cost,
      input_tokens: state.input_tokens,
      output_tokens: state.output_tokens,
      cache_hit_tokens: state.cache_hit_tokens,
      cache_miss_tokens: state.cache_miss_tokens,
      input_cost: state.input_cost,
      output_cost: state.output_cost,
      rounds: state.rounds,
      startTime: state.startTime,
      balance: state.balance,
      customBalance: state.customBalance,
      wallets: state.wallets,
      walletIgnored: state.walletIgnored,
      settings: safeSettings,
      messageCount: state.messageCount,
      // 兼容旧多存档导入：额外提供 saves 包装（同样全量）
      saves: { default: { name: 'default', history: stripHistory(fullHist), total_tokens: state.total_tokens, total_cost: state.total_cost, input_tokens: state.input_tokens, output_tokens: state.output_tokens, cache_hit_tokens: state.cache_hit_tokens, cache_miss_tokens: state.cache_miss_tokens, input_cost: state.input_cost, output_cost: state.output_cost, rounds: state.rounds, startTime: state.startTime } },
      currentSave: 'default',
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = `API用量统计_导出_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
  doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 1000);
}

export function normalizeImportData(raw: any): { data?: any; error?: string; skipped?: any } {
  let version = raw.version ?? 1;
  if (typeof version !== 'number' || isNaN(version) || version < 1) version = 1;
  if (version > EXPORT_FORMAT_VERSION) return { error: `文件版本 v${version} 高于当前 v${EXPORT_FORMAT_VERSION}，请升级扩展` };
  const d = raw.data;
  if (!d || typeof d !== 'object') return { error: '文件中缺少数据' };
  // 兼容旧 saves / 新 history
  let history: any[] = [];
  if (Array.isArray(d.history)) history = d.history;
  else if (d.saves && typeof d.saves === 'object') {
    for (const s of Object.values(d.saves as any)) {
      const h = (s as any).history || [];
      history = history.concat(h);
    }
  }
  const cleaned: any[] = [];
  let skipped = 0;
  for (const h of history) {
    if (!h || typeof h !== 'object' || h.timestamp === undefined || isNaN(h.timestamp)) { skipped++; continue; }
    const nh: any = { timestamp: h.timestamp, model: h.model || 'unknown', prompt_tokens: h.prompt_tokens || 0, cache_hit_tokens: h.cache_hit_tokens || 0, cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0, total_tokens: h.total_tokens || 0, priceType: h.priceType || 'old' };
    const SKIP_IMPORT = new Set(['messages', 'fullRequest', 'fullResponse', 'raw_usage']);
    for (const f of Object.keys(h)) { if (isUnsafeKey(f) || SKIP_IMPORT.has(f)) continue; if (nh[f] === undefined) nh[f] = h[f]; }
    cleaned.push(nh);
  }
  cleaned.sort((a, b) => b.timestamp - a.timestamp);
  return { data: { history: cleaned, balance: d.balance, customBalance: d.customBalance, wallets: Array.isArray(d.wallets) ? d.wallets : undefined, walletIgnored: Array.isArray(d.walletIgnored) ? d.walletIgnored : undefined, settings: d.settings, messageCount: d.messageCount, total_tokens: d.total_tokens, total_cost: d.total_cost, input_tokens: d.input_tokens, output_tokens: d.output_tokens, cache_hit_tokens: d.cache_hit_tokens, cache_miss_tokens: d.cache_miss_tokens, input_cost: d.input_cost, output_cost: d.output_cost, rounds: d.rounds, startTime: d.startTime }, skipped: { entries: skipped } } as any;
}

export function applyImportedData(d: any, mode: 'overwrite' | 'merge') {
  let addedOfficial = 0;
  if (mode === 'overwrite') {
    repository.replaceAll({
      history: (d.history || []),
      total_tokens: d.total_tokens ?? (d.history || []).reduce((a: number, h: any) => a + (h.total_tokens || 0), 0),
      total_cost: d.total_cost ?? (d.history || []).reduce((a: number, h: any) => a + (h.cost || 0), 0),
      input_tokens: d.input_tokens ?? 0,
      output_tokens: d.output_tokens ?? 0,
      cache_hit_tokens: d.cache_hit_tokens ?? 0,
      cache_miss_tokens: d.cache_miss_tokens ?? 0,
      input_cost: d.input_cost ?? 0,
      output_cost: d.output_cost ?? 0,
      rounds: d.rounds ?? d.history?.length ?? 0,
      startTime: d.startTime ?? Date.now(),
      balance: d.balance,
      customBalance: d.customBalance,
      wallets: d.wallets,
      walletIgnored: d.walletIgnored,
      settings: d.settings,
      messageCount: d.messageCount,
    } as any);
  } else {
    // 合并：按记录身份去重，避免同一毫秒的跨钱包记录被误删
    const seen = new Set((state.history || []).map((h: any) => historyRecordKey(h)));
    const toAdd: any[] = [];
    for (const h of d.history || []) {
      const key = historyRecordKey(h);
      if (!seen.has(key)) { seen.add(key); toAdd.push(h); }
    }
    const merged = [...toAdd, ...state.history].sort((a: any, b: any) => b.timestamp - a.timestamp);
    // 合并时不覆盖余额/设置
    repository.replaceAll({ history: merged } as any);
    if (Array.isArray(d.wallets)) {
      repository.replaceAll({
        wallets: mergeWalletCollections(repository.getWallets(), d.wallets),
        walletIgnored: Array.from(new Set([...(state.walletIgnored || []), ...(d.walletIgnored || [])])),
      } as any);
    }
    // 合并新增的官方模型轮次（addEntry 口径：仅 deepseek 官方模型计轮）
    for (const h of toAdd) { try { if (isDeepSeekOfficialModel(h.model)) addedOfficial++; } catch {} }
  }
  // 导入后按当前价格段重算每条费用，再按历史重算累计聚合（修复合并后累计不变、跨规则导入费用失真）
  try { repository.recalcAll(); } catch {}
  try {
    let tt = 0, tc = 0, it = 0, ot = 0, ch = 0, cm = 0, ic = 0, oc = 0;
    for (const h of state.history || []) {
      tt += h.total_tokens || 0; tc += h.cost || 0;
      it += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0); ot += h.completion_tokens || 0;
      ch += h.cache_hit_tokens || 0; cm += h.cache_miss_tokens || 0;
      ic += h.input_cost || 0; oc += h.output_cost || 0;
    }
    const patch: any = { total_tokens: tt, total_cost: tc, input_tokens: it, output_tokens: ot, cache_hit_tokens: ch, cache_miss_tokens: cm, input_cost: ic, output_cost: oc };
    if (mode === 'merge') patch.rounds = (state.rounds || 0) + addedOfficial;
    repository.replaceAll(patch);
  } catch {}
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}

export function bindImportExport(doc: Document) {
  const exp = doc.getElementById('aus-btn-export') as HTMLButtonElement | null;
  if (exp) exp.onclick = () => exportHistory();
  const imp = doc.getElementById('aus-btn-import') as HTMLButtonElement | null;
  if (imp) imp.onclick = () => triggerImport();
}

function triggerImport() {
  const doc = (window.parent as any)?.document ?? document;
  let inputEl = doc.getElementById('aus-import-file') as HTMLInputElement | null;
  if (!inputEl) {
    const el = doc.createElement('input');
    el.type = 'file'; el.id = 'aus-import-file'; el.accept = '.json,application/json'; (el as HTMLElement).style.display = 'none';
    doc.body.appendChild(el);
    el.addEventListener('change', () => {
      const inp = el as HTMLInputElement;
      const file = inp.files?.[0]; inp.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let raw: any = null;
        try { raw = JSON.parse(reader.result as string); } catch {}
        if (!raw || raw.format !== 'deepseek-stat-export') return alert('导入失败：文件格式不正确');
        const res: any = normalizeImportData(raw);
        if (res.error) return alert('导入失败：' + res.error);
        const merge = confirm('导入方式：\n确定 = 合并导入（推荐，按时间戳去重）\n取消 = 覆盖导入（替换全部数据）');
        const mode = merge ? 'merge' : 'overwrite';
        if (mode === 'overwrite' && !confirm('覆盖将删除现有全部统计并无法恢复，确定要覆盖？')) return;
        applyImportedData(res.data, mode as any);
        alert(mode === 'overwrite' ? '已覆盖导入' : '已合并导入');
      };
      reader.readAsText(file, 'utf-8');
    });
    inputEl = el as HTMLInputElement;
  }
  inputEl!.click();
}
