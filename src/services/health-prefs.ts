/**
 * 健康提示的偏好落盘（纯 localStorage，不进 settings、不参与导出）
 *
 * 两个键：
 * - HEALTH_BAR_ENABLED_KEY  提示条总开关
 * - HEALTH_IGNORE_KEY       已忽略的问题指纹（v2 结构：带过期时间，默认 7 天）
 *
 * v1 只存字符串数组，且旧版插件报错的指纹是固定的 plugin-error||console，
 * 一旦点过「忽略」就永久静音所有控制台类报错。迁移时直接丢弃这类无归因条目，
 * 让用户能重新看到真正有归因的报错。
 */

export const HEALTH_BAR_ENABLED_KEY = 'aus_health_bar_enabled_v1';
export const HEALTH_IGNORE_KEY = 'aus_health_ignore_v2';
/** v1 旧键：只在迁移时读一次 */
export const HEALTH_IGNORE_LEGACY_KEY = 'aus_health_ignore_v1';
/** 最多保留多少条忽略记录 */
export const HEALTH_IGNORE_LIMIT = 50;
/** 忽略有效期：过期后同类问题会重新提示，避免永久静音 */
export const HEALTH_IGNORE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface IgnoreEntry {
  key: string;
  at: number;
  expiresAt: number;
  /** one=只忽略这一次；kind=忽略这一类（默认） */
  scope: 'one' | 'kind';
}

function readStorage(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value == null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {}
}

function normalizeEntry(raw: any, now: number): IgnoreEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  if (!key) return null;
  const at = Number(raw.at);
  const expiresAt = Number(raw.expiresAt);
  return {
    key,
    at: Number.isFinite(at) && at > 0 ? at : now,
    expiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : now + HEALTH_IGNORE_TTL_MS,
    scope: raw.scope === "one" ? "one" : "kind",
  };
}

/** 旧版固定指纹：无归因的插件报错（点一次会静音全部控制台报错） */
export function isLegacyBlanketKey(key: string): boolean {
  const s = String(key || "");
  if (!s.startsWith("plugin-error|")) return false;
  const parts = s.split("|");
  // v1 格式 plugin-error|模型|console，模型恒空 → plugin-error||console
  return parts.length >= 3 && !parts[1] && parts[2] === "console";
}

function writeIgnoreEntries(entries: IgnoreEntry[], now = Date.now()): void {
  const alive = entries.filter((entry) => entry && entry.key && entry.expiresAt > now);
  if (!alive.length) { writeStorage(HEALTH_IGNORE_KEY, null); return; }
  writeStorage(HEALTH_IGNORE_KEY, JSON.stringify(alive.slice(0, HEALTH_IGNORE_LIMIT)));
}

/** 读全部未过期条目（含 v1 迁移） */
export function readIgnoreEntries(now = Date.now()): IgnoreEntry[] {
  const out: IgnoreEntry[] = [];
  const seen = new Set<string>();
  const raw = readStorage(HEALTH_IGNORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : [];
      for (const item of list) {
        const entry = normalizeEntry(item, now);
        if (!entry) continue;
        if (entry.expiresAt <= now) continue;
        if (seen.has(entry.key)) continue;
        seen.add(entry.key);
        out.push(entry);
      }
    } catch {}
  }
  // v1 → v2 迁移：丢掉无归因的旧插件报错指纹，其余补上过期时间
  const legacy = readStorage(HEALTH_IGNORE_LEGACY_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      const list = Array.isArray(parsed) ? parsed : [];
      for (const item of list) {
        const key = typeof item === "string" ? item : typeof item?.key === "string" ? item.key : "";
        if (!key || isLegacyBlanketKey(key)) continue;
        if (seen.has(key)) continue;
        const at = typeof item?.at === "number" && item.at > 0 ? item.at : now;
        const expiresAt = at + HEALTH_IGNORE_TTL_MS;
        if (expiresAt <= now) continue;
        seen.add(key);
        out.push({ key, at, expiresAt, scope: "kind" });
      }
      writeIgnoreEntries(out, now);
    } catch {}
    writeStorage(HEALTH_IGNORE_LEGACY_KEY, null);
  }
  return out.sort((a, b) => b.at - a.at);
}

export function isHealthBarEnabled(): boolean {
  return readStorage(HEALTH_BAR_ENABLED_KEY) !== "0";
}

export function setHealthBarEnabled(enabled: boolean): void {
  writeStorage(HEALTH_BAR_ENABLED_KEY, enabled ? "1" : "0");
}

export function readIgnoredHealthKeys(now = Date.now()): string[] {
  return readIgnoreEntries(now).map((entry) => entry.key);
}

export function ignoredHealthCount(now = Date.now()): number {
  return readIgnoreEntries(now).length;
}

/** 追加忽略：同 key 覆盖时间，按写入时间倒序截断 */
export function addIgnoredHealthKeys(keys: string[], now = Date.now(), scope: "one" | "kind" = "kind"): void {
  const incoming = Array.isArray(keys) ? keys.map((key) => String(key || "").trim()).filter(Boolean) : [];
  if (!incoming.length) return;
  const map = new Map<string, IgnoreEntry>();
  for (const entry of readIgnoreEntries(now)) map.set(entry.key, entry);
  for (const key of incoming) {
    map.set(key, { key, at: now, expiresAt: now + HEALTH_IGNORE_TTL_MS, scope });
  }
  const merged = [...map.values()].sort((a, b) => b.at - a.at).slice(0, HEALTH_IGNORE_LIMIT);
  writeIgnoreEntries(merged, now);
}

export function clearIgnoredHealthKeys(): void {
  writeStorage(HEALTH_IGNORE_KEY, null);
}
