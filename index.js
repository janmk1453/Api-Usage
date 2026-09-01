const defaultSettings = () => ({
  theme: "light",
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
  webdav: { url: "https://dav.jianguoyun.com/dav/", username: "", path: "", proxy: "" },
  historyScope: "all",
  overviewFour: ["avg_cost", "avg_tokens", "avg_duration", "avg_rate"]
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
const DETAIL_KEEP = 10;
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
const state$2 = {
  history: [],
  total_tokens: 0,
  total_cost: 0,
  input_tokens: 0,
  output_tokens: 0,
  cache_hit_tokens: 0,
  cache_miss_tokens: 0,
  input_cost: 0,
  output_cost: 0,
  rounds: 0,
  startTime: Date.now(),
  lastUsage: null,
  settings: defaultSettings(),
  balance: null,
  customBalance: null,
  messageCount: 0
};
function getSelectedSave() {
  return {
    history: state$2.history,
    total_tokens: state$2.total_tokens,
    total_cost: state$2.total_cost,
    input_tokens: state$2.input_tokens,
    output_tokens: state$2.output_tokens,
    cache_hit_tokens: state$2.cache_hit_tokens,
    cache_miss_tokens: state$2.cache_miss_tokens,
    input_cost: state$2.input_cost,
    output_cost: state$2.output_cost,
    rounds: state$2.rounds,
    startTime: state$2.startTime
  };
}
function getCurrentChatIdForStore() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.getCurrentChatId) {
      const v = ctx.getCurrentChatId();
      if (typeof v === "string" && v) return v;
    }
    const chid = globalThis.this_chid;
    const chars = globalThis.characters;
    if (typeof chid === "number" && Array.isArray(chars) && chars[chid]) {
      const c = chars[chid].chat;
      if (typeof c === "string" && c) return c;
    }
  } catch {
  }
  return null;
}
function getHistoryForDisplay() {
  const scope = state$2.settings.historyScope || "all";
  if (scope !== "current") return state$2.history || [];
  const cur = getCurrentChatIdForStore();
  if (!cur) return state$2.history || [];
  return (state$2.history || []).filter((h) => h.chatId === cur);
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
  if (cur && cur._migrated) {
    if (cur.saves && !cur.history) {
      try {
        let allHistory = [];
        let agg = { total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() };
        let earliest = Date.now();
        for (const s of Object.values(cur.saves)) {
          const h = s.history || [];
          allHistory = allHistory.concat(h);
          agg.total_tokens += s.total_tokens || 0;
          agg.total_cost += s.total_cost || 0;
          agg.input_tokens += s.input_tokens || 0;
          agg.output_tokens += s.output_tokens || 0;
          agg.cache_hit_tokens += s.cache_hit_tokens || 0;
          agg.cache_miss_tokens += s.cache_miss_tokens || 0;
          agg.input_cost += s.input_cost || 0;
          agg.output_cost += s.output_cost || 0;
          agg.rounds += s.rounds || 0;
          if (s.startTime && s.startTime < earliest) earliest = s.startTime;
          try {
            const coldRaw = await dbGet("cold_" + s.name);
            if (coldRaw) {
              const cold2 = JSON.parse(coldRaw);
              allHistory = allHistory.concat(cold2);
            }
          } catch {
          }
        }
        allHistory.sort((a, b) => b.timestamp - a.timestamp);
        const hot = allHistory.slice(0, HOT_KEEP);
        const cold = allHistory.slice(HOT_KEEP);
        if (cold.length) await dbSet("cold_history", JSON.stringify(cold));
        const next = { history: hot, _coldCount: cold.length, total_tokens: agg.total_tokens, total_cost: agg.total_cost, input_tokens: agg.input_tokens, output_tokens: agg.output_tokens, cache_hit_tokens: agg.cache_hit_tokens, cache_miss_tokens: agg.cache_miss_tokens, input_cost: agg.input_cost, output_cost: agg.output_cost, rounds: agg.rounds, startTime: earliest, _migratedArchive: true };
        delete next.saves;
        delete next.currentSave;
        saveExtensionSettings({ ...cur, ...next });
      } catch {
      }
    }
    return;
  }
  const legacySaves = loadLegacy(STORAGE_KEYS.SAVES);
  const hasNewHistory = cur?.history;
  if (!legacySaves && !cur) {
    saveExtensionSettings({ _migrated: true, _updated: Date.now(), history: [], total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() });
    return;
  }
  if (hasNewHistory) {
    saveExtensionSettings({ ...cur, _migrated: true, _updated: Date.now() });
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
    const balanceRaw = loadLegacy(STORAGE_KEYS.BALANCE);
    const customBal = loadLegacy(STORAGE_KEYS.CUSTOM_BALANCE);
    const msgCount = loadLegacy(STORAGE_KEYS.MESSAGE_COUNT);
    const next = { _migrated: true, _updated: Date.now() };
    if (savesRaw) {
      try {
        const saves = JSON.parse(savesRaw);
        let allHistory = [];
        let agg = { total_tokens: 0, total_cost: 0, input_tokens: 0, output_tokens: 0, cache_hit_tokens: 0, cache_miss_tokens: 0, input_cost: 0, output_cost: 0, rounds: 0, startTime: Date.now() };
        let earliest = Date.now();
        let count = 0;
        for (const s of Object.values(saves)) {
          const h = s.history || [];
          allHistory = allHistory.concat(h);
          agg.total_tokens += s.total_tokens || 0;
          agg.total_cost += s.total_cost || 0;
          agg.input_tokens += s.input_tokens || 0;
          agg.output_tokens += s.output_tokens || 0;
          agg.cache_hit_tokens += s.cache_hit_tokens || 0;
          agg.cache_miss_tokens += s.cache_miss_tokens || 0;
          agg.input_cost += s.input_cost || 0;
          agg.output_cost += s.output_cost || 0;
          agg.rounds += s.rounds || 0;
          if (s.startTime && s.startTime < earliest) earliest = s.startTime;
          count++;
        }
        allHistory.sort((a, b) => b.timestamp - a.timestamp);
        const hot = allHistory.slice(0, HOT_KEEP);
        const cold = allHistory.slice(HOT_KEEP);
        if (cold.length) await dbSet("cold_history", JSON.stringify(cold));
        next.history = hot;
        next._coldCount = cold.length;
        next.total_tokens = agg.total_tokens;
        next.total_cost = agg.total_cost;
        next.input_tokens = agg.input_tokens;
        next.output_tokens = agg.output_tokens;
        next.cache_hit_tokens = agg.cache_hit_tokens;
        next.cache_miss_tokens = agg.cache_miss_tokens;
        next.input_cost = agg.input_cost;
        next.output_cost = agg.output_cost;
        next.rounds = agg.rounds;
        next.startTime = count ? earliest : Date.now();
      } catch {
      }
    } else {
      next.history = [];
      next.total_tokens = 0;
      next.total_cost = 0;
      next.input_tokens = 0;
      next.output_tokens = 0;
      next.cache_hit_tokens = 0;
      next.cache_miss_tokens = 0;
      next.input_cost = 0;
      next.output_cost = 0;
      next.rounds = 0;
      next.startTime = Date.now();
    }
    if (settingsRaw) try {
      next.settings = JSON.parse(settingsRaw);
    } catch {
    }
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
async function loadHistoryCold() {
  try {
    const raw = await dbGet("cold_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function appendHistoryCold(entries) {
  if (!entries.length) return;
  const cold = await loadHistoryCold();
  const keyOf = (h) => `${h.timestamp}|${h.model || ""}|${h.total_tokens || 0}`;
  const seen = new Set(cold.map((h) => keyOf(h)));
  const toAdd = entries.filter((h) => !seen.has(keyOf(h)));
  if (!toAdd.length) return;
  const next = [...toAdd, ...cold];
  await dbSet("cold_history", JSON.stringify(next));
  try {
    const cur = getExtensionSettings();
    if (cur) saveExtensionSettings({ ...cur, _coldCount: next.length, _updated: Date.now() });
  } catch {
  }
}
async function getAllHistory() {
  const hot = getExtensionSettings()?.history || [];
  const cold = await loadHistoryCold();
  const merged = [...hot, ...cold].sort((a, b) => b.timestamp - a.timestamp);
  const keyOf = (h) => `${h.timestamp}|${h.model || ""}|${h.total_tokens || 0}`;
  const seen = /* @__PURE__ */ new Set();
  const dedup = [];
  for (const h of merged) {
    const k = keyOf(h);
    if (!seen.has(k)) {
      seen.add(k);
      dedup.push(h);
    }
  }
  return dedup;
}
const persistence = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  HOT_KEEP,
  appendHistoryCold,
  getAllHistory,
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
function localDay$1(ts) {
  const t = typeof ts === "number" ? ts : ts.getTime();
  return new Date(t + 8 * 3600 * 1e3).toISOString().slice(0, 10);
}
function localTimeHM(ts) {
  const t = typeof ts === "number" ? ts : ts.getTime();
  const d = new Date(t + 8 * 3600 * 1e3);
  const iso = d.toISOString();
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  const hh = iso.slice(11, 13);
  const mi = iso.slice(14, 16);
  return `${mm}-${dd} ${hh}:${mi}`;
}
function esc$1(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function isUnsafeKey$1(k) {
  return k === "__proto__" || k === "constructor" || k === "prototype";
}
function mergePrices(base, custom) {
  if (!custom) return base;
  return {
    hit: custom.hit !== void 0 && custom.hit !== "" ? parseFloat(custom.hit) : base.hit,
    miss: custom.miss !== void 0 && custom.miss !== "" ? parseFloat(custom.miss) : base.miss,
    output: custom.output !== void 0 && custom.output !== "" ? parseFloat(custom.output) : base.output
  };
}
function normalizeModel(model) {
  if (!model) return "deepseek-v4-flash";
  let m = String(model).trim();
  m = m.replace(/^\[[^\]]+\]/, "").trim();
  const low = m.toLowerCase();
  if (low.includes("deepseek-v4-flash-vision") || low.includes("deepseek-v4-flash-vision-exp")) return "deepseek-v4-flash-vision-exp";
  if (low.includes("deepseek-v4-pro")) return "deepseek-v4-pro";
  if (low.includes("deepseek-v4-flash")) return "deepseek-v4-flash";
  if (low.includes("deepseek")) {
    return "deepseek-v4-flash";
  }
  return m;
}
function getPricing$1(model, settings) {
  const raw = model || "deepseek-v4-flash";
  const m = normalizeModel(raw);
  const base = PRICING[m] || PRICING["deepseek-v4-flash"];
  for (const cm of settings.customModels || []) {
    if (cm?.model === raw || cm?.model === m) {
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
  const raw = model || "deepseek-v4-flash";
  const m = normalizeModel(raw);
  if (PRICING[m]) return true;
  for (const cm of settings.customModels || []) if (cm?.model === raw || cm?.model === m) return true;
  return false;
}
function isDeepSeekOfficialModel(m) {
  if (typeof m !== "string") return false;
  const norm = normalizeModel(m);
  return norm.toLowerCase().indexOf("deepseek") === 0 || String(m).toLowerCase().includes("deepseek");
}
function isPeakHour(timestamp, settings) {
  const hours = settings && settings.peakHours || DEFAULT_PEAK_HOURS;
  return isPeakHour$1(timestamp, hours);
}
function calcCost(u, settings) {
  const model = u.model || "deepseek-v4-flash";
  if (!hasPriceForModel(model, settings)) return { input: 0, output: 0, total: 0, priceType: "old" };
  const pricing = getPricing$1(model, settings);
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
  const pricing = getPricing$1(model, settings);
  const useNewPricing = settings.useNewPricing && u.timestamp >= settings.newPricingDate;
  let p;
  if (useNewPricing && pricing.usePeakPricing !== false && isDeepSeekOfficialModel(model)) {
    p = isPeakHour(u.timestamp, settings) ? pricing.peak : pricing.offpeak;
  } else p = pricing.offpeak;
  return (u.prompt_cache_hit_tokens || 0) / 1e6 * (p.miss - p.hit);
}
const map = /* @__PURE__ */ new Map();
const DataEvents = {
  UPDATED: "data:updated",
  // 任何数据变更（存储/修改/导入/同步后）
  HISTORY_ADDED: "data:history:added",
  SETTINGS_CHANGED: "data:settings:changed",
  BALANCE_CHANGED: "data:balance:changed"
};
function emit(event, payload) {
  map.get(event)?.forEach((fn) => {
    try {
      fn(payload);
    } catch {
    }
  });
}
function getCurrentChatId() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    if (ctx?.getCurrentChatId) {
      const v = ctx.getCurrentChatId();
      if (typeof v === "string" && v) return v;
    }
    const chid = globalThis.this_chid;
    const chars = globalThis.characters;
    if (typeof chid === "number" && Array.isArray(chars) && chars[chid]) {
      const c = chars[chid].chat;
      if (typeof c === "string" && c) return c;
    }
  } catch {
  }
  return null;
}
function getCurrentChatName() {
  const id = getCurrentChatId();
  return id ? String(id) : null;
}
function pruneDetails() {
  if (!state$2.history || state$2.history.length <= DETAIL_KEEP) return;
  const hs = [...state$2.history].sort((a, b) => b.timestamp - a.timestamp);
  for (let i = DETAIL_KEEP; i < hs.length; i++) {
    delete hs[i].messages;
    delete hs[i].fullRequest;
    delete hs[i].fullResponse;
  }
}
function persist() {
  pruneDetails();
  let safeLastUsage = state$2.lastUsage;
  if (safeLastUsage) {
    try {
      const c = { ...safeLastUsage };
      delete c.messages;
      delete c.fullRequest;
      delete c.fullResponse;
      safeLastUsage = c;
    } catch {
    }
  }
  saveHot({
    history: state$2.history,
    total_tokens: state$2.total_tokens,
    total_cost: state$2.total_cost,
    input_tokens: state$2.input_tokens,
    output_tokens: state$2.output_tokens,
    cache_hit_tokens: state$2.cache_hit_tokens,
    cache_miss_tokens: state$2.cache_miss_tokens,
    input_cost: state$2.input_cost,
    output_cost: state$2.output_cost,
    rounds: state$2.rounds,
    startTime: state$2.startTime,
    settings: state$2.settings,
    balance: state$2.balance,
    customBalance: state$2.customBalance,
    messageCount: state$2.messageCount,
    lastUsage: safeLastUsage
  });
  emit(DataEvents.UPDATED);
}
const repository = {
  snapshot() {
    return {
      saves: {},
      currentSave: null,
      settings: state$2.settings,
      balance: state$2.balance,
      customBalance: state$2.customBalance,
      messageCount: state$2.messageCount,
      lastUsage: state$2.lastUsage,
      history: state$2.history,
      total_tokens: state$2.total_tokens,
      total_cost: state$2.total_cost
    };
  },
  getAggregated() {
    return getSelectedSave();
  },
  getHistoryByRange(range) {
    const s = getSelectedSave();
    if (!s?.history) return [];
    const toDay = (ts) => new Date(ts + 8 * 3600 * 1e3).toISOString().slice(0, 10);
    return s.history.filter((h) => {
      const k = toDay(h.timestamp);
      return k >= range.start && k <= range.end;
    });
  },
  async getColdHistory() {
    return loadHistoryCold();
  },
  async getAllHistory() {
    return getAllHistory();
  },
  addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft = 0, thinkTime = 0) {
    messages = messages || [];
    if (!model) try {
      model = globalThis.SillyTavern?.getContext?.().model || "deepseek-v4-flash";
    } catch {
      model = "deepseek-v4-flash";
    }
    const TRACE = "[API用量统计][TRACE]";
    try {
      console.log(TRACE + " addEntry 收到", { model, usageStr: JSON.stringify(usage).slice(0, 1500), hasMessages: !!messages?.length, startTime, ttft });
    } catch {
    }
    if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
      try {
        console.warn("[API用量统计] addEntry 跳过无效 usage：", usage, " model=", model);
      } catch {
      }
      try {
        console.log(TRACE + " addEntry 跳过：usage 非对象");
      } catch {
      }
      return null;
    }
    const hasAnyTokenField = typeof usage.prompt_tokens === "number" || typeof usage.completion_tokens === "number" || typeof usage.total_tokens === "number" || typeof usage.input_tokens === "number" || typeof usage.output_tokens === "number" || typeof usage.prompt_cache_hit_tokens === "number" || usage.prompt_tokens_details && typeof usage.prompt_tokens_details.cached_tokens === "number";
    if (!hasAnyTokenField) {
      try {
        console.warn("[API用量统计] addEntry 跳过无 token 字段的 usage：", JSON.stringify(usage).slice(0, 300));
      } catch {
      }
      try {
        console.log(TRACE + " addEntry 跳过：无 token 字段");
      } catch {
      }
      return null;
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
    if (hit === 0 && miss === 0 && comp === 0 && total === 0) {
      try {
        console.warn("[API用量统计] addEntry 跳过全 0 token 条目 model=" + model);
      } catch {
      }
      try {
        console.log(TRACE + " addEntry 跳过：全 0 token");
      } catch {
      }
      return null;
    }
    try {
      console.log(TRACE + " addEntry 解析", { hit, miss, comp, total });
    } catch {
    }
    try {
      console.log("[AUS-TEMP] addEntry 入口", { model, total, hit, miss, comp, hasUsage: !!usage });
    } catch {
    }
    try {
      const now = Date.now();
      const fp = `${model}|${total}|${hit}|${miss}|${comp}`;
      const lastFp = state$2._lastFp;
      const lastFpTime = state$2._lastFpTime;
      if (lastFp === fp && lastFpTime && now - lastFpTime < 5e3) {
        try {
          console.log(TRACE + " addEntry 去重跳过(5s指纹)", { fp });
        } catch {
        }
        return null;
      }
      state$2._lastFp = fp;
      state$2._lastFpTime = now;
    } catch {
    }
    const lu = { timestamp: Date.now(), model, prompt_tokens: hit + miss, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp, total_tokens: total };
    const duration = startTime ? Date.now() - startTime : 0;
    const thinkTokens = usage.completion_tokens_details?.reasoning_tokens || 0;
    lu.duration = duration;
    lu.tokenRate = duration - (ttft || 0) > 50 && comp > 0 ? Math.round(comp / (duration - (ttft || 0)) * 1e3) : 0;
    lu.ttft = ttft || 0;
    lu.thinkTime = thinkTime || 0;
    lu.thinkTokens = thinkTokens;
    lu.messages = messages;
    const c = calcCost({ timestamp: lu.timestamp, model, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp }, state$2.settings);
    lu.cost = c.total;
    lu.input_cost = c.input;
    lu.output_cost = c.output;
    lu.priceType = c.priceType;
    lu.raw_usage = usage;
    lu.fullRequest = fullRequest;
    lu.fullResponse = fullResponse;
    const chatId = getCurrentChatId();
    const chatName = getCurrentChatName();
    lu.chatId = chatId;
    lu.chatName = chatName;
    state$2.lastUsage = lu;
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
      priceType: lu.priceType,
      raw_usage: usage,
      messages,
      duration,
      ttft,
      thinkTime,
      thinkTokens,
      tokenRate: lu.tokenRate,
      fullRequest,
      fullResponse,
      chatId,
      chatName
    };
    try {
      console.log(TRACE + " addEntry 即将写入", { timestamp: entry.timestamp, model: entry.model, total: entry.total_tokens, cost: entry.cost, chatId: entry.chatId });
    } catch {
    }
    state$2.history.unshift(entry);
    state$2.total_tokens += total;
    state$2.total_cost += lu.cost;
    state$2.input_tokens += hit + miss;
    state$2.output_tokens += comp;
    state$2.cache_hit_tokens += hit;
    state$2.cache_miss_tokens += miss;
    state$2.input_cost += lu.input_cost;
    state$2.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) state$2.rounds += 1;
    try {
      if (state$2.customBalance != null && String(state$2.customBalance).trim() !== "") {
        const cur = parseFloat(String(state$2.customBalance));
        if (!isNaN(cur)) state$2.customBalance = (cur - lu.cost).toFixed(4);
      } else if (state$2.balance && state$2.balance.balance != null && String(state$2.balance.balance).trim() !== "") {
        const cur = parseFloat(String(state$2.balance.balance));
        if (!isNaN(cur)) {
          state$2.balance.balance = (cur - lu.cost).toFixed(4);
          state$2.balance.timestamp = Date.now();
        }
      }
    } catch {
    }
    if (state$2.history.length > MAX_HISTORY) {
      const overflow = state$2.history.slice(MAX_HISTORY);
      appendHistoryCold(overflow).catch(() => {
      });
      state$2.history = state$2.history.slice(0, MAX_HISTORY);
    }
    state$2.startTime = state$2.startTime || Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },
  recalcAll() {
    for (const h of state$2.history || []) {
      const c = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state$2.settings);
      h.input_cost = c.input;
      h.output_cost = c.output;
      h.cost = c.total;
      h.priceType = c.priceType;
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? (h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100 : 0;
    }
    persist();
  },
  replaceAll(next) {
    if (next.history !== void 0) {
      let h = next.history;
      h = h.map((e) => {
        if (!e || typeof e !== "object") return e;
        for (const k of Object.keys(e)) if (isUnsafeKey$1(k)) delete e[k];
        return e;
      });
      if (h.length > MAX_HISTORY) {
        const overflow = h.slice(MAX_HISTORY);
        appendHistoryCold(overflow).catch(() => {
        });
        state$2.history = h.slice(0, MAX_HISTORY);
      } else {
        state$2.history = h;
      }
    }
    if (next.total_tokens !== void 0) state$2.total_tokens = next.total_tokens;
    if (next.total_cost !== void 0) state$2.total_cost = next.total_cost;
    if (next.input_tokens !== void 0) state$2.input_tokens = next.input_tokens;
    if (next.output_tokens !== void 0) state$2.output_tokens = next.output_tokens;
    if (next.cache_hit_tokens !== void 0) state$2.cache_hit_tokens = next.cache_hit_tokens;
    if (next.cache_miss_tokens !== void 0) state$2.cache_miss_tokens = next.cache_miss_tokens;
    if (next.input_cost !== void 0) state$2.input_cost = next.input_cost;
    if (next.output_cost !== void 0) state$2.output_cost = next.output_cost;
    if (next.rounds !== void 0) state$2.rounds = next.rounds;
    if (next.startTime !== void 0) state$2.startTime = next.startTime;
    if (next.saves) {
      let all = [...state$2.history || []];
      for (const s of Object.values(next.saves)) {
        const h = s.history || [];
        all = all.concat(h);
        state$2.total_tokens += s.total_tokens || 0;
        state$2.total_cost += s.total_cost || 0;
        state$2.input_tokens += s.input_tokens || 0;
        state$2.output_tokens += s.output_tokens || 0;
        state$2.cache_hit_tokens += s.cache_hit_tokens || 0;
        state$2.cache_miss_tokens += s.cache_miss_tokens || 0;
        state$2.input_cost += s.input_cost || 0;
        state$2.output_cost += s.output_cost || 0;
        state$2.rounds += s.rounds || 0;
      }
      all.sort((a, b) => b.timestamp - a.timestamp);
      const keyOf = (h) => `${h.timestamp}|${h.model || ""}|${h.total_tokens || 0}`;
      const seen = /* @__PURE__ */ new Set();
      const dedup = [];
      for (const h of all) {
        const k = keyOf(h);
        if (!seen.has(k)) {
          seen.add(k);
          dedup.push(h);
        }
      }
      if (dedup.length > MAX_HISTORY) {
        const overflow = dedup.slice(MAX_HISTORY);
        appendHistoryCold(overflow).catch(() => {
        });
      }
      state$2.history = dedup.slice(0, MAX_HISTORY);
    }
    if (next.settings !== void 0) {
      const def = defaultSettings();
      const incoming = next.settings || {};
      const merged = { ...def, ...incoming };
      merged.webdav = { ...def.webdav, ...incoming.webdav || {} };
      if (!Array.isArray(merged.peakHours) || !merged.peakHours.length) merged.peakHours = def.peakHours;
      if (!Array.isArray(merged.customModels)) merged.customModels = def.customModels;
      if (!merged.historyScope) merged.historyScope = def.historyScope;
      if (!merged.theme) merged.theme = def.theme;
      if (!Array.isArray(merged.overviewFour) || merged.overviewFour.length !== 4) merged.overviewFour = def.overviewFour;
      try {
        const valid = /* @__PURE__ */ new Set(["avg_cost", "avg_tokens", "avg_duration", "avg_rate", "avg_input_cost", "avg_input_tokens", "avg_output_cost", "avg_output_tokens", "avg_think_time", "avg_think_tokens", "avg_hit_rate", "latest_hit_rate", "max_output", "max_input", "max_total"]);
        if (Array.isArray(merged.overviewFour)) merged.overviewFour = merged.overviewFour.map((k) => valid.has(k) ? k : "avg_cost");
      } catch {
      }
      state$2.settings = merged;
    }
    if (next.balance !== void 0) state$2.balance = next.balance;
    if (next.customBalance !== void 0) state$2.customBalance = next.customBalance;
    if (next.messageCount !== void 0) state$2.messageCount = next.messageCount;
    if (next.lastUsage !== void 0) state$2.lastUsage = next.lastUsage;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== void 0 || next.customBalance !== void 0) emit(DataEvents.BALANCE_CHANGED);
  },
  pruneZeroEntries() {
    const before = (state$2.history || []).length;
    const filtered = (state$2.history || []).filter((h) => {
      const isZero = h.total_tokens === 0 && h.prompt_tokens === 0 && h.completion_tokens === 0 && h.cache_hit_tokens === 0 && h.cache_miss_tokens === 0;
      const isFakeTokenCount = !!(h.raw_usage && h.raw_usage._from_token_count);
      return !(isZero || isFakeTokenCount);
    });
    if (filtered.length !== before) {
      state$2.history = filtered;
      let total_tokens = 0, total_cost = 0, input_tokens = 0, output_tokens = 0, cache_hit_tokens = 0, cache_miss_tokens = 0, input_cost = 0, output_cost = 0, rounds = 0;
      for (const h of filtered) {
        total_tokens += h.total_tokens || 0;
        total_cost += h.cost || 0;
        input_tokens += (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0);
        output_tokens += h.completion_tokens || 0;
        cache_hit_tokens += h.cache_hit_tokens || 0;
        cache_miss_tokens += h.cache_miss_tokens || 0;
        input_cost += h.input_cost || 0;
        output_cost += h.output_cost || 0;
        rounds += 1;
      }
      state$2.total_tokens = total_tokens;
      state$2.total_cost = total_cost;
      state$2.input_tokens = input_tokens;
      state$2.output_tokens = output_tokens;
      state$2.cache_hit_tokens = cache_hit_tokens;
      state$2.cache_miss_tokens = cache_miss_tokens;
      state$2.input_cost = input_cost;
      state$2.output_cost = output_cost;
      state$2.rounds = rounds;
      persist();
      try {
        console.log("[API用量统计] 已自动清理 " + (before - filtered.length) + " 条全 0 污染条目");
      } catch {
      }
    }
    return filtered.length;
  },
  async hydrate() {
    const hot = await loadHot();
    if (hot) {
      if (hot.history) state$2.history = hot.history;
      if (hot.total_tokens !== void 0) state$2.total_tokens = hot.total_tokens;
      if (hot.total_cost !== void 0) state$2.total_cost = hot.total_cost;
      if (hot.input_tokens !== void 0) state$2.input_tokens = hot.input_tokens;
      if (hot.output_tokens !== void 0) state$2.output_tokens = hot.output_tokens;
      if (hot.cache_hit_tokens !== void 0) state$2.cache_hit_tokens = hot.cache_hit_tokens;
      if (hot.cache_miss_tokens !== void 0) state$2.cache_miss_tokens = hot.cache_miss_tokens;
      if (hot.input_cost !== void 0) state$2.input_cost = hot.input_cost;
      if (hot.output_cost !== void 0) state$2.output_cost = hot.output_cost;
      if (hot.rounds !== void 0) state$2.rounds = hot.rounds;
      if (hot.startTime !== void 0) state$2.startTime = hot.startTime;
      if (hot.settings) state$2.settings = { ...state$2.settings, ...hot.settings };
      if (hot.balance) state$2.balance = hot.balance;
      if (hot.customBalance) state$2.customBalance = hot.customBalance;
      if (hot.messageCount) state$2.messageCount = hot.messageCount;
      if (hot.lastUsage) state$2.lastUsage = hot.lastUsage;
    }
    if (!state$2.settings.historyScope) {
      state$2.settings.historyScope = "all";
      try {
        saveHot({ settings: state$2.settings });
      } catch {
      }
    }
    if (!Array.isArray(state$2.settings.overviewFour) || state$2.settings.overviewFour.length !== 4) {
      state$2.settings.overviewFour = ["avg_cost", "avg_tokens", "avg_duration", "avg_rate"];
      try {
        saveHot({ settings: state$2.settings });
      } catch {
      }
    }
    let needPersistChatId = false;
    for (const h of state$2.history || []) {
      if (h.chatId === void 0) {
        h.chatId = null;
        h.chatName = null;
        needPersistChatId = true;
      }
    }
    if (needPersistChatId) try {
      saveHot({ history: state$2.history });
    } catch {
    }
    try {
      this.pruneZeroEntries();
    } catch {
    }
    try {
      this.recalcAll();
    } catch {
    }
    emit(DataEvents.UPDATED);
    return this.snapshot();
  }
};
let lastMessages = [];
let lastStart = 0;
let lastFetchUsage = null;
let lastFetchModel = null;
let lastFetchTime = 0;
function setLastRequest(messages, start) {
  lastMessages = messages || [];
  lastStart = start || Date.now();
}
const TARGET_API = "/api/backends/chat-completions/generate";
function installFetchCapture() {
  try {
    const p = window.parent || window;
    if (!p || !p.fetch || p.fetch.__aus_patched) {
      try {
        console.log("[AUS-TEMP] installFetchCapture 跳过 已 patched 或无 fetch", { hasFetch: !!p?.fetch, patched: !!p?.fetch?.__aus_patched });
      } catch {
      }
      return;
    }
    const rawFetch2 = p.fetch.bind(p);
    try {
      console.log("[AUS-TEMP] installFetchCapture 开始安装", { target: TARGET_API });
    } catch {
    }
    const patched = function() {
      const args = arguments;
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      try {
        console.log("[AUS-TEMP] fetch 拦截入口", { url: String(url).slice(0, 200), hasBody: !!args[1]?.body });
      } catch {
      }
      if (typeof url === "string" && url.indexOf(TARGET_API) !== -1) {
        let reqBody = null;
        try {
          reqBody = JSON.parse(args[1]?.body || "null");
        } catch {
        }
        const fullReq = reqBody ? JSON.parse(JSON.stringify(reqBody)) : null;
        let msgs = [];
        try {
          if (reqBody?.messages?.length) msgs = reqBody.messages.slice(-10);
        } catch {
        }
        const startTime = Date.now();
        try {
          lastMessages = msgs;
          lastStart = startTime;
        } catch {
        }
        try {
          console.log("[AUS-TEMP] 命中 TARGET_API 即将透传", { url: String(url).slice(0, 120) });
        } catch {
        }
        return rawFetch2.apply(p, args).then((res) => {
          try {
            console.log("[AUS-TEMP] fetch 响应返回", { url: String(url).slice(0, 120), status: res?.status, ok: res?.ok, ct: res.headers.get("content-type") });
          } catch {
          }
          try {
            const clone = res.clone();
            try {
              console.log("[AUS-TEMP] clone 成功，准备解析 text");
            } catch {
            }
            const ttftRef = { value: 0 };
            const thinkRef = { value: 0 };
            const parseAndProcess = (text, ttftVal, thinkTimeVal) => {
              let data = null;
              try {
                const trimmed = text.trim();
                if (trimmed.startsWith("{")) {
                  data = JSON.parse(trimmed);
                } else {
                  text.split("\n").forEach((line) => {
                    if (line.startsWith("data: ") && line !== "data: [DONE]") {
                      try {
                        const chunk = JSON.parse(line.substring(6));
                        if (chunk.usage) data = chunk;
                        if (!data && chunk.choices?.[0]?.usage) data = { usage: chunk.choices[0].usage, model: chunk.model };
                      } catch {
                      }
                    }
                  });
                  if (!data || !data.usage) {
                    const m = text.match(/"usage"\s*:\s*(\{[^\}]+\})/);
                    if (m) {
                      try {
                        const u = JSON.parse(m[1]);
                        if (u && typeof u === "object") data = { usage: u, model: data?.model };
                      } catch {
                      }
                    }
                  }
                }
              } catch (e) {
                console.warn("[API用量统计][TRACE] 用量响应解析失败", e?.message || e);
                return;
              }
              if (data && data.usage) {
                const model = data?.model || reqBody?.model || fullReq?.model || lastFetchModel || "deepseek-v4-flash";
                const usage = data.usage;
                lastFetchUsage = { usage, model, msgs, startTime, fullReq, fullResponse: data, ttft: ttftVal, thinkTime: thinkTimeVal };
                lastFetchModel = typeof model === "string" ? model : null;
                lastFetchTime = Date.now();
                try {
                  console.log("[AUS-TEMP] fetch 解析成功 usage", { model, usage });
                } catch {
                }
                try {
                  console.log("[API用量统计][TRACE] fetch 捕获 usage", { url: String(url).slice(0, 80), usage: JSON.stringify(usage).slice(0, 1500), model });
                } catch {
                }
                try {
                  console.log("[AUS-TEMP] 即将 processUsage fetch");
                } catch {
                }
                try {
                  processUsage(usage, model, msgs, startTime, fullReq, data, ttftVal, thinkTimeVal);
                  try {
                    console.log("[AUS-TEMP] processUsage fetch 完成");
                  } catch {
                  }
                } catch (e) {
                  console.error("[API用量统计] fetch 用量记录失败", e?.message || e);
                }
              } else {
                try {
                  console.log("[AUS-TEMP] fetch 解析后无 usage", { textLen: text.length, hasData: !!data, dataKeys: data ? Object.keys(data).slice(0, 10) : [] });
                } catch {
                }
              }
            };
            const ct = clone.headers.get("content-type") || "";
            try {
              console.log("[AUS-TEMP] 准备 clone.text 解析", { ct });
            } catch {
            }
            if (ct.includes("application/json")) {
              clone.text().then((t) => {
                try {
                  console.log("[AUS-TEMP] clone.text json 完成", { len: t.length });
                } catch {
                }
                parseAndProcess(t, 0, 0);
              }).catch((e) => {
                try {
                  console.log("[AUS-TEMP] clone.text json 失败", e?.message);
                } catch {
                }
              });
            } else {
              clone.text().then((t) => {
                try {
                  console.log("[AUS-TEMP] clone.text stream 完成", { len: t.length });
                } catch {
                }
                parseAndProcess(t, 0, 0);
              }).catch((e) => {
                try {
                  console.log("[AUS-TEMP] clone.text stream 失败", e?.message);
                } catch {
                }
              });
            }
          } catch (e) {
            console.warn("[API用量统计] fetch 克隆解析异常，不影响原请求", e?.message || e);
            try {
              console.log("[AUS-TEMP] fetch 克隆异常", e?.message);
            } catch {
            }
          }
          return res;
        }).catch((e) => {
          try {
            console.log("[AUS-TEMP] rawFetch 失败", e?.message);
          } catch {
          }
          throw e;
        });
      }
      return rawFetch2.apply(p, args);
    };
    patched.__aus_patched = true;
    p.fetch = patched;
    console.log("[API用量统计][TRACE] fetch 捕获已安装（原脚本 1:1 逻辑，TARGET_API=" + TARGET_API + "）");
  } catch {
  }
}
let interceptionInstalled = false;
let rawFetchRef = null;
let messageReceivedHandler = null;
function installInterception() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    try {
      console.log("[AUS-TEMP] installInterception 调用", { hasCtx: !!ctx, hasEs: !!es, hasEt: !!et, installed: interceptionInstalled });
    } catch {
    }
    if (!es || !et) {
      try {
        console.log("[AUS-TEMP] installInterception 失败 无 es/et");
      } catch {
      }
      return false;
    }
    if (interceptionInstalled) {
      try {
        console.log("[AUS-TEMP] installInterception 已安装跳过");
      } catch {
      }
      return true;
    }
    try {
      const p = window.parent || window;
      if (p?.fetch && !p.fetch.__aus_patched) rawFetchRef = p.fetch.bind(p);
    } catch {
    }
    es.on(et.GENERATION_ENDED, onGenerationEnded);
    messageReceivedHandler = () => setTimeout(refresh, 400);
    es.on(et.MESSAGE_RECEIVED, messageReceivedHandler);
    globalThis.ApiUsageStatInterceptor = (chat, _ctxSize, _abort, _type) => {
      try {
        console.log("[AUS-TEMP] ApiUsageStatInterceptor 触发", { len: chat?.length, type: _type });
      } catch {
      }
      try {
        setLastRequest(chat?.slice(-10) || [], Date.now());
      } catch {
      }
      try {
        console.log("[AUS-TEMP] setLastRequest 完成");
      } catch {
      }
    };
    try {
      installFetchCapture();
    } catch {
    }
    interceptionInstalled = true;
    return true;
  } catch {
    return false;
  }
}
function uninstallInterception() {
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const es = ctx?.eventSource;
    const et = ctx?.event_types;
    if (es && et && messageReceivedHandler) {
      try {
        es.off?.(et.GENERATION_ENDED, onGenerationEnded);
      } catch {
      }
      try {
        es.off?.(et.MESSAGE_RECEIVED, messageReceivedHandler);
      } catch {
      }
    }
    try {
      const p = window.parent || window;
      if (p && rawFetchRef && p.fetch.__aus_patched) {
        p.fetch = rawFetchRef;
      }
    } catch {
    }
    interceptionInstalled = false;
  } catch {
  }
}
function isValidUsage(u) {
  if (!u || typeof u !== "object" || Array.isArray(u)) return false;
  return typeof u.prompt_tokens === "number" || typeof u.completion_tokens === "number" || typeof u.total_tokens === "number" || typeof u.input_tokens === "number" || typeof u.output_tokens === "number" || typeof u.prompt_cache_hit_tokens === "number" || typeof u.cached_tokens === "number" || u.prompt_tokens_details && typeof u.prompt_tokens_details.cached_tokens === "number";
}
function pickUsageFromExtra(extra) {
  if (!extra || typeof extra !== "object") return null;
  const candidates = [
    extra.api_usage,
    extra.usage,
    extra.openai_usage,
    extra.token_usage,
    // 兼容部分渠道把 usage 塞在 extra.data.usage
    extra.data?.usage,
    extra.response?.usage
  ];
  for (const c of candidates) {
    if (isValidUsage(c)) return c;
  }
  if (isValidUsage(extra)) return extra;
  return null;
}
function onGenerationEnded(...args) {
  const TRACE = "[API用量统计][TRACE]";
  try {
    console.log("[AUS-TEMP] onGenerationEnded 入口", { argsLen: args.length, arg0Keys: args[0] ? Object.keys(args[0]).slice(0, 10) : [] });
  } catch {
  }
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const chat = ctx?.chat || [];
    const tail = chat[chat.length - 1];
    const extra = tail?.extra || {};
    const tailModel = tail?.model || null;
    const extraModel = extra.model || tailModel || ctx?.model || "deepseek-v4-flash";
    try {
      console.log(TRACE + " onGenerationEnded 触发", {
        chatLen: chat.length,
        tailIdx: chat.length - 1,
        tailExtraKeys: extra ? Object.keys(extra).slice(0, 20) : [],
        tailExtraStr: JSON.stringify(extra).slice(0, 2e3),
        args0: args[0] ? JSON.stringify(args[0]).slice(0, 2e3) : "no args0",
        model: extraModel,
        hasApiUsage: !!extra.api_usage,
        hasUsage: !!extra.usage,
        hasTokenCount: extra.token_count
      });
    } catch {
    }
    let usage = pickUsageFromExtra(extra);
    let model = extraModel;
    try {
      console.log(TRACE + " pickUsageFromExtra 结果", { hasUsage: !!usage, usageStr: usage ? JSON.stringify(usage).slice(0, 1500) : "null", isValid: usage ? isValidUsage(usage) : false });
    } catch {
    }
    if (usage && isValidUsage(usage)) {
      console.log(TRACE + " 命中主路径 extra usage，准备 processUsage");
      processUsage(usage, model, lastMessages, lastStart);
      return;
    }
    if (tail?.swipe_info && typeof tail.swipe_info === "object") {
      console.log(TRACE + " 尝试 swipe_info 兼容路径", { swipeKeys: Object.keys(tail.swipe_info).slice(0, 5) });
      for (const v of Object.values(tail.swipe_info)) {
        const cand = v?.extra?.api_usage || v?.extra?.usage;
        if (isValidUsage(cand)) {
          usage = cand;
          model = v?.extra?.model || model;
          console.log(TRACE + " swipe_info 命中", { model, cand: JSON.stringify(cand).slice(0, 1e3) });
          processUsage(usage, model, lastMessages, lastStart);
          return;
        }
      }
      console.log(TRACE + " swipe_info 未命中有效 usage");
    }
    const maybeUsage = args[0]?.usage || args[0]?.api_usage;
    try {
      console.log(TRACE + " 尝试 args 兜底", { hasMaybeUsage: !!maybeUsage, maybeUsageStr: maybeUsage ? JSON.stringify(maybeUsage).slice(0, 1500) : "null", isValid: maybeUsage ? isValidUsage(maybeUsage) : false });
    } catch {
    }
    if (isValidUsage(maybeUsage)) {
      const m = args[0]?.model || model;
      console.log(TRACE + " args 命中", { model: m });
      processUsage(maybeUsage, m, lastMessages, lastStart);
      return;
    }
    {
      let fetchPack = lastFetchUsage;
      let fetchUsage = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
      if (fetchUsage && isValidUsage(fetchUsage) && Date.now() - lastFetchTime < 12e4) {
        const fetchedModel = fetchPack && fetchPack.model || lastFetchModel || model;
        const fetchedMsgs = fetchPack && fetchPack.msgs || lastMessages;
        const fetchedStart = fetchPack && fetchPack.startTime || lastStart;
        const fetchedReq = fetchPack && fetchPack.fullReq || null;
        const fetchedRes = fetchPack && fetchPack.fullResponse || null;
        const fTtft = fetchPack && fetchPack.ttft || 0;
        const fThink = fetchPack && fetchPack.thinkTime || 0;
        console.log(TRACE + " fetch 兜底命中", { model: fetchedModel, usage: JSON.stringify(fetchUsage).slice(0, 1500) });
        lastFetchUsage = null;
        processUsage(fetchUsage, fetchedModel, fetchedMsgs, fetchedStart, fetchedReq, fetchedRes, fTtft, fThink);
        return;
      } else if (lastFetchUsage) {
        const fu = fetchPack && fetchPack.usage ? fetchPack.usage : fetchPack;
        console.log(TRACE + " fetch 有缓存但无效或超时", { has: !!lastFetchUsage, isValid: fu ? isValidUsage(fu) : false, age: Date.now() - lastFetchTime });
      }
    }
    if (extra.token_count != null && !usage) {
      try {
        console.warn("[API用量统计] 跳过无效 usage：仅有本地 token_count=" + extra.token_count + " model=" + model + " 未生成条目（非 API 真实用量，需完整 usage）。若确为真实请求，请检查网络 fetch 捕获是否命中，或查看 TRACE 中 fetch 日志");
      } catch {
      }
      console.log(TRACE + " 无有效 usage，仅有 token_count，已跳过不记录", { token_count: extra.token_count, model, hasFetch: !!lastFetchUsage });
      return;
    }
    console.log(TRACE + " 未找到任何有效 usage，丢弃本次记录", { extraKeys: extra ? Object.keys(extra).slice(0, 20) : [], argsKeys: args[0] ? Object.keys(args[0]).slice(0, 20) : [], hasFetch: !!lastFetchUsage });
  } catch (e) {
    try {
      console.error(TRACE + " onGenerationEnded 异常", e);
    } catch {
    }
  }
}
function refresh() {
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
}
function processUsage(usage, model, messages, startTime, fullRequest = null, fullResponse = null, ttft = 0, thinkTime = 0) {
  repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime);
  refresh();
}
function recalcAllCosts() {
  repository.recalcAll();
}
const interception = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  installInterception,
  processUsage,
  recalcAllCosts,
  setLastRequest,
  uninstallInterception
}, Symbol.toStringTag, { value: "Module" }));
const XOR_KEY = "ds-stats-v1-xor-key!@#$%^&*";
function encryptKey(plaintext) {
  if (!plaintext) return "";
  try {
    const utf8 = unescape(encodeURIComponent(plaintext));
    let result = "";
    for (let i = 0; i < utf8.length; i++) {
      result += String.fromCharCode(utf8.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return btoa(result);
  } catch {
    let result = "";
    for (let i = 0; i < plaintext.length; i++) {
      result += String.fromCharCode(plaintext.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    try {
      return btoa(result);
    } catch {
      return "";
    }
  }
}
function decryptKey(ciphertext) {
  if (!ciphertext) return "";
  try {
    const decoded = atob(ciphertext);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    try {
      return decodeURIComponent(escape(result));
    } catch {
      return result;
    }
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
      state$2.balance = bal;
      saveHot({ balance: bal });
      try {
        globalThis.ApiUsageStat?.refreshUI?.();
      } catch {
      }
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
function stripHistory$1(history) {
  return history.map((h) => {
    const c = { ...h };
    delete c.messages;
    delete c.fullRequest;
    delete c.fullResponse;
    return c;
  });
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
      history: stripHistory$1(state$2.history),
      total_tokens: state$2.total_tokens,
      total_cost: state$2.total_cost,
      input_tokens: state$2.input_tokens,
      output_tokens: state$2.output_tokens,
      cache_hit_tokens: state$2.cache_hit_tokens,
      cache_miss_tokens: state$2.cache_miss_tokens,
      input_cost: state$2.input_cost,
      output_cost: state$2.output_cost,
      rounds: state$2.rounds,
      startTime: state$2.startTime,
      balance: state$2.balance,
      customBalance: state$2.customBalance,
      settings: JSON.parse(JSON.stringify(state$2.settings)),
      messageCount: state$2.messageCount,
      // 兼容旧多存档导入：额外提供 saves 包装
      saves: { default: { name: "default", history: stripHistory$1(state$2.history), total_tokens: state$2.total_tokens, total_cost: state$2.total_cost, input_tokens: state$2.input_tokens, output_tokens: state$2.output_tokens, cache_hit_tokens: state$2.cache_hit_tokens, cache_miss_tokens: state$2.cache_miss_tokens, input_cost: state$2.input_cost, output_cost: state$2.output_cost, rounds: state$2.rounds, startTime: state$2.startTime } },
      currentSave: "default"
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
  let history = [];
  if (Array.isArray(d.history)) history = d.history;
  else if (d.saves && typeof d.saves === "object") {
    for (const s of Object.values(d.saves)) {
      const h = s.history || [];
      history = history.concat(h);
    }
  }
  const cleaned = [];
  let skipped = 0;
  for (const h of history) {
    if (!h || typeof h !== "object" || h.timestamp === void 0 || isNaN(h.timestamp)) {
      skipped++;
      continue;
    }
    if (isUnsafeKey(String(h.model))) continue;
    const nh = { timestamp: h.timestamp, model: h.model || "unknown", prompt_tokens: h.prompt_tokens || 0, cache_hit_tokens: h.cache_hit_tokens || 0, cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0, total_tokens: h.total_tokens || 0, priceType: h.priceType || "old" };
    for (const f of Object.keys(h)) {
      if (isUnsafeKey(f)) continue;
      if (nh[f] === void 0) nh[f] = h[f];
    }
    cleaned.push(nh);
  }
  cleaned.sort((a, b) => b.timestamp - a.timestamp);
  return { data: { history: cleaned, balance: d.balance, customBalance: d.customBalance, settings: d.settings, messageCount: d.messageCount, total_tokens: d.total_tokens, total_cost: d.total_cost, input_tokens: d.input_tokens, output_tokens: d.output_tokens, cache_hit_tokens: d.cache_hit_tokens, cache_miss_tokens: d.cache_miss_tokens, input_cost: d.input_cost, output_cost: d.output_cost, rounds: d.rounds, startTime: d.startTime }, skipped: { entries: skipped } };
}
function applyImportedData(d, mode) {
  if (mode === "overwrite") {
    repository.replaceAll({
      history: d.history || [],
      total_tokens: d.total_tokens ?? (d.history || []).reduce((a, h) => a + (h.total_tokens || 0), 0),
      total_cost: d.total_cost ?? (d.history || []).reduce((a, h) => a + (h.cost || 0), 0),
      input_tokens: d.input_tokens ?? 0,
      output_tokens: d.output_tokens ?? 0,
      cache_hit_tokens: d.cache_hit_tokens ?? 0,
      cache_miss_tokens: d.cache_miss_tokens ?? 0,
      input_cost: d.input_cost ?? 0,
      output_cost: d.output_cost ?? 0,
      rounds: d.rounds ?? d.history?.length ?? 0,
      startTime: d.startTime ?? Date.now(),
      balance: d.balance,
      customBalance: d.customBalance,
      settings: d.settings,
      messageCount: d.messageCount
    });
  } else {
    const seen = new Set((state$2.history || []).map((h) => h.timestamp));
    const toAdd = [];
    for (const h of d.history || []) {
      if (!seen.has(h.timestamp)) {
        seen.add(h.timestamp);
        toAdd.push(h);
      }
    }
    const merged = [...toAdd, ...state$2.history].sort((a, b) => b.timestamp - a.timestamp);
    repository.replaceAll({ history: merged });
  }
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
  const cfg = state$2.settings.webdav || {};
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
  const cfg = state$2.settings.webdav || {};
  const base = (cfg.url || "").trim().replace(/\/+$/, "");
  const path = (cfg.path || "").trim().replace(/^\/+|\/+$/g, "");
  let u = base + "/";
  if (path) u += path + "/";
  u += WEBDAV_SYNC_FILE;
  return u;
}
function reqUrl(u) {
  const proxy = (state$2.settings.webdav?.proxy || "").trim();
  if (!proxy) return u;
  if (proxy.indexOf("?") !== -1) return proxy + encodeURIComponent(u);
  return proxy.replace(/\/+$/, "") + "/" + encodeURIComponent(u);
}
function dirs() {
  const cfg = state$2.settings.webdav || {};
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
function stripHistory(history) {
  return history.map((h) => {
    const c = { ...h };
    delete c.messages;
    delete c.fullRequest;
    delete c.fullResponse;
    return c;
  });
}
function buildLocalBundle() {
  return {
    format: "deepseek-stat-sync",
    version: WEBDAV_REMOTE_VERSION,
    syncedAt: Date.now(),
    data: {
      history: stripHistory(state$2.history),
      total_tokens: state$2.total_tokens,
      total_cost: state$2.total_cost,
      input_tokens: state$2.input_tokens,
      output_tokens: state$2.output_tokens,
      cache_hit_tokens: state$2.cache_hit_tokens,
      cache_miss_tokens: state$2.cache_miss_tokens,
      input_cost: state$2.input_cost,
      output_cost: state$2.output_cost,
      rounds: state$2.rounds,
      startTime: state$2.startTime,
      balance: state$2.balance,
      customBalance: state$2.customBalance,
      settings: JSON.parse(JSON.stringify(state$2.settings)),
      messageCount: state$2.messageCount
    },
    _ts: {}
  };
}
function mergeBundles(remote, local) {
  const rd = remote.data || {}, ld = local.data || {};
  const toHistory = (d) => {
    if (Array.isArray(d.history)) return d.history;
    if (d.saves && typeof d.saves === "object") {
      let arr = [];
      for (const s of Object.values(d.saves)) arr = arr.concat(s.history || []);
      return arr;
    }
    return [];
  };
  const clean = (arr) => arr.map((e) => {
    if (e && typeof e === "object") {
      for (const k of Object.keys(e)) if (isUnsafeKey$1(k)) delete e[k];
    }
    return e;
  });
  const lh = clean(toHistory(ld)), rh = clean(toHistory(rd));
  const keyOf = (h) => `${h.timestamp}|${h.model || ""}|${h.total_tokens || 0}`;
  const lseen = new Set(lh.map((h) => keyOf(h)));
  const rseen = new Set(rh.map((h) => keyOf(h)));
  let pulled = 0, pushed = 0;
  const merged = [...rh.filter((h) => {
    if (!lseen.has(keyOf(h))) {
      pulled++;
      return true;
    }
    return false;
  }), ...lh.filter((h) => {
    if (!rseen.has(keyOf(h))) {
      pushed++;
      return true;
    }
    return false;
  }), ...lh.filter((h) => rseen.has(keyOf(h)))];
  const dedup = /* @__PURE__ */ new Map();
  for (const h of merged) dedup.set(keyOf(h), h);
  let hist = Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp);
  const data = {
    history: hist,
    total_tokens: ld.total_tokens ?? rd.total_tokens ?? hist.reduce((a, h) => a + (h.total_tokens || 0), 0),
    total_cost: ld.total_cost ?? rd.total_cost ?? hist.reduce((a, h) => a + (h.cost || 0), 0),
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
    settings: ld.settings ?? rd.settings
  };
  return { mergedData: data, pulled, pushed };
}
let syncing = false;
async function doSyncNow() {
  if (syncing) return alert("同步进行中");
  const cfg = state$2.settings.webdav || {};
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
    repository.replaceAll(merged.mergedData);
    repository.recalcAll();
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
function applyTheme(theme) {
  const t = theme || state$2.settings.theme || "light";
  const mode = t === "dark" ? "dark" : "light";
  try {
    const doc = window.parent?.document ?? document;
    const panel = doc.getElementById("aus-panel");
    if (panel) panel.setAttribute("data-ds-theme", mode);
    const overlay = doc.getElementById("aus-overlay");
    if (overlay) {
      overlay.setAttribute("data-extension", "api-usage-stat");
      overlay.setAttribute("data-ds-theme", mode);
    }
    try {
      document.documentElement.removeAttribute("data-ds-theme");
      document.documentElement.removeAttribute("data-extension");
    } catch {
    }
    try {
      doc.documentElement.removeAttribute("data-ds-theme");
      if (doc.documentElement.getAttribute("data-extension") === "api-usage-stat") {
        const hasPanel = !!doc.getElementById("aus-panel");
        if (hasPanel) doc.documentElement.removeAttribute("data-extension");
      }
    } catch {
    }
  } catch {
  }
}
function generateDebugBatch() {
  const startStr = state$2.settings.debugDateStart;
  const endStr = state$2.settings.debugDateEnd;
  if (!startStr || !endStr) return alert("请设置起始与结束日期");
  const startDate = /* @__PURE__ */ new Date(startStr + "T00:00:00Z");
  const endDate = /* @__PURE__ */ new Date(endStr + "T00:00:00Z");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return alert("日期范围无效");
  const count = state$2.settings.debugBatchCount || 30;
  const model = state$2.settings.debugModel || "deepseek-v4-flash";
  const hit = state$2.settings.debugHit || 1e4;
  const miss = state$2.settings.debugMiss || 5e3;
  const output = state$2.settings.debugOutput || 2e3;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 864e5) + 1;
  const perDay = Math.ceil(count / totalDays);
  let generated = 0;
  for (let d = 0; d < totalDays && generated < count; d++) {
    const curDate = new Date(startDate);
    curDate.setUTCDate(startDate.getUTCDate() + d);
    for (let i = 0; i < perDay && generated < count; i++) {
      const rv = (base) => Math.round(base * (0.3 + Math.random() * 1.4));
      const h = rv(hit), m = rv(miss), o = rv(output);
      const total = h + m + o;
      const ts = new Date(curDate);
      ts.setUTCHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
      const dur = Math.floor(Math.random() * 5e3) + 500;
      const ttft = Math.floor(Math.random() * 1e3) + 100;
      const c = calcCost({ timestamp: ts.getTime(), model, prompt_cache_hit_tokens: h, prompt_cache_miss_tokens: m, completion_tokens: o }, state$2.settings);
      state$2.total_tokens += total;
      state$2.total_cost += c.total;
      state$2.input_tokens += h + m;
      state$2.output_tokens += o;
      state$2.cache_hit_tokens += h;
      state$2.cache_miss_tokens += m;
      state$2.input_cost += c.input;
      state$2.output_cost += c.output;
      if (isDeepSeekOfficialModel(model)) state$2.rounds += 1;
      state$2.history.unshift({ timestamp: ts.getTime(), model, prompt_tokens: h + m, cache_hit_tokens: h, cache_miss_tokens: m, completion_tokens: o, total_tokens: total, input_cost: c.input, output_cost: c.output, cost: c.total, cache_hit_rate: h + m > 0 ? h / (h + m) * 100 : 0, priceType: c.priceType, raw_usage: { prompt_cache_hit_tokens: h, prompt_cache_miss_tokens: m, completion_tokens: o, total_tokens: total }, messages: [], duration: dur, ttft, thinkTime: 300, thinkTokens: Math.floor(o * 0.2), tokenRate: Math.round(o / (dur - ttft) * 1e3), fullRequest: null, fullResponse: null });
      generated++;
    }
  }
  state$2.history.sort((a, b) => b.timestamp - a.timestamp);
  repository.recalcAll();
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
  alert("已生成 " + generated + " 条模拟数据");
}
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function localDay(ts) {
  return new Date(ts + 8 * 3600 * 1e3).toISOString().slice(0, 10);
}
function renderSettings(doc) {
  const host = doc.getElementById("aus-settings");
  if (!host) return;
  const s = state$2.settings;
  host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <!-- 颜色模式（与用量统计·模型选择一致的胶囊下拉） -->
      <div class="ds-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">颜色模式</span><div id="aus-theme-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">模式</span><span id="aus-theme-label" style="font-weight:600;color:var(--ds-text);">浅色</span><span style="font-size:10px;">▼</span></div></div><div id="aus-theme-dropdown" style="display:none;position:absolute;top:44px;right:12px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:140px;padding:8px;"></div><div style="font-size:11px;color:var(--ds-text-2);margin-top:6px;">切换后立即生效，深色模式针对夜间可读性优化</div></div>

      <!-- 历史显示范围 -->
      <div class="ds-card" style="position:relative;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">历史显示范围</span><div id="aus-history-scope-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">范围</span><span id="aus-history-scope-label" style="font-weight:600;color:var(--ds-text);">全部历史</span><span style="font-size:10px;">▼</span></div></div><div id="aus-history-scope-dropdown" style="display:none;position:absolute;top:44px;right:12px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:160px;padding:8px;"></div><div style="font-size:11px;color:var(--ds-text-2);margin-top:6px;">全部历史展示所有对话的记录，当前对话仅展示与当前聊天文件关联的记录</div></div>

      <!-- API 密钥 -->
      <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);font-weight:500;margin-bottom:6px;">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="输入 DeepSeek API 密钥" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;outline:none;" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;"></div></div>

      <!-- 余额 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">自动校准余额</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-auto-balance" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-auto-balance-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-auto-balance-interval" style="display:${s.autoBalance ? "block" : "none"};margin-top:8px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;color:var(--ds-text);">校准间隔（分钟）</span><input type="number" id="aus-balance-interval" min="1" max="1440" style="width:90px;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;text-align:center;" /></div></div>
        <div style="margin-top:12px;display:flex;gap:8px;"><input id="aus-custom-balance" placeholder="自定义余额（覆盖 API 查询）" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><button id="aus-save-balance" class="ds-btn-pill" style="padding:8px 14px;">保存</button><button id="aus-clear-balance" style="padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">清除</button></div><div id="aus-balance-status" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;"></div>
      </div>

      <!-- 新价格机制 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">新价格机制（峰谷计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-use-new-pricing" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-use-new-pricing-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-new-pricing-panel" style="display:${s.useNewPricing ? "grid" : "none"};margin-top:10px;gap:8px;">
          <div style="display:flex;gap:8px;align-items:center;"><input type="date" id="aus-new-pricing-date" style="flex:1;padding:7px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><button id="aus-btn-pricing-today" style="padding:7px 12px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;white-space:nowrap;">设为今日</button></div>
          <div style="font-size:11px;color:var(--ds-text-2);">生效日期前按旧价，之后按峰谷价（仅 deepseek* 模型，周末全天低谷）。</div>
        </div>
      </div>

      <!-- 高峰时段 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">高峰时段</span><button id="aus-btn-add-peak-hour" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">+ 添加</button></div><div id="aus-peak-hours-list" style="display:grid;gap:6px;margin-top:8px;"></div><div style="font-size:10px;color:var(--ds-text-3);margin-top:6px;">支持跨天（如 22:00-02:00），周末自动低谷。</div></div>

      <!-- 模型与价格 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">模型与价格（¥/百万 tokens）</span><button id="aus-btn-add-model" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">+ 自定义模型</button></div><div id="aus-custom-models-list" style="display:grid;gap:8px;margin-top:8px;"></div></div>

      <!-- 调试 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">调试模式（模拟数据，不计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-debug-mode" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-debug-mode-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-debug-panel" style="display:${s.debug ? "grid" : "none"};margin-top:10px;gap:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">命中</div><input type="number" id="aus-debug-hit" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">未命中</div><input type="number" id="aus-debug-miss" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">输出</div><input type="number" id="aus-debug-output" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">模型</div><select id="aus-debug-model" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;"></select></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><input type="date" id="aus-debug-date-start" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input type="date" id="aus-debug-date-end" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input type="number" id="aus-debug-batch-count" min="1" placeholder="条数" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>
          <button id="aus-btn-debug-batch" class="ds-btn-pill" style="width:100%;">生成模拟数据</button><div id="aus-debug-status" style="font-size:11px;color:var(--ds-text-2);"></div>
        </div>
      </div>

      <!-- 峰值圆点 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">峰值提示小圆点</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-peak-dot" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-peak-dot-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">重置位置</button></div>

      <!-- WebDAV -->
      <div class="ds-card"><div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:6px;">WebDAV 云同步</div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:8px;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
        <div style="display:grid;gap:8px;">
          <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>
          <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button>
        </div>
      </div>
    </div>
  `;
  const apiKeyEl = doc.getElementById("aus-api-key");
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const v = ctx?.extensionSettings?.["api_usage_stat"]?.apiKey;
    if (v && apiKeyEl) {
      apiKeyEl.value = "";
      apiKeyEl.placeholder = "已保存 ●●●●（留空不修改）";
      apiKeyEl.dataset.hasKey = "1";
    }
  } catch {
  }
  doc.getElementById("aus-custom-balance").value = state$2.customBalance || "";
  doc.getElementById("aus-peak-dot").checked = state$2.settings.peakDot !== false;
  const peakSlider = doc.getElementById("aus-peak-dot-slider");
  if (peakSlider) peakSlider.style.left = state$2.settings.peakDot !== false ? "23px" : "3px";
  const autoCb = doc.getElementById("aus-auto-balance");
  const autoSlider = doc.getElementById("aus-auto-balance-slider");
  if (autoCb) autoCb.checked = !!s.autoBalance;
  if (autoSlider) autoSlider.style.left = s.autoBalance ? "23px" : "3px";
  doc.getElementById("aus-balance-interval").value = String(s.balanceInterval ?? 10);
  const newCb = doc.getElementById("aus-use-new-pricing");
  const newSlider = doc.getElementById("aus-use-new-pricing-slider");
  if (newCb) newCb.checked = !!s.useNewPricing;
  if (newSlider) newSlider.style.left = s.useNewPricing ? "23px" : "3px";
  const newDate = doc.getElementById("aus-new-pricing-date");
  if (newDate) newDate.value = s.newPricingDate ? localDay(s.newPricingDate) : "";
  const dbgCb = doc.getElementById("aus-debug-mode");
  const dbgSlider = doc.getElementById("aus-debug-mode-slider");
  if (dbgCb) dbgCb.checked = !!s.debug;
  if (dbgSlider) dbgSlider.style.left = s.debug ? "23px" : "3px";
  doc.getElementById("aus-debug-hit").value = String(s.debugHit ?? 1e4);
  doc.getElementById("aus-debug-miss").value = String(s.debugMiss ?? 5e3);
  doc.getElementById("aus-debug-output").value = String(s.debugOutput ?? 2e3);
  doc.getElementById("aus-debug-date-start").value = s.debugDateStart || "";
  doc.getElementById("aus-debug-date-end").value = s.debugDateEnd || "";
  doc.getElementById("aus-debug-batch-count").value = String(s.debugBatchCount ?? 30);
  doc.getElementById("aus-webdav-url").value = s.webdav?.url || "";
  doc.getElementById("aus-webdav-user").value = s.webdav?.username || "";
  doc.getElementById("aus-webdav-path").value = s.webdav?.path || "";
  doc.getElementById("aus-webdav-proxy").value = s.webdav?.proxy || "";
  try {
    const pass = localStorage.getItem("ds_ds_webdav_pass") || "";
    const el = doc.getElementById("aus-webdav-pass");
    if (pass && el) {
      el.value = "";
      el.placeholder = "已保存 ●●●●（留空不修改）";
      el.dataset.hasKey = "1";
    } else {
      const ctx = globalThis.SillyTavern?.getContext?.();
      const v2 = ctx?.extensionSettings?.["api_usage_stat"]?.webdavPass;
      if (v2 && el) {
        el.value = "";
        el.placeholder = "已保存 ●●●●（留空不修改）";
        el.dataset.hasKey = "1";
      }
    }
  } catch {
  }
  let themePickerOpen = false;
  function renderThemePicker() {
    const dropdown = doc.getElementById("aus-theme-dropdown");
    const label = doc.getElementById("aus-theme-label");
    if (!label) return;
    const cur = state$2.settings.theme || "light";
    label.textContent = cur === "dark" ? "深色" : "浅色";
    if (!dropdown) return;
    const opts = [{ v: "light", l: "浅色" }, { v: "dark", l: "深色" }];
    dropdown.innerHTML = opts.map((o) => {
      const active = o.v === cur ? "background:var(--ds-card);font-weight:600;" : "";
      return `<div data-theme="${o.v}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active}">${o.l}</div>`;
    }).join("");
    dropdown.querySelectorAll("[data-theme]").forEach((el) => {
      el.onclick = () => {
        const v = el.getAttribute("data-theme");
        state$2.settings.theme = v;
        saveHot({ settings: state$2.settings });
        applyTheme(v);
        themePickerOpen = false;
        dropdown.style.display = "none";
        renderThemePicker();
        try {
          globalThis.ApiUsageStat?.refreshUI?.();
        } catch {
        }
      };
    });
  }
  renderThemePicker();
  const themeBtn = doc.getElementById("aus-theme-btn");
  const themeDropdown = doc.getElementById("aus-theme-dropdown");
  if (themeBtn && themeDropdown) {
    themeBtn.onclick = () => {
      themePickerOpen = !themePickerOpen;
      themeDropdown.style.display = themePickerOpen ? "block" : "none";
      if (themePickerOpen) renderThemePicker();
    };
  }
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (themePickerOpen && !t.closest("#aus-theme-dropdown") && !t.closest("#aus-theme-btn")) {
      themePickerOpen = false;
      const d = doc.getElementById("aus-theme-dropdown");
      if (d) d.style.display = "none";
    }
    if (scopePickerOpen && !t.closest("#aus-history-scope-dropdown") && !t.closest("#aus-history-scope-btn")) {
      scopePickerOpen = false;
      const d2 = doc.getElementById("aus-history-scope-dropdown");
      if (d2) d2.style.display = "none";
    }
  });
  let scopePickerOpen = false;
  function renderScopePicker() {
    const dropdown = doc.getElementById("aus-history-scope-dropdown");
    const label = doc.getElementById("aus-history-scope-label");
    if (!label) return;
    const cur = state$2.settings.historyScope || "all";
    label.textContent = cur === "current" ? "当前对话" : "全部历史";
    if (!dropdown) return;
    const opts = [{ v: "all", l: "全部历史" }, { v: "current", l: "当前对话" }];
    dropdown.innerHTML = opts.map((o) => {
      const active = o.v === cur ? "background:var(--ds-card);font-weight:600;" : "";
      return `<div data-scope="${o.v}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active}">${o.l}</div>`;
    }).join("");
    dropdown.querySelectorAll("[data-scope]").forEach((el) => {
      el.onclick = () => {
        const v = el.getAttribute("data-scope");
        state$2.settings.historyScope = v;
        saveHot({ settings: state$2.settings });
        scopePickerOpen = false;
        dropdown.style.display = "none";
        renderScopePicker();
        try {
          globalThis.ApiUsageStat?.refreshUI?.();
        } catch {
        }
      };
    });
  }
  renderScopePicker();
  const scopeBtn = doc.getElementById("aus-history-scope-btn");
  const scopeDropdown = doc.getElementById("aus-history-scope-dropdown");
  if (scopeBtn && scopeDropdown) {
    scopeBtn.onclick = () => {
      scopePickerOpen = !scopePickerOpen;
      scopeDropdown.style.display = scopePickerOpen ? "block" : "none";
      if (scopePickerOpen) renderScopePicker();
    };
  }
  doc.getElementById("aus-save-key").onclick = () => {
    const el = doc.getElementById("aus-api-key");
    const v = el.value.trim();
    if (!v && el.dataset.hasKey === "1") {
      const sEl2 = doc.getElementById("aus-key-status");
      sEl2.textContent = "未修改，已保留原密钥";
      return;
    }
    saveApiKey(v);
    const sEl = doc.getElementById("aus-key-status");
    sEl.textContent = v ? "已保存" : "已清空";
    if (v) {
      el.value = "";
      el.placeholder = "已保存 ●●●●（留空不修改）";
      el.dataset.hasKey = "1";
    } else {
      el.placeholder = "输入 DeepSeek API 密钥";
      el.dataset.hasKey = "";
    }
  };
  doc.getElementById("aus-save-balance").onclick = () => {
    const v = doc.getElementById("aus-custom-balance").value.trim();
    if (v && isNaN(parseFloat(v))) return alert("请输入有效金额");
    state$2.customBalance = v || null;
    saveHot({ customBalance: state$2.customBalance });
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
    doc.getElementById("aus-balance-status").textContent = v ? "已保存" : "已清除";
  };
  doc.getElementById("aus-clear-balance").onclick = () => {
    state$2.customBalance = null;
    saveHot({ customBalance: null });
    doc.getElementById("aus-custom-balance").value = "";
    doc.getElementById("aus-balance-status").textContent = "已清除";
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  if (autoCb) autoCb.onchange = () => {
    state$2.settings.autoBalance = autoCb.checked;
    if (autoSlider) autoSlider.style.left = autoCb.checked ? "23px" : "3px";
    doc.getElementById("aus-auto-balance-interval").style.display = autoCb.checked ? "block" : "none";
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-balance-interval").onchange = (e) => {
    state$2.settings.balanceInterval = parseInt(e.target.value) || 10;
    saveHot({ settings: state$2.settings });
  };
  if (newCb) newCb.onchange = () => {
    state$2.settings.useNewPricing = newCb.checked;
    if (newSlider) newSlider.style.left = newCb.checked ? "23px" : "3px";
    doc.getElementById("aus-new-pricing-panel").style.display = newCb.checked ? "grid" : "none";
    saveHot({ settings: state$2.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  if (newDate) newDate.onchange = () => {
    if (newDate.value) {
      const p = newDate.value.split("-");
      state$2.settings.newPricingDate = (/* @__PURE__ */ new Date(p[0] + "-" + p[1] + "-" + p[2] + "T00:00:00+08:00")).getTime();
    } else state$2.settings.newPricingDate = 0;
    saveHot({ settings: state$2.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  doc.getElementById("aus-btn-pricing-today").onclick = () => {
    const d = /* @__PURE__ */ new Date();
    d.setHours(0, 0, 0, 0);
    state$2.settings.newPricingDate = d.getTime();
    if (newDate) newDate.value = localDay(d.getTime());
    if (newCb && !newCb.checked) {
      newCb.checked = true;
      if (newSlider) newSlider.style.left = "23px";
      doc.getElementById("aus-new-pricing-panel").style.display = "grid";
    }
    saveHot({ settings: state$2.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  if (dbgCb) dbgCb.onchange = () => {
    state$2.settings.debug = dbgCb.checked;
    if (dbgSlider) dbgSlider.style.left = dbgCb.checked ? "23px" : "3px";
    doc.getElementById("aus-debug-panel").style.display = dbgCb.checked ? "grid" : "none";
    const st = doc.getElementById("aus-debug-status");
    if (st) st.textContent = dbgCb.checked ? "调试模式已开启，下次对话将使用模拟参数，不计费" : "";
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-hit").onchange = (e) => {
    state$2.settings.debugHit = parseInt(e.target.value) || 0;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-miss").onchange = (e) => {
    state$2.settings.debugMiss = parseInt(e.target.value) || 0;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-output").onchange = (e) => {
    state$2.settings.debugOutput = parseInt(e.target.value) || 0;
    saveHot({ settings: state$2.settings });
  };
  const dbgModel = doc.getElementById("aus-debug-model");
  if (dbgModel) dbgModel.onchange = (e) => {
    state$2.settings.debugModel = e.target.value;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-date-start").onchange = (e) => {
    state$2.settings.debugDateStart = e.target.value;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-date-end").onchange = (e) => {
    state$2.settings.debugDateEnd = e.target.value;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-debug-batch-count").onchange = (e) => {
    state$2.settings.debugBatchCount = parseInt(e.target.value) || 1;
    saveHot({ settings: state$2.settings });
  };
  doc.getElementById("aus-btn-debug-batch").onclick = () => generateDebugBatch();
  doc.getElementById("aus-peak-dot").onchange = (e) => {
    state$2.settings.peakDot = e.target.checked;
    const sl = doc.getElementById("aus-peak-dot-slider");
    if (sl) sl.style.left = e.target.checked ? "23px" : "3px";
    saveHot({ settings: state$2.settings });
    try {
      globalThis.ApiUsageStat?.updatePeakDot?.();
    } catch {
    }
  };
  doc.getElementById("aus-reset-dot").onclick = () => {
    try {
      localStorage.removeItem("ds_ds_peak_dot_pos");
      const dot = window.parent?.document?.getElementById("aus-peak-dot-indicator");
      if (dot) {
        dot.style.left = "";
        dot.style.top = "60px";
        dot.style.right = "16px";
      }
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
    state$2.settings.webdav.url = wUrl.value.trim();
    saveHot({ settings: state$2.settings });
  };
  if (wUser) wUser.onchange = () => {
    state$2.settings.webdav.username = wUser.value.trim();
    saveHot({ settings: state$2.settings });
  };
  if (wPath) wPath.onchange = () => {
    state$2.settings.webdav.path = wPath.value.trim();
    saveHot({ settings: state$2.settings });
  };
  if (wProxy) wProxy.onchange = () => {
    state$2.settings.webdav.proxy = wProxy.value.trim();
    saveHot({ settings: state$2.settings });
  };
  if (wPass) wPass.onchange = () => {
    const vv = wPass.value.trim();
    if (!vv && wPass.dataset.hasKey === "1") return;
    saveWebdavPass(wPass.value);
    if (vv) {
      wPass.value = "";
      wPass.placeholder = "已保存 ●●●●（留空不修改）";
      wPass.dataset.hasKey = "1";
    }
  };
  doc.getElementById("aus-webdav-sync").onclick = () => doSyncNow();
  renderPeakHoursEditor(doc);
  renderModelsEditor(doc);
  fillDebugModelSelect(doc);
}
function renderPeakHoursEditor(doc) {
  const list = doc.getElementById("aus-peak-hours-list");
  if (!list) return;
  const hours = state$2.settings.peakHours || [];
  list.innerHTML = hours.map((h, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="time" value="${esc(h.start || "")}" data-idx="${i}" data-field="start" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
      <span style="font-size:11px;color:var(--ds-text-2);">至</span>
      <input type="time" value="${esc(h.end || "")}" data-idx="${i}" data-field="end" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
      <button data-del="${i}" style="padding:6px 8px;border:1px solid var(--ds-red-border);border-radius:8px;background:var(--ds-red-bg);color:var(--ds-red);font-size:11px;cursor:pointer;">删除</button>
    </div>
  `).join("");
  list.querySelectorAll('input[type="time"]').forEach((el) => {
    el.onchange = () => {
      const idx = parseInt(el.getAttribute("data-idx"));
      const field2 = el.getAttribute("data-field");
      state$2.settings.peakHours[idx][field2] = el.value;
      saveHot({ settings: state$2.settings });
      recalcAllCosts();
      try {
        globalThis.ApiUsageStat?.refreshUI?.();
      } catch {
      }
    };
  });
  list.querySelectorAll("button[data-del]").forEach((el) => {
    el.onclick = () => {
      const idx = parseInt(el.getAttribute("data-del"));
      state$2.settings.peakHours.splice(idx, 1);
      if (!state$2.settings.peakHours.length) state$2.settings.peakHours = JSON.parse(JSON.stringify(DEFAULT_PEAK_HOURS));
      saveHot({ settings: state$2.settings });
      renderPeakHoursEditor(doc);
      recalcAllCosts();
      try {
        globalThis.ApiUsageStat?.refreshUI?.();
      } catch {
      }
    };
  });
  const addBtn = doc.getElementById("aus-btn-add-peak-hour");
  if (addBtn) addBtn.onclick = () => {
    state$2.settings.peakHours.push({ start: "09:00", end: "12:00" });
    saveHot({ settings: state$2.settings });
    renderPeakHoursEditor(doc);
  };
}
function renderModelsEditor(doc) {
  const list = doc.getElementById("aus-custom-models-list");
  if (!list) return;
  const builtin = Object.keys(PRICING);
  const cms = state$2.settings.customModels || [];
  const rows = [];
  for (const m of builtin) {
    const p = getPricing(m);
    const usePeak = p.usePeakPricing !== false;
    rows.push(modelRow(m, p, true, usePeak));
  }
  for (const e of cms) {
    if (e?.model && builtin.indexOf(e.model) === -1) {
      const p = getPricing(e.model);
      rows.push(modelRow(e.model, p, false, p.usePeakPricing !== false));
    }
  }
  list.innerHTML = rows.join("");
  list.querySelectorAll('input[type="checkbox"].aus-cm-peak').forEach((el) => {
    el.onchange = () => {
      const row = el.closest("[data-model]");
      const model = row.getAttribute("data-model") || "";
      const usePeak = el.checked;
      upsertCustom(model, { usePeakPricing: usePeak });
      saveHot({ settings: state$2.settings });
      renderModelsEditor(doc);
      recalcAllCosts();
      try {
        globalThis.ApiUsageStat?.refreshUI?.();
      } catch {
      }
    };
  });
  list.querySelectorAll("input[data-price]").forEach((el) => {
    el.onchange = () => {
      const row = el.closest("[data-model]");
      const model = row.getAttribute("data-model") || "";
      const isBuiltin = row.getAttribute("data-builtin") === "1";
      const prices = readRow(row);
      saveCustomRow(model, prices, isBuiltin);
    };
  });
  list.querySelectorAll("button[data-del]").forEach((el) => {
    el.onclick = () => {
      const row = el.closest("[data-model]");
      const model = row.getAttribute("data-model") || "";
      state$2.settings.customModels = state$2.settings.customModels.filter((c) => c.model !== model);
      saveHot({ settings: state$2.settings });
      renderModelsEditor(doc);
      fillDebugModelSelect(doc);
      recalcAllCosts();
      try {
        globalThis.ApiUsageStat?.refreshUI?.();
      } catch {
      }
    };
  });
  const addBtn = doc.getElementById("aus-btn-add-model");
  if (addBtn) addBtn.onclick = () => {
    const name = "custom-model-" + (state$2.settings.customModels.length + 1);
    state$2.settings.customModels.push({ model: name, usePeakPricing: true, offpeak: {}, peak: {} });
    saveHot({ settings: state$2.settings });
    renderModelsEditor(doc);
    fillDebugModelSelect(doc);
  };
}
function modelRow(model, p, isBuiltin, usePeak) {
  const hit = (v) => v !== void 0 && v !== "" ? v : "";
  return `<div data-model="${esc(model)}" data-builtin="${isBuiltin ? "1" : "0"}" style="border:1px solid var(--ds-border);border-radius:10px;padding:10px;background:var(--ds-card-inner);display:grid;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <input value="${esc(model)}" ${isBuiltin ? "readonly" : ""} style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:${isBuiltin ? "var(--ds-sidebar-bg)" : "var(--ds-card-inner)"};font-size:12px;" />
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" class="aus-cm-peak" ${usePeak ? "checked" : ""} /> 峰谷</label>
      ${isBuiltin ? "" : '<button data-del="1" style="padding:4px 8px;border:1px solid var(--ds-red-border);border-radius:6px;background:var(--ds-red-bg);color:var(--ds-red);font-size:11px;cursor:pointer;">删除</button>'}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:var(--ds-sidebar-bg);border-radius:8px;padding:8px;display:grid;gap:6px;">
        <div style="font-size:10px;font-weight:600;color:var(--ds-green);">非峰</div>
        ${field("offpeak.hit", hit(p.offpeak.hit))}${field("offpeak.miss", hit(p.offpeak.miss))}${field("offpeak.output", hit(p.offpeak.output))}
      </div>
      <div style="background:var(--ds-card-inner);border-radius:8px;padding:8px;display:grid;gap:6px;${usePeak ? "" : "opacity:0.45;pointer-events:none;"}">
        <div style="font-size:10px;font-weight:600;color:#D97706;">高峰</div>
        ${field("peak.hit", hit(p.peak.hit))}${field("peak.miss", hit(p.peak.miss))}${field("peak.output", hit(p.peak.output))}
      </div>
    </div>
    <div style="font-size:10px;color:var(--ds-text-3);">单位：¥/百万 tokens · 内置模型不可删除，价格可覆盖</div>
  </div>`;
}
function field(key, val) {
  const label = key.endsWith(".hit") ? "命中" : key.endsWith(".miss") ? "未命中" : "输出";
  return `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;color:var(--ds-text-2);width:44px;">${label}</span><input type="number" step="0.001" min="0" data-price="${key}" value="${esc(val)}" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>`;
}
function readRow(row) {
  const peak = row.querySelector(".aus-cm-peak")?.checked ?? true;
  const out = { usePeakPricing: peak, offpeak: {}, peak: {} };
  row.querySelectorAll("input[data-price]").forEach((el) => {
    const k = el.getAttribute("data-price");
    const v = el.value.trim();
    const num = v === "" ? "" : parseFloat(v);
    const [zone, field2] = k.split(".");
    out[zone][field2] = v === "" || isNaN(num) ? "" : num;
  });
  return out;
}
function upsertCustom(model, patch) {
  const cms = state$2.settings.customModels;
  let found = cms.find((c) => c.model === model);
  if (found) Object.assign(found, patch);
  else cms.push({ model, usePeakPricing: patch.usePeakPricing, offpeak: {}, peak: {} });
}
function saveCustomRow(model, prices, isBuiltin) {
  const base = PRICING[model];
  let same = true;
  for (const f of ["hit", "miss", "output"]) {
    if (prices.offpeak[f] !== "" && prices.offpeak[f] !== base?.offpeak?.[f]) same = false;
    if (prices.peak[f] !== "" && prices.peak[f] !== base?.peak?.[f]) same = false;
  }
  const cms = state$2.settings.customModels;
  const idx = cms.findIndex((c) => c.model === model);
  if (isBuiltin && prices.usePeakPricing && same) {
    if (idx !== -1) cms.splice(idx, 1);
  } else {
    const entry = { model, usePeakPricing: prices.usePeakPricing, offpeak: prices.offpeak, peak: prices.peak };
    if (idx !== -1) cms[idx] = entry;
    else cms.push(entry);
  }
  saveHot({ settings: state$2.settings });
  recalcAllCosts();
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
}
function getPricing(model) {
  const m = model || "deepseek-v4-flash";
  const base = PRICING[m] || PRICING["deepseek-v4-flash"];
  for (const cm of state$2.settings.customModels || []) {
    if (cm?.model === m) {
      const merge = (b, c) => ({ hit: c?.hit !== "" && c?.hit !== void 0 ? parseFloat(c.hit) : b.hit, miss: c?.miss !== "" && c?.miss !== void 0 ? parseFloat(c.miss) : b.miss, output: c?.output !== "" && c?.output !== void 0 ? parseFloat(c.output) : b.output });
      return { usePeakPricing: cm.usePeakPricing !== false, offpeak: merge(base.offpeak, cm.offpeak), peak: merge(base.peak, cm.peak) };
    }
  }
  return base;
}
function fillDebugModelSelect(doc) {
  const sel = doc.getElementById("aus-debug-model");
  if (!sel) return;
  const models = Object.keys(PRICING).concat((state$2.settings.customModels || []).map((c) => c.model).filter(Boolean));
  const uniq = Array.from(new Set(models));
  sel.innerHTML = uniq.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  const cur = state$2.settings.debugModel;
  if (uniq.indexOf(cur) === -1) state$2.settings.debugModel = uniq[0] || "deepseek-v4-flash";
  sel.value = state$2.settings.debugModel;
}
let selOld = null;
let selNew = null;
function getDoc$6() {
  return window.parent?.document ?? document;
}
function diffMessages(oldMsgs, newMsgs) {
  const toText = (m) => `${m.role || ""}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`;
  const a = (oldMsgs || []).map(toText).join("\n");
  const b = (newMsgs || []).map(toText).join("\n");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return '<span style="color:var(--ds-text-2);">两条请求完全一致（缓存命中段完整）</span>';
  const ctx = 80;
  const aCtx = esc$1(a.slice(Math.max(0, i - ctx), i)) + '<span style="background:var(--ds-red-bg);color:var(--ds-red);padding:0 2px;border-radius:3px;">' + esc$1(a.slice(i, i + 200)) + "</span>" + esc$1(a.slice(i + 200, i + 280));
  const bCtx = esc$1(b.slice(Math.max(0, i - ctx), i)) + '<span style="background:var(--ds-green-bg);color:var(--ds-green);padding:0 2px;border-radius:3px;">' + esc$1(b.slice(i, i + 200)) + "</span>" + esc$1(b.slice(i + 200, i + 280));
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"><div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">旧：${aCtx}</div><div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;font-size:11px;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">新：${bCtx}</div></div><div style="font-size:11px;color:var(--ds-text-2);margin-top:8px;">差异起点即缓存发散位置，前 ${i} 字符一致为命中段</div>`;
}
function bindHistoryCompare() {
  const doc = getDoc$6();
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
  const doc = getDoc$6();
  const host = doc.getElementById("aus-diff");
  if (!host) return;
  if (selOld == null || selNew == null) {
    host.innerHTML = '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;">已选 ' + (selOld != null ? "旧 " : "") + (selNew != null ? "新 " : "") + "，请在历史中各选一条 旧/新 进行对比</div>";
    return;
  }
  const s = getSelectedSave();
  const oldEntry = (s?.history || []).find((h) => h.timestamp === selOld);
  const newEntry = (s?.history || []).find((h) => h.timestamp === selNew);
  if (!oldEntry || !newEntry) {
    host.innerHTML = '<div style="color:var(--ds-red);font-size:12px;">未找到对应记录</div>';
    return;
  }
  host.innerHTML = diffMessages(oldEntry.messages || [], newEntry.messages || []);
}
function computeOverview() {
  const s = getSelectedSave();
  if (!s) return { balanceText: "¥0.00 CNY", totalCost: 0, totalTokens: 0, hit: 0, miss: 0, output: 0, hitRate: 0, savings: 0, inputCost: 0, outputCost: 0, avgCost: 0, avgTokens: 0, avgDuration: 0, avgRate: 0, rounds: 0, remainingRounds: null, avgInputCost: 0, avgInputTokens: 0, avgOutputCost: 0, avgOutputTokens: 0, avgThinkTime: 0, avgThinkTokens: 0, avgHitRate: 0, latestHitRate: null, maxOutput: 0, maxInput: 0, maxTotal: 0 };
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0, output = s.output_tokens || 0;
  const hitRate = hit + miss > 0 ? hit / (hit + miss) * 100 : 0;
  let savings = 0;
  try {
    for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state$2.settings);
  } catch {
  }
  const rounds = s.rounds || 0;
  const hist = s.history || [];
  const avgCost = rounds ? totalCost / rounds : 0;
  const avgTokens = rounds ? totalTokens / rounds : 0;
  const avgDuration = hist.length ? hist.reduce((a, h) => a + (h.duration || 0), 0) / hist.length / 1e3 : 0;
  const avgRate = hist.length ? hist.reduce((a, h) => a + (h.tokenRate || 0), 0) / hist.length : 0;
  const inputTokens = s.input_tokens || 0;
  const avgInputCost = rounds ? (s.input_cost || 0) / rounds : 0;
  const avgInputTokens = rounds ? inputTokens / rounds : 0;
  const avgOutputCost = rounds ? (s.output_cost || 0) / rounds : 0;
  const avgOutputTokens = rounds ? output / rounds : 0;
  const thinkTimes = hist.map((h) => h.thinkTime || 0).filter((v) => v > 0);
  const thinkTokensArr = hist.map((h) => h.thinkTokens || 0).filter((v) => v > 0);
  const avgThinkTime = thinkTimes.length ? thinkTimes.reduce((a, b) => a + b, 0) / thinkTimes.length / 1e3 : 0;
  const avgThinkTokens = thinkTokensArr.length ? thinkTokensArr.reduce((a, b) => a + b, 0) / thinkTokensArr.length : 0;
  const hitRates = hist.map((h) => {
    const ch = h.cache_hit_tokens || 0, cm = h.cache_miss_tokens || 0, tot = ch + cm;
    return tot > 0 ? ch / tot * 100 : 0;
  }).filter((v) => v > 0);
  const avgHitRate = hitRates.length ? hitRates.reduce((a, b) => a + b, 0) / hitRates.length : 0;
  let latestHitRate = null;
  if (hist.length) {
    const latest = [...hist].sort((a, b) => b.timestamp - a.timestamp)[0];
    const ch = latest.cache_hit_tokens || 0, cm = latest.cache_miss_tokens || 0, tot = ch + cm;
    latestHitRate = tot > 0 ? ch / tot * 100 : 0;
  }
  let maxOutput = 0, maxInput = 0, maxTotal = 0;
  for (const h of hist) {
    const out = h.completion_tokens || 0;
    const inp = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) || h.prompt_tokens || 0;
    const tot = h.total_tokens || 0;
    if (out > maxOutput) maxOutput = out;
    if (inp > maxInput) maxInput = inp;
    if (tot > maxTotal) maxTotal = tot;
  }
  const bal = state$2.customBalance || state$2.balance?.balance;
  let remainingRounds = null;
  try {
    const balNum = bal != null && bal !== "" ? parseFloat(String(bal)) : NaN;
    if (!isNaN(balNum) && s.history?.length) {
      const dsHist = (s.history || []).filter((h) => typeof h.model === "string" && h.model.toLowerCase().indexOf("deepseek") === 0);
      if (dsHist.length) {
        const alpha = 0.3;
        let ewma = dsHist[dsHist.length - 1].cost || 0;
        for (let i = dsHist.length - 2; i >= 0; i--) ewma = alpha * (dsHist[i].cost || 0) + (1 - alpha) * ewma;
        if (ewma > 0) remainingRounds = Math.floor(balNum / ewma);
      }
    }
  } catch {
  }
  return {
    balanceText: bal ? "¥" + bal + " CNY" : "¥0.00 CNY",
    totalCost,
    totalTokens,
    hit,
    miss,
    output,
    hitRate,
    savings,
    inputCost: s.input_cost || 0,
    outputCost: s.output_cost || 0,
    avgCost,
    avgTokens,
    avgDuration,
    avgRate,
    rounds,
    remainingRounds,
    avgInputCost,
    avgInputTokens,
    avgOutputCost,
    avgOutputTokens,
    avgThinkTime,
    avgThinkTokens,
    avgHitRate,
    latestHitRate,
    maxOutput,
    maxInput,
    maxTotal
  };
}
function getDoc$5() {
  return window.parent?.document ?? document;
}
function themeIsDark() {
  try {
    const doc = getDoc$5();
    const p = doc.getElementById("aus-panel");
    return p?.getAttribute("data-ds-theme") === "dark";
  } catch {
    return false;
  }
}
function renderHeatmap(filtered) {
  const doc = getDoc$5();
  const container = doc.getElementById("aus-heatmap-container-overview") || doc.getElementById("aus-heatmap-container");
  const legendEl = doc.getElementById("aus-heatmap-legend-overview") || doc.getElementById("aus-heatmap-legend");
  const labelsEl = doc.getElementById("aus-heatmap-labels-overview") || doc.getElementById("aus-heatmap-labels");
  const scrollEl = doc.getElementById("aus-heatmap-scroll-overview") || doc.getElementById("aus-heatmap-scroll");
  if (!container) return;
  if (!filtered || filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ds-text-3);font-size:12px">暂无数据</div>';
    if (legendEl) legendEl.innerHTML = "";
    if (labelsEl) labelsEl.innerHTML = "";
    return;
  }
  const dayMap = {};
  for (const h of filtered) {
    const k = localDay$1(h.timestamp);
    dayMap[k] = (dayMap[k] || 0) + (h.total_tokens || 0);
  }
  const keys = Object.keys(dayMap).sort();
  const isDark = themeIsDark();
  const now = /* @__PURE__ */ new Date();
  const endStr = localDay$1(now.getTime());
  const endDate = /* @__PURE__ */ new Date(endStr + "T00:00:00Z");
  let startDate = new Date(endDate);
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 2);
  if (keys.length > 0) {
    const earliest = /* @__PURE__ */ new Date(keys[0] + "T00:00:00Z");
    if (earliest < startDate) startDate = earliest;
  }
  const sd = startDate.getUTCDay();
  startDate.setUTCDate(startDate.getUTCDate() + (sd === 0 ? -6 : 1 - sd));
  const ed = endDate.getUTCDay();
  endDate.setUTCDate(endDate.getUTCDate() + (ed === 0 ? 0 : 7 - ed));
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 864e5);
  const totalWeeks = Math.ceil(totalDays / 7);
  const vals = [];
  for (const k in dayMap) if (dayMap[k] > 0) vals.push(dayMap[k]);
  vals.sort((a, b) => a - b);
  const pct = (arr, p) => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil(arr.length * p / 100) - 1;
    return arr[Math.max(0, Math.min(idx, arr.length - 1))];
  };
  let p25 = pct(vals, 25), p50 = pct(vals, 50), p75 = pct(vals, 75);
  if (p25 === 0 && p50 === 0 && p75 === 0) {
    p25 = 1;
    p50 = 1e3;
    p75 = 1e4;
  } else if (p25 === p50 && p50 === p75) {
    p25 = Math.max(1, Math.floor(p50 / 2));
    p75 = p50 * 2;
  }
  const getLevel = (t) => {
    if (t <= 0) return 0;
    if (t <= p25) return 1;
    if (t <= p50) return 2;
    if (t <= p75) return 3;
    return 4;
  };
  const colorsDark = ["#161b22", "#0d3b20", "#1a7f37", "#3fb950", "#aceebb"];
  const colorsLight = ["#EBEDF0", "#9BE9A8", "#40C463", "#30A14E", "#216E39"];
  const clr = isDark ? colorsDark : colorsLight;
  const borderClr = isDark ? "#1f2937" : "#E5E7EB";
  const mn = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const dl = ["周一", "", "周三", "", "周五", "", "周日"];
  const cs = 12;
  if (labelsEl) {
    let lhtml = '<div style="display:flex;flex-direction:column">';
    lhtml += '<div style="height:16px;width:28px;"></div>';
    for (let d = 0; d < 7; d++) {
      const lh = cs + 2;
      lhtml += '<div style="height:' + lh + "px;width:28px;padding:0 4px 0 0;line-height:" + lh + 'px;font-size:9px;color:var(--ds-text-3);text-align:right;box-sizing:border-box">' + (d % 2 === 0 ? dl[d] : "") + "</div>";
    }
    lhtml += "</div>";
    labelsEl.innerHTML = lhtml;
  }
  let html = '<table style="border-collapse:collapse;font-size:10px;color:var(--ds-text-3)"><tr><td style="height:16px;padding:0;line-height:16px"></td>';
  let lastM = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const ws = new Date(startDate);
    ws.setUTCDate(startDate.getUTCDate() + w * 7);
    const mk = ws.getUTCFullYear() * 12 + ws.getUTCMonth();
    if (mk !== lastM) {
      let span = 1;
      for (let w2 = w + 1; w2 < totalWeeks; w2++) {
        const ws2 = new Date(startDate);
        ws2.setUTCDate(startDate.getUTCDate() + w2 * 7);
        if (ws2.getUTCFullYear() * 12 + ws2.getUTCMonth() === mk) span++;
        else break;
      }
      let label = mn[ws.getUTCMonth()];
      if (ws.getUTCMonth() === 0) label = ws.getUTCFullYear() + "年";
      html += '<td colspan="' + span + '" style="padding:0 0 0 2px;line-height:16px;height:16px;font-size:10px;color:var(--ds-text-3);white-space:nowrap">' + label + "</td>";
      lastM = mk;
    }
  }
  html += "</tr>";
  for (let d = 0; d < 7; d++) {
    html += "<tr>";
    for (let w = 0; w < totalWeeks; w++) {
      const cd = new Date(startDate);
      cd.setUTCDate(startDate.getUTCDate() + w * 7 + d);
      const key = cd.toISOString().slice(0, 10);
      const t = dayMap[key] || 0;
      const lv = getLevel(t);
      const tip = cd.getUTCFullYear() + "年" + (cd.getUTCMonth() + 1) + "月" + cd.getUTCDate() + "日" + (t > 0 ? " · " + t.toLocaleString() + " Token" : " · 无记录");
      html += '<td style="padding:1px;line-height:0;font-size:0"><div style="width:' + cs + "px;height:" + cs + "px;border-radius:2px;background:" + clr[lv] + ";border:1px solid " + borderClr + ';cursor:pointer;box-sizing:border-box;" title="' + tip + '"></div></td>';
    }
    html += "</tr>";
  }
  html += "</table>";
  container.innerHTML = html;
  if (legendEl) {
    let lhtml = "更少 ";
    for (let i = 0; i < 5; i++) {
      lhtml += '<span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:' + clr[i] + ";border:1px solid " + borderClr + ';vertical-align:middle;margin:0 0 0 3px"></span>';
    }
    lhtml += " 更多";
    legendEl.innerHTML = lhtml;
  }
  setTimeout(() => {
    if (scrollEl) scrollEl.scrollLeft = scrollEl.scrollWidth;
  }, 50);
}
function fmt(n) {
  return n.toLocaleString("zh-CN");
}
function CNY(n) {
  return "¥" + n.toFixed(4) + " CNY";
}
const FOUR_OPTIONS = [
  { key: "avg_cost", label: "每轮费用" },
  { key: "avg_tokens", label: "每轮 Token" },
  { key: "avg_duration", label: "平均耗时" },
  { key: "avg_rate", label: "输出速率" },
  { key: "avg_input_cost", label: "每轮平均输入费用" },
  { key: "avg_input_tokens", label: "每轮平均输入 Token" },
  { key: "avg_output_cost", label: "每轮平均输出费用" },
  { key: "avg_output_tokens", label: "每轮平均输出 Token" },
  { key: "avg_think_time", label: "思维链平均耗时" },
  { key: "avg_think_tokens", label: "思维链平均 Token" },
  { key: "avg_hit_rate", label: "平均缓存命中率" },
  { key: "latest_hit_rate", label: "最新命中率" },
  { key: "max_output", label: "单轮最大输出" },
  { key: "max_input", label: "单轮最大输入" },
  { key: "max_total", label: "单轮最大总 Token" }
];
const FOUR_LABEL_MAP = new Map(FOUR_OPTIONS.map((o) => [o.key, o.label]));
function ensureFour() {
  let cur = state$2.settings.overviewFour;
  const valid = new Set(FOUR_OPTIONS.map((o) => o.key));
  if (!Array.isArray(cur) || cur.length !== 4 || cur.some((k) => !valid.has(k))) {
    cur = ["avg_cost", "avg_tokens", "avg_duration", "avg_rate"];
    state$2.settings.overviewFour = cur;
    try {
      saveHot({ settings: state$2.settings });
    } catch {
    }
  }
  return cur;
}
function getFourDisplay(key, v) {
  const title = FOUR_LABEL_MAP.get(key) || key;
  const rounds = v.rounds || 0;
  !rounds && key !== "latest_hit_rate" && key !== "avg_hit_rate" && key !== "max_output" && key !== "max_input" && key !== "max_total" || !v.history && false;
  switch (key) {
    case "avg_cost":
      return { title, html: `¥${(v.avgCost || 0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case "avg_tokens":
      return { title, html: `${Math.round(v.avgTokens || 0).toLocaleString("zh-CN")}` };
    case "avg_duration":
      return { title, html: `${(v.avgDuration || 0).toFixed(1)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">s</span>` };
    case "avg_rate":
      return { title: "输出速率", html: `${Math.round(v.avgRate || 0)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">t/s</span>` };
    case "avg_input_cost":
      return { title, html: `¥${(v.avgInputCost || 0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case "avg_input_tokens":
      return { title, html: `${Math.round(v.avgInputTokens || 0).toLocaleString("zh-CN")}` };
    case "avg_output_cost":
      return { title, html: `¥${(v.avgOutputCost || 0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case "avg_output_tokens":
      return { title, html: `${Math.round(v.avgOutputTokens || 0).toLocaleString("zh-CN")}` };
    case "avg_think_time": {
      const has = (v.avgThinkTime || 0) > 0;
      return { title, html: has ? `${v.avgThinkTime.toFixed(1)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">s</span>` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case "avg_think_tokens": {
      const has = (v.avgThinkTokens || 0) > 0;
      return { title, html: has ? `${Math.round(v.avgThinkTokens).toLocaleString("zh-CN")}` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case "avg_hit_rate": {
      const has = (v.avgHitRate || 0) > 0;
      return { title, html: has ? `${v.avgHitRate.toFixed(1)}<span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">%</span>` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case "latest_hit_rate": {
      const val = v.latestHitRate;
      if (val == null) return { title, html: `<span style="color:var(--ds-text-3);">—</span>` };
      return { title, html: `${val.toFixed(1)}<span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">%</span>` };
    }
    case "max_output":
      return { title, html: `${(v.maxOutput || 0).toLocaleString("zh-CN")}` };
    case "max_input":
      return { title, html: `${(v.maxInput || 0).toLocaleString("zh-CN")}` };
    case "max_total":
      return { title, html: `${(v.maxTotal || 0).toLocaleString("zh-CN")}` };
    default:
      return { title, html: "—" };
  }
}
let fourBound = false;
function bindFour() {
  if (fourBound) return;
  fourBound = true;
  const doc = window.parent?.document ?? document;
  doc.addEventListener("click", (e) => {
    const t = e.target;
    for (let i = 0; i < 4; i++) {
      const drop = doc.getElementById(`aus-four-drop-${i}`);
      const btn = doc.getElementById(`aus-four-btn-${i}`);
      if (drop && btn && !t.closest(`#aus-four-drop-${i}`) && !t.closest(`#aus-four-btn-${i}`)) drop.style.display = "none";
    }
  });
}
function openFourDrop(idx, v) {
  const doc = window.parent?.document ?? document;
  const drop = doc.getElementById(`aus-four-drop-${idx}`);
  if (!drop) return;
  const curKeys = ensureFour();
  const cur = curKeys[idx];
  drop.innerHTML = FOUR_OPTIONS.map((o) => {
    const active = o.key === cur;
    return `<div data-four="${idx}" data-key="${o.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:11px;${active ? "background:var(--ds-card);font-weight:600;color:var(--ds-text);" : ""}">${o.label}</div>`;
  }).join("");
  drop.querySelectorAll("[data-four]").forEach((el) => {
    el.onclick = () => {
      const key = el.getAttribute("data-key");
      const at = Number(el.getAttribute("data-four"));
      const arr = ensureFour().slice();
      arr[at] = key;
      state$2.settings.overviewFour = arr;
      try {
        saveHot({ settings: state$2.settings });
      } catch {
      }
      drop.style.display = "none";
      renderOverview();
    };
  });
  drop.style.display = drop.style.display === "block" ? "none" : "block";
}
function renderOverview() {
  const doc = window.parent?.document ?? document;
  const v = computeOverview();
  const balEl = doc.getElementById("aus-balance");
  if (balEl) balEl.textContent = v.balanceText;
  const remEl = doc.getElementById("aus-balance-remaining");
  if (remEl) {
    if (v.remainingRounds != null) remEl.textContent = "预计还可进行 " + v.remainingRounds.toLocaleString("zh-CN") + " 轮对话（仅 DeepSeek 官方）";
    else {
      const hasBal = !!(state$2.customBalance || state$2.balance?.balance);
      remEl.textContent = hasBal ? "暂无 DeepSeek 对话数据，无法预测" : "查询余额后可预测剩余轮次";
    }
  }
  const costEl = doc.getElementById("aus-total-cost");
  if (costEl) costEl.textContent = "¥" + v.totalCost.toFixed(4) + " CNY";
  const tokEl = doc.getElementById("aus-total-tokens");
  if (tokEl) tokEl.textContent = fmt(v.totalTokens) + " tokens";
  const histHost = doc.getElementById("aus-overview-history");
  if (histHost) {
    histHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">Token 历史消耗</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（命中缓存）</span><span style="font-weight:600;color:var(--ds-green);">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（未命中缓存）</span><span style="font-weight:600;color:var(--ds-red);">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输出</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.output)} tokens</span></div>
      </div>
    `;
  }
  const spendHost = doc.getElementById("aus-overview-spend");
  if (spendHost) {
    spendHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">预计节省</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-green);">${CNY(v.savings)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">支出在输入</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-text);">${CNY(v.inputCost)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit + v.miss)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">支出在输出</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-text);">${CNY(v.outputCost)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.output)} tokens</div></span></div>
      </div>
    `;
  }
  const fourHost = doc.getElementById("aus-overview-four");
  if (fourHost) {
    const keys = ensureFour();
    bindFour();
    fourHost.innerHTML = keys.map((k, i) => {
      const d = getFourDisplay(k, v);
      const isRate = k === "avg_rate";
      const valColor = isRate ? "var(--ds-green)" : "var(--ds-text)";
      return `<div class="ds-card" style="padding:14px;position:relative;overflow:visible;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div style="font-size:11px;color:var(--ds-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title}</div>
          <button id="aus-four-btn-${i}" title="切换指标" style="flex-shrink:0;padding:4px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:10px;cursor:pointer;line-height:1;">▼</button>
          <div id="aus-four-drop-${i}" style="display:none;position:absolute;top:38px;right:8px;z-index:6;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:180px;max-height:260px;overflow:auto;"></div>
        </div>
        <div style="font-size:18px;font-weight:600;color:${valColor};margin-top:6px;word-break:break-all;">${d.html}</div>
      </div>`;
    }).join("");
    keys.forEach((_, i) => {
      const btn = doc.getElementById(`aus-four-btn-${i}`);
      if (btn) btn.onclick = () => openFourDrop(i);
    });
  }
  try {
    const hist = state$2.history || [];
    renderHeatmap(hist);
  } catch {
  }
}
const Y_OPTIONS = [
  { key: "input_hit_token", label: "输入(命中) token", unit: "tokens", kind: "token", color: "#0BA25E" },
  { key: "input_miss_token", label: "输入(未命中) token", unit: "tokens", kind: "token", color: "#F87171" },
  { key: "output_token", label: "输出 token", unit: "tokens", kind: "token", color: "#6366F1" },
  { key: "total_token", label: "总 Token", unit: "tokens", kind: "token", color: "#111827" },
  { key: "input_hit_cost", label: "输入(命中)费用", unit: "CNY", kind: "cost", color: "#10B981" },
  { key: "input_miss_cost", label: "输入(未命中)费用", unit: "CNY", kind: "cost", color: "#F59E0B" },
  { key: "output_cost", label: "输出费用", unit: "CNY", kind: "cost", color: "#8B5CF6" },
  { key: "total_cost", label: "总费用", unit: "CNY", kind: "cost", color: "#FF6A00" }
];
const X_OPTIONS = [
  { key: "round", label: "轮次" },
  { key: "hour", label: "每小时" },
  { key: "day", label: "每日" },
  { key: "week", label: "每周" },
  { key: "month", label: "每月" }
];
let ySelected = /* @__PURE__ */ new Set(["total_cost"]);
let xSelected = "day";
function getYSelected() {
  return Array.from(ySelected);
}
function getXSelected() {
  return xSelected;
}
function setXSelected(k) {
  xSelected = k;
}
function toggleY(key) {
  if (ySelected.has(key)) {
    if (ySelected.size > 1) ySelected.delete(key);
  } else ySelected.add(key);
}
function toHourKey(ts) {
  const d = new Date(ts + 8 * 3600 * 1e3);
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, "0"), day = String(d.getUTCDate()).padStart(2, "0"), h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:00`;
}
function toWeekKey(ts) {
  const d = new Date(ts);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function toMonthKey(ts) {
  const d = new Date(ts + 8 * 3600 * 1e3);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function getBucketKey(e, x, idx) {
  if (x === "round") return `#${idx + 1}`;
  if (x === "hour") return toHourKey(e.timestamp);
  if (x === "day") return localDay$1(e.timestamp);
  if (x === "week") return toWeekKey(e.timestamp);
  if (x === "month") return toMonthKey(e.timestamp);
  return localDay$1(e.timestamp);
}
function getYValue$1(e, y) {
  switch (y) {
    case "input_hit_token":
      return e.cache_hit_tokens || 0;
    case "input_miss_token":
      return e.cache_miss_tokens || 0;
    case "output_token":
      return e.completion_tokens || 0;
    case "total_token":
      return e.total_tokens || 0;
    case "input_hit_cost": {
      const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
      const ic = e.input_cost || 0;
      return tot ? ic * (hit / tot) : 0;
    }
    case "input_miss_cost": {
      const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
      const ic = e.input_cost || 0;
      return tot ? ic * (miss / tot) : 0;
    }
    case "output_cost":
      return e.output_cost || 0;
    case "total_cost":
      return e.cost || 0;
  }
  return 0;
}
function aggregateForChart(entries, yKeys, xKey) {
  const yMeta = new Map(Y_OPTIONS.map((o) => [o.key, o]));
  if (!yKeys.length) yKeys = ["total_cost"];
  if (xKey === "round") {
    const labels2 = entries.map((_, i) => `#${i + 1}`);
    const series2 = yKeys.map((k) => {
      const meta = yMeta.get(k);
      return { name: meta.label, data: entries.map((e) => Number(getYValue$1(e, k).toFixed(String(k).includes("cost") ? 6 : 0))), kind: meta.kind, color: meta.color };
    });
    return { labels: labels2, series: series2 };
  }
  const buckets = /* @__PURE__ */ new Map();
  entries.forEach((e) => {
    const key = getBucketKey(e, xKey, 0);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e);
  });
  const sortedKeys = Array.from(buckets.keys()).sort();
  const labels = sortedKeys.map((k) => {
    if (xKey === "hour") return k.slice(5);
    if (xKey === "day") return k.slice(5).replace("-", "/");
    if (xKey === "week") return k;
    if (xKey === "month") return k;
    return k;
  });
  const series = yKeys.map((k) => {
    const meta = yMeta.get(k);
    const data = sortedKeys.map((bucket) => {
      const arr = buckets.get(bucket);
      let sum = 0;
      for (const e of arr) sum += getYValue$1(e, k);
      return Number(sum.toFixed(String(k).includes("cost") ? 4 : 0));
    });
    return { name: meta.label, data, kind: meta.kind, color: meta.color };
  });
  return { labels, series };
}
const CHART_DEFS = {
  token: { title: "Token 趋势", yOpts: Y_OPTIONS.filter((o) => o.kind === "token"), hasX: true },
  cost: { title: "费用 趋势", yOpts: Y_OPTIONS.filter((o) => o.kind === "cost"), hasX: true },
  hit: { title: "缓存命中 趋势", yOpts: [{ key: "hit_rate", label: "命中率", unit: "%", kind: "cost", color: "#0BA25E" }], hasX: true },
  req: { title: "API请求数 趋势", yOpts: [{ key: "req_count", label: "请求数", unit: "次", kind: "token", color: "#6366F1" }], hasX: true },
  dur: { title: "耗时与速率 趋势", yOpts: [{ key: "duration", label: "耗时", unit: "s", kind: "token", color: "#2563EB" }, { key: "rate", label: "速率", unit: "t/s", kind: "cost", color: "#10B981" }], hasX: true },
  pie: { title: "模型用量占比", yOpts: [], hasX: false }
};
const state$1 = {
  token: { y: /* @__PURE__ */ new Set(["input_hit_token", "input_miss_token", "output_token"]), x: "round", pieMode: "token" },
  cost: { y: /* @__PURE__ */ new Set(["total_cost"]), x: "round", pieMode: "token" },
  hit: { y: /* @__PURE__ */ new Set(["hit_rate"]), x: "round", pieMode: "token" },
  req: { y: /* @__PURE__ */ new Set(["req_count"]), x: "day", pieMode: "token" },
  dur: { y: /* @__PURE__ */ new Set(["duration", "rate"]), x: "round", pieMode: "token" },
  pie: { y: /* @__PURE__ */ new Set([]), x: "day", pieMode: "token" }
};
function getDoc$4() {
  return window.parent?.document ?? document;
}
function themeColor$2(name, fallback) {
  try {
    const doc = getDoc$4();
    const el = doc.getElementById("aus-panel") || doc.documentElement;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}
function bucketKey$1(ts, x, idx) {
  if (x === "round") return `#${idx + 1}`;
  if (x === "hour") {
    const d = new Date(ts + 8 * 3600 * 1e3);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  if (x === "day") return localDay$1(ts);
  if (x === "week") {
    const d = new Date(ts);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  if (x === "month") {
    const d = new Date(ts + 8 * 3600 * 1e3);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return localDay$1(ts);
}
function getYValue(e, key) {
  switch (key) {
    case "input_hit_token":
      return e.cache_hit_tokens || 0;
    case "input_miss_token":
      return e.cache_miss_tokens || 0;
    case "output_token":
      return e.completion_tokens || 0;
    case "total_token":
      return e.total_tokens || 0;
    case "input_hit_cost": {
      const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
      return tot ? (e.input_cost || 0) * (hit / tot) : 0;
    }
    case "input_miss_cost": {
      const hit = e.cache_hit_tokens || 0, miss = e.cache_miss_tokens || 0, tot = hit + miss;
      return tot ? (e.input_cost || 0) * (miss / tot) : 0;
    }
    case "output_cost":
      return e.output_cost || 0;
    case "total_cost":
      return e.cost || 0;
    case "hit_rate": {
      const h = e.cache_hit_tokens || 0, m = e.cache_miss_tokens || 0, tot = h + m;
      return tot ? h / tot * 100 : 0;
    }
    case "req_count":
      return 1;
    case "duration":
      return (e.duration || 0) / 1e3;
    case "rate":
      return e.tokenRate || 0;
  }
  return 0;
}
async function getEcharts$1() {
  const ec = await import("./core-CNISqr4u.js");
  const { BarChart, LineChart, PieChart } = await import("./charts-vsOc2fZ2.js");
  const { GridComponent, TooltipComponent, LegendComponent } = await import("./components-CKoHC6Fi.js");
  const { CanvasRenderer } = await import("./renderers-ua0LGD8C.js");
  ec.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
  return ec;
}
const charts$1 = {};
let lastFiltered$1 = [];
function renderExtraCharts(filtered) {
  lastFiltered$1 = filtered || [];
  for (const id of Object.keys(CHART_DEFS)) {
    renderOne$1(id, filtered);
  }
}
async function renderOne$1(id, filtered) {
  try {
    const doc = getDoc$4();
    const el = doc.getElementById(`aus-chart-${id}`);
    if (!el) return;
    if (id === "pie") {
      const mode = state$1.pie.pieMode;
      if (!filtered.length) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ds-text-3);">暂无数据</div>';
        return;
      }
      const map2 = {};
      for (const e of filtered) {
        const m = e.model || "unknown";
        const v = mode === "token" ? e.total_tokens || 0 : 1;
        map2[m] = (map2[m] || 0) + v;
      }
      const data = Object.entries(map2).map(([name, value]) => ({ name, value }));
      const ec = await getEcharts$1();
      if (charts$1[id]) try {
        charts$1[id].dispose();
      } catch {
      }
      el.innerHTML = "";
      el.style.height = "260px";
      const c = charts$1[id] = ec.init(el);
      c.setOption({
        backgroundColor: "transparent",
        tooltip: { trigger: "item", backgroundColor: themeColor$2("--ds-card-inner", "#FFFFFF"), borderColor: themeColor$2("--ds-border", "#E5E7EB"), textStyle: { fontSize: 11, color: themeColor$2("--ds-text", "#111827") } },
        legend: { bottom: 0, textStyle: { fontSize: 10, color: themeColor$2("--ds-text-2", "#6B7280") } },
        series: [{ type: "pie", radius: ["40%", "70%"], itemStyle: { borderRadius: 6, borderColor: themeColor$2("--ds-card-inner", "#FFFFFF"), borderWidth: 2 }, label: { fontSize: 11 }, data }]
      });
      return;
    }
    const yKeys = Array.from(state$1[id].y);
    const xKey = state$1[id].x;
    if (!yKeys.length) {
      el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--ds-text-3);font-size:11px;">请选择 Y 轴</div>';
      return;
    }
    if (xKey === "round") {
      const labels2 = filtered.map((_, i) => `#${i + 1}`);
      const yMeta = new Map(CHART_DEFS[id].yOpts.map((o) => [o.key, o]));
      const series2 = yKeys.map((k) => {
        const meta = yMeta.get(k) || Y_OPTIONS.find((o) => o.key === k) || { label: k, color: "var(--ds-text-2)" };
        const data = filtered.map((e) => {
          const v = getYValue(e, k);
          return Number(v.toFixed(k.includes("cost") || k === "hit_rate" ? 2 : 0));
        });
        return { name: meta.label, data, color: meta.color, kind: meta.kind || "token" };
      });
      await drawBarLine(el, id, labels2, series2);
      return;
    }
    const buckets = /* @__PURE__ */ new Map();
    filtered.forEach((e) => {
      const key = bucketKey$1(e.timestamp, xKey, 0);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(e);
    });
    const sortedKeys = Array.from(buckets.keys()).sort();
    const labels = sortedKeys.map((k) => xKey === "day" ? k.slice(5).replace("-", "/") : xKey === "hour" ? k.slice(5) : k);
    const yOptsMap = new Map(CHART_DEFS[id].yOpts.map((o) => [o.key, o]));
    const fullMap = new Map([...Y_OPTIONS, ...CHART_DEFS[id].yOpts].map((o) => [o.key, o]));
    const series = yKeys.map((k) => {
      const meta = fullMap.get(k) || { label: k, color: "var(--ds-text-2)", kind: "token" };
      let data;
      if (k === "hit_rate") {
        data = sortedKeys.map((key) => {
          const arr = buckets.get(key);
          let hit = 0, tot = 0;
          for (const e of arr) {
            hit += e.cache_hit_tokens || 0;
            tot += (e.cache_hit_tokens || 0) + (e.cache_miss_tokens || 0);
          }
          return tot ? Number((hit / tot * 100).toFixed(1)) : 0;
        });
      } else if (k === "duration") {
        data = sortedKeys.map((key) => {
          const arr = buckets.get(key);
          const avg = arr.reduce((a, c) => a + (c.duration || 0), 0) / arr.length / 1e3;
          return Number(avg.toFixed(1));
        });
      } else if (k === "rate") {
        data = sortedKeys.map((key) => {
          const arr = buckets.get(key);
          const avg = arr.reduce((a, c) => a + (c.tokenRate || 0), 0) / arr.length;
          return Math.round(avg);
        });
      } else if (k === "req_count") {
        data = sortedKeys.map((key) => buckets.get(key).length);
      } else {
        data = sortedKeys.map((key) => {
          const arr = buckets.get(key);
          let sum = 0;
          for (const e of arr) sum += getYValue(e, k);
          return Number(sum.toFixed(k.includes("cost") ? 2 : 0));
        });
      }
      return { name: meta.label, data, color: meta.color, kind: meta.kind || "token" };
    });
    await drawBarLine(el, id, labels, series);
  } catch (e) {
    try {
      const doc2 = getDoc$4();
      const el2 = doc2.getElementById(`aus-chart-${id}`);
      if (el2) el2.innerHTML = '<div style="text-align:center;padding:20px;color:#DC2626;font-size:11px;">图表加载失败: ' + (e?.message || e) + "</div>";
    } catch {
    }
    try {
      console.error("[Api-Usage] renderOne failed", id, e);
    } catch {
    }
  }
}
function calcXInterval(labels, el) {
  const w = el.clientWidth || 320;
  const minPerLabel = w < 500 ? 42 : w < 760 ? 56 : 68;
  const maxLabels = Math.max(8, Math.floor(w / minPerLabel));
  if (labels.length <= maxLabels) return 0;
  return Math.ceil(labels.length / maxLabels) - 1;
}
async function drawBarLine(el, id, labels, series) {
  try {
    const ec = await getEcharts$1();
    if (charts$1[id]) try {
      charts$1[id].dispose();
    } catch {
    }
    el.innerHTML = "";
    el.style.height = "260px";
    const c = charts$1[id] = ec.init(el);
    const isTokenCost = id === "token" || id === "cost";
    const interval = calcXInterval(labels, el);
    const opts = {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", backgroundColor: themeColor$2("--ds-card-inner", "#FFFFFF"), borderColor: themeColor$2("--ds-border", "#E5E7EB"), textStyle: { fontSize: 11 } },
      grid: { left: 40, right: 20, top: 8, bottom: 24 },
      xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: themeColor$2("--ds-border", "#E5E7EB") } }, axisLabel: { fontSize: 10, color: themeColor$2("--ds-text-3", "#9CA3AF"), rotate: labels.length > 12 ? 30 : 0, interval, hideOverlap: false } },
      yAxis: { type: "value", axisLabel: { fontSize: 10, color: themeColor$2("--ds-text-3", "#9CA3AF") }, splitLine: { lineStyle: { color: themeColor$2("--ds-card", "#F6F7F8") } } },
      dataZoom: labels.length > 8 ? [{ type: "inside", xAxisIndex: 0, start: Math.max(0, (labels.length - Math.max(8, Math.min(labels.length, Math.floor((el.clientWidth || 320) / 44)))) / labels.length * 100), end: 100, zoomOnMouseWheel: false, moveOnMouseMove: true }] : void 0,
      series: (() => {
        const barIndices = series.map((s, i) => ({ s, i })).filter(({ s }) => !(isTokenCost && s.name.includes("总"))).map(({ i }) => i);
        const topIdx = barIndices.length ? barIndices[barIndices.length - 1] : -1;
        return series.map((s, idx) => {
          const isTotal = s.name.includes("总");
          if (isTokenCost && isTotal) return { name: s.name, type: "line", data: s.data, smooth: true, lineStyle: { color: s.color, width: 2 }, itemStyle: { color: s.color }, symbolSize: 2 };
          const isTop = idx === topIdx;
          return { name: s.name, type: "bar", stack: "total", data: s.data, itemStyle: { color: s.color, borderRadius: isTop ? [4, 4, 0, 0] : [0, 0, 0, 0] }, barMaxWidth: 16, barGap: "-100%" };
        });
      })()
    };
    if (id === "hit") {
      opts.series = [{ name: "命中率", type: "line", data: series[0].data, areaStyle: { opacity: 0.12, color: series[0].color }, lineStyle: { color: series[0].color }, itemStyle: { color: series[0].color }, smooth: true }];
      opts.yAxis = { max: 100, axisLabel: { formatter: (v) => v + "%" } };
    }
    if (id === "dur") {
      opts.yAxis = [
        { type: "value", name: "耗时 s", position: "left", axisLabel: { fontSize: 10, color: themeColor$2("--ds-text-3", "#9CA3AF") }, splitLine: { lineStyle: { color: themeColor$2("--ds-card", "#F6F7F8") } } },
        { type: "value", name: "速率 t/s", position: "right", axisLabel: { fontSize: 10, color: themeColor$2("--ds-text-3", "#9CA3AF") }, splitLine: { show: false } }
      ];
      opts.series = series.map((s) => ({
        name: s.name,
        type: "line",
        yAxisIndex: s.name.includes("速率") || s.name.toLowerCase().includes("rate") ? 1 : 0,
        data: s.data,
        smooth: true,
        symbolSize: 4,
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        areaStyle: s.name.includes("耗时") ? { opacity: 0.08, color: s.color } : void 0
      }));
    }
    c.setOption(opts);
  } catch (e) {
    try {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#DC2626;font-size:11px;">图表渲染失败</div>';
    } catch {
    }
    try {
      console.error("[Api-Usage] drawBarLine failed", id, e);
    } catch {
    }
  }
}
function initExtraCharts() {
  const doc = getDoc$4();
  for (const id of Object.keys(CHART_DEFS)) {
    if (!CHART_DEFS[id].hasX) continue;
    const yBtn = doc.getElementById(`aus-extra-y-${id}`);
    const yDrop = doc.getElementById(`aus-extra-y-drop-${id}`);
    const xBtn = doc.getElementById(`aus-extra-x-${id}`);
    const xDrop = doc.getElementById(`aus-extra-x-drop-${id}`);
    if (yBtn && yDrop) {
      yBtn.onclick = () => {
        yDrop.style.display = yDrop.style.display === "block" ? "none" : "block";
        if (yDrop.style.display === "block") renderExtraY(id);
      };
    }
    if (xBtn && xDrop) {
      xBtn.onclick = () => {
        xDrop.style.display = xDrop.style.display === "block" ? "none" : "block";
        if (xDrop.style.display === "block") renderExtraX(id);
      };
    }
  }
  const pieToggle = doc.getElementById("aus-pie-toggle");
  if (pieToggle) {
    pieToggle.onclick = () => {
      state$1.pie.pieMode = state$1.pie.pieMode === "token" ? "count" : "token";
      pieToggle.textContent = state$1.pie.pieMode === "token" ? "Token" : "次数";
      renderExtraCharts(lastFiltered$1);
    };
  }
  doc.addEventListener("click", (e) => {
    const t = e.target;
    for (const id of Object.keys(CHART_DEFS)) {
      if (!CHART_DEFS[id].hasX) continue;
      const yDrop = doc.getElementById(`aus-extra-y-drop-${id}`);
      const yBtn = doc.getElementById(`aus-extra-y-${id}`);
      const xDrop = doc.getElementById(`aus-extra-x-drop-${id}`);
      const xBtn = doc.getElementById(`aus-extra-x-${id}`);
      if (yDrop && yBtn && !t.closest(`#aus-extra-y-drop-${id}`) && !t.closest(`#aus-extra-y-${id}`)) yDrop.style.display = "none";
      if (xDrop && xBtn && !t.closest(`#aus-extra-x-drop-${id}`) && !t.closest(`#aus-extra-x-${id}`)) xDrop.style.display = "none";
    }
  });
}
function renderExtraY(id) {
  const doc = getDoc$4();
  const drop = doc.getElementById(`aus-extra-y-drop-${id}`);
  const label = doc.getElementById(`aus-extra-y-label-${id}`);
  if (!drop) return;
  const opts = CHART_DEFS[id].yOpts;
  const sel = state$1[id].y;
  if (label) label.textContent = sel.size ? `${sel.size} 项` : "选择";
  drop.innerHTML = opts.map((o) => {
    const checked = sel.has(o.key);
    return `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;${checked ? "background:var(--ds-active-bg);" : ""}"><input type="checkbox" data-y="${o.key}" data-chart="${id}" ${checked ? "checked" : ""} style="accent-color:var(--ds-text);" /><span style="width:8px;height:8px;background:${o.color};border-radius:2px;"></span>${o.label}</label>`;
  }).join("");
  drop.querySelectorAll("input[data-y]").forEach((el) => {
    el.onchange = () => {
      const k = el.getAttribute("data-y"), cid = el.getAttribute("data-chart");
      if (el.checked) state$1[cid].y.add(k);
      else {
        if (state$1[cid].y.size > 1) state$1[cid].y.delete(k);
        else el.checked = true;
      }
      renderExtraY(cid);
      renderExtraCharts(lastFiltered$1);
    };
  });
}
function renderExtraX(id) {
  const doc = getDoc$4();
  const drop = doc.getElementById(`aus-extra-x-drop-${id}`);
  const label = doc.getElementById(`aus-extra-x-label-${id}`);
  if (!drop) return;
  const cur = state$1[id].x;
  if (label) label.textContent = X_OPTIONS.find((o) => o.key === cur)?.label || cur;
  drop.innerHTML = X_OPTIONS.map((o) => {
    const active = o.key === cur;
    return `<div data-x="${o.key}" data-chart="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active ? "background:var(--ds-active-bg);font-weight:600;" : ""}">${o.label}</div>`;
  }).join("");
  drop.querySelectorAll("[data-x]").forEach((el) => {
    el.onclick = () => {
      const k = el.getAttribute("data-x"), cid = el.getAttribute("data-chart");
      state$1[cid].x = k;
      drop.style.display = "none";
      renderExtraX(cid);
      renderExtraCharts(lastFiltered$1);
    };
  });
}
const MODEL_COLORS = [
  "#0BA25E",
  "#6366F1",
  "#FF6A00",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EF4444",
  "#06B6D4",
  "#84CC16",
  "#E11D48",
  "#0EA5E9",
  "#F97316",
  "#14B8A6",
  "#A855F7",
  "#EAB308",
  "#22C55E"
];
const state = {
  token: { x: "day" },
  req: { x: "day" }
};
function getDoc$3() {
  return window.parent?.document ?? document;
}
function themeColor$1(name, fallback) {
  try {
    const doc = getDoc$3();
    const el = doc.getElementById("aus-panel") || doc.documentElement;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}
function bucketKey(ts, x, idx) {
  if (x === "round") return `#${idx + 1}`;
  if (x === "hour") {
    const d = new Date(ts + 8 * 3600 * 1e3);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  if (x === "day") return localDay$1(ts);
  if (x === "week") {
    const d = new Date(ts);
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((tmp - yearStart) / 864e5 + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }
  if (x === "month") {
    const d = new Date(ts + 8 * 3600 * 1e3);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return localDay$1(ts);
}
async function getEcharts() {
  const ec = await import("./core-CNISqr4u.js");
  const { LineChart } = await import("./charts-vsOc2fZ2.js");
  const { GridComponent, TooltipComponent, LegendComponent } = await import("./components-CKoHC6Fi.js");
  const { CanvasRenderer } = await import("./renderers-ua0LGD8C.js");
  ec.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
  return ec;
}
const charts = {};
let lastFiltered = [];
function renderModelTrends(filtered) {
  lastFiltered = filtered || [];
  renderOne("token", filtered);
  renderOne("req", filtered);
}
async function renderOne(id, filtered) {
  try {
    const doc = getDoc$3();
    const el = doc.getElementById(`aus-chart-model-${id}`);
    if (!el) return;
    const xKey = state[id].x;
    if (!filtered.length) {
      if (charts[id]) try {
        charts[id].dispose();
      } catch {
      }
      charts[id] = null;
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ds-text-3);font-size:11px;">暂无数据</div>';
      return;
    }
    const modelSet = /* @__PURE__ */ new Set();
    for (const e of filtered) modelSet.add(e.model || "unknown");
    const models = Array.from(modelSet).sort();
    const colorMap = /* @__PURE__ */ new Map();
    models.forEach((m, i) => colorMap.set(m, MODEL_COLORS[i % MODEL_COLORS.length]));
    let labels = [];
    let seriesData = [];
    if (xKey === "round") {
      labels = filtered.map((_, i) => `#${i + 1}`);
      seriesData = models.map((m) => {
        const col = colorMap.get(m);
        const data = filtered.map((e) => {
          if ((e.model || "unknown") !== m) return 0;
          return id === "token" ? e.total_tokens || 0 : 1;
        });
        return { name: m, data, color: col };
      });
    } else {
      const buckets = /* @__PURE__ */ new Map();
      filtered.forEach((_, idx) => {
        const e = filtered[idx];
        const key = bucketKey(e.timestamp, xKey, idx);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(e);
      });
      const sortedKeys = Array.from(buckets.keys()).sort();
      labels = sortedKeys.map((k) => xKey === "day" ? k.slice(5).replace("-", "/") : xKey === "hour" ? k.slice(5) : k);
      seriesData = models.map((m) => {
        const col = colorMap.get(m);
        const data = sortedKeys.map((key) => {
          const arr = buckets.get(key);
          let sum = 0;
          for (const e of arr) if ((e.model || "unknown") === m) sum += id === "token" ? e.total_tokens || 0 : 1;
          return sum;
        });
        return { name: m, data, color: col };
      });
    }
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) {
      const statsView = doc.querySelector('[data-view="stats"]');
      const isHidden = statsView ? statsView.style.display === "none" || statsView.offsetParent === null : false;
      if (isHidden) return;
      const tries = renderOne._retryCount || 0;
      if (tries >= 20) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ds-text-3);font-size:11px;">图表容器未就绪</div>';
        return;
      }
      renderOne._retryCount = tries + 1;
      setTimeout(() => renderOne(id, filtered), 120);
      return;
    }
    renderOne._retryCount = 0;
    const ec = await getEcharts();
    if (charts[id]) try {
      charts[id].dispose();
    } catch {
    }
    el.innerHTML = "";
    el.style.height = "220px";
    const c = charts[id] = ec.init(el);
    const cBorder = themeColor$1("--ds-border", "#E5E7EB");
    const cCard = themeColor$1("--ds-card", "#F6F7F8");
    const cText3 = themeColor$1("--ds-text-3", "#9CA3AF");
    const cCardInner = themeColor$1("--ds-card-inner", "#FFFFFF");
    const cText = themeColor$1("--ds-text", "#111827");
    const cw = w || 320;
    const minPerLabel = cw < 500 ? 42 : cw < 760 ? 56 : 68;
    const maxLabels = Math.max(8, Math.floor(cw / minPerLabel));
    const xInterval = labels.length <= maxLabels ? 0 : Math.ceil(labels.length / maxLabels) - 1;
    const needZoom = labels.length > maxLabels;
    const legendTop = models.length > 4 ? 2 : 0;
    c.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: cCardInner,
        borderColor: cBorder,
        borderWidth: 1,
        textStyle: { color: cText, fontSize: 11 },
        formatter: (params) => {
          if (!params?.length) return "";
          const idx = params[0].dataIndex;
          const label = labels[idx];
          let sum = 0;
          for (const p of params) sum += Number(p.value || 0);
          let html = `<div style="font-weight:600;margin-bottom:6px;">${label}<span style="margin-left:8px;color:var(--ds-text-2);font-weight:400;">合计 ${id === "token" ? sum.toLocaleString() + " tokens" : sum + " 次"}</span></div>`;
          for (const p of params) {
            if (Number(p.value) === 0) continue;
            html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${id === "token" ? Number(p.value).toLocaleString() + " tokens" : p.value + " 次"}</span></div>`;
          }
          if (!params.some((p) => Number(p.value) > 0)) html += `<div style="color:var(--ds-text-3);font-size:10px;">本${xKey === "day" ? "日" : xKey === "hour" ? "时段" : xKey === "week" ? "周" : xKey === "month" ? "月" : "轮次"}无数据</div>`;
          return `<div style="padding:4px 2px;min-width:180px;max-width:280px;">${html}</div>`;
        }
      },
      legend: {
        top: legendTop,
        type: "scroll",
        textStyle: { fontSize: 10, color: cText3 },
        pageIconColor: cText3,
        pageTextStyle: { color: cText3 },
        itemWidth: 10,
        itemHeight: 6
      },
      grid: { left: 42, right: 16, top: 22 + (models.length > 4 ? 8 : 0), bottom: 24 },
      dataZoom: needZoom ? [{ type: "inside", xAxisIndex: 0, start: Math.max(0, (labels.length - maxLabels) / labels.length * 100), end: 100, zoomOnMouseWheel: false, moveOnMouseMove: true }] : void 0,
      xAxis: { type: "category", data: labels, boundaryGap: false, axisLine: { lineStyle: { color: cBorder } }, axisLabel: { color: cText3, fontSize: 10, interval: xInterval, rotate: labels.length > 12 ? 30 : 0, hideOverlap: false } },
      yAxis: { type: "value", axisLabel: { color: cText3, fontSize: 10, formatter: (v) => id === "token" ? v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : String(v) : String(v) }, splitLine: { lineStyle: { color: cCard } } },
      series: seriesData.map((s) => ({
        name: s.name,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 1.5, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: { color: s.color, opacity: 0.18 },
        emphasis: { focus: "series" },
        data: s.data
      }))
    }, true);
    setTimeout(() => {
      try {
        c.resize();
      } catch {
      }
    }, 60);
  } catch (e) {
    try {
      const doc2 = getDoc$3();
      const el2 = doc2.getElementById(`aus-chart-model-${id}`);
      if (el2) el2.innerHTML = '<div style="text-align:center;padding:20px;color:#DC2626;font-size:11px;">图表加载失败</div>';
    } catch {
    }
    try {
      console.error("[Api-Usage] renderModelTrends failed", id, e);
    } catch {
    }
  }
}
function initModelTrends() {
  const doc = getDoc$3();
  for (const id of ["token", "req"]) {
    const btn = doc.getElementById(`aus-modeltrends-x-${id}`);
    const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
    if (btn && drop) {
      btn.onclick = () => {
        drop.style.display = drop.style.display === "block" ? "none" : "block";
        if (drop.style.display === "block") renderXDrop(id);
      };
    }
  }
  doc.addEventListener("click", (e) => {
    const t = e.target;
    for (const id of ["token", "req"]) {
      const btn = doc.getElementById(`aus-modeltrends-x-${id}`);
      const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
      if (btn && drop && !t.closest(`#aus-modeltrends-x-${id}`) && !t.closest(`#aus-modeltrends-x-drop-${id}`)) drop.style.display = "none";
    }
  });
}
function renderXDrop(id) {
  const doc = getDoc$3();
  const drop = doc.getElementById(`aus-modeltrends-x-drop-${id}`);
  const label = doc.getElementById(`aus-modeltrends-x-label-${id}`);
  if (!drop) return;
  const cur = state[id].x;
  if (label) label.textContent = X_OPTIONS.find((o) => o.key === cur)?.label || cur;
  drop.innerHTML = X_OPTIONS.map((o) => {
    const active = o.key === cur;
    return `<div data-x="${o.key}" data-trend="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active ? "background:var(--ds-card);font-weight:600;" : ""}">${o.label}</div>`;
  }).join("");
  drop.querySelectorAll("[data-x]").forEach((el) => {
    el.onclick = () => {
      const k = el.getAttribute("data-x"), tid = el.getAttribute("data-trend");
      state[tid].x = k;
      drop.style.display = "none";
      renderXDrop(tid);
      renderModelTrends(lastFiltered);
    };
  });
}
let currentRange = "30d";
let customStart = "";
let customEnd = "";
let pickerOpen = false;
let selectedModel = "__all__";
let modelPickerOpen = false;
let summarySortKey = null;
let summarySortDir = "desc";
let lastSummaryFiltered = null;
function updateSummarySortHeader() {
  const doc = getDoc$2();
  const ths = doc.querySelectorAll("#aus-model-summary thead th[data-sort-key]");
  ths.forEach((th) => {
    th.style.color = "";
    th.style.fontWeight = "";
    const ind = th.querySelector(".aus-sort-ind");
    if (ind) ind.textContent = "";
  });
  if (summarySortKey) {
    const cur = doc.querySelector(`#aus-model-summary thead th[data-sort-key="${summarySortKey}"]`);
    if (cur) {
      cur.style.color = "var(--ds-text)";
      cur.style.fontWeight = "600";
      const ind = cur.querySelector(".aus-sort-ind");
      if (ind) ind.textContent = summarySortDir === "asc" ? " ▲" : " ▼";
    }
  }
}
function bindSummarySort() {
  const doc = getDoc$2();
  const ths = doc.querySelectorAll("#aus-model-summary thead th[data-sort-key]");
  if (!ths.length) return;
  if (bindSummarySort._bound) return;
  bindSummarySort._bound = true;
  ths.forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort-key");
      if (!key) return;
      if (summarySortKey === key) {
        summarySortDir = summarySortDir === "asc" ? "desc" : "asc";
      } else {
        summarySortKey = key;
        summarySortDir = "desc";
      }
      updateSummarySortHeader();
      if (lastSummaryFiltered) renderModelSummary(lastSummaryFiltered);
    });
    th.addEventListener("mouseenter", () => {
      const k = th.getAttribute("data-sort-key");
      if (k !== summarySortKey) th.style.color = "var(--ds-text)";
    });
    th.addEventListener("mouseleave", () => {
      const k = th.getAttribute("data-sort-key");
      if (k !== summarySortKey) th.style.color = "";
    });
  });
}
function getDoc$2() {
  return window.parent?.document ?? document;
}
function themeColor(name, fallback) {
  try {
    const doc = getDoc$2();
    const el = doc.getElementById("aus-panel") || doc.documentElement;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}
function getRangeDates() {
  const today = localDay$1(Date.now());
  const d = /* @__PURE__ */ new Date(today + "T00:00:00Z");
  const fmt2 = (x) => x.toISOString().slice(0, 10);
  switch (currentRange) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = new Date(d);
      y.setUTCDate(y.getUTCDate() - 1);
      const s = fmt2(y);
      return { start: s, end: s };
    }
    case "7d": {
      const s = new Date(d);
      s.setUTCDate(s.getUTCDate() - 6);
      return { start: fmt2(s), end: today };
    }
    case "30d": {
      const s = new Date(d);
      s.setUTCDate(s.getUTCDate() - 29);
      return { start: fmt2(s), end: today };
    }
    case "month": {
      const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      return { start: fmt2(s), end: today };
    }
    case "lastMonth": {
      const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return { start: fmt2(s), end: fmt2(e) };
    }
    case "custom":
      return { start: customStart || today, end: customEnd || today };
    case "all":
      return { start: "2020-01-01", end: today };
  }
  return { start: today, end: today };
}
function filterByRange(entries) {
  const { start, end } = getRangeDates();
  return entries.filter((e) => {
    const k = localDay$1(e.timestamp);
    return k >= start && k <= end;
  });
}
function getRecordedModels() {
  const s = getSelectedSave();
  const set = /* @__PURE__ */ new Set();
  for (const h of s?.history || []) if (h?.model) set.add(h.model);
  return Array.from(set).sort();
}
function filterByModel(entries) {
  if (selectedModel === "__all__") return entries;
  return entries.filter((e) => e.model === selectedModel);
}
let calendarOffset = 0;
function updateRangeHighlight() {
  const doc = getDoc$2();
  doc.querySelectorAll("[data-range]").forEach((el) => {
    const r = el.getAttribute("data-range");
    if (r === currentRange) {
      el.style.background = "var(--ds-card)";
      el.style.fontWeight = "600";
    } else {
      el.style.background = "";
      el.style.fontWeight = "";
    }
  });
  const calWrap = doc.getElementById("aus-date-calendar");
  if (calWrap) calWrap.style.display = currentRange === "custom" ? "block" : "none";
}
function renderCalendar() {
  const doc = getDoc$2();
  const cal = doc.getElementById("aus-date-calendar");
  if (!cal) return;
  updateRangeHighlight();
  if (currentRange !== "custom") return;
  const todayStr = localDay$1(Date.now());
  const base = /* @__PURE__ */ new Date(todayStr + "T00:00:00Z");
  base.setUTCMonth(base.getUTCMonth() + calendarOffset);
  const months = [];
  months.push(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1)));
  months.push(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)));
  let html = '<div style="display:flex;gap:12px;align-items:flex-start;">';
  html += `<button id="aus-cal-prev" style="margin-top:32px;padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);cursor:pointer;">‹</button>`;
  html += '<div style="display:flex;gap:16px;">';
  for (const m of months) {
    const y = m.getUTCFullYear(), mo = m.getUTCMonth();
    const first = new Date(Date.UTC(y, mo, 1));
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const startDow = first.getUTCDay();
    html += `<div style="min-width:220px;"><div style="text-align:center;font-weight:600;font-size:13px;margin-bottom:8px;">${y}年${mo + 1}月</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:11px;">`;
    const week = ["日", "一", "二", "三", "四", "五", "六"];
    for (const w of week) html += `<div style="text-align:center;color:var(--ds-text-3);padding:4px;">${w}</div>`;
    for (let i = 0; i < startDow; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(y, mo, d));
      const key = date.toISOString().slice(0, 10);
      const { start, end } = getRangeDates();
      const inRange = key >= start && key <= end;
      const isToday = key === todayStr;
      const bg = inRange ? "var(--ds-text)" : "var(--ds-card-inner)";
      const color = inRange ? "var(--ds-card-inner)" : "var(--ds-text)";
      const ring = isToday && !inRange ? "border:1px solid var(--ds-text);" : "";
      html += `<div data-date="${key}" style="text-align:center;padding:6px;border-radius:999px;background:${bg};color:${color};cursor:pointer;${ring}">${d}</div>`;
    }
    html += `</div></div>`;
  }
  html += "</div>";
  html += `<button id="aus-cal-next" style="margin-top:32px;padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);cursor:pointer;">›</button>`;
  html += "</div>";
  cal.innerHTML = html;
  const prev = doc.getElementById("aus-cal-prev");
  const next = doc.getElementById("aus-cal-next");
  if (prev) prev.onclick = () => {
    calendarOffset--;
    renderCalendar();
  };
  if (next) next.onclick = () => {
    calendarOffset++;
    renderCalendar();
  };
  cal.querySelectorAll("[data-date]").forEach((el) => {
    el.addEventListener("click", () => {
      if (currentRange !== "custom") {
        currentRange = "custom";
        customStart = el.getAttribute("data-date");
        customEnd = el.getAttribute("data-date");
      } else {
        const clicked = el.getAttribute("data-date");
        if (!customStart) customStart = clicked;
        else if (clicked < customStart) {
          customEnd = customStart;
          customStart = clicked;
        } else customEnd = clicked;
      }
      updatePickerLabel();
      updateRangeHighlight();
      renderStatsView();
      renderCalendar();
    });
  });
}
function updatePickerLabel() {
  const doc = getDoc$2();
  const label = doc.getElementById("aus-range-label");
  if (!label) return;
  const map2 = { all: "全部", today: "今天", yesterday: "昨天", "7d": "近 7 天", "30d": "近 30 天", month: "本月", lastMonth: "上月", custom: "自定义" };
  if (currentRange === "custom" && customStart && customEnd) {
    label.textContent = customStart === customEnd ? customStart : `${customStart} ~ ${customEnd}`;
  } else label.textContent = map2[currentRange] || "近 30 天";
  updateRangeHighlight();
}
function renderModelPicker() {
  const doc = getDoc$2();
  const dropdown = doc.getElementById("aus-model-dropdown");
  const label = doc.getElementById("aus-model-label");
  if (!dropdown || !label) return;
  const models = getRecordedModels();
  label.textContent = selectedModel === "__all__" ? "全部" : selectedModel;
  let html = `<div data-model="__all__" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${selectedModel === "__all__" ? "background:var(--ds-card);font-weight:600;" : ""}">全部</div>`;
  for (const m of models) {
    const active = m === selectedModel ? "background:var(--ds-card);font-weight:600;" : "";
    html += `<div data-model="${esc$1(m)}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active}">${esc$1(m)}</div>`;
  }
  if (!models.length) html += '<div style="padding:8px 10px;color:var(--ds-text-3);font-size:12px;">暂无模型</div>';
  dropdown.innerHTML = html;
  dropdown.querySelectorAll("[data-model]").forEach((el) => {
    el.onclick = () => {
      selectedModel = el.getAttribute("data-model") || "__all__";
      modelPickerOpen = false;
      dropdown.style.display = "none";
      renderModelPicker();
      renderStatsView();
    };
  });
}
function bindPicker() {
  const doc = getDoc$2();
  const btn = doc.getElementById("aus-range-btn");
  const dropdown = doc.getElementById("aus-range-dropdown");
  if (btn && dropdown) {
    btn.onclick = () => {
      pickerOpen = !pickerOpen;
      dropdown.style.display = pickerOpen ? "flex" : "none";
      const md = doc.getElementById("aus-model-dropdown");
      if (md) {
        md.style.display = "none";
        modelPickerOpen = false;
      }
      if (pickerOpen) renderCalendar();
    };
    doc.querySelectorAll("[data-range]").forEach((el) => {
      el.onclick = () => {
        const r = el.getAttribute("data-range");
        currentRange = r;
        if (r !== "custom") {
          customStart = "";
          customEnd = "";
        }
        pickerOpen = false;
        dropdown.style.display = "none";
        updatePickerLabel();
        renderStatsView();
      };
    });
  }
  const mBtn = doc.getElementById("aus-model-btn");
  const mDropdown = doc.getElementById("aus-model-dropdown");
  if (mBtn && mDropdown) {
    mBtn.onclick = () => {
      modelPickerOpen = !modelPickerOpen;
      mDropdown.style.display = modelPickerOpen ? "block" : "none";
      const rDrop = doc.getElementById("aus-range-dropdown");
      if (rDrop) {
        rDrop.style.display = "none";
        pickerOpen = false;
      }
      if (modelPickerOpen) renderModelPicker();
    };
  }
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (pickerOpen && !t.closest("#aus-range-dropdown") && !t.closest("#aus-range-btn")) {
      pickerOpen = false;
      const d = doc.getElementById("aus-range-dropdown");
      if (d) d.style.display = "none";
    }
    if (modelPickerOpen && !t.closest("#aus-model-dropdown") && !t.closest("#aus-model-btn")) {
      modelPickerOpen = false;
      const d = doc.getElementById("aus-model-dropdown");
      if (d) d.style.display = "none";
    }
  });
}
let chartYOpen = false;
let chartXOpen = false;
function renderChartSelectors() {
  const doc = getDoc$2();
  const yBtn = doc.getElementById("aus-chart-y-btn");
  const xBtn = doc.getElementById("aus-chart-x-btn");
  const yDrop = doc.getElementById("aus-chart-y-dropdown");
  const xDrop = doc.getElementById("aus-chart-x-dropdown");
  const yLabel = doc.getElementById("aus-chart-y-label");
  const xLabel = doc.getElementById("aus-chart-x-label");
  if (!yBtn || !xBtn || !yDrop || !xDrop) return;
  const ySel = getYSelected();
  if (yLabel) yLabel.textContent = ySel.length ? `${ySel.length} 项` : "选择";
  let yHtml = "";
  for (const opt of Y_OPTIONS) {
    const checked = ySel.includes(opt.key);
    yHtml += `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;${checked ? "background:var(--ds-card);" : ""}"><input type="checkbox" data-ykey="${opt.key}" ${checked ? "checked" : ""} style="accent-color:var(--ds-text);" /><span style="display:inline-block;width:8px;height:8px;background:${opt.color};border-radius:2px;"></span>${opt.label}<span style="margin-left:auto;color:var(--ds-text-3);font-size:10px;">${opt.unit}</span></label>`;
  }
  yDrop.innerHTML = yHtml;
  yDrop.querySelectorAll("input[data-ykey]").forEach((el) => {
    el.onchange = () => {
      toggleY(el.getAttribute("data-ykey"));
      renderChartSelectors();
      const s = getSelectedSave();
      const filtered = filterByModel(filterByRange(s.history || []));
      renderChart(filtered);
    };
  });
  const xSel = getXSelected();
  const xMap = { round: "轮次", hour: "每小时", day: "每日", week: "每周", month: "每月" };
  if (xLabel) xLabel.textContent = xMap[xSel] || xSel;
  let xHtml = "";
  for (const opt of X_OPTIONS) {
    const active = opt.key === xSel;
    xHtml += `<div data-xkey="${opt.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active ? "background:var(--ds-card);font-weight:600;" : ""}">${opt.label}</div>`;
  }
  xDrop.innerHTML = xHtml;
  xDrop.querySelectorAll("[data-xkey]").forEach((el) => {
    el.onclick = () => {
      setXSelected(el.getAttribute("data-xkey"));
      chartXOpen = false;
      xDrop.style.display = "none";
      renderChartSelectors();
      const s = getSelectedSave();
      const filtered = filterByModel(filterByRange(s.history || []));
      renderChart(filtered);
    };
  });
}
function bindChartSelectors() {
  const doc = getDoc$2();
  const yBtn = doc.getElementById("aus-chart-y-btn");
  const yDrop = doc.getElementById("aus-chart-y-dropdown");
  const xBtn = doc.getElementById("aus-chart-x-btn");
  const xDrop = doc.getElementById("aus-chart-x-dropdown");
  if (yBtn && yDrop) {
    yBtn.onclick = () => {
      chartYOpen = !chartYOpen;
      yDrop.style.display = chartYOpen ? "block" : "none";
      if (chartYOpen) {
        const xD = doc.getElementById("aus-chart-x-dropdown");
        if (xD) {
          xD.style.display = "none";
          chartXOpen = false;
        }
        renderChartSelectors();
      }
    };
  }
  if (xBtn && xDrop) {
    xBtn.onclick = () => {
      chartXOpen = !chartXOpen;
      xDrop.style.display = chartXOpen ? "block" : "none";
      if (chartXOpen) {
        const yD = doc.getElementById("aus-chart-y-dropdown");
        if (yD) {
          yD.style.display = "none";
          chartYOpen = false;
        }
        renderChartSelectors();
      }
    };
  }
  doc.addEventListener("click", (e) => {
    const t = e.target;
    if (chartYOpen && !t.closest("#aus-chart-y-dropdown") && !t.closest("#aus-chart-y-btn")) {
      chartYOpen = false;
      const d = doc.getElementById("aus-chart-y-dropdown");
      if (d) d.style.display = "none";
    }
    if (chartXOpen && !t.closest("#aus-chart-x-dropdown") && !t.closest("#aus-chart-x-btn")) {
      chartXOpen = false;
      const d = doc.getElementById("aus-chart-x-dropdown");
      if (d) d.style.display = "none";
    }
  });
}
let chart = null;
async function renderChart(filteredRaw) {
  const doc = getDoc$2();
  const el = doc.getElementById("aus-stats-chart");
  if (!el) return;
  const yKeys = getYSelected();
  const xKey = getXSelected();
  const { labels, series } = aggregateForChart(filteredRaw, yKeys, xKey);
  if (!labels.length) {
    if (chart) {
      try {
        chart.dispose();
      } catch {
      }
      chart = null;
    }
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ds-text-3);font-size:12px;">该筛选无数据（历史 ' + filteredRaw.length + " 条）</div>";
    return;
  }
  const w = el.clientWidth, h = el.clientHeight;
  if (w === 0 || h === 0) {
    const statsView = doc.querySelector('[data-view="stats"]');
    const isHidden = statsView ? statsView.style.display === "none" || statsView.offsetParent === null : false;
    if (isHidden) {
      try {
        console.log("[AUS] renderChart 容器隐藏，等待切换");
      } catch {
      }
      return;
    }
    const tries = renderChart._retryCount || 0;
    if (tries >= 80) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ds-text-3);font-size:11px;">图表容器未就绪，请切换视图重试</div>';
      return;
    }
    renderChart._retryCount = tries + 1;
    setTimeout(() => renderChart(filteredRaw), 120);
    return;
  }
  renderChart._retryCount = 0;
  let echarts;
  try {
    echarts = await import("./core-CNISqr4u.js").then(async (ec) => {
      const { BarChart, LineChart } = await import("./charts-vsOc2fZ2.js");
      const { GridComponent, TooltipComponent } = await import("./components-CKoHC6Fi.js");
      const { CanvasRenderer } = await import("./renderers-ua0LGD8C.js");
      ec.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
      return ec;
    });
  } catch (e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#DC2626;font-size:12px;">图表加载失败，请检查网络后重试</div>';
    console.error("[Api-Usage] echarts load failed", e);
    return;
  }
  if (!chart) {
    chart = echarts.init(el);
  } else {
    try {
      chart.resize();
    } catch {
    }
  }
  const hasToken = series.some((s) => s.kind === "token");
  const hasCost = series.some((s) => s.kind === "cost");
  const cBorder = themeColor("--ds-border", "#E5E7EB");
  const cCard = themeColor("--ds-card", "#F6F7F8");
  const cText3 = themeColor("--ds-text-3", "#9CA3AF");
  const yAxis = [];
  if (hasToken) yAxis.push({ type: "value", name: "tokens", position: "left", axisLine: { show: false }, splitLine: { lineStyle: { color: cCard } }, axisLabel: { color: cText3, fontSize: 10 } });
  if (hasCost) yAxis.push({ type: "value", name: "CNY", position: hasToken ? "right" : "left", axisLine: { show: false }, splitLine: { show: false }, axisLabel: { color: cText3, fontSize: 10, formatter: (v) => "¥" + v } });
  const lastBarIdx = (() => {
    const indices = series.map((_, i) => i).filter((i) => series[i].kind !== "cost");
    const target = indices.length ? indices : series.map((_, i) => i);
    return target.length ? target[target.length - 1] : -1;
  })();
  const seriesOpt = series.map((s, idx) => {
    const isCost = s.kind === "cost";
    const yIndex = hasToken && hasCost ? isCost ? 1 : 0 : 0;
    const isTop = idx === lastBarIdx;
    let col = s.color;
    if (col === "#111827" || typeof col === "string" && col.indexOf("var(") === 0) col = themeColor("--ds-text", "#111827");
    return {
      name: s.name,
      type: "bar",
      yAxisIndex: yIndex,
      data: s.data,
      stack: "total",
      itemStyle: { color: col, borderRadius: isTop ? [4, 4, 0, 0] : [0, 0, 0, 0] },
      barMaxWidth: 18,
      barGap: "-100%",
      emphasis: { focus: "series" }
    };
  });
  const cCardInner = themeColor("--ds-card-inner", "#FFFFFF");
  const cText = themeColor("--ds-text", "#111827");
  const cw = w || 320;
  const minPerLabel = cw < 500 ? 42 : cw < 760 ? 56 : 68;
  const maxLabels = Math.max(8, Math.floor(cw / minPerLabel));
  const xInterval = labels.length <= maxLabels ? 0 : Math.ceil(labels.length / maxLabels) - 1;
  const needZoom = labels.length > maxLabels;
  chart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: cCardInner,
      borderColor: cBorder,
      borderWidth: 1,
      textStyle: { color: cText, fontSize: 11 },
      formatter: (params) => {
        if (!params?.length) return "";
        const idx = params[0].dataIndex;
        const label = labels[idx];
        let html = `<div style="font-weight:600;margin-bottom:6px;">${label}</div>`;
        for (const p of params) {
          const v = p.value;
          const unit = Y_OPTIONS.find((o) => o.label === p.seriesName)?.unit || "";
          html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${unit === "CNY" ? "¥" + Number(v).toFixed(4) : Number(v).toLocaleString() + " " + unit}</span></div>`;
        }
        return `<div style="padding:4px 2px;min-width:180px;">${html}</div>`;
      }
    },
    grid: { left: 50, right: hasToken && hasCost ? 50 : 20, top: 8, bottom: 28 },
    dataZoom: needZoom ? [{ type: "inside", xAxisIndex: 0, start: Math.max(0, (labels.length - maxLabels) / labels.length * 100), end: 100, zoomOnMouseWheel: false, moveOnMouseMove: true }] : void 0,
    xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: cBorder } }, axisLabel: { color: cText3, fontSize: 10, interval: xInterval, rotate: labels.length > 12 ? 30 : 0, hideOverlap: false } },
    yAxis: yAxis.length ? yAxis : { type: "value", axisLabel: { color: cText3, fontSize: 10 } },
    series: seriesOpt
  }, true);
  setTimeout(() => {
    try {
      chart.resize();
    } catch {
    }
  }, 60);
}
function renderModelSummary(filtered) {
  const doc = getDoc$2();
  const tbody = doc.getElementById("aus-summary-tbody");
  if (!tbody) return;
  lastSummaryFiltered = filtered;
  try {
    bindSummarySort();
  } catch {
  }
  try {
    updateSummarySortHeader();
  } catch {
  }
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr>';
    return;
  }
  const map2 = {};
  for (const h of filtered) {
    const m = h.model || "unknown";
    if (!map2[m]) map2[m] = { count: 0, hit: 0, miss: 0, out: 0, total: 0, cost: 0, dur: 0, rate: 0, rateCnt: 0 };
    const e = map2[m];
    e.count++;
    e.hit += h.cache_hit_tokens || 0;
    e.miss += h.cache_miss_tokens || 0;
    e.out += h.completion_tokens || 0;
    e.total += h.total_tokens || 0;
    e.cost += h.cost || 0;
    if (h.duration) {
      e.dur += h.duration;
    }
    if (h.tokenRate) {
      e.rate += h.tokenRate;
      e.rateCnt++;
    }
  }
  let list = Object.keys(map2).map((m) => {
    const e = map2[m];
    const avgCost = e.count ? e.cost / e.count : 0;
    const avgDurVal = e.count && e.dur ? e.dur / e.count : -1;
    const avgDurStr = e.count && e.dur ? (e.dur / e.count / 1e3).toFixed(1) + "s" : "—";
    const avgRateVal = e.rateCnt ? e.rate / e.rateCnt : -1;
    const avgRateStr = e.rateCnt ? Math.round(e.rate / e.rateCnt) + " t/s" : "—";
    return { m, count: e.count, hit: e.hit, miss: e.miss, out: e.out, total: e.total, cost: e.cost, avgCost, avgDurVal, avgRateVal, avgDurStr, avgRateStr };
  });
  if (summarySortKey) {
    const dir = summarySortDir === "asc" ? 1 : -1;
    const getVal = (r) => {
      switch (summarySortKey) {
        case "count":
          return r.count;
        case "hit":
          return r.hit;
        case "miss":
          return r.miss;
        case "out":
          return r.out;
        case "total":
          return r.total;
        case "cost":
          return r.cost;
        case "avgCost":
          return r.avgCost;
        case "avgDur":
          return r.avgDurVal;
        case "avgRate":
          return r.avgRateVal;
        default:
          return 0;
      }
    };
    list.sort((a, b) => {
      const av = getVal(a), bv = getVal(b);
      if (av === bv) return a.m.localeCompare(b.m);
      return (av - bv) * dir;
    });
  } else {
    list.sort((a, b) => a.m.localeCompare(b.m));
  }
  const rows = list.map((r) => {
    return `<tr style="border-bottom:1px solid var(--ds-card);"><td style="padding:6px 8px;text-align:left;color:var(--ds-text);font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${esc$1(r.m)}</td><td style="padding:6px 8px;text-align:right;">${r.count}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${r.hit.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#DC2626;">${r.miss.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#6366F1;">${r.out.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;font-weight:600;">${r.total.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:var(--ds-text);">¥${r.cost.toFixed(4)}</td><td style="padding:6px 8px;text-align:right;">¥${r.avgCost.toFixed(4)}</td><td style="padding:6px 8px;text-align:right;color:var(--ds-text-2);">${r.avgDurStr}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${r.avgRateStr}</td></tr>`;
  }).join("");
  tbody.innerHTML = rows;
}
let cachedAllHistory = null;
let allHistoryLoading = false;
async function getHistoryForStats() {
  const s = getSelectedSave();
  const hot = s?.history || [];
  if (hot.length >= 400 || cachedAllHistory) {
    if (cachedAllHistory) return cachedAllHistory;
    if (allHistoryLoading) return hot;
    allHistoryLoading = true;
    try {
      const mod = await Promise.resolve().then(() => persistence);
      if (mod.getAllHistory) {
        const all = await mod.getAllHistory();
        if (all && all.length > hot.length) {
          cachedAllHistory = all;
          return all;
        }
      }
    } catch {
    } finally {
      allHistoryLoading = false;
    }
  }
  return hot;
}
async function renderStatsView() {
  const doc = getDoc$2();
  const s = getSelectedSave();
  if (!s) return;
  const allHistory = await getHistoryForStats();
  const timeFiltered = filterByRange(allHistory);
  const summaryFiltered = filterByModel(timeFiltered);
  const chartFiltered = filterByModel(timeFiltered);
  let totalCost = 0, totalReq = summaryFiltered.length, totalTok = 0;
  for (const e of summaryFiltered) {
    totalCost += e.cost || 0;
    totalTok += e.total_tokens || 0;
  }
  const costEl = doc.getElementById("aus-stats-cost");
  if (costEl) costEl.textContent = "¥" + totalCost.toFixed(2) + " CNY";
  const reqEl = doc.getElementById("aus-stats-req");
  if (reqEl) reqEl.textContent = String(totalReq);
  const tokEl = doc.getElementById("aus-stats-tok");
  if (tokEl) tokEl.textContent = totalTok.toLocaleString("zh-CN");
  renderModelSummary(summaryFiltered);
  renderModelPicker();
  renderChartSelectors();
  const statsViewEl = doc.querySelector('[data-view="stats"]');
  const isStatsHidden = statsViewEl ? statsViewEl.style.display === "none" || statsViewEl.offsetParent === null : false;
  if (!isStatsHidden) {
    renderChart(chartFiltered);
    renderExtraCharts(chartFiltered);
    renderModelTrends(chartFiltered);
  } else {
    try {
      console.log("[AUS] stats 隐藏，跳过图表初始化");
    } catch {
    }
  }
  if (cachedAllHistory && cachedAllHistory.length !== (s.history || []).length) ;
  else if (!cachedAllHistory && allHistory.length !== (s.history || []).length) {
    try {
      const mod = await Promise.resolve().then(() => persistence);
      const all = await mod.getAllHistory();
      if (all && all.length > (s.history || []).length) {
        cachedAllHistory = all;
        const tf2 = filterByRange(all);
        const sf2 = filterByModel(tf2);
        const cf2 = sf2;
        let c2 = 0, r2 = sf2.length, t2 = 0;
        for (const e of sf2) {
          c2 += e.cost || 0;
          t2 += e.total_tokens || 0;
        }
        const ce2 = doc.getElementById("aus-stats-cost");
        if (ce2) ce2.textContent = "¥" + c2.toFixed(2) + " CNY";
        const re2 = doc.getElementById("aus-stats-req");
        if (re2) re2.textContent = String(r2);
        const te2 = doc.getElementById("aus-stats-tok");
        if (te2) te2.textContent = t2.toLocaleString("zh-CN");
        renderModelSummary(sf2);
        const sv2 = doc.querySelector('[data-view="stats"]');
        const hidden2 = sv2 ? sv2.style.display === "none" || sv2.offsetParent === null : false;
        if (!hidden2) {
          renderChart(cf2);
          renderExtraCharts(cf2);
          renderModelTrends(cf2);
        }
      }
    } catch {
    }
  }
}
function initStatsView() {
  bindPicker();
  bindChartSelectors();
  try {
    bindSummarySort();
  } catch {
  }
  try {
    initModelTrends();
  } catch {
  }
  updatePickerLabel();
  renderStatsView();
}
function getDoc$1() {
  return window.parent?.document ?? document;
}
let panelCreated = false;
let panelOpen = false;
let collapsed = false;
function refreshUI() {
  try {
    const doc = getDoc$1();
    const s = getSelectedSave();
    if (!s) return;
    const bal = state$2.customBalance || state$2.balance?.balance;
    const balEl = doc.getElementById("aus-balance");
    if (balEl) balEl.textContent = bal ? "¥" + bal + " CNY" : "¥0.00 CNY";
    const totalCostEl = doc.getElementById("aus-total-cost");
    if (totalCostEl) totalCostEl.textContent = "¥" + (s.total_cost || 0).toFixed(4) + " CNY";
    const tokEl = doc.getElementById("aus-total-tokens");
    if (tokEl) tokEl.textContent = (s.total_tokens || 0).toLocaleString("zh-CN") + " tokens";
    renderHistory(doc, s);
    renderOverview();
    renderStatsView();
  } catch {
  }
}
function renderHistory(doc, s) {
  const host = doc.getElementById("aus-history");
  if (!host) return;
  let hist = s.history || [];
  try {
    const scope = state$2.settings.historyScope || "all";
    if (scope === "current") {
      const filtered = getHistoryForDisplay();
      hist = filtered;
    }
  } catch {
  }
  if (!hist.length) {
    const scope = state$2.settings.historyScope || "all";
    const tip = scope === "current" ? '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;line-height:1.8;">当前对话暂无记录<br/><span style="font-size:11px;">已按“当前对话”过滤，旧记录（未关联对话）仅在“全部历史”中可见</span><br/><button id="aus-history-scope-switch" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">切换为全部历史</button></div>' : '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;">暂无历史记录</div>';
    host.innerHTML = tip;
    const btn = doc.getElementById("aus-history-scope-switch");
    if (btn) btn.onclick = () => {
      state$2.settings.historyScope = "all";
      try {
        saveHot({ settings: state$2.settings });
      } catch {
      }
      try {
        refreshUI();
      } catch {
      }
      const host2 = doc.getElementById("aus-settings");
      if (host2) try {
        window.ApiUsageStat?.refreshUI?.();
      } catch {
      }
    };
    return;
  }
  host.innerHTML = hist.slice(0, 50).map((h) => {
    const total = h.total_tokens || 1;
    const hp = (h.cache_hit_tokens || 0) / total * 100;
    const mp = (h.cache_miss_tokens || 0) / total * 100;
    const op = (h.completion_tokens || 0) / total * 100;
    const hps = hp.toFixed(1), mps = mp.toFixed(1), ops = op.toFixed(1);
    return `
    <div style="padding:10px 12px;background:var(--ds-card);border-radius:10px;margin-bottom:8px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;color:var(--ds-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc$1(h.model)} · ${esc$1(localTimeHM(h.timestamp))}</div>
          <div style="color:var(--ds-text-2);margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.duration || 0}ms · ${h.tokenRate || 0} t/s</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
          <div>
            <div style="font-weight:700;color:var(--ds-text);">¥${(h.cost || 0).toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;">旧</button>
            <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;">新</button>
            <button class="aus-detail-toggle" data-ts="${h.timestamp}" style="padding:4px 8px;border:1px solid var(--ds-black);border-radius:6px;background:var(--ds-black);color:var(--ds-black-text);font-size:10px;cursor:pointer;">详情</button>
          </div>
        </div>
      </div>
      <div style="background:var(--ds-border);border-radius:999px;height:6px;overflow:hidden;margin-top:8px;display:flex;">
        <div style="background:var(--ds-green);width:${hp}%;height:100%;"></div>
        <div style="background:var(--ds-red-border);width:${mp}%;height:100%;"></div>
        <div style="background:var(--ds-purple-bg);width:${op}%;height:100%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px;">
        <div style="display:flex;gap:8px;"><span style="color:var(--ds-green);font-weight:500;">${hps}% 命中</span><span style="color:var(--ds-red);font-weight:500;">${mps}% 未命中</span><span style="color:var(--ds-purple);font-weight:500;">${ops}% 输出</span></div>
        <span style="color:var(--ds-text-2);">${total.toLocaleString()}t</span>
      </div>
      <div class="aus-detail-panel" data-detail="${h.timestamp}" style="display:none;margin-top:8px;border-top:1px solid var(--ds-border);padding-top:8px;height:520px;overflow:hidden;display:none;flex-direction:column;gap:8px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">基础信息</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">模型</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;word-break:break-all;">${esc$1(h.model || "—")}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">时段</div><div style="font-weight:600;margin-top:2px;color:var(--ds-text);">${h.priceType === "new-peak" ? "🔴 高峰" : h.priceType === "new-offpeak" ? "🟢 非高峰" : "⚪ 旧价格"}</div></div>
              <div style="grid-column:1/-1;"><div style="color:var(--ds-text-2);font-size:10px;">时间</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${new Date(h.timestamp).toLocaleString("zh-CN")}</div></div>
            </div>
          </div>
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">性能</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.duration || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">首字延迟</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.ttft || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">速率</div><div style="font-weight:600;color:var(--ds-green);margin-top:2px;">${h.tokenRate || 0} t/s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.thinkTime || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链 Token</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${h.thinkTokens || 0}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">总时长</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.duration || 0) / 1e3).toFixed(1)}s</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">Token 消耗</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存命中</div><div style="font-weight:600;color:var(--ds-green);margin-top:2px;">${(h.cache_hit_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存未命中</div><div style="font-weight:600;color:var(--ds-red);margin-top:2px;">${(h.cache_miss_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">输出 Token</div><div style="font-weight:600;color:var(--ds-purple);margin-top:2px;">${(h.completion_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">总 Token</div><div style="font-weight:700;color:var(--ds-text);margin-top:2px;">${(h.total_tokens || 0).toLocaleString()}</div></div>
            </div>
          </div>
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">费用明细</div>
            <div style="display:grid;gap:6px;margin-top:6px;font-size:11px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输入费用</span><span style="font-weight:600;color:var(--ds-text);">¥${(h.input_cost || 0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输出费用</span><span style="font-weight:600;color:var(--ds-text);">¥${(h.output_cost || 0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--ds-card);padding-top:6px;margin-top:2px;"><span style="color:var(--ds-text);font-weight:600;">总费用</span><span style="font-weight:700;color:var(--ds-text);">¥${(h.cost || 0).toFixed(6)}</span></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="aus-tab-btn" data-tab="req" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:11px;cursor:pointer;">请求参数 (Request Body)</button>
          <button class="aus-tab-btn" data-tab="res" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">API 完整响应 (Full Response)</button>
          <button class="aus-tab-btn" data-tab="raw" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">原始 Token 用量 (Raw Usage)</button>
          <button class="aus-tab-btn" data-tab="msg" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">消息内容 (Messages)</button>
        </div>
        <pre class="aus-tab-content" data-content="req-${h.timestamp}" style="flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc$1(h.fullRequest ? JSON.stringify(h.fullRequest, null, 2) : h.raw_usage ? JSON.stringify(h.raw_usage, null, 2) : "（原文已清理，仅保留统计）")}</pre>
        <pre class="aus-tab-content" data-content="res-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc$1(h.fullResponse ? JSON.stringify(h.fullResponse, null, 2) : "（原文已清理）")}</pre>
        <pre class="aus-tab-content" data-content="raw-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc$1(JSON.stringify(h.raw_usage || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="msg-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc$1(h.messages && h.messages.length ? JSON.stringify(h.messages, null, 2) : "（原文已清理——超过保留条数 10 条，仅统计可用）")}</pre>
      </div>
    </div>
  `;
  }).join("");
  host.querySelectorAll(".aus-detail-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ts = btn.getAttribute("data-ts");
      const panel = host.querySelector(`[data-detail="${ts}"]`);
      if (!panel) return;
      const isOpen = panel.style.display !== "none" && panel.style.display !== "";
      if (isOpen) {
        panel.style.display = "none";
        btn.textContent = "详情";
        btn.style.background = "var(--ds-black)";
        btn.style.color = "var(--ds-black-text)";
      } else {
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        btn.textContent = "收起";
        btn.style.background = "var(--ds-card-inner)";
        btn.style.color = "var(--ds-text)";
        btn.style.borderColor = "var(--ds-black)";
      }
    });
  });
  host.querySelectorAll(".aus-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ts = btn.getAttribute("data-ts");
      const tab = btn.getAttribute("data-tab");
      const root = btn.closest(".aus-detail-panel");
      if (!root) return;
      root.querySelectorAll(".aus-tab-btn").forEach((b) => {
        b.style.background = "var(--ds-card-inner)";
        b.style.color = "var(--ds-text)";
        b.style.borderColor = "var(--ds-border)";
      });
      btn.style.background = "var(--ds-black)";
      btn.style.color = "var(--ds-black-text)";
      btn.style.borderColor = "var(--ds-black)";
      root.querySelectorAll(".aus-tab-content").forEach((c) => {
        c.style.display = "none";
      });
      const target = root.querySelector(`[data-content="${tab}-${ts}"]`);
      if (target) target.style.display = "block";
    });
  });
}
function bindPanel(doc) {
  const q = doc.getElementById("aus-btn-query-balance");
  if (q) q.onclick = () => queryBalance();
}
function switchView(view) {
  const doc = getDoc$1();
  doc.querySelectorAll("[data-view]").forEach((el) => {
    const v = el.getAttribute("data-view");
    el.style.display = v === view ? "block" : "none";
    if (v === view) {
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transition = "opacity 0.15s";
        el.style.opacity = "1";
      });
    }
  });
  doc.querySelectorAll(".aus-nav-item").forEach((el) => {
    const v = el.getAttribute("data-nav");
    if (v === view) el.classList.add("active");
    else el.classList.remove("active");
  });
  const titles = { overview: "用量概览", stats: "用量统计", history: "历史记录", settings: "设置", help: "使用说明", about: "关于" };
  const titleEl = doc.getElementById("aus-page-title");
  if (titleEl) titleEl.textContent = titles[view] || "";
  refreshUI();
  if (view === "stats") {
    setTimeout(() => {
      try {
        const doc2 = getDoc$1();
        const el = doc2.getElementById("aus-stats-chart");
        if (el && (el.clientWidth === 0 || el.clientHeight === 0)) {
          setTimeout(() => {
            try {
              renderStatsView();
            } catch {
            }
          }, 80);
        } else {
          renderStatsView();
        }
      } catch {
      }
    }, 60);
  }
}
function positionPanel() {
  const doc = getDoc$1();
  const overlay = doc.getElementById("aus-overlay");
  const panel = doc.getElementById("aus-panel");
  if (!overlay || !panel || overlay.style.display === "none") return;
  const vw = doc.documentElement.clientWidth || window.parent?.innerWidth || 0;
  const vh = doc.documentElement.clientHeight || window.parent?.innerHeight || 0;
  panel.style.left = "0px";
  panel.style.top = "0px";
  const rect = panel.getBoundingClientRect();
  const docOffX = -rect.left;
  const docOffY = -rect.top;
  overlay.style.left = docOffX + "px";
  overlay.style.top = docOffY + "px";
  overlay.style.width = vw + "px";
  overlay.style.height = vh + "px";
  panel.style.left = docOffX + "px";
  panel.style.top = docOffY + "px";
  panel.style.width = vw + "px";
  panel.style.height = vh + "px";
}
function createPanel() {
  if (panelCreated) return;
  const doc = getDoc$1();
  if (doc.getElementById("aus-panel")) {
    panelCreated = true;
    return;
  }
  panelCreated = true;
  const theme = state$2.settings.theme || "light";
  const overlay = doc.createElement("div");
  overlay.id = "aus-overlay";
  overlay.setAttribute("data-extension", "api-usage-stat");
  overlay.setAttribute("data-ds-theme", theme);
  overlay.style.cssText = "position:absolute;top:0;left:0;background:var(--ds-overlay);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePanel();
  });
  const panel = doc.createElement("div");
  panel.id = "aus-panel";
  panel.setAttribute("data-extension", "api-usage-stat");
  panel.setAttribute("data-ds-theme", theme);
  panel.style.cssText = "position:absolute;top:0;left:0;z-index:100001;background:var(--ds-panel-bg);color:var(--ds-text);font-family:'Microsoft YaHei','微软雅黑',system-ui,-apple-system,sans-serif;display:none;flex-direction:row;overflow:hidden;transform:none;filter:none;will-change:auto;";
  panel.innerHTML = `
    <div id="aus-sidebar" style="width:220px;flex-shrink:0;background:var(--ds-sidebar-bg);border-right:1px solid var(--ds-border);display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden;">
      <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;min-width:0;" id="aus-brand">
          <span style="font-size:13px;font-weight:700;color:var(--ds-text);white-space:nowrap;">API用量统计</span>
          <span style="font-size:11px;color:var(--ds-text-2);white-space:nowrap;">v3.0.0</span>
        </div>
        <button id="aus-sidebar-toggle" style="width:28px;height:28px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;flex-shrink:0;">‹</button>
      </div>
      <div style="flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;">
          <div class="aus-nav-item active" data-nav="overview" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">◈</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">▦</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">≡</span><span class="aus-nav-label">历史记录</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--ds-border);padding-top:8px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">⚙</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">?</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;line-height:1;">ⓘ</span><span class="aus-nav-label">关于</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--ds-panel-bg);">
      <div style="flex-shrink:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--ds-border);background:var(--ds-card-inner);">
        <span id="aus-page-title" style="font-size:14px;font-weight:600;color:var(--ds-text);">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div id="aus-main" style="flex:1;overflow:auto;padding:20px;background:var(--ds-panel-bg);">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div id="aus-balance-remaining" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;min-height:16px;"></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">导入</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.0000<small>CNY</small></div><div style="font-size:11px;color:var(--ds-text-3);margin-top:2px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="ds-card" id="aus-overview-history"></div>
              <div class="ds-card" id="aus-overview-spend"></div>
            </div>
            <div id="aus-overview-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-heatmap-card-overview" class="ds-card" style="margin-top:12px;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:12px;font-weight:600;color:var(--ds-text);">Token 使用量热力图</div>
                <div id="aus-heatmap-legend-overview" style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--ds-text-3);"></div>
              </div>
              <div style="display:flex;gap:0;overflow:hidden;max-width:100%;box-sizing:border-box;">
                <div id="aus-heatmap-labels-overview" style="flex-shrink:0;padding:4px 0"></div>
                <div id="aus-heatmap-scroll-overview" style="overflow-x:auto;overflow-y:hidden;flex:1;min-width:0;max-width:100%;padding:4px 0;cursor:grab;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;">
                  <div id="aus-heatmap-container-overview" style="display:inline-block;min-width:max-content;"></div>
                </div>
              </div>
              <div style="font-size:10px;color:var(--ds-text-3);margin-top:6px;display:flex;justify-content:space-between;">
                <span>按日聚合 Token（深绿=高用量，展示近 2 年）</span>
                <span style="color:var(--ds-text-2);">悬停查看日期</span>
              </div>
            </div>
           </div>
           <div data-view="stats" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div id="aus-range-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">时间维度</span><span id="aus-range-label" style="font-weight:600;color:var(--ds-text);">近 30 天</span><span style="font-size:10px;">▼</span></div>
              <div id="aus-model-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">模型</span><span id="aus-model-label" style="font-weight:600;color:var(--ds-text);">全部</span><span style="font-size:10px;">▼</span></div>
              <div id="aus-range-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden;flex-direction:row;">
                <div style="min-width:120px;border-right:1px solid var(--ds-card);padding:8px;display:grid;gap:2px;">
                  <div data-range="all" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">全部</div>
                  <div data-range="today" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">今天</div>
                  <div data-range="yesterday" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">昨天</div>
                  <div data-range="7d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">近 7 天</div>
                  <div data-range="30d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">近 30 天</div>
                  <div data-range="month" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">本月</div>
                  <div data-range="lastMonth" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">上月</div>
                  <div data-range="custom" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">自定义</div>
                </div>
                <div id="aus-date-calendar" style="padding:12px;display:none;"></div>
              </div>
              <div id="aus-model-dropdown" style="display:none;position:absolute;top:40px;left:160px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">消费金额</div><div id="aus-stats-cost" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">¥0.00 CNY</div></div>
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">API 请求次数</div><div id="aus-stats-req" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">Tokens</div><div id="aus-stats-tok" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
            </div>
            <div id="aus-model-summary" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">模型汇总</div>
              <table style="width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">模型</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">调用次数<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(命中)<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(未命中)<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgCost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgDur" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均耗时<span class="aus-sort-ind"></span></th><th data-sort-key="avgRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均速率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-summary-tbody"><tr><td colspan="10" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
            </div>
            <div class="ds-card" style="margin-top:12px;position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">自定义图表</span><div style="display:flex;gap:8px;position:relative;"><div id="aus-chart-y-btn" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;"><span style="color:var(--ds-text-2);">Y</span><span id="aus-chart-y-label" style="font-weight:600;color:var(--ds-text);">总费用</span><span style="font-size:10px;">▼</span></div><div id="aus-chart-x-btn" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;"><span style="color:var(--ds-text-2);">X</span><span id="aus-chart-x-label" style="font-weight:600;color:var(--ds-text);">每日</span><span style="font-size:10px;">▼</span></div><div id="aus-chart-y-dropdown" style="display:none;position:absolute;top:34px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:220px;max-height:280px;overflow:auto;"></div><div id="aus-chart-x-dropdown" style="display:none;position:absolute;top:34px;right:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:140px;"></div></div></div><div id="aus-stats-chart" style="height:300px;"></div></div>
            <div id="aus-extra-charts" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">Token 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-y-token" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-y-label-token">3 项</span> ▼</div><div id="aus-extra-x-token" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-token">轮次</span> ▼</div></div></div><div id="aus-extra-y-drop-token" style="display:none;position:absolute;top:32px;left:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:180px;max-height:200px;overflow:auto;"></div><div id="aus-extra-x-drop-token" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-token" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">费用 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-y-cost" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-y-label-cost">1 项</span> ▼</div><div id="aus-extra-x-cost" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-cost">轮次</span> ▼</div></div></div><div id="aus-extra-y-drop-cost" style="display:none;position:absolute;top:32px;left:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:180px;max-height:200px;overflow:auto;"></div><div id="aus-extra-x-drop-cost" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-cost" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">缓存命中 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-hit" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-hit">轮次</span> ▼</div></div></div><div id="aus-extra-x-drop-hit" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-hit" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">API请求数 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-req" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-req">每日</span> ▼</div></div></div><div id="aus-extra-x-drop-req" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-req" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">耗时与速率 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-dur" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-dur">轮次</span> ▼</div></div></div><div id="aus-extra-x-drop-dur" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-dur" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">模型用量占比</span><div id="aus-pie-toggle" style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:10px;cursor:pointer;">Token</div></div><div id="aus-chart-pie" style="height:220px;"></div></div>
            </div>
            <div id="aus-model-trends" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">模型 Token 趋势</span><div style="display:flex;gap:6px;"><div id="aus-modeltrends-x-token" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-modeltrends-x-label-token">每日</span> ▼</div></div></div><div id="aus-modeltrends-x-drop-token" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-model-token" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">模型调用次数趋势</span><div style="display:flex;gap:6px;"><div id="aus-modeltrends-x-req" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-modeltrends-x-label-req">每日</span> ▼</div></div></div><div id="aus-modeltrends-x-drop-req" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-model-req" style="height:220px;"></div></div>
            </div>
          </div>
          <div data-view="history" style="display:none;">
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:var(--ds-text-3);">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <div data-view="settings" style="display:none;">
            <div id="aus-settings"></div>
          </div>
          <div data-view="help" style="display:none;">
            <div style="display:grid;gap:12px;">
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#DC2626;font-weight:600;margin-bottom:6px;">⚠️ 安全提示</div><div style="color:var(--ds-text-2);">在本扩展中填入 API 密钥存在安全风险。密钥仅经 XOR 混淆后存储于 SillyTavern 设置中，建议使用权限受限的 API 密钥。</div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#2563EB;font-weight:600;margin-bottom:6px;">📊 使用统计 / 预测</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 输入 API 密钥并保存后点击“查询”获取余额（余额和缓存命中仅支持 DeepSeek 官方）</div><div>2. 正常对话，扩展自动记录每次请求的费用、token 数及缓存命中等统计数据</div><div>3. 切换时间维度或模型查看不同范围的统计</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:var(--ds-green);font-weight:600;margin-bottom:6px;">💡 高峰时间提示</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 设置中可开启峰值提示小圆点，直观显示当前高低峰状态</div><div>2. 圆点可拖动，位置自动记忆，找不到时可在设置中重置</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#DB2777;font-weight:600;margin-bottom:6px;">🔄 消息对比</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在历史记录中找到想对比的两条消息，前者点“旧”，后者点“新”</div><div>2. 系统并排显示请求消息的文字差异</div><div>3. 差异点即缓存发散起始位置（前 N 条相同为缓存命中段）</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#D97706;font-weight:600;margin-bottom:6px;">📈 统计图表</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在用量统计中按时间维度筛选数据</div><div>2. 橙色堆叠柱展示多模型消费金额占比，悬浮查看分模型明细</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#7C3AED;font-weight:600;margin-bottom:6px;">💾 请求详细参数</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在历史记录中点击某条的“详情”展开固定区域</div><div>2. 查看：模型/时间/耗时/首字延迟/思维链/费用/Token 详情及四类原始数据（请求参数/完整响应/Raw Usage/Messages）</div><div>3. 兼容峰谷计价分段</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#0891B2;font-weight:600;margin-bottom:6px;">🧡 模型兼容</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 完全兼容 DeepSeek 官方 API</div><div>2. 尽量兼容不同厂商/渠道的请求格式，部分模型可能无命中数</div><div>3. 如数据异常，请携带完整请求与响应反馈</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:var(--ds-text-3);font-weight:600;margin-bottom:6px;">✨ 关于</div><div style="color:var(--ds-text-2);">本扩展由原脚本迁移重构（Vite + ECharts，浅色隔离）。原脚本由 AI 编写 <span style="color:var(--ds-text);">@janmk</span> · 仓库 <a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);text-decoration:underline;">janmk1453/Api-Usage</a></div></div>
            </div>
          </div>
          <div data-view="about" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:var(--ds-text);">
              <div style="font-size:14px;font-weight:600;">关于<br/><br/>API用量统计 · SillyTavern 扩展</div>
              <div style="margin-top:8px;color:var(--ds-text-2);">迁移至原 DeepSeek使用预测 脚本<br/>致力于实现最全面的用量可视化统计<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);">janmk1453/Api-Usage</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const sbOverlay = doc.createElement("div");
  sbOverlay.id = "aus-sidebar-overlay";
  sbOverlay.style.cssText = "display:none;position:absolute;left:60px;top:0;right:0;bottom:0;background:rgba(0,0,0,0.08);z-index:4;";
  sbOverlay.addEventListener("click", () => applyCollapsed(true));
  panel.appendChild(sbOverlay);
  doc.body.appendChild(overlay);
  doc.body.appendChild(panel);
  try {
    applyTheme(theme);
  } catch {
  }
  try {
    const p = window.parent || window;
    p.addEventListener("scroll", positionPanel, { capture: true, passive: true });
    p.addEventListener("resize", positionPanel, { passive: true });
  } catch {
  }
  doc.getElementById("aus-panel-close")?.addEventListener("click", closePanel);
  doc.querySelectorAll(".aus-nav-item").forEach((el) => {
    el.addEventListener("click", () => {
      const v = el.getAttribute("data-nav");
      if (v) switchView(v);
    });
  });
  const applyCollapsed = (v) => {
    collapsed = v;
    const sb = doc.getElementById("aus-sidebar");
    const brand = doc.getElementById("aus-brand");
    const btn = doc.getElementById("aus-sidebar-toggle");
    const overlay2 = doc.getElementById("aus-sidebar-overlay");
    if (!sb) return;
    const isMobile = window.parent?.innerWidth <= 760 || window.innerWidth <= 760;
    if (isMobile) {
      if (collapsed) {
        sb.style.setProperty("width", "60px", "important");
        sb.style.setProperty("min-width", "60px", "important");
        sb.style.setProperty("max-width", "60px", "important");
        sb.style.position = "";
        sb.style.left = "";
        sb.style.top = "";
        sb.style.bottom = "";
        sb.style.zIndex = "";
        sb.style.boxShadow = "";
        if (overlay2) overlay2.style.display = "none";
      } else {
        sb.style.setProperty("width", "220px", "important");
        sb.style.setProperty("min-width", "220px", "important");
        sb.style.setProperty("max-width", "220px", "important");
        sb.style.position = "absolute";
        sb.style.left = "0";
        sb.style.top = "0";
        sb.style.bottom = "0";
        sb.style.zIndex = "5";
        sb.style.boxShadow = "4px 0 16px rgba(0,0,0,0.12)";
        if (overlay2) overlay2.style.display = "block";
      }
    } else {
      sb.style.setProperty("width", collapsed ? "60px" : "220px", "important");
      sb.style.setProperty("min-width", collapsed ? "60px" : "220px", "important");
      sb.style.setProperty("max-width", collapsed ? "60px" : "220px", "important");
      sb.style.position = "";
      sb.style.left = "";
      sb.style.top = "";
      sb.style.bottom = "";
      sb.style.zIndex = "";
      sb.style.boxShadow = "";
      if (overlay2) overlay2.style.display = "none";
    }
    if (brand) brand.style.setProperty("display", collapsed ? "none" : "flex", "important");
    if (btn) btn.textContent = collapsed ? "›" : "‹";
    doc.querySelectorAll(".aus-nav-label").forEach((el) => {
      el.style.setProperty("display", collapsed ? "none" : "inline", "important");
    });
    doc.querySelectorAll(".aus-nav-item").forEach((el) => {
      el.style.justifyContent = collapsed ? "center" : "flex-start";
    });
  };
  doc.getElementById("aus-sidebar-toggle")?.addEventListener("click", () => applyCollapsed(!collapsed));
  try {
    const isMobile = window.parent?.innerWidth <= 760 || window.innerWidth <= 760;
    if (isMobile) applyCollapsed(true);
    window.parent?.addEventListener("resize", () => {
      const nowMobile = window.parent?.innerWidth <= 760;
      if (nowMobile && !collapsed) {
      }
    });
  } catch {
  }
  bindPanel(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  initStatsView();
  initExtraCharts();
  switchView("overview");
  refreshUI();
}
function openPanel() {
  const doc = getDoc$1();
  const ov = doc.getElementById("aus-overlay");
  const pn = doc.getElementById("aus-panel");
  if (!ov || !pn) {
    createPanel();
    return openPanel();
  }
  ov.style.display = "block";
  pn.style.display = "flex";
  positionPanel();
  requestAnimationFrame(() => {
    ov.style.opacity = "1";
    positionPanel();
  });
  panelOpen = true;
  refreshUI();
}
function closePanel() {
  const doc = getDoc$1();
  const ov = doc.getElementById("aus-overlay");
  const pn = doc.getElementById("aus-panel");
  if (ov) {
    ov.style.opacity = "0";
    setTimeout(() => {
      ov.style.display = "none";
    }, 200);
  }
  if (pn) pn.style.display = "none";
  panelOpen = false;
}
function togglePanel() {
  if (panelOpen) closePanel();
  else openPanel();
}
function isWeekend(ts) {
  const d = new Date(ts + 8 * 3600 * 1e3).getUTCDay();
  return d === 0 || d === 6;
}
function isPeak(ts) {
  if (isWeekend(ts)) return false;
  const d = new Date(ts);
  const mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 8 * 60) % 1440;
  for (const h of state$2.settings.peakHours || []) {
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
  for (const h of state$2.settings.peakHours || []) {
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
  if (state$2.settings.peakDot === false) {
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
  try {
    document.documentElement.removeAttribute("data-extension");
    document.documentElement.removeAttribute("data-ds-theme");
    const doc = getDoc();
    doc.documentElement.removeAttribute("data-ds-theme");
    if (doc.documentElement.getAttribute("data-extension") === "api-usage-stat" && doc.getElementById("aus-panel")) {
      doc.documentElement.removeAttribute("data-extension");
    }
  } catch {
  }
}
async function initStore() {
  await repository.hydrate();
}
function injectWandEntry() {
  const doc = getDoc();
  const menu = doc.getElementById("extensionsMenu") || doc.getElementById("extensions_menu") || doc.querySelector("#extensionsMenu") || doc.querySelector("#extensions_menu") || doc.querySelector(".extensionsMenu") || doc.getElementById("extensions_settings") || doc.querySelector("#rm_extensions_block");
  if (!menu) return false;
  if (doc.getElementById("aus_wand_container")) return true;
  const container = doc.createElement("div");
  container.id = "aus_wand_container";
  container.className = "extension_container";
  container.innerHTML = '<div id="aus_wand_entry" class="list-group-item flex-container flexGap5" style="cursor:pointer;"><div class="fa-solid fa-chart-column extensionsMenuExtensionButton"></div>API用量统计</div>';
  try {
    menu.appendChild(container);
  } catch {
    return false;
  }
  const btn = doc.getElementById("aus_wand_entry");
  if (btn) btn.addEventListener("click", () => togglePanel());
  console.log("[API用量统计] 魔法棒入口已注入");
  return true;
}
function ensureWandEntry() {
  if (injectWandEntry()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (injectWandEntry() || tries > 20) clearInterval(timer);
  }, 500);
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
    const doc = getDoc();
    doc.getElementById("aus-overlay")?.remove();
    doc.getElementById("aus-panel")?.remove();
    doc.getElementById("aus_wand_container")?.remove();
    doc.getElementById("aus-peak-dot-indicator")?.remove();
  } catch {
  }
}
function onEnable() {
  console.log("[API用量统计] enabled");
  try {
    Promise.resolve().then(() => interception).then((m) => m.installInterception());
  } catch {
  }
}
function onDisable() {
  console.log("[API用量统计] disabled");
  try {
    Promise.resolve().then(() => interception).then((m) => m.uninstallInterception?.());
  } catch {
  }
  try {
    const doc = getDoc();
    doc.getElementById("aus-overlay")?.remove();
    doc.getElementById("aus-panel")?.remove();
  } catch {
  }
}
async function onActivate() {
  ensureStyleScope();
  try {
    injectWandEntry();
    ensureWandEntry();
  } catch {
  }
}
async function init() {
  ensureStyleScope();
  try {
    applyTheme(state$2.settings.theme);
  } catch {
  }
  try {
    await initStore();
  } catch (e) {
    console.error("[API用量统计] initStore 失败", e);
  }
  try {
    installInterception();
  } catch {
  }
  const mount = () => {
    try {
      applyTheme(state$2.settings.theme);
    } catch {
    }
    try {
      createPanel();
    } catch {
    }
    try {
      ensureWandEntry();
    } catch {
    }
    try {
      createPeakDot();
    } catch {
    }
    try {
      refreshUI();
    } catch {
    }
  };
  if (globalThis.SillyTavern?.getContext) mount();
  else window.setTimeout(mount, 1500);
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, () => {
      try {
        createPanel();
      } catch {
      }
      try {
        ensureWandEntry();
      } catch {
      }
      try {
        refreshUI();
      } catch {
      }
      try {
        const mod = globalThis.ApiUsageStatInterceptor ? null : null;
      } catch {
      }
      try {
        Promise.resolve().then(() => interception).then((m) => m.installInterception());
      } catch {
      }
    });
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_INITIALIZED, () => {
      try {
        ensureWandEntry();
      } catch {
      }
      try {
        Promise.resolve().then(() => interception).then((m) => m.installInterception());
      } catch {
      }
    });
    ctx?.eventSource?.on?.(ctx?.event_types?.CHAT_CHANGED, () => {
      try {
        if (state$2.settings.historyScope === "current") refreshUI();
      } catch {
      }
    });
    let retry = 0;
    const timer = setInterval(() => {
      retry++;
      try {
        const ok = globalThis.SillyTavern?.getContext?.()?.eventSource;
        if (ok) {
          try {
            if (installInterception()) clearInterval(timer);
          } catch {
          }
        }
      } catch {
      }
      if (retry > 6) clearInterval(timer);
    }, 1500);
  } catch {
  }
  try {
    getDoc().addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
  } catch {
  }
  globalThis.ApiUsageStat = { MODULE, refreshUI, updatePeakDot, openPanel, closePanel, togglePanel, state: state$2, injectWandEntry: ensureWandEntry };
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
