import { state } from '../store/index';
import { WEBDAV_SYNC_FILE, WEBDAV_REMOTE_VERSION, MAX_HISTORY } from '../constants/pricing';
import { decryptKey, encryptKey } from '../utils/crypto';

const WEBDAV_PASS_KEY = 'ds_webdav_pass';

function b64(s: string) { try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); } }

function rawFetch() {
  try { const p: any = window.parent; return p?.fetch?.bind(p) ?? fetch.bind(window); } catch { return fetch.bind(window); }
}

function authHeader(): string {
  const cfg: any = state.settings.webdav || {};
  let pass = '';
  try { pass = decryptKey(localStorage.getItem('ds_' + WEBDAV_PASS_KEY) || ''); } catch {}
  try { const v = (globalThis as any).SillyTavern?.getContext?.().extensionSettings?.['api_usage_stat']?.webdavPass; if (v) pass = decryptKey(v); } catch {}
  return 'Basic ' + b64((cfg.username || '') + ':' + pass);
}
function realUrl(): string {
  const cfg: any = state.settings.webdav || {};
  const base = (cfg.url || '').trim().replace(/\/+$/, '');
  const path = (cfg.path || '').trim().replace(/^\/+|\/+$/g, '');
  let u = base + '/';
  if (path) u += path + '/';
  u += WEBDAV_SYNC_FILE;
  return u;
}
function reqUrl(u: string): string {
  const proxy = ((state.settings.webdav as any)?.proxy || '').trim();
  if (!proxy) return u;
  if (proxy.indexOf('?') !== -1) return proxy + encodeURIComponent(u);
  return proxy.replace(/\/+$/, '') + '/' + encodeURIComponent(u);
}
function dirs(): string[] {
  const cfg: any = state.settings.webdav || {};
  const base = (cfg.url || '').trim().replace(/\/+$/, '');
  const path = (cfg.path || '').trim().replace(/^\/+|\/+$/g, '');
  const out: string[] = [];
  if (path) { let acc = base; path.split('/').forEach((seg: string) => { if (seg) { acc += '/' + seg; out.push(acc); } }); }
  return out;
}

async function webdavGet(): Promise<any> {
  const url = reqUrl(realUrl());
  try {
    const r: any = await rawFetch()(url, { method: 'GET', headers: { Authorization: authHeader(), Accept: '*/*' } });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return { exists: true, error: true, status: r.status };
    const t = await r.text(); return { exists: true, text: t };
  } catch (e: any) { return { exists: false, netError: true, errName: e?.name || '', errMsg: e?.message || String(e) }; }
}
async function webdavMkcol(dir: string) {
  const url = reqUrl(dir);
  try { const r: any = await rawFetch()(url, { method: 'MKCOL', headers: { Authorization: authHeader() } }); return r.status === 201 || r.status === 405 || r.status === 409 || r.status === 204; } catch { return false; }
}
async function webdavPut(text: string) {
  for (const d of dirs()) await webdavMkcol(d);
  const url = reqUrl(realUrl());
  const r: any = await rawFetch()(url, { method: 'PUT', headers: { Authorization: authHeader(), 'Content-Type': 'application/json; charset=utf-8' }, body: text });
  if (!r.ok) throw new Error('上传失败 HTTP ' + r.status);
}

function buildLocalBundle(): any {
  const saves: any = {};
  for (const k of Object.keys(state.saves)) {
    const ns = JSON.parse(JSON.stringify((state.saves as any)[k] || {}));
    if (ns.history) for (const h of ns.history) { delete h.messages; delete h.fullRequest; delete h.fullResponse; }
    saves[k] = ns;
  }
  return { format: 'deepseek-stat-sync', version: WEBDAV_REMOTE_VERSION, syncedAt: Date.now(), data: { saves, currentSave: state.currentSave, balance: state.balance, customBalance: state.customBalance, settings: JSON.parse(JSON.stringify(state.settings)), messageCount: state.messageCount }, _ts: {} as any };
}

