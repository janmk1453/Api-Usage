const defaultSettings = () => ({
  autoBalance: false,
  balanceInterval: 10,
  debug: false,
  debugHit: 1e4,
  debugMiss: 5e3,
  debugOutput: 2e3,
  debugModel: "deepseek-v4-flash",
  debugDateStart: "",
  debugDateEnd: "",
  debugBatchCount: 30,
  useNewPricing: true,
  newPricingDate: (/* @__PURE__ */ new Date("2026-08-17T00:00:00+08:00")).getTime(),
  customModels: [],
  peakHours: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  peakDot: true,
  webdav: { url: "https://dav.jianguoyun.com/dav/", username: "", path: "", proxy: "" }
});
const PRICING = {
  "deepseek-v4-flash": {
    usePeakPricing: true,
    offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
    peak: { hit: 0.1, miss: 3, output: 9 }
  },
  "deepseek-v4-pro": {
    usePeakPricing: true,
    offpeak: { hit: 0.15, miss: 4.5, output: 13.5 },
    peak: { hit: 0.3, miss: 9, output: 27 }
  },
  "deepseek-v4-flash-vision-exp": {
    usePeakPricing: true,
    offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
    peak: { hit: 0.1, miss: 3, output: 9 }
  }
};
const DEFAULT_PEAK_HOURS = [
  { start: "09:00", end: "12:00" },
  { start: "14:00", end: "18:00" }
];
const MAX_HISTORY = 500;
const STORAGE_KEYS = {
  KEY: "ds_api_key",
  BALANCE: "ds_balance_data",
  SAVES: "ds_saves",
  CURRENT_SAVE: "ds_current_save",
  SETTINGS: "ds_settings",
  MESSAGE_COUNT: "ds_message_count",
  CUSTOM_BALANCE: "ds_custom_balance",
  LAST_VERSION: "ds_last_version",
  SYNC_META: "ds_sync_meta",
  WEBDAV_PASS: "ds_webdav_pass",
  PEAK_DOT_POS: "ds_peak_dot_pos"
};
const EXPORT_FORMAT_VERSION = 1;
const WEBDAV_SYNC_FILE = "DeepSeekStatSync.json";
const WEBDAV_REMOTE_VERSION = 1;
const state = {
  currentSave: null,
  saves: {},
  lastUsage: null,
  settings: defaultSettings(),
  balance: null,
  customBalance: null,
  messageCount: 0,
  overviewModel: "__all__",
  chartModel: "__all__"
};
function getSelectedSave() {
  if (state.currentSave === "__all__") return getMergedStats();
  return state.currentSave && state.saves[state.currentSave] || null;
}
function getMergedStats() {
  const m = {
    total_tokens: 0,
    total_cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    input_cost: 0,
    output_cost: 0,
    rounds: 0,
    history: [],
    startTime: Date.now()
  };
  let ah = [];
  let es = Date.now();
  for (const k of Object.keys(state.saves)) {
    const s = state.saves[k];
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
  ah.sort((a, b) => b.timestamp - a.timestamp);
  m.history = ah.slice(0, MAX_HISTORY);
  return m;
}
function createNewSave() {
  let cn = "";
  try {
    cn = globalThis.SillyTavern?.getContext?.().name2 || "";
  } catch {
  }
  const n = /* @__PURE__ */ new Date();
  const key = `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}_${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}${String(n.getSeconds()).padStart(2, "0")}_${cn || "unknown"}`;
  state.saves[key] = {
    name: key,
    character: cn,
    startTime: n.getTime(),
    _mtime: n.getTime(),
    total_tokens: 0,
    total_cost: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_hit_tokens: 0,
    cache_miss_tokens: 0,
    input_cost: 0,
    output_cost: 0,
    rounds: 0,
    history: []
  };
  state.currentSave = key;
  return key;
}
const MODULE$1 = "api_usage_stat";
const HOT_KEEP = 50;
const DB_NAME = "api_usage_stat_db";
const STORE_NAME = "kv";
function getDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}
async function dbGet(key) {
  try {
    const db = await getDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction([STORE_NAME], "readonly");
      const r = tx.objectStore(STORE_NAME).get(key);
      r.onsuccess = (e) => res(e.target.result ?? null);
      r.onerror = (e) => rej(e.target.error);
    });
  } catch {
    try {
      return localStorage.getItem("aus_" + key);
    } catch {
      return null;
    }
  }
}
async function dbSet(key, value) {
  try {
    const db = await getDB();
    await new Promise((res, rej) => {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const r = tx.objectStore(STORE_NAME).put(value, key);
      r.onsuccess = () => res();
      r.onerror = (e) => rej(e.target.error);
    });
  } catch {
    try {
      localStorage.setItem("aus_" + key, value);
    } catch {
    }
  }
}
function loadLegacy(key) {
  try {
    const gv = globalThis.getAllVariables;
    if (typeof gv === "function") {
      const v = gv();
      if (v && v[key] != null) return v[key];
    }
  } catch {
  }
  try {
    return localStorage.getItem("ds_" + key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}
function getExtensionSettings() {
  try {
    return globalThis.SillyTavern?.getContext?.().extensionSettings?.[MODULE$1] ?? null;
  } catch {
    return null;
  }
}
function saveExtensionSettings(data) {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx) return;
    ctx.extensionSettings[MODULE$1] = data;
    ctx.saveSettingsDebounced?.();
  } catch {
  }
}
let saveTimer = null;
function saveHot(patch) {
  const cur = getExtensionSettings() || {};
  const next = { ...cur, ...patch, _updated: Date.now() };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveExtensionSettings(next), 300);
}
async function migrateIfNeeded() {
  const cur = getExtensionSettings();
  if (cur && cur._migrated) return;
  const legacySaves = loadLegacy(STORAGE_KEYS.SAVES);
  if (!legacySaves && !cur) {
    saveExtensionSettings({ _migrated: true, _updated: Date.now() });
    return;
  }
  try {
    const backup = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      const v = loadLegacy(k);
      if (v) backup[k] = v;
    }
    if (Object.keys(backup).length) await dbSet("migration_backup_" + Date.now(), JSON.stringify(backup));
  } catch {
  }
  try {
    const savesRaw = loadLegacy(STORAGE_KEYS.SAVES);
    const settingsRaw = loadLegacy(STORAGE_KEYS.SETTINGS);
    const curSave = loadLegacy(STORAGE_KEYS.CURRENT_SAVE);
    const balanceRaw = loadLegacy(STORAGE_KEYS.BALANCE);
    const customBal = loadLegacy(STORAGE_KEYS.CUSTOM_BALANCE);
    const msgCount = loadLegacy(STORAGE_KEYS.MESSAGE_COUNT);
    const next = { _migrated: true, _updated: Date.now() };
    if (savesRaw) {
      try {
        const saves = JSON.parse(savesRaw);
        const hotSaves = {};
        for (const [k, s] of Object.entries(saves)) {
          const hist = s.history || [];
          const hot = hist.slice(0, HOT_KEEP);
          const cold = hist.slice(HOT_KEEP);
          hotSaves[k] = { ...s, history: hot, _coldCount: cold.length };
          if (cold.length) await dbSet("cold_" + k, JSON.stringify(cold));
        }
        next.saves = hotSaves;
      } catch {
      }
    }
    if (settingsRaw) try {
      next.settings = JSON.parse(settingsRaw);
    } catch {
    }
    if (curSave) next.currentSave = curSave;
    if (balanceRaw) try {
      next.balance = JSON.parse(balanceRaw);
    } catch {
      next.balance = balanceRaw;
    }
    if (customBal) next.customBalance = customBal;
    if (msgCount) next.messageCount = parseInt(msgCount, 10) || 0;
    saveExtensionSettings({ ...cur || {}, ...next });
  } catch {
  }
}
async function loadHot() {
  await migrateIfNeeded();
  return getExtensionSettings();
}
async function loadHistoryCold(saveKey) {
  try {
    const raw = await dbGet("cold_" + saveKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function appendHistoryCold(saveKey, entries) {
  if (!entries.length) return;
  const cold = await loadHistoryCold(saveKey);
  const next = [...entries, ...cold];
  await dbSet("cold_" + saveKey, JSON.stringify(next));
}
const persistence = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  appendHistoryCold,
  getExtensionSettings,
  loadHistoryCold,
  loadHot,
  migrateIfNeeded,
  saveExtensionSettings,
  saveHot
}, Symbol.toStringTag, { value: "Module" }));
function isWeekendDay(timestamp) {
  const t = typeof timestamp === "number" ? timestamp : timestamp && timestamp.getTime ? timestamp.getTime() : 0;
  const day = new Date(t + 8 * 3600 * 1e3).getUTCDay();
  return day === 6 || day === 0;
}
function isPeakHour$1(timestamp, peakHours) {
  if (isWeekendDay(timestamp)) return false;
  const d = new Date(timestamp);
  const totalMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
  for (const h of peakHours) {
    if (!h || !h.start || !h.end) continue;
    const p = h.start.split(":");
    const q = h.end.split(":");
    const sp = parseInt(p[0]) * 60 + parseInt(p[1] || "0");
    const ep = parseInt(q[0]) * 60 + parseInt(q[1] || "0");
    if (sp < ep) {
      if (totalMinutes >= sp && totalMinutes < ep) return true;
    } else if (totalMinutes >= sp || totalMinutes < ep) {
      return true;
    }
  }
  return false;
}
function localDay(ts) {
  const t = typeof ts === "number" ? ts : ts.getTime();
  return new Date(t + 8 * 3600 * 1e3).toISOString().slice(0, 10);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function mergePrices(base, custom) {
  if (!custom) return base;
  return {
    hit: custom.hit !== void 0 && custom.hit !== "" ? parseFloat(custom.hit) : base.hit,
    miss: custom.miss !== void 0 && custom.miss !== "" ? parseFloat(custom.miss) : base.miss,
    output: custom.output !== void 0 && custom.output !== "" ? parseFloat(custom.output) : base.output
  };
}
function getPricing(model, settings) {
  const m = model || "deepseek-v4-flash";
  const base = PRICING[m] || PRICING["deepseek-v4-flash"];
  for (const cm of settings.customModels || []) {
    if (cm?.model === m) {
      return {
        usePeakPricing: cm.usePeakPricing !== false,
        offpeak: mergePrices(base.offpeak, cm.offpeak),
        peak: mergePrices(base.peak, cm.peak)
      };
    }
  }
  return base;
}
function hasPriceForModel(model, settings) {
  const m = model || "deepseek-v4-flash";
  if (PRICING[m]) return true;
  for (const cm of settings.customModels || []) if (cm?.model === m) return true;
  return false;
}
function isDeepSeekOfficialModel(m) {
  return typeof m === "string" && m.toLowerCase().indexOf("deepseek") === 0;
}
function isPeakHour(timestamp, settings) {
  const hours = settings && settings.peakHours || DEFAULT_PEAK_HOURS;
  return isPeakHour$1(timestamp, hours);
}
function calcCost(u, settings) {
  const model = u.model || "deepseek-v4-flash";
  if (!hasPriceForModel(model, settings)) return { input: 0, output: 0, total: 0, priceType: "old" };
  const pricing = getPricing(model, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p;
  let priceType;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    const isPeak2 = isPeakHour(u.timestamp, settings);
    p = isPeak2 ? pricing.peak : pricing.offpeak;
    priceType = isPeak2 ? "new-peak" : "new-offpeak";
  } else {
    p = pricing.offpeak;
    priceType = useNewPricing ? "new-offpeak" : "old";
  }
  const ih = u.prompt_cache_hit_tokens / 1e6 * p.hit;
  const im = u.prompt_cache_miss_tokens / 1e6 * p.miss;
  const o = u.completion_tokens / 1e6 * p.output;
  return { input: ih + im, output: o, total: ih + im + o, priceType };
}
function calcSavings(u, settings) {
  const model = u.model || "deepseek-v4-flash";
  if (!hasPriceForModel(model, settings)) return 0;
  const pricing = getPricing(model, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    p = isPeakHour(u.timestamp, settings) ? pricing.peak : pricing.offpeak;
  } else p = pricing.offpeak;
  return (u.prompt_cache_hit_tokens || 0) / 1e6 * (p.miss - p.hit);
}
let lastMessages = [];
let lastStart = 0;
function setLastRequest(messages, start) {
  lastMessages = messages || [];
  lastStart = start || Date.now();
}
function installInterception() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (!es || !et) return;
    es.on(et.GENERATION_ENDED, onGenerationEnded);
    es.on(et.MESSAGE_RECEIVED, () => setTimeout(refresh, 400));
    globalThis.ApiUsageStatInterceptor = (chat, _ctxSize, _abort, _type) => {
      try {
        setLastRequest(chat?.slice(-10) || [], Date.now());
      } catch {
      }
    };
  } catch {
  }
}
function onGenerationEnded(...args) {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const chat = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    const usage = extra.api_usage || extra.token_count || extra.usage;
    if (usage) {
      const model = extra.model || tail?.model || ctx?.model || "deepseek-v4-flash";
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    const maybeUsage = args[0]?.usage || args[0]?.token_count;
    if (maybeUsage) {
      const model = args[0]?.model || "deepseek-v4-flash";
      processUsage(maybeUsage, model, lastMessages, lastStart);
    }
  } catch {
  }
}
function refresh() {
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
}
function processUsage(usage, model, messages, startTime, fullRequest = null, fullResponse = null, ttft = 0, thinkTime = 0) {
  messages = messages || [];
  if (!model) {
    try {
      model = globalThis.SillyTavern?.getContext?.().model || "deepseek-v4-flash";
    } catch {
      model = "deepseek-v4-flash";
    }
  }
  let hit = usage.prompt_cache_hit_tokens || 0;
  if (!hit && usage.prompt_tokens_details?.cached_tokens) hit = usage.prompt_tokens_details.cached_tokens;
  let miss = usage.prompt_cache_miss_tokens;
  if (miss === void 0 || miss === null) {
    miss = (usage.prompt_tokens || usage.input_tokens || 0) - hit;
    if (miss < 0) miss = 0;
  }
  const comp = usage.completion_tokens || usage.output_tokens || 0;
  const total = usage.total_tokens || hit + miss + comp;
  const lu = {
    timestamp: Date.now(),
    model,
    prompt_tokens: hit + miss,
    prompt_cache_hit_tokens: hit,
    prompt_cache_miss_tokens: miss,
    completion_tokens: comp,
    total_tokens: total
  };
  const duration = startTime ? Date.now() - startTime : 0;
  const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
  lu.duration = duration;
  lu.tokenRate = duration - (ttft || 0) > 50 && comp > 0 ? Math.round(comp / (duration - (ttft || 0)) * 1e3) : 0;
  lu.ttft = ttft || 0;
  lu.thinkTime = thinkTime || 0;
  lu.thinkTokens = thinkTokens;
  lu.messages = messages;
  const c = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state.settings);
  lu.cost = c.total;
  lu.input_cost = c.input;
  lu.output_cost = c.output;
  lu.priceType = c.priceType;
  lu.raw_usage = usage;
  lu.fullRequest = fullRequest;
  lu.fullResponse = fullResponse;
  state.lastUsage = lu;
  let s = null;
  if (state.currentSave === "__all__") {
    let lt = 0, real = null;
    for (const k of Object.keys(state.saves)) {
      const sv = state.saves[k];
      if (sv && sv.startTime > lt) {
        lt = sv.startTime;
        real = sv;
      }
    }
    s = real || state.saves[Object.keys(state.saves)[0]];
  } else s = state.saves[state.currentSave];
  if (!s) return;
  const priceType = lu.priceType;
  const entry = {
    timestamp: lu.timestamp,
    model,
    prompt_tokens: hit + miss,
    cache_hit_tokens: hit,
    cache_miss_tokens: miss,
    completion_tokens: comp,
    total_tokens: total,
    input_cost: lu.input_cost,
    output_cost: lu.output_cost,
    cost: lu.cost,
    cache_hit_rate: hit + miss > 0 ? hit / (hit + miss) * 100 : 0,
    priceType,
    raw_usage: usage,
    messages,
    duration,
    ttft,
    thinkTime,
    thinkTokens,
    tokenRate: lu.tokenRate,
    fullRequest,
    fullResponse
  };
  s.history.unshift(entry);
  s.total_tokens += total;
  s.total_cost += lu.cost;
  s.input_tokens += hit + miss;
  s.output_tokens += comp;
  s.cache_hit_tokens += hit;
  s.cache_miss_tokens += miss;
  s.input_cost += lu.input_cost;
  s.output_cost += lu.output_cost;
  if (isDeepSeekOfficialModel(model)) s.rounds += 1;
  if (s.history.length > 500) s.history = s.history.slice(0, 500);
  s._mtime = Date.now();
  refresh();
}
function recalcAllCosts() {
  for (const k of Object.keys(state.saves)) {
    const s = state.saves[k];
    for (const h of s.history || []) {
      const c = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings);
      h.input_cost = c.input;
      h.output_cost = c.output;
      h.cost = c.total;
      h.priceType = c.priceType;
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? (h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100 : 0;
    }
  }
}
const interception = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  installInterception,
  processUsage,
  recalcAllCosts,
  setLastRequest
}, Symbol.toStringTag, { value: "Module" }));
const XOR_KEY = "ds-stats-v1-xor-key!@#$%^&*";
function encryptKey(plaintext) {
  if (!plaintext) return "";
  let result = "";
  for (let i = 0; i < plaintext.length; i++) {
    result += String.fromCharCode(plaintext.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
  }
  return btoa(result);
}
function decryptKey(ciphertext) {
  if (!ciphertext) return "";
  try {
    const decoded = atob(ciphertext);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return result;
  } catch {
    return ciphertext;
  }
}
const PREFIX = "[DS]";
const warned = /* @__PURE__ */ new Set();
let debugOn = false;
try {
  debugOn = localStorage.getItem("ds_debug_log") === "1";
} catch {
}
const log = {
  debug(...args) {
    if (debugOn) console.log(PREFIX, ...args);
  },
  warn(msg, ...rest) {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn(PREFIX, msg, ...rest);
  },
  error(...args) {
    console.error(PREFIX, ...args);
  }
};
function toast(type, msg) {
  try {
    const t = window.parent?.toastr ?? window.toastr;
    if (t?.[type]) {
      t[type](msg);
      return;
    }
  } catch {
    log.debug("toastr 不可用: " + msg);
  }
}
function getApiKey() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const ext = ctx?.extensionSettings?.["api_usage_stat"];
    if (ext?.apiKey) return decryptKey(ext.apiKey);
  } catch {
  }
  return "";
}
function saveApiKey(key) {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings["api_usage_stat"] = ctx.extensionSettings["api_usage_stat"] || {};
      ctx.extensionSettings["api_usage_stat"].apiKey = encryptKey(key);
      ctx.saveSettingsDebounced?.();
    }
  } catch {
  }
}
async function queryBalance(apiKey) {
  const key = getApiKey();
  if (!key) {
    toast("error", "请先设置 API 密钥");
    return null;
  }
  try {
    const r = await fetch("https://api.deepseek.com/user/balance", {
      method: "GET",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }
    });
    const d = await r.json();
    if (d.is_available && d.balance_infos?.length) {
      const i = d.balance_infos[0];
      const bal = { balance: i.total_balance, currency: i.currency, available: d.is_available, timestamp: Date.now() };
      state.balance = bal;
      saveHot({ balance: bal });
      toast("success", "余额已更新 ¥" + i.total_balance);
      return bal;
    }
    toast("error", d.error?.message || "查询失败");
    return null;
  } catch (e) {
    log.error("余额查询失败", e);
    toast("error", "网络错误: " + (e?.message || e));
    return null;
  }
}
function isUnsafeKey(k) {
  return k === "__proto__" || k === "constructor" || k === "prototype";
}
function stripDetails(saves) {
  const out = JSON.parse(JSON.stringify(saves || {}));
  for (const k of Object.keys(out)) {
    const sv = out[k];
    if (sv?.history) for (const h of sv.history) {
      delete h.messages;
      delete h.fullRequest;
      delete h.fullResponse;
    }
  }
  return out;
}
function exportHistory() {
  const doc = window.parent?.document ?? document;
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => n < 10 ? "0" + n : "" + n;
  const payload = {
    format: "deepseek-stat-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    appVersion: "3.0.0",
    data: {
      saves: stripDetails(state.saves),
      currentSave: state.currentSave,
      balance: state.balance,
      customBalance: state.customBalance,
      settings: JSON.parse(JSON.stringify(state.settings)),
      messageCount: state.messageCount
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = `API用量统计_导出_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
    }
  }, 1e3);
}
function normalizeImportData(raw) {
  let version = raw.version ?? 1;
  if (typeof version !== "number" || isNaN(version) || version < 1) version = 1;
  if (version > EXPORT_FORMAT_VERSION) return { error: `文件版本 v${version} 高于当前 v${EXPORT_FORMAT_VERSION}，请升级扩展` };
  const d = raw.data;
  if (!d || typeof d !== "object") return { error: "文件中缺少数据" };
  if (!d.saves || typeof d.saves !== "object") d.saves = {};
  const saves = {};
  let skipped = { saves: 0, entries: 0 };
  for (const k of Object.keys(d.saves)) {
    if (isUnsafeKey(k)) continue;
    const s = d.saves[k];
    if (!s || typeof s !== "object") {
      skipped.saves++;
      continue;
    }
    const ns = { name: s.name || k, character: s.character ?? "", customBalance: s.customBalance ?? null };
    if (s.startTime !== void 0) ns.startTime = s.startTime;
    const hs = [];
    if (Array.isArray(s.history)) for (const h of s.history) {
      if (!h || typeof h !== "object" || h.timestamp === void 0 || isNaN(h.timestamp)) {
        skipped.entries++;
        continue;
      }
      const nh = { timestamp: h.timestamp, model: h.model || "unknown", prompt_tokens: h.prompt_tokens || 0, cache_hit_tokens: h.cache_hit_tokens || 0, cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0, total_tokens: h.total_tokens || 0, priceType: h.priceType || "old" };
      for (const f of Object.keys(h)) {
        if (isUnsafeKey(f)) continue;
        if (nh[f] === void 0) nh[f] = h[f];
      }
      hs.push(nh);
    }
    ns.history = hs;
    for (const f of Object.keys(s)) {
      if (isUnsafeKey(f) || f === "history") continue;
      if (ns[f] === void 0) ns[f] = s[f];
    }
    saves[k] = ns;
  }
  d.saves = saves;
  return { data: d, skipped };
}
function applyImportedData(d, mode) {
  for (const k of Object.keys(d.saves || {})) {
    if (isUnsafeKey(k)) continue;
    const s = d.saves[k];
    if (!s) continue;
    s.name = s.name || k;
    if (s.character === void 0) s.character = "";
    if (s.customBalance === void 0) s.customBalance = null;
    s.history = Array.isArray(s.history) ? s.history : [];
    s.history.forEach((h) => {
      if (h && h.priceType === void 0) h.priceType = "old";
    });
  }
  if (mode === "overwrite") {
    state.saves = d.saves || {};
    state.currentSave = d.currentSave && d.saves[d.currentSave] ? d.currentSave : null;
    if (d.balance !== void 0) state.balance = d.balance;
    if (d.customBalance !== void 0) state.customBalance = d.customBalance;
    if (d.settings) state.settings = d.settings;
    if (d.messageCount !== void 0) state.messageCount = d.messageCount;
  } else {
    for (const k of Object.keys(d.saves || {})) {
      if (isUnsafeKey(k)) continue;
      const s = d.saves[k];
      if (!state.saves[k]) state.saves[k] = s;
      else {
        const seen = {};
        (state.saves[k].history || []).forEach((h) => {
          if (h) seen[h.timestamp] = true;
        });
        (s.history || []).forEach((h) => {
          if (h && !seen[h.timestamp]) {
            seen[h.timestamp] = true;
            state.saves[k].history.push(h);
          }
        });
        state.saves[k].history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (state.saves[k].history.length > MAX_HISTORY) state.saves[k].history = state.saves[k].history.slice(0, MAX_HISTORY);
      }
    }
  }
  if (!state.currentSave || !state.saves[state.currentSave]) {
    const keys = Object.keys(state.saves);
    state.currentSave = keys.length ? keys[0] : null;
  }
  recalcAllCosts();
  saveHot({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance, messageCount: state.messageCount });
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
}
function bindImportExport(doc) {
  const exp = doc.getElementById("aus-btn-export");
  if (exp) exp.onclick = () => exportHistory();
  const imp = doc.getElementById("aus-btn-import");
  if (imp) imp.onclick = () => triggerImport();
}
function triggerImport() {
  const doc = window.parent?.document ?? document;
  let inputEl = doc.getElementById("aus-import-file");
  if (!inputEl) {
    const el = doc.createElement("input");
    el.type = "file";
    el.id = "aus-import-file";
    el.accept = ".json,application/json";
    el.style.display = "none";
    doc.body.appendChild(el);
    el.addEventListener("change", () => {
      const inp = el;
      const file = inp.files?.[0];
      inp.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let raw = null;
        try {
          raw = JSON.parse(reader.result);
        } catch {
        }
        if (!raw || raw.format !== "deepseek-stat-export") return alert("导入失败：文件格式不正确");
        const res = normalizeImportData(raw);
        if (res.error) return alert("导入失败：" + res.error);
        const mode = confirm("确定导入？\n确定=覆盖导入（替换全部）\n取消=合并导入（按时间戳去重）\n（合并更安全）") ? "overwrite" : "merge";
        if (mode === "overwrite" && !confirm("覆盖将替换全部数据，确定？")) return;
        applyImportedData(res.data, mode);
        alert(mode === "overwrite" ? "已覆盖导入" : "已合并导入");
      };
      reader.readAsText(file, "utf-8");
    });
    inputEl = el;
  }
  inputEl.click();
}
const WEBDAV_PASS_KEY = "ds_webdav_pass";
function b64(s) {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return btoa(s);
  }
}
function rawFetch() {
  try {
    const p = window.parent;
    return p?.fetch?.bind(p) ?? fetch.bind(window);
  } catch {
    return fetch.bind(window);
  }
}
function authHeader() {
  const cfg = state.settings.webdav || {};
  let pass = "";
  try {
    pass = decryptKey(localStorage.getItem("ds_" + WEBDAV_PASS_KEY) || "");
  } catch {
  }
  try {
    const v = globalThis.SillyTavern?.getContext?.().extensionSettings?.["api_usage_stat"]?.webdavPass;
    if (v) pass = decryptKey(v);
  } catch {
  }
  return "Basic " + b64((cfg.username || "") + ":" + pass);
}
function realUrl() {
  const cfg = state.settings.webdav || {};
  const base = (cfg.url || "").trim().replace(/\/+$/, "");
  const path = (cfg.path || "").trim().replace(/^\/+|\/+$/g, "");
  let u = base + "/";
  if (path) u += path + "/";
  u += WEBDAV_SYNC_FILE;
  return u;
}
function reqUrl(u) {
  const proxy = (state.settings.webdav?.proxy || "").trim();
  if (!proxy) return u;
  if (proxy.indexOf("?") !== -1) return proxy + encodeURIComponent(u);
  return proxy.replace(/\/+$/, "") + "/" + encodeURIComponent(u);
}
function dirs() {
  const cfg = state.settings.webdav || {};
  const base = (cfg.url || "").trim().replace(/\/+$/, "");
  const path = (cfg.path || "").trim().replace(/^\/+|\/+$/g, "");
  const out = [];
  if (path) {
    let acc = base;
    path.split("/").forEach((seg) => {
      if (seg) {
        acc += "/" + seg;
        out.push(acc);
      }
    });
  }
  return out;
}
async function webdavGet() {
  const url = reqUrl(realUrl());
  try {
    const r = await rawFetch()(url, { method: "GET", headers: { Authorization: authHeader(), Accept: "*/*" } });
    if (r.status === 404) return { exists: false };
    if (!r.ok) return { exists: true, error: true, status: r.status };
    const t = await r.text();
    return { exists: true, text: t };
  } catch (e) {
    return { exists: false, netError: true, errName: e?.name || "", errMsg: e?.message || String(e) };
  }
}
async function webdavMkcol(dir) {
  const url = reqUrl(dir);
  try {
    const r = await rawFetch()(url, { method: "MKCOL", headers: { Authorization: authHeader() } });
    return r.status === 201 || r.status === 405 || r.status === 409 || r.status === 204;
  } catch {
    return false;
  }
}
async function webdavPut(text) {
  for (const d of dirs()) await webdavMkcol(d);
  const url = reqUrl(realUrl());
  const r = await rawFetch()(url, { method: "PUT", headers: { Authorization: authHeader(), "Content-Type": "application/json; charset=utf-8" }, body: text });
  if (!r.ok) throw new Error("上传失败 HTTP " + r.status);
}
function buildLocalBundle() {
  const saves = {};
  for (const k of Object.keys(state.saves)) {
    const ns = JSON.parse(JSON.stringify(state.saves[k] || {}));
    if (ns.history) for (const h of ns.history) {
      delete h.messages;
      delete h.fullRequest;
      delete h.fullResponse;
    }
    saves[k] = ns;
  }
  return { format: "deepseek-stat-sync", version: WEBDAV_REMOTE_VERSION, syncedAt: Date.now(), data: { saves, currentSave: state.currentSave, balance: state.balance, customBalance: state.customBalance, settings: JSON.parse(JSON.stringify(state.settings)), messageCount: state.messageCount }, _ts: {} };
}
function mergeBundles(remote, local) {
  const rd = remote.data || {}, ld = local.data || {};
  let saves = {};
  const keys = {};
  Object.keys(ld.saves || {}).forEach((k) => keys[k] = 1);
  Object.keys(rd.saves || {}).forEach((k) => keys[k] = 1);
  let pulled = 0, pushed = 0;
  for (const k of Object.keys(keys)) {
    const ls = ld.saves?.[k], rs = rd.saves?.[k];
    if (!rs) {
      saves[k] = JSON.parse(JSON.stringify(ls));
      pushed += ls?.history?.length || 0;
      continue;
    }
    if (!ls) {
      saves[k] = JSON.parse(JSON.stringify(rs));
      pulled += rs?.history?.length || 0;
      continue;
    }
    const lseen = {}, rseen = {};
    (ls.history || []).forEach((h) => {
      if (h?.timestamp !== void 0) lseen[h.timestamp] = true;
    });
    (rs.history || []).forEach((h) => {
      if (h?.timestamp !== void 0) rseen[h.timestamp] = true;
    });
    const hist = [];
    (rs.history || []).forEach((h) => {
      if (h?.timestamp !== void 0 && !lseen[h.timestamp]) {
        pulled++;
        hist.push(h);
      }
    });
    (ls.history || []).forEach((h) => {
      if (!h || h.timestamp === void 0) return;
      if (!rseen[h.timestamp]) {
        pushed++;
        hist.push(h);
      } else {
        for (let i = 0; i < hist.length; i++) if (hist[i].timestamp === h.timestamp) {
          hist[i] = h;
          break;
        }
      }
    });
    hist.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const outHist = hist.length > MAX_HISTORY ? hist.slice(0, MAX_HISTORY) : hist;
    const lm = ls._mtime || ls.startTime || 0, rm = rs._mtime || rs.startTime || 0;
    const ns = {};
    ["name", "character", "customBalance", "startTime", "total_tokens", "total_cost", "input_tokens", "output_tokens", "cache_hit_tokens", "cache_miss_tokens", "input_cost", "output_cost", "rounds"].forEach((f) => {
      ns[f] = lm >= rm ? ls[f] !== void 0 ? ls[f] : rs[f] : rs[f] !== void 0 ? rs[f] : ls[f];
    });
    ns._mtime = Math.max(lm, rm);
    ns.history = outHist;
    [ls, rs].forEach((src) => {
      if (src) {
        for (const f of Object.keys(src)) if (ns[f] === void 0) ns[f] = src[f];
      }
    });
    saves[k] = ns;
  }
  const data = { saves, currentSave: ld.currentSave ?? rd.currentSave, balance: ld.balance ?? rd.balance, customBalance: ld.customBalance ?? rd.customBalance, messageCount: ld.messageCount ?? rd.messageCount, settings: ld.settings ?? rd.settings };
  return { mergedData: data, pulled, pushed };
}
let syncing = false;
async function doSyncNow() {
  if (syncing) return alert("同步进行中");
  const cfg = state.settings.webdav || {};
  if (!cfg.url || !cfg.username) return alert("请先在设置中填写 WebDAV 地址与用户名");
  if (!/^https:\/\//i.test(cfg.url)) return alert("WebDAV 地址必须为 https");
  syncing = true;
  const btn = window.parent?.document?.getElementById("aus-webdav-sync");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "同步中…";
  }
  const local = buildLocalBundle();
  try {
    const res = await webdavGet();
    if (res.netError) {
      const isCors = res.errName === "TypeError" || /Failed to fetch|NetworkError|CORS/i.test(res.errMsg || "");
      throw new Error(isCors ? "CORS 被拦截，请配置 CORS 代理" : "网络错误: " + (res.errMsg || "未知"));
    }
    if (res.error) throw new Error("读取云端失败 HTTP " + res.status);
    let merged;
    if (!res.exists) merged = { mergedData: local.data, pulled: 0, pushed: 0 };
    else {
      let remote;
      try {
        remote = JSON.parse(res.text);
      } catch {
        throw new Error("云端文件解析失败");
      }
      if (remote.format !== "deepseek-stat-sync") throw new Error("云端格式不符");
      if (remote.version > WEBDAV_REMOTE_VERSION) throw new Error("云端版本过高，请升级扩展");
      merged = mergeBundles(remote, local);
    }
    state.saves = merged.mergedData.saves || {};
    state.currentSave = merged.mergedData.currentSave;
    state.balance = merged.mergedData.balance;
    state.customBalance = merged.mergedData.customBalance;
    state.messageCount = merged.mergedData.messageCount || 0;
    if (merged.mergedData.settings) state.settings = merged.mergedData.settings;
    const { recalcAllCosts: recalcAllCosts2 } = await Promise.resolve().then(() => interception);
    recalcAllCosts2();
    const { saveHot: saveHot2 } = await Promise.resolve().then(() => persistence);
    saveHot2({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance, messageCount: state.messageCount });
    await webdavPut(JSON.stringify(buildLocalBundle()));
    alert(`同步完成${merged.pulled ? `（拉取 ${merged.pulled} 条）` : ""}${merged.pushed ? `（上传 ${merged.pushed} 条）` : ""}`);
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  } catch (e) {
    alert("同步失败: " + (e?.message || e));
  } finally {
    syncing = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "☁️ 立即同步";
    }
  }
}
function saveWebdavPass(pass) {
  try {
    localStorage.setItem("ds_ds_webdav_pass", encryptKey(pass));
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.extensionSettings) {
      ctx.extensionSettings["api_usage_stat"] = ctx.extensionSettings["api_usage_stat"] || {};
      ctx.extensionSettings["api_usage_stat"].webdavPass = encryptKey(pass);
      ctx.saveSettingsDebounced?.();
    }
  } catch {
  }
}
function renderSettings(doc) {
  const host = doc.getElementById("aus-settings");
  if (!host) return;
  host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div class="ds-card"><div class="ds-card-title">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="sk-..." style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" value="" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div></div>
      <div class="ds-card"><div class="ds-card-title">自定义余额</div><div style="display:flex;gap:8px;"><input id="aus-custom-balance" placeholder="如 50.00" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /><button id="aus-save-balance" class="ds-btn-pill" style="padding:8px 14px;">保存</button><button id="aus-clear-balance" style="padding:8px 14px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:12px;cursor:pointer;">清除</button></div><div id="aus-balance-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div></div>
      <div class="ds-card"><div class="ds-card-title">峰值提示小圆点</div><label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;"><input type="checkbox" id="aus-peak-dot" /> 启用峰值圆点（红/黄/绿）</label><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">重置位置</button></div>
      <div class="ds-card"><div class="ds-card-title">WebDAV 云同步</div><div style="font-size:11px;color:#6B7280;margin-bottom:8px;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
        <div style="display:grid;gap:8px;">
          <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /></div>
          <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button><div id="aus-webdav-status" style="font-size:11px;color:#6B7280;"></div>
        </div>
      </div>
    </div>
  `;
  const apiKeyEl = doc.getElementById("aus-api-key");
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const v = ctx?.extensionSettings?.["api_usage_stat"]?.apiKey;
    if (v && apiKeyEl) apiKeyEl.value = decryptKey(v);
  } catch {
  }
  doc.getElementById("aus-custom-balance").value = state.customBalance || "";
  doc.getElementById("aus-peak-dot").checked = state.settings.peakDot !== false;
  doc.getElementById("aus-webdav-url").value = state.settings.webdav?.url || "";
  doc.getElementById("aus-webdav-user").value = state.settings.webdav?.username || "";
  doc.getElementById("aus-webdav-path").value = state.settings.webdav?.path || "";
  doc.getElementById("aus-webdav-proxy").value = state.settings.webdav?.proxy || "";
  try {
    const pass = localStorage.getItem("ds_ds_webdav_pass") || "";
    const el = doc.getElementById("aus-webdav-pass");
    if (pass && el) el.value = decryptKey(pass);
  } catch {
  }
  doc.getElementById("aus-save-key").onclick = () => {
    const v = doc.getElementById("aus-api-key").value.trim();
    saveApiKey(v);
    const s = doc.getElementById("aus-key-status");
    s.textContent = v ? "已保存" : "已清空";
  };
  doc.getElementById("aus-save-balance").onclick = () => {
    const v = doc.getElementById("aus-custom-balance").value.trim();
    if (v && isNaN(parseFloat(v))) return alert("请输入有效金额");
    state.customBalance = v || null;
    saveHot({ customBalance: state.customBalance });
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
    doc.getElementById("aus-balance-status").textContent = v ? "已保存" : "已清除";
  };
  doc.getElementById("aus-clear-balance").onclick = () => {
    state.customBalance = null;
    saveHot({ customBalance: null });
    doc.getElementById("aus-custom-balance").value = "";
    doc.getElementById("aus-balance-status").textContent = "已清除";
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  doc.getElementById("aus-peak-dot").onchange = (e) => {
    state.settings.peakDot = e.target.checked;
    saveHot({ settings: state.settings });
    try {
      globalThis.ApiUsageStat?.updatePeakDot?.();
    } catch {
    }
  };
  doc.getElementById("aus-reset-dot").onclick = () => {
    try {
      localStorage.removeItem("ds_ds_peak_dot_pos");
    } catch {
    }
    alert("已重置");
  };
  const wUrl = doc.getElementById("aus-webdav-url");
  const wUser = doc.getElementById("aus-webdav-user");
  const wPath = doc.getElementById("aus-webdav-path");
  const wProxy = doc.getElementById("aus-webdav-proxy");
  const wPass = doc.getElementById("aus-webdav-pass");
  if (wUrl) wUrl.onchange = () => {
    state.settings.webdav.url = wUrl.value.trim();
    saveHot({ settings: state.settings });
  };
  if (wUser) wUser.onchange = () => {
    state.settings.webdav.username = wUser.value.trim();
    saveHot({ settings: state.settings });
  };
  if (wPath) wPath.onchange = () => {
    state.settings.webdav.path = wPath.value.trim();
    saveHot({ settings: state.settings });
  };
  if (wProxy) wProxy.onchange = () => {
    state.settings.webdav.proxy = wProxy.value.trim();
    saveHot({ settings: state.settings });
  };
  if (wPass) wPass.onchange = () => saveWebdavPass(wPass.value);
  doc.getElementById("aus-webdav-sync").onclick = () => doSyncNow();
}
function getDoc$5() {
  return window.parent?.document ?? document;
}
function fmt(n) {
  return n.toLocaleString("zh-CN");
}
function renderStats() {
  const doc = getDoc$5();
  const s = getSelectedSave();
  if (!s) return;
  const host = doc.getElementById("aus-stats");
  if (!host) return;
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0;
  const rounds = s.rounds || 0;
  const hitRate = hit + miss > 0 ? hit / (hit + miss) * 100 : 0;
  const avgCost = rounds ? totalCost / rounds : 0;
  const avgTokens = rounds ? totalTokens / rounds : 0;
  let savings = 0;
  try {
    for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings);
  } catch {
  }
  const inputCost = s.input_cost || 0, outputCost = s.output_cost || 0;
  const latest = (s.history || [])[0];
  const latestRate = latest ? latest.cache_hit_rate || 0 : 0;
  let maxCost = 0, minCost = Infinity, maxTok = 0, minTok = Infinity;
  for (const h of s.history || []) {
    const c = h.cost || 0, t = h.total_tokens || 0;
    if (c > maxCost) maxCost = c;
    if (c < minCost) minCost = c;
    if (t > maxTok) maxTok = t;
    if (t < minTok) minTok = t;
  }
  if (!isFinite(minCost)) minCost = 0;
  if (!isFinite(minTok)) minTok = 0;
  const avgIn = rounds ? (s.input_tokens || 0) / rounds : 0;
  const avgOut = rounds ? (s.output_tokens || 0) / rounds : 0;
  const avgDur = rounds ? (s.history || []).reduce((a, h) => a + (h.duration || 0), 0) / rounds / 1e3 : 0;
  const avgSpeed = rounds ? (s.history || []).reduce((a, h) => a + (h.tokenRate || 0), 0) / rounds : 0;
  const cards = [
    { title: "总消耗", val: "¥" + totalCost.toFixed(4), sub: fmt(totalTokens) + " tokens" },
    { title: "加权命中率", val: hitRate.toFixed(1) + "%", sub: "基于 " + rounds + " 轮", accent: true },
    { title: "平均每轮", val: "¥" + avgCost.toFixed(4), sub: Math.round(avgTokens) + " tokens" },
    { title: "预计节省", val: "¥" + savings.toFixed(4), sub: fmt(hit) + " hit tokens", accent: true },
    { title: "输入费用", val: "¥" + inputCost.toFixed(4), sub: fmt(s.input_tokens || 0) + " tokens" },
    { title: "输出费用", val: "¥" + outputCost.toFixed(4), sub: fmt(s.output_tokens || 0) + " tokens" },
    { title: "总 Tokens", val: fmt(totalTokens), sub: "平均 " + Math.round(avgTokens) + "/轮" },
    { title: "命中 Tokens", val: fmt(hit), sub: "占输入 " + (hit + miss > 0 ? (hit / (hit + miss) * 100).toFixed(1) : "0") + "%" },
    { title: "未命中 Tokens", val: fmt(miss), sub: "占输入 " + (hit + miss > 0 ? (miss / (hit + miss) * 100).toFixed(1) : "0") + "%" },
    { title: "对话轮数", val: String(rounds), sub: "轮对话" },
    { title: "单轮最大", val: "¥" + maxCost.toFixed(4), sub: maxCost ? fmt(maxTok) + " tokens" : "暂无数据" },
    { title: "单轮最小", val: "¥" + minCost.toFixed(4), sub: s.history?.length ? fmt(minTok) + " tokens" : "暂无数据" },
    { title: "最新命中率", val: latest ? latestRate.toFixed(1) + "%" : "-", sub: latest ? latest.model : "暂无数据", accent: true },
    { title: "平均输入", val: Math.round(avgIn).toString(), sub: "tokens/轮" },
    { title: "平均输出", val: Math.round(avgOut).toString(), sub: "tokens/轮" },
    { title: "平均耗时", val: avgDur.toFixed(1) + "s", sub: "首延 " + (s.history?.[0]?.ttft ? (s.history[0].ttft / 1e3).toFixed(1) + "s" : "-") },
    { title: "平均速率", val: Math.round(avgSpeed) + " t/s", sub: avgSpeed ? "tokens/秒" : "暂无数据", accent: true },
    { title: "思维链", val: (latest?.thinkTokens || 0) + " tk", sub: latest?.thinkTime ? (latest.thinkTime / 1e3).toFixed(1) + "s" : "—" }
  ];
  host.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">` + cards.map((c) => `
    <div class="ds-card" style="padding:12px 14px;">
      <div class="ds-card-title" style="font-size:11px;">${c.title}</div>
      <div class="${c.accent ? "ds-card-val" : "ds-card-val"}" style="${c.accent ? "color:#0BA25E;" : ""}font-size:18px;">${c.val}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.sub}</div>
    </div>
  `).join("") + `</div>`;
}
let chart = null;
let heatChart = null;
async function getECharts() {
  const echarts = await import("./core-DHCzIie4.js");
  const { BarChart, HeatmapChart } = await import("./charts-C377pMlY.js");
  const { GridComponent, TooltipComponent, VisualMapComponent } = await import("./components-DIeLoJQ9.js");
  const { CanvasRenderer } = await import("./renderers-B8lc3lud.js");
  echarts.use([BarChart, HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);
  return echarts;
}
function getDoc$4() {
  return window.parent?.document ?? document;
}
function aggregateByDay(entries) {
  const map = {};
  for (const e of entries) {
    const k = localDay(e.timestamp);
    if (!map[k]) map[k] = { cost: 0, tokens: 0, count: 0 };
    map[k].cost += e.cost || 0;
    map[k].tokens += e.total_tokens || 0;
    map[k].count++;
  }
  const keys = Object.keys(map).sort();
  return keys.map((k) => ({ day: k.slice(5).replace("-", "/"), cost: map[k].cost, tokens: map[k].tokens, count: map[k].count }));
}
async function renderCharts() {
  const doc = getDoc$4();
  const s = getSelectedSave();
  if (!s) return;
  const barEl = doc.getElementById("aus-chart-bar");
  if (!barEl) return;
  const entries = s.history || [];
  if (!entries.length) {
    barEl.innerHTML = '<div style="text-align:center;padding:24px;color:#9CA3AF;font-size:12px;">暂无数据，发起一次对话后自动统计</div>';
    return;
  }
  const echarts = await getECharts();
  const agg = aggregateByDay(entries);
  const days = agg.map((a) => a.day);
  const costs = agg.map((a) => Number(a.cost.toFixed(4)));
  if (!chart) chart = echarts.init(barEl);
  chart.setOption({
    backgroundColor: "transparent",
    grid: { left: 32, right: 12, top: 12, bottom: 28 },
    tooltip: { trigger: "axis", backgroundColor: "#111827", textStyle: { color: "#fff", fontSize: 11 }, borderWidth: 0 },
    xAxis: { type: "category", data: days, axisLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 } },
    series: [{ type: "bar", data: costs, itemStyle: { color: "#FF6A00", borderRadius: [4, 4, 0, 0] }, barWidth: 14, emphasis: { itemStyle: { color: "#FF7A00" } } }]
  });
  const heatEl = doc.getElementById("aus-heatmap");
  if (heatEl) {
    if (!heatChart) heatChart = echarts.init(heatEl);
    const max = Math.max(...agg.map((a) => a.tokens), 1);
    heatChart.setOption({
      backgroundColor: "transparent",
      tooltip: { formatter: (p) => `${p.data[0]}: ${p.data[1]} tokens` },
      grid: { left: 40, right: 12, top: 8, bottom: 24 },
      xAxis: { type: "category", data: days, axisLabel: { color: "#9CA3AF", fontSize: 10 }, axisLine: { lineStyle: { color: "#E5E7EB" } } },
      yAxis: { type: "category", data: ["Tokens"], axisLabel: { color: "#9CA3AF" }, axisLine: { show: false }, splitLine: { show: false } },
      visualMap: { min: 0, max, show: false, inRange: { color: ["#FFF7ED", "#FF6A00"] } },
      series: [{ type: "heatmap", data: agg.map((a, i) => [i, 0, a.tokens]), label: { show: false }, emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.2)" } } }]
    });
  }
}
let selOld = null;
let selNew = null;
function getDoc$3() {
  return window.parent?.document ?? document;
}
function diffMessages(oldMsgs, newMsgs) {
  const toText = (m) => `${m.role || ""}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`;
  const a = (oldMsgs || []).map(toText).join("\n");
  const b = (newMsgs || []).map(toText).join("\n");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return '<span style="color:#6B7280;">两条请求完全一致（缓存命中段完整）</span>';
  const ctx = 80;
  const aCtx = a.slice(Math.max(0, i - ctx), i) + '<span style="background:#FEE2E2;color:#B91C1C;padding:0 2px;border-radius:3px;">' + esc(a.slice(i, i + 200)) + "</span>" + esc(a.slice(i + 200, i + 280));
  const bCtx = b.slice(Math.max(0, i - ctx), i) + '<span style="background:#DCFCE7;color:#15803D;padding:0 2px;border-radius:3px;">' + esc(b.slice(i, i + 200)) + "</span>" + esc(b.slice(i + 200, i + 280));
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;">旧：${aCtx}</div><div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;">新：${bCtx}</div></div><div style="font-size:11px;color:#6B7280;margin-top:8px;">差异起点即缓存发散位置，前 ${i} 字符一致为命中段</div>`;
}
function bindHistoryCompare() {
  const doc = getDoc$3();
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains("aus-compare-old") || t.classList.contains("aus-compare-new")) {
      const ts = parseInt(t.getAttribute("data-ts") || "0");
      if (t.classList.contains("aus-compare-old")) selOld = ts;
      else selNew = ts;
      renderDiff();
    }
    if (t.id === "aus-diff-fullscreen") {
      const m = doc.getElementById("aus-diff");
      if (m) m.classList.toggle("aus-diff-full");
    }
  });
}
function renderDiff() {
  const doc = getDoc$3();
  const host = doc.getElementById("aus-diff");
  if (!host) return;
  if (selOld == null || selNew == null) {
    host.innerHTML = '<div style="text-align:center;padding:16px;color:#9CA3AF;font-size:12px;">已选 ' + (selOld != null ? "旧 " : "") + (selNew != null ? "新 " : "") + "，请在历史中各选一条 旧/新 进行对比</div>";
    return;
  }
  const s = getSelectedSave();
  const oldEntry = (s?.history || []).find((h) => h.timestamp === selOld);
  const newEntry = (s?.history || []).find((h) => h.timestamp === selNew);
  if (!oldEntry || !newEntry) {
    host.innerHTML = '<div style="color:#B91C1C;font-size:12px;">未找到对应记录</div>';
    return;
  }
  host.innerHTML = diffMessages(oldEntry.messages || [], newEntry.messages || []);
}
function renderUsageDetail(ts) {
  const doc = getDoc$3();
  const s = getSelectedSave();
  const h = (s?.history || []).find((x) => x.timestamp === ts);
  if (!h) return;
  let overlay = doc.getElementById("aus-usage-overlay");
  if (!overlay) {
    overlay = doc.createElement("div");
    overlay.id = "aus-usage-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
    overlay.innerHTML = '<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:80vh;overflow:auto;padding:16px;" id="aus-usage-box"></div>';
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.style.display = "none";
    });
    doc.body.appendChild(overlay);
  }
  overlay.style.display = "flex";
  const box = doc.getElementById("aus-usage-box");
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><b style="font-size:14px;color:#111827;">使用详情</b><button onclick="document.getElementById('aus-usage-overlay').style.display='none'" style="border:1px solid #E5E7EB;border-radius:999px;background:#fff;padding:6px 10px;cursor:pointer;">✕</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">模型</div><div style="font-weight:600;color:#111827;">${esc(h.model)}</div></div>
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">费用</div><div style="font-weight:700;color:#111827;">¥${(h.cost || 0).toFixed(4)}</div></div>
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">Tokens</div><div>${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.total_tokens || 0} 总</div></div>
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">命中率</div><div>${(h.cache_hit_rate || 0).toFixed(1)}%</div></div>
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">耗时/速率</div><div>${h.duration || 0}ms · ${h.tokenRate || 0} t/s · 首延 ${h.ttft || 0}ms</div></div>
      <div style="background:#F6F7F8;border-radius:10px;padding:10px;"><div style="color:#6B7280;font-size:11px;">思维链</div><div>${h.thinkTokens || 0} tk · ${h.thinkTime || 0}ms</div></div>
    </div>
  `;
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.classList?.contains("aus-usage-btn")) {
      const ts2 = parseInt(t.getAttribute("data-ts") || "0");
      renderUsageDetail(ts2);
    }
  }, { once: true });
}
function getDoc$2() {
  return window.parent?.document ?? document;
}
function renderCustomizer() {
  const doc = getDoc$2();
  const host = doc.getElementById("aus-customizer");
  if (!host) return;
  const allKeys = ["总消耗", "加权命中率", "平均每轮", "预计节省", "输入费用", "输出费用", "总 Tokens", "命中 Tokens", "未命中 Tokens", "对话轮数", "单轮最大", "单轮最小", "最新命中率", "平均输入", "平均输出", "平均耗时", "平均速率", "思维链"];
  host.innerHTML = `
    <details style="background:#F6F7F8;border-radius:10px;padding:10px 12px;">
      <summary style="font-size:12px;font-weight:600;color:#111827;cursor:pointer;list-style:none;">显示设置（${allKeys.length} 项）</summary>
      <div style="font-size:11px;color:#6B7280;margin-top:8px;">后续可按需显隐，当前已按脚本 1:1 全部展示。对齐 DeepSeek 浅色卡，无删减。</div>
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
        ${allKeys.map((k) => `<span style="padding:4px 8px;background:#fff;border:1px solid #E5E7EB;border-radius:999px;font-size:11px;color:#111827;">${k}</span>`).join("")}
      </div>
    </details>
  `;
}
function getDoc$1() {
  return window.parent?.document ?? document;
}
function refreshUI() {
  try {
    const doc = getDoc$1();
    const s = getSelectedSave();
    if (!s) return;
    const totalCostEl = doc.getElementById("aus-total-cost");
    const totalTokensEl = doc.getElementById("aus-total-tokens");
    const roundsEl = doc.getElementById("aus-rounds");
    const hitRateEl = doc.getElementById("aus-hit-rate");
    const balanceEl = doc.getElementById("aus-balance");
    const cost = (s.total_cost || 0).toFixed(4);
    const tokens = s.total_tokens || 0;
    const hitRate = (s.cache_hit_tokens || 0) + (s.cache_miss_tokens || 0) > 0 ? (s.cache_hit_tokens / (s.cache_hit_tokens + s.cache_miss_tokens) * 100).toFixed(1) : "0.0";
    if (totalCostEl) totalCostEl.textContent = "¥" + cost;
    if (totalTokensEl) totalTokensEl.textContent = String(tokens);
    if (roundsEl) roundsEl.textContent = String(s.rounds || 0) + " 轮";
    if (hitRateEl) hitRateEl.textContent = hitRate + "%";
    const bal = state.customBalance || state.balance?.balance;
    if (balanceEl) balanceEl.textContent = bal ? "¥" + bal + " CNY" : "¥0.00 CNY";
    renderHistory(doc, s);
    renderStats();
    renderCharts();
  } catch {
  }
}
function renderHistory(doc, s) {
  const host = doc.getElementById("aus-history");
  if (!host) return;
  const hist = s.history || [];
  if (!hist.length) {
    host.innerHTML = '<div style="text-align:center;padding:16px;color:#9CA3AF;font-size:12px;">暂无历史记录</div>';
    return;
  }
  host.innerHTML = hist.slice(0, 50).map((h) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#F6F7F8;border-radius:10px;margin-bottom:6px;font-size:12px;">
      <div style="min-width:0;flex:1;">
        <div style="font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.model)} · ${esc(localDay(h.timestamp))}</div>
        <div style="color:#6B7280;margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.duration || 0}ms · ${h.tokenRate || 0} t/s</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
        <div>
          <div style="font-weight:700;color:#111827;">¥${(h.cost || 0).toFixed(4)}</div>
          <div style="color:#9CA3AF;font-size:11px;">${(h.cache_hit_rate || 0).toFixed(1)}% 命中</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">旧</button>
          <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">新</button>
          <button class="aus-usage-btn" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #111827;border-radius:6px;background:#111827;color:#fff;font-size:10px;cursor:pointer;">详情</button>
        </div>
      </div>
    </div>
  `).join("");
  host.querySelectorAll(".aus-usage-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ts = parseInt(btn.getAttribute("data-ts") || "0");
      renderUsageDetail(ts);
    });
  });
}
function bindPanel(doc) {
  const q = doc.getElementById("aus-btn-query-balance");
  if (q) q.onclick = () => queryBalance();
  const sel = doc.getElementById("aus-save-select");
  if (sel) sel.onchange = (e) => {
    state.currentSave = e.target.value;
    try {
      globalThis.SillyTavern?.getContext?.().saveSettingsDebounced?.();
    } catch {
    }
    refreshUI();
  };
}
function injectPanel() {
  const doc = getDoc$1();
  if (doc.getElementById("api-usage-stat-panel")) return;
  const host = doc.getElementById("api-usage-stat-root");
  if (!host) return;
  const content = host.querySelector(".inline-drawer-content");
  if (!content) return;
  const panel = doc.createElement("div");
  panel.id = "api-usage-stat-panel";
  panel.setAttribute("data-extension", "api-usage-stat");
  panel.setAttribute("data-ds-theme", "light");
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导入</button></div></div>
      <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.00</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px;" id="aus-total-tokens">0 tokens</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <select id="aus-save-select" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;"></select>
      <span style="font-size:11px;color:#6B7280;">共 <span id="aus-rounds">0 轮</span> · 命中 <span id="aus-hit-rate">0%</span></span>
    </div>
    <div id="aus-stats" style="margin-bottom:12px;"></div>
    <div id="aus-customizer" style="margin-bottom:12px;"></div>
    <div style="display:grid;gap:12px;margin-bottom:12px;">
      <div class="ds-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">消费金额 (CNY)</span><span style="font-size:11px;color:#6B7280;">近 30 天</span></div><div id="aus-chart-bar" style="height:180px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
      <div class="ds-card"><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">Tokens 热力</div><div id="aus-heatmap" style="height:120px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
    </div>
    <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:#9CA3AF;">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
    <div id="aus-history"></div>
    <div id="aus-settings" style="margin-top:16px;border-top:1px solid #E5E7EB;padding-top:12px;"></div>
  `;
  content.appendChild(panel);
  bindPanel(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  renderCustomizer();
  refreshUI();
}
function isWeekend(ts) {
  const d = new Date(ts + 8 * 3600 * 1e3).getUTCDay();
  return d === 0 || d === 6;
}
function isPeak(ts) {
  if (isWeekend(ts)) return false;
  const d = new Date(ts);
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
  for (const h of state.settings.peakHours || []) {
    const sp = parseInt(h.start.split(":")[0]) * 60 + parseInt(h.start.split(":")[1] || "0");
    const ep = parseInt(h.end.split(":")[0]) * 60 + parseInt(h.end.split(":")[1] || "0");
    if (sp < ep) {
      if (mins >= sp && mins < ep) return true;
    } else if (mins >= sp || mins < ep) return true;
  }
  return false;
}
function getPeakStatus(now = Date.now()) {
  if (isWeekend(now)) return { color: "#22c55e", label: "周末全天低谷" };
  if (isPeak(now)) return { color: "#ef4444", label: "高峰时段" };
  const d = new Date(now);
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
  let nearest = 1440;
  for (const h of state.settings.peakHours || []) {
    const sp = parseInt(h.start.split(":")[0]) * 60 + parseInt(h.start.split(":")[1] || "0");
    let diff = sp - mins;
    if (diff < 0) diff += 1440;
    if (diff < nearest) nearest = diff;
  }
  if (nearest <= 10) return { color: "#eab308", label: `距高峰 ${nearest} 分` };
  return { color: "#22c55e", label: "非高峰" };
}
function updatePeakDot() {
  const doc = window.parent?.document ?? document;
  const dot = doc.getElementById("aus-peak-dot-indicator");
  if (!dot) return;
  if (state.settings.peakDot === false) {
    dot.style.display = "none";
    return;
  }
  dot.style.display = "block";
  const st = getPeakStatus();
  dot.style.background = st.color;
  dot.style.boxShadow = `0 0 8px ${st.color}`;
  dot.title = `API用量统计 · ${st.label}`;
}
function createPeakDot() {
  const doc = window.parent?.document ?? document;
  if (doc.getElementById("aus-peak-dot-indicator")) return;
  const dot = doc.createElement("div");
  dot.id = "aus-peak-dot-indicator";
  dot.style.cssText = "position:fixed;width:18px;height:18px;border-radius:50%;z-index:3000;cursor:grab;opacity:0.85;border:2px solid rgba(0,0,0,0.25);transition:opacity 0.2s;user-select:none;touch-action:none;";
  let saved = null;
  try {
    const v = localStorage.getItem("ds_ds_peak_dot_pos");
    if (v) saved = JSON.parse(v);
  } catch {
  }
  if (saved) {
    dot.style.left = saved.left + "px";
    dot.style.top = saved.top + "px";
  } else {
    dot.style.right = "16px";
    dot.style.top = "60px";
  }
  doc.body.appendChild(dot);
  updatePeakDot();
  setInterval(updatePeakDot, 3e4);
  dot.addEventListener("mousedown", (e) => {
    dot.style.cursor = "grabbing";
    const rect = dot.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const onMove = (ev) => {
      dot.style.left = ev.clientX - sx + "px";
      dot.style.top = ev.clientY - sy + "px";
      dot.style.right = "auto";
    };
    const onUp = () => {
      dot.style.cursor = "grab";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem("ds_ds_peak_dot_pos", JSON.stringify({ left: parseInt(dot.style.left) || 0, top: parseInt(dot.style.top) || 0 }));
      } catch {
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}
const MODULE = "api_usage_stat";
function getDoc() {
  return window.parent?.document ?? document;
}
function ensureStyleScope() {
  document.documentElement.setAttribute("data-extension", "api-usage-stat");
}
async function initStore() {
  const hot = await loadHot();
  if (hot) {
    if (hot.saves) state.saves = hot.saves;
    if (hot.currentSave) state.currentSave = hot.currentSave;
    if (hot.settings) state.settings = { ...state.settings, ...hot.settings };
    if (hot.balance) state.balance = hot.balance;
    if (hot.customBalance) state.customBalance = hot.customBalance;
    if (hot.messageCount) state.messageCount = hot.messageCount;
  }
  if (!state.currentSave || !state.saves[state.currentSave]) {
    const keys = Object.keys(state.saves);
    if (keys.length) state.currentSave = keys[0];
    else createNewSave();
    saveHot({ saves: state.saves, currentSave: state.currentSave, settings: state.settings, balance: state.balance, customBalance: state.customBalance });
  }
}
async function renderPlaceholder() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.renderExtensionTemplateAsync) {
    }
  } catch {
  }
  fallbackPlaceholder();
}
function fallbackPlaceholder() {
  const doc = getDoc();
  const host = doc.getElementById("extensions_settings2") ?? doc.getElementById("extensions_settings");
  if (!host) return;
  if (doc.getElementById("api-usage-stat-root")) return;
  const wrap = doc.createElement("div");
  wrap.id = "api-usage-stat-root";
  wrap.setAttribute("data-extension", "api-usage-stat");
  wrap.setAttribute("data-ds-theme", "light");
  wrap.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header"><b>API用量统计</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
      <div class="inline-drawer-content" style="padding:12px;background:#fff;">
        <div data-extension="api-usage-stat" data-ds-theme="light">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px;">
            <div class="ds-card"><div class="ds-card-title">消费金额</div><div class="ds-card-val">¥0.00<small style="font-size:14px;color:#9CA3AF;margin-left:4px;">CNY</small></div></div>
            <div class="ds-card"><div class="ds-card-title">API 请求次数</div><div class="ds-card-val">0</div></div>
            <div class="ds-card"><div class="ds-card-title">Tokens</div><div class="ds-card-val">0</div></div>
          </div>
          <div style="font-size:11px;color:#9CA3AF;text-align:center;padding:6px;">样式已对齐 DeepSeek 官方 · 阶段 1 已接通定价/存储/拦截</div>
        </div>
      </div>
    </div>
  `;
  host.appendChild(wrap);
  setTimeout(() => injectPanel(), 100);
}
async function onInstall() {
  console.log("[API用量统计] installed");
  try {
    const { loadHot: loadHot2 } = await Promise.resolve().then(() => persistence);
    await loadHot2();
  } catch {
  }
}
async function onUpdate() {
  console.log("[API用量统计] updated");
}
async function onDelete() {
  console.log("[API用量统计] deleted");
  try {
    const doc = window.parent?.document ?? document;
    const root = doc.getElementById("api-usage-stat-root");
    if (root) root.remove();
    const dot = doc.getElementById("aus-peak-dot-indicator");
    if (dot) dot.remove();
  } catch {
  }
}
function onEnable() {
  console.log("[API用量统计] enabled");
}
function onDisable() {
  console.log("[API用量统计] disabled");
}
async function onActivate() {
  ensureStyleScope();
}
async function init() {
  ensureStyleScope();
  await initStore();
  installInterception();
  const tryMount = () => {
    renderPlaceholder();
    setTimeout(() => {
      injectPanel();
      refreshUI();
      createPeakDot();
    }, 300);
  };
  if (globalThis.SillyTavern?.getContext) tryMount();
  else window.setTimeout(tryMount, 1500);
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, tryMount);
  } catch {
  }
  globalThis.ApiUsageStat = { MODULE, refreshUI, updatePeakDot, state };
}
init();
export {
  onActivate,
  onDelete,
  onDisable,
  onEnable,
  onInstall,
  onUpdate
};
