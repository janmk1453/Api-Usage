import { state } from '../store/index';
import { EXPORT_FORMAT_VERSION, MAX_HISTORY } from '../constants/pricing';
import { recalcAllCosts } from './interception';
import { saveHot } from '../store/persistence';

function isUnsafeKey(k: string) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }

function stripDetails(saves: any) {
  const out = JSON.parse(JSON.stringify(saves || {}));
  for (const k of Object.keys(out)) {
    const sv: any = out[k];
    if (sv?.history) for (const h of sv.history) { delete h.messages; delete h.fullRequest; delete h.fullResponse; }
  }
  return out;
}

export function exportHistory() {
  const doc = (window.parent as any)?.document ?? document;
  const d = new Date();
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const payload = {
    format: 'deepseek-stat-export' as const,
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '3.0.0',
    data: {
      saves: stripDetails(state.saves),
      currentSave: state.currentSave,
      balance: state.balance,
      customBalance: state.customBalance,
      settings: JSON.parse(JSON.stringify(state.settings)),
      messageCount: state.messageCount,
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
  if (!d.saves || typeof d.saves !== 'object') d.saves = {};
  const saves: any = {}; let skipped = { saves: 0, entries: 0 };
  for (const k of Object.keys(d.saves)) {
    if (isUnsafeKey(k)) continue;
    const s = d.saves[k];
    if (!s || typeof s !== 'object') { skipped.saves++; continue; }
    const ns: any = { name: s.name || k, character: s.character ?? '', customBalance: s.customBalance ?? null };
    if (s.startTime !== undefined) ns.startTime = s.startTime;
    const hs: any[] = [];
    if (Array.isArray(s.history)) for (const h of s.history) {
      if (!h || typeof h !== 'object' || h.timestamp === undefined || isNaN(h.timestamp)) { skipped.entries++; continue; }
      const nh: any = { timestamp: h.timestamp, model: h.model || 'unknown', prompt_tokens: h.prompt_tokens || 0, cache_hit_tokens: h.cache_hit_tokens || 0, cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0, total_tokens: h.total_tokens || 0, priceType: h.priceType || 'old' };
      for (const f of Object.keys(h)) { if (isUnsafeKey(f)) continue; if (nh[f] === undefined) nh[f] = h[f]; }
      hs.push(nh);
    }
    ns.history = hs;
    for (const f of Object.keys(s)) { if (isUnsafeKey(f) || f === 'history') continue; if (ns[f] === undefined) ns[f] = s[f]; }
    saves[k] = ns;
  }
  d.saves = saves;
  return { data: d, skipped } as any;
}

export function applyImportedData(d: any, mode: 'overwrite' | 'merge') {
  for (const k of Object.keys(d.saves || {})) {
    if (isUnsafeKey(k)) continue;
    const s = d.saves[k];
    if (!s) continue;
    s.name = s.name || k;
    if (s.character === undefined) s.character = '';
    if (s.customBalance === undefined) s.customBalance = null;
    s.history = Array.isArray(s.history) ? s.history : [];
    s.history.forEach((h: any) => { if (h && h.priceType === undefined) h.priceType = 'old'; });
  }
  if (mode === 'overwrite') {
    state.saves = d.saves || {};
    state.currentSave = d.currentSave && (d.saves as any)[d.currentSave] ? d.currentSave : null;
    if (d.balance !== undefined) state.balance = d.balance;
    if (d.customBalance !== undefined) state.customBalance = d.customBalance;
    if (d.settings) state.settings = d.settings;
    if (d.messageCount !== undefined) state.messageCount = d.messageCount;
  } else {
    for (const k of Object.keys(d.saves || {})) {
      if (isUnsafeKey(k)) continue;
      const s = d.saves[k];
      if (!state.saves[k]) state.saves[k] = s;
      else {
        const seen: any = {};
        (state.saves[k].history || []).forEach((h: any) => { if (h) seen[h.timestamp] = true; });
        (s.history || []).forEach((h: any) => { if (h && !seen[h.timestamp]) { seen[h.timestamp] = true; state.saves[k].history.push(h); } });
        state.saves[k].history.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
        if (state.saves[k].history.length > MAX_HISTORY) state.saves[k].history = state.saves[k].history.slice(0, MAX_HISTORY);
      }
    }
  }
  if (!state.currentSave || !state.saves[state.currentSave as string]) {
    const keys = Object.keys(state.saves);
    state.currentSave = keys.length ? keys[0] : null;
  }
  recalcAllCosts();
  saveHot({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance, messageCount: state.messageCount });
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
        const mode = confirm('确定导入？\n确定=覆盖导入（替换全部）\n取消=合并导入（按时间戳去重）\n（合并更安全）') ? 'overwrite' : 'merge';
        if (mode === 'overwrite' && !confirm('覆盖将替换全部数据，确定？')) return;
        applyImportedData(res.data, mode as any);
        alert(mode === 'overwrite' ? '已覆盖导入' : '已合并导入');
      };
      reader.readAsText(file, 'utf-8');
    });
    inputEl = el as HTMLInputElement;
  }
  inputEl!.click();
}