function mergeBundles(remote: any, local: any) {
  const rd = remote.data || {}, ld = local.data || {};
  let saves: any = {}; const keys: any = {};
  Object.keys(ld.saves || {}).forEach((k) => (keys[k] = 1));
  Object.keys(rd.saves || {}).forEach((k) => (keys[k] = 1));
  let pulled = 0, pushed = 0;
  for (const k of Object.keys(keys)) {
    const ls = ld.saves?.[k], rs = rd.saves?.[k];
    if (!rs) { saves[k] = JSON.parse(JSON.stringify(ls)); pushed += ls?.history?.length || 0; continue; }
    if (!ls) { saves[k] = JSON.parse(JSON.stringify(rs)); pulled += rs?.history?.length || 0; continue; }
    const lseen: any = {}, rseen: any = {};
    (ls.history || []).forEach((h: any) => { if (h?.timestamp !== undefined) lseen[h.timestamp] = true; });
    (rs.history || []).forEach((h: any) => { if (h?.timestamp !== undefined) rseen[h.timestamp] = true; });
    const hist: any[] = [];
    (rs.history || []).forEach((h: any) => { if (h?.timestamp !== undefined && !lseen[h.timestamp]) { pulled++; hist.push(h); } });
    (ls.history || []).forEach((h: any) => {
      if (!h || h.timestamp === undefined) return;
      if (!rseen[h.timestamp]) { pushed++; hist.push(h); }
      else { for (let i = 0; i < hist.length; i++) if (hist[i].timestamp === h.timestamp) { hist[i] = h; break; } }
    });
    hist.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
    const outHist = hist.length > MAX_HISTORY ? hist.slice(0, MAX_HISTORY) : hist;
    const lm = ls._mtime || ls.startTime || 0, rm = rs._mtime || rs.startTime || 0;
    const ns: any = {};
    ['name', 'character', 'customBalance', 'startTime', 'total_tokens', 'total_cost', 'input_tokens', 'output_tokens', 'cache_hit_tokens', 'cache_miss_tokens', 'input_cost', 'output_cost', 'rounds'].forEach((f) => {
      ns[f] = lm >= rm ? (ls[f] !== undefined ? ls[f] : rs[f]) : (rs[f] !== undefined ? rs[f] : ls[f]);
    });
    ns._mtime = Math.max(lm, rm); ns.history = outHist;
    [ls, rs].forEach((src: any) => { if (src) for (const f of Object.keys(src)) if (ns[f] === undefined) ns[f] = src[f]; });
    saves[k] = ns;
  }
  const data = { saves, currentSave: ld.currentSave ?? rd.currentSave, balance: ld.balance ?? rd.balance, customBalance: ld.customBalance ?? rd.customBalance, messageCount: ld.messageCount ?? rd.messageCount, settings: ld.settings ?? rd.settings };
  return { mergedData: data, pulled, pushed };
}

let syncing = false;
export async function doSyncNow() {
  if (syncing) return alert('同步进行中');
  const cfg: any = state.settings.webdav || {};
  if (!cfg.url || !cfg.username) return alert('请先在设置中填写 WebDAV 地址与用户名');
  if (!/^https:\/\//i.test(cfg.url)) return alert('WebDAV 地址必须为 https');
  syncing = true;
  const btn = (window.parent as any)?.document?.getElementById('aus-webdav-sync') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = '同步中…'; }
  const local = buildLocalBundle();
  try {
    const res: any = await webdavGet();
    if (res.netError) {
      const isCors = res.errName === 'TypeError' || /Failed to fetch|NetworkError|CORS/i.test(res.errMsg || '');
      throw new Error(isCors ? 'CORS 被拦截，请配置 CORS 代理' : '网络错误: ' + (res.errMsg || '未知'));
    }
    if (res.error) throw new Error('读取云端失败 HTTP ' + res.status);
    let merged: any;
    if (!res.exists) merged = { mergedData: local.data, pulled: 0, pushed: 0 };
    else {
      let remote: any; try { remote = JSON.parse(res.text); } catch { throw new Error('云端文件解析失败'); }
      if (remote.format !== 'deepseek-stat-sync') throw new Error('云端格式不符');
      if (remote.version > WEBDAV_REMOTE_VERSION) throw new Error('云端版本过高，请升级扩展');
      merged = mergeBundles(remote, local);
    }
    // 应用
    state.saves = merged.mergedData.saves || {};
    state.currentSave = merged.mergedData.currentSave;
    state.balance = merged.mergedData.balance;
    state.customBalance = merged.mergedData.customBalance;
    state.messageCount = merged.mergedData.messageCount || 0;
    if (merged.mergedData.settings) state.settings = merged.mergedData.settings as any;
    // 重算
    const { recalcAllCosts } = await import('./interception');
    recalcAllCosts();
    const { saveHot } = await import('../store/persistence');
    saveHot({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance, messageCount: state.messageCount });
    await webdavPut(JSON.stringify(buildLocalBundle()));
    alert(`同步完成${merged.pulled ? `（拉取 ${merged.pulled} 条）` : ''}${merged.pushed ? `（上传 ${merged.pushed} 条）` : ''}`);
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  } catch (e: any) {
    alert('同步失败: ' + (e?.message || e));
  } finally {
    syncing = false;
    if (btn) { btn.disabled = false; btn.textContent = '☁️ 立即同步'; }
  }
}

export function saveWebdavPass(pass: string) {
  try {
    localStorage.setItem('ds_ds_webdav_pass', encryptKey(pass));
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings['api_usage_stat'] = ctx.extensionSettings['api_usage_stat'] || {};
      ctx.extensionSettings['api_usage_stat'].webdavPass = encryptKey(pass);
      ctx.saveSettingsDebounced?.();
    }
  } catch {}
}
