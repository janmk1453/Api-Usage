import { t as toast, l as log } from "./index-BgluDUu_.js";
const CURRENT_VERSION = "3.0.4";
const REPO = "janmk1453/Api-Usage";
const REPO_URL = "https://github.com/" + REPO;
const REMOTE_MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
const EXTENSION_FOLDER = "Api-Usage";
const TIMEOUT_MS = 5 * 1e3;
const LOCAL_TIMEOUT_MS = 15e3;
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
function shortSha(s) {
  return (s || "").slice(0, 7);
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
function getLastNotified() {
  try {
    return localStorage.getItem(LAST_NOTIFIED_KEY) || "";
  } catch {
    return "";
  }
}
function setLastNotified(v) {
  try {
    localStorage.setItem(LAST_NOTIFIED_KEY, v);
  } catch {
  }
}
async function fetchLocalCommit() {
  const ctx = globalThis.SillyTavern?.getContext?.();
  if (!ctx?.getRequestHeaders) return null;
  let headers;
  try {
    headers = ctx.getRequestHeaders();
  } catch {
    headers = { "Content-Type": "application/json" };
  }
  const rf = getParentFetch();
  for (const isGlobal of [false, true]) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
      }
    }, LOCAL_TIMEOUT_MS);
    try {
      const resp = await rf("/api/extensions/version", {
        method: "POST",
        headers,
        body: JSON.stringify({ extensionName: EXTENSION_FOLDER, global: isGlobal }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (resp?.ok) {
        const data = await resp.json();
        const sha = String(data?.currentCommitHash || "").trim();
        if (sha) return { sha, branch: String(data?.currentBranchName || "") };
      }
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}
async function compareWithMain(localSha, signal) {
  const rf = getParentFetch();
  const url = `https://api.github.com/repos/${REPO}/compare/${localSha}...main?t=${Date.now()}`;
  const resp = await rf(url, { method: "GET", headers: { Accept: "application/vnd.github+json" }, cache: "no-store", signal });
  if (!resp?.ok) return null;
  const data = await resp.json();
  const ahead = Number(data?.ahead_by || 0);
  const commits = Array.isArray(data?.commits) ? data.commits : [];
  const remoteSha = commits.length ? String(commits[commits.length - 1]?.sha || "") : localSha;
  return { hasUpdate: ahead > 0, remoteSha };
}
async function fetchRemoteManifestVersion(signal) {
  const rf = getParentFetch();
  const resp = await rf(REMOTE_MANIFEST + "?t=" + Date.now(), { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", signal });
  if (!resp?.ok) throw new Error("HTTP " + resp.status);
  const data = await resp.json();
  const v = String(data?.version || "").trim();
  if (!v) throw new Error("远程版本为空");
  return v;
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
  setStoredLastCheck(Date.now());
  const banner = getBanner();
  try {
    const local = await fetchLocalCommit();
    if (local?.sha) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => {
        try {
          ctrl.abort();
        } catch {
        }
      }, TIMEOUT_MS);
      try {
        const cmp = await compareWithMain(local.sha, ctrl.signal);
        clearTimeout(timer);
        if (cmp) {
          const localLabel = `${local.branch || "unknown"}@${shortSha(local.sha)}`;
          const remoteLabel = `main@${shortSha(cmp.remoteSha)}`;
          if (cmp.hasUpdate) {
            const key = cmp.remoteSha || remoteLabel;
            if (getLastNotified() !== key || manual) {
              toast("info", `发现 main 分支新提交（${localLabel} → ${remoteLabel}），请前往仓库更新：${REPO_URL}`);
              setLastNotified(key);
            }
            if (banner) {
              banner.style.display = "block";
              banner.innerHTML = `发现新提交 <b>${remoteLabel}</b>（当前 ${localLabel}） <a href="${REPO_URL}" target="_blank" style="color:var(--ds-green);text-decoration:underline;">前往更新</a>`;
            }
          } else {
            toast("info", `已是最新版本（${localLabel}）`);
            if (banner) banner.style.display = "none";
          }
          return { hasUpdate: cmp.hasUpdate, current: localLabel, remote: remoteLabel };
        }
      } catch (e) {
        clearTimeout(timer);
        log.debug("提交哈希检查失败，回退版本检查", e?.message || e);
      }
    }
  } catch (e) {
    log.debug("获取本地提交失败，回退版本检查", e?.message || e);
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
      }
    }, TIMEOUT_MS);
    let remoteVer = "";
    try {
      remoteVer = await fetchRemoteManifestVersion(ctrl.signal);
    } finally {
      clearTimeout(timer);
    }
    const hasUpdate = isNewer(remoteVer, CURRENT_VERSION);
    if (hasUpdate) {
      if (getLastNotified() !== remoteVer || manual) {
        toast("info", `发现新版本 v${remoteVer}（当前 v${CURRENT_VERSION}），请前往仓库更新：${REPO_URL}`);
        setLastNotified(remoteVer);
      }
      if (banner) {
        banner.style.display = "block";
        banner.innerHTML = `发现新版本 <b>v${remoteVer}</b>（当前 v${CURRENT_VERSION}） <a href="${REPO_URL}" target="_blank" style="color:var(--ds-green);text-decoration:underline;">前往更新</a>`;
      }
    } else {
      toast("info", `已是最新版本 v${CURRENT_VERSION}`);
      if (banner) banner.style.display = "none";
    }
    return { hasUpdate, current: CURRENT_VERSION, remote: remoteVer };
  } catch (e) {
    log.debug("检查更新失败", e?.message || e);
    toast("error", "检查更新失败：" + (e?.message || String(e)));
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
