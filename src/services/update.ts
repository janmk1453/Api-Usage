import { toast, log } from '../utils/logger';

declare const __APP_VERSION__: string;
const CURRENT_VERSION: string = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3.0.0') as string;
const REPO = 'janmk1453/Api-Usage';
const REMOTE_MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
const EXTENSION_FOLDER = 'Api-Usage';
const INTERVAL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 5 * 1000;
const LOCAL_TIMEOUT_MS = 15000;
const LAST_CHECK_KEY = 'aus_update_last_check';
const LAST_NOTIFIED_KEY = 'aus_update_last_notified_version';

function getParentFetch(): typeof fetch {
  try {
    const p: any = window.parent;
    if (p?.fetch) return p.fetch.bind(p);
  } catch {}
  return fetch.bind(window);
}

function shortSha(s: string): string {
  return (s || '').slice(0, 7);
}

function parseVersion(v: string): number[] {
  return String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
}
function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

function getStoredLastCheck(): number {
  try { return parseInt(localStorage.getItem(LAST_CHECK_KEY) || '0', 10) || 0; } catch { return 0; }
}
function setStoredLastCheck(t: number) {
  try { localStorage.setItem(LAST_CHECK_KEY, String(t)); } catch {}
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings['api_usage_stat'] = ctx.extensionSettings['api_usage_stat'] || {};
      ctx.extensionSettings['api_usage_stat']._updateLastCheck = t;
      ctx.saveSettingsDebounced?.();
    }
  } catch {}
}
function getLastNotified(): string {
  try { return localStorage.getItem(LAST_NOTIFIED_KEY) || ''; } catch { return ''; }
}
function setLastNotified(v: string) {
  try { localStorage.setItem(LAST_NOTIFIED_KEY, v); } catch {}
}

// 通过 ST 扩展管理 API 获取扩展目录当前提交哈希（服务端会 git fetch origin）
async function fetchLocalCommit(): Promise<{ sha: string; branch: string } | null> {
  const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
  if (!ctx?.getRequestHeaders) return null;
  let headers: any;
  try { headers = ctx.getRequestHeaders(); } catch { headers = { 'Content-Type': 'application/json' }; }
  const rf = getParentFetch();
  for (const isGlobal of [false, true]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch {} }, LOCAL_TIMEOUT_MS);
    try {
      const resp: any = await rf('/api/extensions/version', {
        method: 'POST',
        headers,
        body: JSON.stringify({ extensionName: EXTENSION_FOLDER, global: isGlobal }),
        signal: ctrl.signal,
      } as any);
      clearTimeout(timer);
      if (resp?.ok) {
        const data = await resp.json();
        const sha = String(data?.currentCommitHash || '').trim();
        if (sha) return { sha, branch: String(data?.currentBranchName || '') };
      }
    } catch { clearTimeout(timer); }
  }
  return null;
}

// 用 GitHub compare 判断 main 是否领先本地提交（ahead_by > 0 表示有更新）
async function compareWithMain(localSha: string, signal: AbortSignal): Promise<{ hasUpdate: boolean; remoteSha: string } | null> {
  const rf = getParentFetch();
  const url = `https://api.github.com/repos/${REPO}/compare/${localSha}...main?t=${Date.now()}`;
  const resp: any = await rf(url, { method: 'GET', headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' as any, signal } as any);
  if (!resp?.ok) return null;
  const data = await resp.json();
  const ahead = Number(data?.ahead_by || 0);
  const commits = Array.isArray(data?.commits) ? data.commits : [];
  const remoteSha = commits.length ? String(commits[commits.length - 1]?.sha || '') : localSha;
  return { hasUpdate: ahead > 0, remoteSha };
}

async function fetchRemoteManifestVersion(signal: AbortSignal): Promise<string> {
  const rf = getParentFetch();
  const resp: any = await rf(REMOTE_MANIFEST + '?t=' + Date.now(), { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' as any, signal } as any);
  if (!resp?.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  const v = String(data?.version || '').trim();
  if (!v) throw new Error('远程版本为空');
  return v;
}

function getBanner(): HTMLElement | null {
  try {
    const doc = (window.parent as any)?.document ?? document;
    return doc.getElementById('aus-update-banner') as HTMLElement | null;
  } catch { return null; }
}

export async function checkUpdate(manual = false): Promise<{ hasUpdate: boolean; current: string; remote: string } | null> {
  // 自动检查 1 小时内最多一次；手动检查不受节流
  if (!manual) {
    const last = getStoredLastCheck();
    if (Date.now() - last < INTERVAL_MS) return null;
  }
  setStoredLastCheck(Date.now());
  const banner = getBanner();

  // 1) 优先：main 分支提交哈希比较
  try {
    const local = await fetchLocalCommit();
    if (local?.sha) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => { try { ctrl.abort(); } catch {} }, TIMEOUT_MS);
      try {
        const cmp = await compareWithMain(local.sha, ctrl.signal);
        clearTimeout(timer);
        if (cmp) {
          const localLabel = `${local.branch || 'unknown'}@${shortSha(local.sha)}`;
          const remoteLabel = `main@${shortSha(cmp.remoteSha)}`;
          if (cmp.hasUpdate) {
            const key = cmp.remoteSha || remoteLabel;
            if (getLastNotified() !== key || manual) {
              toast('info', `发现 main 分支新提交（${localLabel} → ${remoteLabel}），请前往「扩展程序 → 管理扩展程序」更新`);
              setLastNotified(key);
            }
            if (banner) {
              banner.style.display = 'block';
              banner.innerHTML = `发现新提交 <b>${remoteLabel}</b>（当前 ${localLabel}），请前往「扩展程序 → 管理扩展程序」更新`;
            }
          } else {
            toast('info', `已是最新版本（${localLabel}）`);
            if (banner) banner.style.display = 'none';
          }
          return { hasUpdate: cmp.hasUpdate, current: localLabel, remote: remoteLabel };
        }
      } catch (e: any) {
        clearTimeout(timer);
        log.debug('提交哈希检查失败，回退版本检查', e?.message || e);
      }
    }
  } catch (e: any) {
    log.debug('获取本地提交失败，回退版本检查', e?.message || e);
  }

  // 2) 回退：manifest 版本对比（扩展非 git 安装或 API 不可用时）
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch {} }, TIMEOUT_MS);
    let remoteVer = '';
    try {
      remoteVer = await fetchRemoteManifestVersion(ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
    const hasUpdate = isNewer(remoteVer, CURRENT_VERSION);
    if (hasUpdate) {
      if (getLastNotified() !== remoteVer || manual) {
        toast('info', `发现新版本 v${remoteVer}（当前 v${CURRENT_VERSION}），请前往「扩展程序 → 管理扩展程序」更新`);
        setLastNotified(remoteVer);
      }
      if (banner) {
        banner.style.display = 'block';
        banner.innerHTML = `发现新版本 <b>v${remoteVer}</b>（当前 v${CURRENT_VERSION}），请前往「扩展程序 → 管理扩展程序」更新`;
      }
    } else {
      toast('info', `已是最新版本 v${CURRENT_VERSION}`);
      if (banner) banner.style.display = 'none';
    }
    return { hasUpdate, current: CURRENT_VERSION, remote: remoteVer };
  } catch (e: any) {
    log.debug('检查更新失败', e?.message || e);
    toast('error', '检查更新失败：' + (e?.message || String(e)));
    return null;
  }
}

export function maybeAutoCheck() {
  try { checkUpdate(false); } catch {}
}
