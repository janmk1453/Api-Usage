import { r as toast, t as log } from "./logger-8RGXnvfI.js";
import { t as esc } from "./date-Dsu8hrMO.js";
//#region src/services/update.ts
var CURRENT_VERSION = "3.2.0";
var REPO = "janmk1453/Api-Usage";
var EXTENSION_FOLDER = "Api-Usage";
var INTERVAL_MS = 36e5;
var TIMEOUT_MS = 5e3;
var LOCAL_TIMEOUT_MS = 15e3;
var LAST_CHECK_KEY = "aus_update_last_check";
var LAST_NOTIFIED_KEY = "aus_update_last_notified_version";
var UPDATE_BRANCH_KEY = "aus_update_branch";
/** 强制更新失败后的退避时间 */
var FORCE_RETRY_KEY = "aus_update_force_retry_at";
/** 启动期救援探测的最小间隔 */
var FORCE_PROBE_KEY = "aus_update_force_probe_at";
var FORCE_RETRY_MS = 18e5;
var FORCE_PROBE_INTERVAL_MS = 72e5;
var POLICY_TIMEOUT_MS = 5e3;
var POLICY_PATH = "update-policy.json";
function getUpdateBranch() {
	try {
		const value = localStorage.getItem(UPDATE_BRANCH_KEY);
		if (value === "main" || value === "dev") return value;
	} catch {}
	return "main";
}
function setUpdateBranch(branch) {
	if (branch !== "main" && branch !== "dev") return;
	try {
		localStorage.setItem(UPDATE_BRANCH_KEY, branch);
	} catch {}
}
function remoteManifestUrl(branch) {
	return `https://raw.githubusercontent.com/${REPO}/${branch}/manifest.json`;
}
var cachedLocalRepo = null;
var loadedBranch = null;
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
/** 把策略文件收敛成稳定结构：缺字段/脏数据一律降级为「不强制」 */
function normalizePolicy(raw) {
	const minVersion = String(raw?.minVersion ?? "").trim().replace(/^v/, "");
	const reason = String(raw?.reason ?? "").trim().slice(0, 200);
	return {
		force: raw?.force === true || raw?.force === "true",
		minVersion: /^\d+(\.\d+)*$/.test(minVersion) ? minVersion : "",
		reason
	};
}
/**
* 是否该强制更新：策略要求 + 远端版本确实更高（永不降级）+ 达到生效门槛。
* 不依赖任何本地开关 —— 这条通道就是留给「用户已经无法手动更新」的版本的。
*/
function shouldForceUpdate(policy, currentVersion, remoteVersion) {
	if (!policy?.force) return false;
	if (!remoteVersion) return false;
	if (!isNewer(remoteVersion, currentVersion)) return false;
	if (policy.minVersion && isNewer(policy.minVersion, remoteVersion)) return false;
	return true;
}
function getForceRetryAt() {
	try {
		return parseInt(localStorage.getItem(FORCE_RETRY_KEY) || "0", 10) || 0;
	} catch {
		return 0;
	}
}
function setForceRetryAt(t) {
	try {
		localStorage.setItem(FORCE_RETRY_KEY, String(t));
	} catch {}
}
function getForceProbeAt() {
	try {
		return parseInt(localStorage.getItem(FORCE_PROBE_KEY) || "0", 10) || 0;
	} catch {
		return 0;
	}
}
function setForceProbeAt(t) {
	try {
		localStorage.setItem(FORCE_PROBE_KEY, String(t));
	} catch {}
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
async function compareWithBranch(localSha, branch, signal) {
	const resp = await getParentFetch()(`https://api.github.com/repos/${REPO}/compare/${localSha}...${encodeURIComponent(branch)}?t=${Date.now()}`, {
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
async function fetchRemoteManifestVersion(branch, signal) {
	const resp = await getParentFetch()(remoteManifestUrl(branch) + "?t=" + Date.now(), {
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
/** 策略文件的两个来源：GitHub raw 优先，jsDelivr 兜底（raw 被墙/限流时仍能拿到） */
function policyUrls(branch) {
	const t = Date.now();
	return [`https://raw.githubusercontent.com/${REPO}/${branch}/${POLICY_PATH}?t=${t}`, `https://cdn.jsdelivr.net/gh/${REPO}@${branch}/${POLICY_PATH}?t=${t}`];
}
/** 读远端策略；读不到一律当作「没有强制要求」，绝不让网络问题反而触发强制 */
async function fetchPolicy(branch) {
	const rf = getParentFetch();
	for (const url of policyUrls(branch)) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => {
			try {
				ctrl.abort();
			} catch {}
		}, POLICY_TIMEOUT_MS);
		try {
			const resp = await rf(url, {
				method: "GET",
				headers: { Accept: "application/json" },
				cache: "no-store",
				signal: ctrl.signal
			});
			clearTimeout(timer);
			if (!resp?.ok) continue;
			const data = await resp.json().catch(() => null);
			if (data && typeof data === "object") return normalizePolicy(data);
		} catch {
			clearTimeout(timer);
		}
	}
	return null;
}
async function fetchRemoteVersionSafe(branch) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => {
		try {
			ctrl.abort();
		} catch {}
	}, POLICY_TIMEOUT_MS);
	try {
		return await fetchRemoteManifestVersion(branch, ctrl.signal);
	} catch {
		return "";
	} finally {
		clearTimeout(timer);
	}
}
function isGenerating() {
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		return !!(ctx?.streaming || ctx?.isGenerating);
	} catch {
		return false;
	}
}
function reloadPage() {
	try {
		window.parent?.location?.reload?.();
	} catch {
		try {
			location.reload();
		} catch {}
	}
}
/**
* 强制更新成功后刷新页面。正在生成时挂到 GENERATION_ENDED 之后，
* 避免把用户正在跑的输出打断；拿不到事件源则每 15 秒轮询一次，最多等 10 分钟。
*/
function scheduleReloadForUpdate(delayMs = 1500) {
	if (!isGenerating()) {
		setTimeout(reloadPage, delayMs);
		return;
	}
	try {
		const ctx = globalThis.SillyTavern?.getContext?.();
		const es = ctx?.eventSource;
		const ended = ctx?.event_types?.GENERATION_ENDED;
		if (es && ended) {
			if (typeof es.once === "function") {
				es.once(ended, () => setTimeout(reloadPage, 800));
				return;
			}
			if (typeof es.on === "function") {
				const handler = () => {
					try {
						es.off?.(ended, handler);
					} catch {}
					setTimeout(reloadPage, 800);
				};
				es.on(ended, handler);
				return;
			}
		}
	} catch {}
	let ticks = 0;
	const timer = setInterval(() => {
		ticks++;
		if (!isGenerating() || ticks > 40) {
			clearInterval(timer);
			reloadPage();
		}
	}, 15e3);
}
var forcedRunning = false;
/**
* 救援通道主流程：读到 force 策略 → 确认远端版本更高 → 直接安装 → 安排刷新。
* 全程 try/catch，失败只退避半小时，不抛给调用方、不影响面板使用。
*/
async function maybeForceUpdate(branch) {
	if (forcedRunning) return false;
	if (getForceRetryAt() > Date.now()) return false;
	try {
		const policy = await fetchPolicy(branch);
		if (!policy?.force) return false;
		const remoteVersion = await fetchRemoteVersionSafe(branch);
		if (!shouldForceUpdate(policy, CURRENT_VERSION, remoteVersion)) return false;
		forcedRunning = true;
		const reason = policy.reason ? `（${policy.reason}）` : "";
		toast("info", `检测到强制更新 v${remoteVersion}${reason}，正在自动更新`);
		const res = await updateSelf();
		if (!res.ok) {
			setForceRetryAt(Date.now() + FORCE_RETRY_MS);
			return false;
		}
		setForceRetryAt(0);
		if (res.changed) scheduleReloadForUpdate();
		return true;
	} catch (e) {
		setForceRetryAt(Date.now() + FORCE_RETRY_MS);
		log.debug("强制更新失败", e?.message || e);
		return false;
	} finally {
		forcedRunning = false;
	}
}
/**
* 启动期静默探测：不依赖面板、不弹「已是最新」之类的提示，只问「远端是否要求强制更新」。
* 非 Git 安装（无提交哈希）与明确最新的情况直接退出，不产生额外请求。
*/
async function probeForcedUpdateAtStartup() {
	try {
		if (Date.now() - getForceProbeAt() < FORCE_PROBE_INTERVAL_MS) return;
		setForceProbeAt(Date.now());
	} catch {}
	try {
		if (!(globalThis.SillyTavern?.getContext?.())?.getRequestHeaders) return;
		const local = await fetchLocalCommit();
		if (!local?.sha) return;
		if (local.isUpToDate === true) return;
		await maybeForceUpdate(local.branch === "dev" || local.branch === "main" ? local.branch : getUpdateBranch());
	} catch (e) {
		log.debug("启动期强制更新探测失败", e?.message || e);
	}
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
/** 最近一次检查得到的新版本状态：面板可能晚于检查创建，用于回填导航徽标 */
var pendingUpdate = false;
/**
* 收集面板内所有「有新版本」指示位。
* 同一个更新状态现在有三处要去：桌面侧栏「关于」的蓝色徽标、窄屏底栏「设置」上的新版本胶囊、
* 设置页「关于」入口行的蓝色徽标，全部用 data-update-badge 标注，统一回填。
*/
function getNavBadges() {
	try {
		const doc = window.parent?.document ?? document;
		const list = Array.from(doc.querySelectorAll("[data-update-badge]"));
		const legacy = doc.getElementById("aus-nav-update-badge");
		if (legacy && list.indexOf(legacy) < 0) list.push(legacy);
		return list;
	} catch {
		return [];
	}
}
/**
* 写入单个指示位的开合状态。
* 窄屏底栏的胶囊放在「设置」项里，打开时要用它顶掉「设置」两个字，
* 因此顺手给父项写 data-has-update，由 style.css 隐藏底栏文字（避免依赖 CSS :has）。
*/
function paintBadge(badge, on) {
	badge.setAttribute("data-on", on);
	try {
		const item = badge.closest(".aus-bottom-item");
		if (item) item.setAttribute("data-has-update", on);
	} catch {}
}
/**
* 「有新版本」指示位同步。
* 侧栏徽标在导航项内部，点击时事件冒泡到 .aus-nav-item → 与点击「关于」完全一致；
* 折叠态（60px 侧栏）由 style.css 按 #aus-sidebar[data-collapsed="1"] 隐藏。
*/
function setNavBadge(visible) {
	pendingUpdate = visible;
	const on = visible ? "1" : "0";
	for (const badge of getNavBadges()) paintBadge(badge, on);
}
/** 面板创建晚于更新检查时调用：把当前更新状态回填到全部指示位 */
function syncUpdateIndicators() {
	const badges = getNavBadges();
	if (!badges.length) return;
	const on = pendingUpdate ? "1" : "0";
	for (const badge of badges) paintBadge(badge, on);
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
async function switchToBranch(branch, global, headers, rf) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => {
		try {
			ctrl.abort();
		} catch {}
	}, LOCAL_TIMEOUT_MS);
	try {
		const resp = await rf("/api/extensions/switch", {
			method: "POST",
			headers,
			body: JSON.stringify({
				extensionName: EXTENSION_FOLDER,
				branch: `origin/${branch}`,
				global
			}),
			signal: ctrl.signal
		});
		clearTimeout(timer);
		if (!resp?.ok) {
			const detail = await readErrorText(resp);
			let message = `切换到 ${branch} 分支失败（HTTP ${resp?.status || "未知"}）`;
			if (resp?.status === 403) message = "没有切换全局扩展分支的权限，请让管理员操作";
			else if (resp?.status === 404) message = `远端不存在 ${branch} 分支，或本地尚未获取该分支`;
			else if (resp?.status === 500) message = "服务端切换分支失败，可能是本地存在未提交改动";
			if (detail) message += "：" + detail;
			return {
				ok: false,
				message
			};
		}
		return {
			ok: true,
			message: ""
		};
	} catch (e) {
		clearTimeout(timer);
		return {
			ok: false,
			message: "切换分支失败：" + (e?.name === "AbortError" ? "请求超时" : e?.message || String(e))
		};
	}
}
async function updateSelf() {
	const targetBranch = getUpdateBranch();
	const ctx = globalThis.SillyTavern?.getContext?.();
	if (!ctx?.getRequestHeaders) {
		const message = "当前不在酒馆环境中，无法调用扩展更新接口";
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			changed: false,
			message,
			branch: targetBranch
		};
	}
	let headers;
	try {
		headers = ctx.getRequestHeaders();
	} catch {
		headers = { "Content-Type": "application/json" };
	}
	let local = null;
	try {
		local = await fetchLocalCommit();
	} catch {}
	if (!local) local = cachedLocalRepo;
	const observedBranch = local?.branch || "";
	if (loadedBranch === null && observedBranch) loadedBranch = observedBranch;
	if (local && !local.sha) {
		const message = "当前安装不是 Git 仓库，无法在扩展内自更新，请在「管理扩展程序」中重新安装或更新";
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			changed: false,
			message,
			branch: targetBranch
		};
	}
	const global = local?.global ?? false;
	const rf = getParentFetch();
	let switchedBranch = false;
	if (local && local.sha && local.branch && local.branch !== targetBranch) {
		const switched = await switchToBranch(targetBranch, global, headers, rf);
		if (!switched.ok) {
			toast("error", switched.message);
			return {
				ok: false,
				isUpToDate: false,
				changed: false,
				message: switched.message,
				branch: targetBranch
			};
		}
		switchedBranch = true;
		local = {
			...local,
			branch: targetBranch
		};
		cachedLocalRepo = local;
	}
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
				changed: false,
				message,
				branch: targetBranch
			};
		}
		const data = await resp.json().catch(() => null);
		const isUpToDate = data?.isUpToDate === true;
		const commit = String(data?.shortCommitHash || "").trim();
		const changed = switchedBranch || !!loadedBranch && !!observedBranch && loadedBranch !== observedBranch || !isUpToDate;
		const message = isUpToDate ? changed ? `已切换到 ${targetBranch} 分支${commit ? "（" + commit + "）" : ""}` : `${targetBranch} 分支已是最新版本，无需更新` : `已更新到 ${targetBranch} 分支${commit ? "（" + commit + "）" : ""}`;
		toast(changed ? "success" : "info", message);
		return {
			ok: true,
			isUpToDate,
			changed,
			message,
			commit: commit || void 0,
			branch: targetBranch
		};
	} catch (e) {
		clearTimeout(timer);
		const message = "更新失败：" + (e?.name === "AbortError" ? "请求超时" : e?.message || String(e));
		toast("error", message);
		return {
			ok: false,
			isUpToDate: false,
			changed: false,
			message,
			branch: targetBranch
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
	const targetBranch = getUpdateBranch();
	let isNonGitInstall = false;
	try {
		const local = await fetchLocalCommit();
		if (local) isNonGitInstall = !local.sha;
		if (local?.sha) {
			const currentBranch = local.branch || "unknown";
			const localLabel = `${currentBranch}@${shortSha(local.sha)}`;
			const needsSwitch = currentBranch !== "unknown" && currentBranch !== targetBranch;
			let hasUpdate = !needsSwitch && local.isUpToDate === false;
			let remoteLabel = "";
			let remoteSha = "";
			let notifyKey = `${targetBranch}:${local.sha}`;
			const ctrl = new AbortController();
			const timer = setTimeout(() => {
				try {
					ctrl.abort();
				} catch {}
			}, TIMEOUT_MS);
			try {
				const cmp = await compareWithBranch(local.sha, targetBranch, ctrl.signal);
				clearTimeout(timer);
				if (cmp) {
					if (cmp.hasUpdate) {
						hasUpdate = true;
						if (cmp.remoteSha && shortSha(cmp.remoteSha) !== shortSha(local.sha)) {
							remoteSha = cmp.remoteSha;
							remoteLabel = `${targetBranch}@${shortSha(cmp.remoteSha)}`;
						}
						notifyKey = `${targetBranch}:${cmp.remoteSha || local.sha}`;
					}
				}
			} catch (e) {
				clearTimeout(timer);
				log.debug("提交哈希检查失败，回退版本检查", e?.message || e);
			}
			if (needsSwitch) hasUpdate = true;
			if (hasUpdate && await maybeForceUpdate(targetBranch)) return {
				hasUpdate: true,
				current: localLabel,
				remote: remoteLabel || `${targetBranch}（领先本地）`
			};
			if (hasUpdate) {
				const message = needsSwitch ? `当前 ${localLabel}，可在关于页切换到 ${targetBranch} 分支并更新` : remoteLabel ? `发现新提交 ${remoteLabel}（当前 ${localLabel}），可在关于页更新` : `检测到 ${targetBranch} 有新提交（当前 ${localLabel}），可在关于页更新`;
				if (getLastNotified() !== notifyKey || manual) {
					toast("info", message);
					setLastNotified(notifyKey);
				}
				if (banner) showBanner(needsSwitch ? `当前 <b>${esc(localLabel)}</b>，目标分支 <b>${esc(targetBranch)}</b>，点击“立即更新”将切换并更新` : remoteLabel ? `发现新提交 <b>${esc(remoteLabel)}</b>（当前 ${esc(localLabel)}），可在本页直接更新` : `当前 <b>${esc(localLabel)}</b> 落后于 <b>${esc(targetBranch)}</b> 分支，点击“立即更新”拉取最新提交`);
				setUpdateButtonVisible(true);
				setNavBadge(true);
			} else {
				if (manual) toast("info", `已是最新版本（${localLabel}，目标 ${targetBranch}）`);
				hideBanner();
				setUpdateButtonVisible(false);
				setNavBadge(false);
			}
			return {
				hasUpdate,
				current: localLabel,
				remote: remoteLabel || (remoteSha ? shortSha(remoteSha) : `${targetBranch}（领先本地）`)
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
			remoteVer = await fetchRemoteManifestVersion(targetBranch, ctrl.signal);
		} finally {
			clearTimeout(timer);
		}
		const hasUpdate = isNewer(remoteVer, CURRENT_VERSION);
		if (hasUpdate) {
			const updateHint = isNonGitInstall ? "，请前往「扩展程序 → 管理扩展程序」更新" : `，可在关于页切换到 ${targetBranch} 并更新`;
			const notifyKey = `${targetBranch}:v${remoteVer}`;
			if (getLastNotified() !== notifyKey || manual) {
				toast("info", `发现 ${targetBranch} 分支新版本 v${remoteVer}（当前 v${CURRENT_VERSION}）${updateHint}`);
				setLastNotified(notifyKey);
			}
			if (banner) showBanner(`发现 <b>${esc(targetBranch)}</b> 分支新版本 <b>v${esc(remoteVer)}</b>（当前 v${esc(CURRENT_VERSION)}）${updateHint}`);
			setUpdateButtonVisible(!isNonGitInstall);
			setNavBadge(true);
		} else {
			if (manual) toast("info", `已是最新版本 v${CURRENT_VERSION}（目标 ${targetBranch}）`);
			hideBanner();
			setUpdateButtonVisible(false);
			setNavBadge(false);
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
export { checkUpdate, getUpdateBranch, maybeAutoCheck, probeForcedUpdateAtStartup, setUpdateBranch, syncUpdateIndicators, updateSelf };
