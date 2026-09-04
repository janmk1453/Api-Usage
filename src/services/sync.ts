import { state } from '../store/index';
import { WEBDAV_SYNC_FILE, WEBDAV_REMOTE_VERSION, MAX_HISTORY } from '../constants/pricing';
import { decryptKey, encryptKey } from '../utils/crypto';
import { repository } from '../data/repository';
import { isUnsafeKey } from '../utils/date';

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
  try {
    const r: any = await rawFetch()(url, { method: 'MKCOL', headers: { Authorization: authHeader() } });
    if (r.status === 201 || r.status === 405 || r.status === 204) return true;
    if (r.status === 409) return false; // 父目录不存在，提示用户检查路径
    return false;
  } catch { return false; }
}
async function webdavPut(text: string) {
  for (const d of dirs()) await webdavMkcol(d);
  const url = reqUrl(realUrl());
  const r: any = await rawFetch()(url, { method: 'PUT', headers: { Authorization: authHeader(), 'Content-Type': 'application/json; charset=utf-8' }, body: text });
  if (!r.ok) throw new Error('上传失败 HTTP ' + r.status);
}

function stripHistory(history: any[]) {
  return history.filter((h: any) => h && (h as any)._debug !== true).map((h: any) => { const c = { ...h }; delete c.messages; delete c.fullRequest; delete c.fullResponse; return c; });
}

function buildLocalBundle(): any {
  return {
    format: 'deepseek-stat-sync',
    version: WEBDAV_REMOTE_VERSION,
    syncedAt: Date.now(),
    data: {
      history: stripHistory(state.history),
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
      settings: JSON.parse(JSON.stringify(state.settings)),
      messageCount: state.messageCount,
    },
    _ts: {} as any,
  };
}

function mergeBundles(remote: any, local: any) {
  const rd = remote.data || {}, ld = local.data || {};
  // 兼容旧 saves 结构：转单一历史
  const toHistory = (d: any): any[] => {
    if (Array.isArray(d.history)) return d.history;
    if (d.saves && typeof d.saves === 'object') {
      let arr: any[] = [];
      for (const s of Object.values(d.saves as any)) arr = arr.concat((s as any).history || []);
      return arr;
    }
    return [];
  };
  // 清洗原型污染
  const clean = (arr: any[]) => arr.map((e:any)=>{ if(e&&typeof e==='object') for(const k of Object.keys(e)) if(isUnsafeKey(k)) delete e[k]; return e; });
  const lh = clean(toHistory(ld)), rh = clean(toHistory(rd));
  const keyOf = (h:any)=> `${h.timestamp}|${h.model||''}|${h.total_tokens||0}`;
  const lseen = new Set(lh.map((h: any) => keyOf(h)));
  const rseen = new Set(rh.map((h: any) => keyOf(h)));
  let pulled = 0, pushed = 0;
  const merged: any[] = [...rh.filter((h: any) => { if (!lseen.has(keyOf(h))) { pulled++; return true; } return false }), ...lh.filter((h: any) => { if (!rseen.has(keyOf(h))) { pushed++; return true; } return false }), ...lh.filter((h: any) => rseen.has(keyOf(h)))];
  // 去重并保留本地更完整条目（已通过上式实现），排序；截断由 repository.replaceAll 统一处理溢出进冷
  const dedup = new Map<string, any>();
  for (const h of merged) dedup.set(keyOf(h), h);
  let hist = Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp);
  // 重新聚合（以本地为准，远程仅补历史）
  const data = {
    history: hist,
    total_tokens: ld.total_tokens ?? rd.total_tokens ?? hist.reduce((a: number, h: any) => a + (h.total_tokens || 0), 0),
    total_cost: ld.total_cost ?? rd.total_cost ?? hist.reduce((a: number, h: any) => a + (h.cost || 0), 0),
    input_tokens: ld.input_tokens ?? rd.input_tokens ?? 0,
    output_tokens: ld.output_tokens ?? rd.output_tokens ?? 0,
    cache_hit_tokens: ld.cache_hit_tokens ?? rd.cache_hit_tokens ?? 0,
    cache_miss_tokens: ld.cache_miss_tokens ?? rd.cache_miss_tokens ?? 0,
    input_cost: ld.input_cost ?? rd.input_cost ?? 0,
    output_cost: ld.output_cost ?? rd.output_cost ?? 0,
    rounds: ld.rounds ?? rd.rounds ?? hist.length,
    startTime: ld.startTime ?? rd.startTime ?? Date.now(),
    balance: ld.balance ?? rd.balance,
    customBalance: ld.customBalance ?? rd.customBalance,
    messageCount: ld.messageCount ?? rd.messageCount,
    settings: ld.settings ?? rd.settings,
  };
  return { mergedData: data, pulled, pushed };
}

let syncing = false;
export async function doSyncNow() {
  if (syncing) return alert('同步进行中');
  const cfg: any = state.settings.webdav || {};
  if (!cfg.url || !cfg.username) return alert('请先在设置中填写 WebDAV 地址与用户名');
  if (!/^https:\/\//i.test(cfg.url)) return alert('WebDAV 地址必须为 https');
  const proxy = (cfg.proxy || '').trim();
  if (proxy && !/^https:\/\//i.test(proxy)) {
    if (!confirm('CORS 代理非 https，WebDAV 用户名密码将以可被截获的方式经该代理传输。\n仍要继续？')) return;
  }
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
    repository.replaceAll(merged.mergedData as any);
    repository.recalcAll();
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
