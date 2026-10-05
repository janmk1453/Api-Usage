import { r as toast, t as log } from "./logger-Bv-AT94O.js";
import { t as esc } from "./date-BJI2m6dS.js";
//#region src/services/update.ts
var CURRENT_VERSION = "3.1.0";
var REPO = "janmk1453/Api-Usage";
var REMOTE_MANIFEST = `https://raw.githubusercontent.com/${REPO}/main/manifest.json`;
var EXTENSION_FOLDER = "Api-Usage";
var INTERVAL_MS = 36e5;
var TIMEOUT_MS = 5e3;
var LOCAL_TIMEOUT_MS = 15e3;
var LAST_CHECK_KEY = "aus_update_last_check";
var LAST_NOTIFIED_KEY = "aus_update_last_notified_version";
var cachedLocalRepo = null;
function getParentFetch() {
	try {
		const p = window.parent;
		if (p?.fetch) return p.fetch.bind(p);
	} catch {}
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
	} catch {}
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		if (ctx?.extensionSettings) {
			ctx.extensionSettings["api_usage_stat"] = ctx.extensionSettings["api_usage_stat"] || {};
			ctx.extensionSettings["api_usage_stat"]._updateLastCheck = t;
			ctx.saveSettingsDebounced?.();
		}
	} catch {}
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
	} catch {}
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
			} catch {}
		}, LOCAL_TIMEOUT_MS);
		try {
			const resp = await rf("/api/extensions/version", {
				method: "POST",
				headers,
				body: JSON.stringify({
					extensionName: EXTENSION_FOLDER,
					global: isGlobal
				}),
				signal: ctrl.signal
			});
			clearTimeout(timer);
			if (resp?.ok) {
				const data = await resp.json();
				const sha = String(data?.currentCommitHash || "").trim();
				const isUpToDate = typeof data?.isUpToDate === "boolean" ? data.isUpToDate : null;
				if (sha || isUpToDate !== null) {
					const info = {
						sha,
						branch: String(data?.currentBranchName || ""),
						global: isGlobal,
						isUpToDate
					};
					cachedLocalRepo = info;
					return info;
				}
			}
		} catch {
			clearTimeout(timer);
		}
	}
	return null;
}
async function compareWithMain(localSha, signal) {
	const resp = await getParentFetch()(`https://api.github.com/repos/${REPO}/compare/${localSha}...main?t=${Date.now()}`, {
		method: "GET",
		headers: { Accept: "application/vnd.github+json" },
		cache: "no-store",
		signal
	});
	if (!resp?.ok) return null;
	const data = await resp.json();
	const ahead = Number(data?.ahead_by || 0);
	const commits = Array.isArray(data?.commits) ? data.commits : [];
	const remoteSha = commits.length ? String(commits[commits.length - 1]?.sha || "") : localSha;
	return {
		hasUpdate: ahead > 0,
		remoteSha
	};
}
async function fetchRemoteManifestVersion(signal) {
	const resp = await getParentFetch()(REMOTE_MANIFEST + "?t=" + Date.now(), {
		method: "GET",
		headers: { Accept: "application/json" },
		cache: "no-store",
		signal
	});
	if (!resp?.ok) throw new Error("HTTP " + resp.status);
	const data = await resp.json();
	const v = String(data?.version || "").trim();
	if (!v) throw new Error("远程版本为空");
	return v;
}
function getBanner() {
	try {
		return (window.parent?.document ?? document).getElementById("aus-update-banner");
	} catch {
		return null;
	}
}
function getUpdateButton() {
	try {
		return (window.parent?.document ?? document).getElementById("aus-run-update");
	} catch {
		return null;
	}
}
function setUpdateButtonVisible(visible) {
	const btn = getUpdateButton();
	if (!btn) return;
	btn.style.display = visible ? "inline-flex" : "none";
}
function showBanner(message) {
	const banner = getBanner();
	if (!banner) return;
	banner.style.display = "block";
	banner.innerHTML = message;
}
function hideBanner() {
	const banner = getBanner();
	if (banner) banner.style.display = "none";
}
async function readErrorText(resp) {
	try {
		const text = String(await resp.text() || "").replace(/\s+/g, " ").trim();
		return text.length > 200 ? text.slice(0, 200) + "…" : text;
	} catch {
		return "";
	}
}
async function updateSelf() {
	const ctx = globalThis.SillyTavern?.getContext?.();
	if (!ctx?.getRequestHeaders) {
		const message = "当前不在酒馆环境中，无法调用扩展更新接口";
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			message
		};
	}
	let headers;
	try {
		headers = ctx.getRequestHeaders();
	} catch {
		headers = { "Content-Type": "application/json" };
	}
	let local = cachedLocalRepo;
	if (!local) try {
		local = await fetchLocalCommit();
	} catch {}
	if (local && !local.sha) {
		const message = "当前安装不是 Git 仓库，无法在扩展内自更新，请在「管理扩展程序」中重新安装或更新";
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			message
		};
	}
	const global = local?.global ?? false;
	const rf = getParentFetch();
	const ctrl = new AbortController();
	const timer = setTimeout(() => {
		try {
			ctrl.abort();
		} catch {}
	}, LOCAL_TIMEOUT_MS);
	try {
		const resp = await rf("/api/extensions/update", {
			method: "POST",
			headers,
			body: JSON.stringify({
				extensionName: EXTENSION_FOLDER,
				global
			}),
			signal: ctrl.signal
		});
		clearTimeout(timer);
		if (!resp?.ok) {
			const detail = await readErrorText(resp);
			let message = `更新失败（HTTP ${resp?.status || "未知"}）`;
			if (resp?.status === 403) message = "没有更新全局扩展的权限，请让管理员执行更新";
			else if (resp?.status === 404) message = "服务端未找到扩展目录，当前安装方式可能不支持自更新";
			else if (resp?.status === 500) message = "服务端执行 git 更新失败，可能是网络、代理或本地改动导致";
			if (detail) message += "：" + detail;
			toast("error", message);
			return {
				ok: false,
				isUpToDate: false,
				message
			};
		}
		const data = await resp.json().catch(() => null);
		const isUpToDate = data?.isUpToDate === true;
		const commit = String(data?.shortCommitHash || "").trim();
		const message = isUpToDate ? "已是最新版本，无需更新" : `更新成功${commit ? "（" + commit + "）" : ""}`;
		toast(isUpToDate ? "info" : "success", message);
		return {
			ok: true,
			isUpToDate,
			message,
			commit: commit || void 0
		};
	} catch (e) {
		clearTimeout(timer);
		const message = "更新失败：" + (e?.name === "AbortError" ? "请求超时" : e?.message || String(e));
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			message
		};
	}
}
async function checkUpdate(manual = false) {
	if (!manual) {
		const last = getStoredLastCheck();
		if (Date.now() - last < INTERVAL_MS) return null;
	}
	setStoredLastCheck(Date.now());
	const banner = getBanner();
	let isNonGitInstall = false;
	try {
		const local = await fetchLocalCommit();
		if (local) isNonGitInstall = !local.sha;
		if (local?.sha) {
			const branchLabel = local.branch || "unknown";
			const localLabel = `${branchLabel}@${shortSha(local.sha)}`;
			let hasUpdate = local.isUpToDate === false;
			let remoteLabel = `origin/${branchLabel}@最新`;
			let notifyKey = `origin:${branchLabel}:${local.sha}`;
			const ctrl = new AbortController();
			const timer = setTimeout(() => {
				try {
					ctrl.abort();
				} catch {}
			}, TIMEOUT_MS);
			try {
				const cmp = await compareWithMain(local.sha, ctrl.signal);
				clearTimeout(timer);
				if (cmp) {
					if (cmp.hasUpdate) {
						hasUpdate = true;
						remoteLabel = `main@${shortSha(cmp.remoteSha)}`;
						notifyKey = cmp.remoteSha || remoteLabel;
					} else if (!hasUpdate) remoteLabel = `main@${shortSha(cmp.remoteSha)}`;
				}
			} catch (e) {
				clearTimeout(timer);
				log.debug("提交哈希检查失败，回退版本检查", e?.message || e);
			}
			if (hasUpdate) {
				if (getLastNotified() !== notifyKey || manual) {
					toast("info", `发现新提交（${localLabel} → ${remoteLabel}），可在「关于 → 检查更新」中直接更新`);
					setLastNotified(notifyKey);
				}
				if (banner) showBanner(`发现新提交 <b>${esc(remoteLabel)}</b>（当前 ${esc(localLabel)}），可在本页直接更新`);
				setUpdateButtonVisible(true);
			} else {
				toast("info", `已是最新版本（${localLabel}）`);
				hideBanner();
				setUpdateButtonVisible(false);
			}
			return {
				hasUpdate,
				current: localLabel,
				remote: remoteLabel
			};
		}
	} catch (e) {
		log.debug("获取本地提交失败，回退版本检查", e?.message || e);
	}
	try {
		const ctrl = new AbortController();
		const timer = setTimeout(() => {
			try {
				ctrl.abort();
			} catch {}
		}, TIMEOUT_MS);
		let remoteVer = "";
		try {
			remoteVer = await fetchRemoteManifestVersion(ctrl.signal);
		} finally {
			clearTimeout(timer);
		}
		const hasUpdate = isNewer(remoteVer, CURRENT_VERSION);
		if (hasUpdate) {
			const updateHint = isNonGitInstall ? "，请前往「扩展程序 → 管理扩展程序」更新" : "，可在本页直接更新";
			if (getLastNotified() !== remoteVer || manual) {
				toast("info", `发现新版本 v${remoteVer}（当前 v${CURRENT_VERSION}）${updateHint}`);
				setLastNotified(remoteVer);
			}
			if (banner) showBanner(`发现新版本 <b>v${esc(remoteVer)}</b>（当前 v${esc(CURRENT_VERSION)}）${updateHint}`);
			setUpdateButtonVisible(!isNonGitInstall);
		} else {
			toast("info", `已是最新版本 v${CURRENT_VERSION}`);
			hideBanner();
			setUpdateButtonVisible(false);
		}
		return {
			hasUpdate,
			current: CURRENT_VERSION,
			remote: remoteVer
		};
	} catch (e) {
		log.debug("检查更新失败", e?.message || e);
		toast("error", "检查更新失败：" + (e?.message || String(e)));
		return null;
	}
}
function maybeAutoCheck() {
	try {
		checkUpdate(false);
	} catch {}
}
//#endregion
export { checkUpdate, maybeAutoCheck, updateSelf };
