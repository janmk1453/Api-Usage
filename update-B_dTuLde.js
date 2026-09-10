import { t as toast, l as log } from "./index-DnXfhiAt.js";
const CURRENT_VERSION = "3.0.4";
const REMOTE_MANIFEST = "https://raw.githubusercontent.com/janmk1453/Api-Usage/main/manifest.json";
const REPO_URL = "https://github.com/janmk1453/Api-Usage";
const INTERVAL_MS = 6 * 60 * 60 * 1e3;
const TIMEOUT_MS = 5 * 1e3;
const LAST_CHECK_KEY = "aus_update_last_check";
const LAST_NOTIFIED_KEY = "aus_update_last_notified_version";
function getParentFetch() {
  try {
    const p = window.parent;
    if (p?.fetch) return p.fetch.bind(p);
  } catch {
  }
  return fetch.bind(window);
}
function parseVersion(v) {
  return String(v || "").replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
}
function isNewer(remote, local) {
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
function getStoredLastCheck() {
  try {
    return parseInt(localStorage.getItem(LAST_CHECK_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}
function setStoredLastCheck(t) {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(t));
  } catch {
  }
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings["api_usage_stat"] = ctx.extensionSettings["api_usage_stat"] || {};
      ctx.extensionSettings["api_usage_stat"]._updateLastCheck = t;
      ctx.saveSettingsDebounced?.();
    }
  } catch {
  }
}
function getBanner() {
  try {
    const doc = window.parent?.document ?? document;
    return doc.getElementById("aus-update-banner");
  } catch {
    return null;
  }
}
async function checkUpdate(manual = false) {
  if (!manual) {
    const last = getStoredLastCheck();
    if (Date.now() - last < INTERVAL_MS) return null;
  }
  setStoredLastCheck(Date.now());
  const rf = getParentFetch();
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try {
      ctrl.abort();
    } catch {
    }
  }, TIMEOUT_MS);
  try {
    const url = REMOTE_MANIFEST + "?t=" + Date.now();
    const resp = await rf(url, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp?.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    const remoteVer = String(data?.version || "").trim();
    if (!remoteVer) throw new Error("远程版本为空");
    const hasUpdate = isNewer(remoteVer, CURRENT_VERSION);
    const banner = getBanner();
    if (hasUpdate) {
      try {
        const lastNotified = (() => {
          try {
            return localStorage.getItem(LAST_NOTIFIED_KEY) || "";
          } catch {
            return "";
          }
        })();
        if (lastNotified !== remoteVer || manual) {
          toast("info", `发现新版本 v${remoteVer}（当前 v${CURRENT_VERSION}），请前往仓库更新：${REPO_URL}`);
          try {
            localStorage.setItem(LAST_NOTIFIED_KEY, remoteVer);
          } catch {
          }
        }
      } catch {
      }
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `发现新版本 <b>v${remoteVer}</b>（当前 v${CURRENT_VERSION}） <a href="${REPO_URL}" target="_blank" style="color:var(--ds-green);text-decoration:underline;">前往更新</a>`;
      }
    } else {
      toast("info", `API用量统计已是最新版本 v${CURRENT_VERSION}`);
      if (banner) banner.style.display = "none";
      log.debug("检查更新：已是最新 v" + CURRENT_VERSION);
    }
    return { hasUpdate, current: CURRENT_VERSION, remote: remoteVer };
  } catch (e) {
    clearTimeout(timer);
    log.debug("检查更新失败", e?.message || e);
    toast("warning", "检查更新失败：" + (e?.message || String(e)));
    return null;
  }
}
function maybeAutoCheck() {
  try {
    checkUpdate(false);
  } catch {
  }
}
export {
  checkUpdate,
  maybeAutoCheck
};
