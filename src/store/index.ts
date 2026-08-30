import { defaultSettings, type Settings } from '../types/settings';
import type { Save } from '../types/save';
import { MAX_HISTORY, DETAIL_KEEP } from '../constants/pricing';

export type State = {
  currentSave: string | '__all__' | null;
  saves: Record<string, Save>;
  lastUsage: any;
  settings: Settings;
  balance: any;
  customBalance: string | null;
  messageCount: number;
  overviewModel: string;
  chartModel: string;
};

export const state: State = {
  currentSave: null,
  saves: {},
  lastUsage: null,
  settings: defaultSettings(),
  balance: null,
  customBalance: null,
  messageCount: 0,
  overviewModel: '__all__',
  chartModel: '__all__',
};

export function getSelectedSave(): Save | null {
  if (state.currentSave === '__all__') return getMergedStats() as any;
  return (state.currentSave && state.saves[state.currentSave]) || null;
}

export function getMergedStats() {
  const m: any = {
    total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0,
    cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0,
    history: [], startTime: Date.now(),
  };
  let ah: any[] = [];
  let es = Date.now();
  for (const k of Object.keys(state.saves)) {
    const s: any = state.saves[k];
    m.total_tokens += s.total_tokens || 0;
    m.total_cost += s.total_cost || 0;
    m.input_tokens += s.input_tokens || 0;
    m.output_tokens += s.output_tokens || 0;
    m.cache_hit_tokens += s.cache_hit_tokens || 0;
    m.cache_miss_tokens += s.cache_miss_tokens || 0;
    m.input_cost += s.input_cost || 0;
    m.output_cost += s.output_cost || 0;
    m.rounds += s.rounds || 0;
    if (s.startTime && s.startTime < es) es = s.startTime;
    ah = ah.concat(s.history || []);
  }
  m.startTime = es;
  ah.sort((a: any, b: any) => b.timestamp - a.timestamp);
  m.history = ah.slice(0, MAX_HISTORY);
  return m;
}

export function pruneHistoryDetails() {
  for (const k of Object.keys(state.saves)) {
    const s = state.saves[k];
    if (!s?.history || s.history.length <= DETAIL_KEEP) continue;
    const hs = [...s.history].sort((a, b) => b.timestamp - a.timestamp);
    for (let i = DETAIL_KEEP; i < hs.length; i++) {
      delete (hs[i] as any).messages;
      delete (hs[i] as any).fullRequest;
      delete (hs[i] as any).fullResponse;
    }
  }
}

export function createNewSave(): string {
  let cn = '';
  try { cn = (globalThis as any).SillyTavern?.getContext?.().name2 || ''; } catch {}
  const n = new Date();
  const key = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}_${String(n.getHours()).padStart(2, '0')}${String(n.getMinutes()).padStart(2, '0')}${String(n.getSeconds()).padStart(2, '0')}_${cn || 'unknown'}`;
  state.saves[key] = {
    name: key, character: cn, startTime: n.getTime(), _mtime: n.getTime(),
    total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0,
    cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, history: [],
  };
  state.currentSave = key;
  return key;
}

export function deleteSave(key: string) {
  delete state.saves[key];
  if (state.currentSave === key) {
    const keys = Object.keys(state.saves);
    state.currentSave = keys.length ? keys[0] : null;
    if (!state.currentSave) createNewSave();
  }
}

export function calculateRemainingRounds(stats?: any): number | null {
  const bal = state.customBalance !== null && state.customBalance !== ''
    ? parseFloat(state.customBalance)
    : state.balance?.balance ? parseFloat(state.balance.balance) : null;
  if (bal === null || isNaN(bal)) return null;
  const s = stats || getSelectedSave();
  if (!s) return null;
  const history = (s.history || []).filter((h: any) => typeof h.model === 'string' && h.model.toLowerCase().indexOf('deepseek') === 0);
  if (!history.length) return null;
  const alpha = 0.3;
  let ewma = history[history.length - 1].cost || 0;
  for (let i = history.length - 2; i >= 0; i--) ewma = alpha * (history[i].cost || 0) + (1 - alpha) * ewma;
  if (ewma <= 0) return null;
  return Math.floor(bal / ewma);
}
