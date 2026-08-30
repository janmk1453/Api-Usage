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
const state = {
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
    history: state.history,
    total_tokens: state.total_tokens,
    total_cost: state.total_cost,
    input_tokens: state.input_tokens,
    output_tokens: state.output_tokens,
    cache_hit_tokens: state.cache_hit_tokens,
    cache_miss_tokens: state.cache_miss_tokens,
    input_cost: state.input_cost,
    output_cost: state.output_cost,
    rounds: state.rounds,
    startTime: state.startTime
  };
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
  const next = [...entries, ...cold];
  await dbSet("cold_history", JSON.stringify(next));
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
function localDay$1(ts) {
  const t = typeof ts === "number" ? ts : ts.getTime();
  return new Date(t + 8 * 3600 * 1e3).toISOString().slice(0, 10);
}
function esc$1(s) {
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
function getPricing$1(model, settings) {
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
function pruneDetails() {
  if (!state.history || state.history.length <= DETAIL_KEEP) return;
  const hs = [...state.history].sort((a, b) => b.timestamp - a.timestamp);
  for (let i = DETAIL_KEEP; i < hs.length; i++) {
    delete hs[i].messages;
    delete hs[i].fullRequest;
    delete hs[i].fullResponse;
  }
}
function persist() {
  pruneDetails();
  saveHot({
    history: state.history,
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
    settings: state.settings,
    balance: state.balance,
    customBalance: state.customBalance,
    messageCount: state.messageCount,
    lastUsage: state.lastUsage
  });
  emit(DataEvents.UPDATED);
}
const repository = {
  snapshot() {
    return {
      saves: {},
      currentSave: null,
      settings: state.settings,
      balance: state.balance,
      customBalance: state.customBalance,
      messageCount: state.messageCount,
      lastUsage: state.lastUsage,
      history: state.history,
      total_tokens: state.total_tokens,
      total_cost: state.total_cost
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
  addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft = 0, thinkTime = 0) {
    messages = messages || [];
    if (!model) try {
      model = globalThis.SillyTavern?.getContext?.().model || "deepseek-v4-flash";
    } catch {
      model = "deepseek-v4-flash";
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
    const lu = { timestamp: Date.now(), model, prompt_tokens: hit + miss, prompt_cache_hit_tokens: hit, prompt_cache_miss_tokens: miss, completion_tokens: comp, total_tokens: total };
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
      fullResponse
    };
    state.history.unshift(entry);
    state.total_tokens += total;
    state.total_cost += lu.cost;
    state.input_tokens += hit + miss;
    state.output_tokens += comp;
    state.cache_hit_tokens += hit;
    state.cache_miss_tokens += miss;
    state.input_cost += lu.input_cost;
    state.output_cost += lu.output_cost;
    if (isDeepSeekOfficialModel(model)) state.rounds += 1;
    if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
    state.startTime = state.startTime || Date.now();
    persist();
    emit(DataEvents.HISTORY_ADDED, entry);
    return entry;
  },
  recalcAll() {
    for (const h of state.history || []) {
      const c = calcCost({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings);
      h.input_cost = c.input;
      h.output_cost = c.output;
      h.cost = c.total;
      h.priceType = c.priceType;
      h.cache_hit_rate = (h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0) > 0 ? (h.cache_hit_tokens || 0) / ((h.cache_hit_tokens || 0) + (h.cache_miss_tokens || 0)) * 100 : 0;
    }
    persist();
  },
  replaceAll(next) {
    if (next.history !== void 0) state.history = next.history;
    if (next.total_tokens !== void 0) state.total_tokens = next.total_tokens;
    if (next.total_cost !== void 0) state.total_cost = next.total_cost;
    if (next.input_tokens !== void 0) state.input_tokens = next.input_tokens;
    if (next.output_tokens !== void 0) state.output_tokens = next.output_tokens;
    if (next.cache_hit_tokens !== void 0) state.cache_hit_tokens = next.cache_hit_tokens;
    if (next.cache_miss_tokens !== void 0) state.cache_miss_tokens = next.cache_miss_tokens;
    if (next.input_cost !== void 0) state.input_cost = next.input_cost;
    if (next.output_cost !== void 0) state.output_cost = next.output_cost;
    if (next.rounds !== void 0) state.rounds = next.rounds;
    if (next.startTime !== void 0) state.startTime = next.startTime;
    if (next.saves) {
      let all = [...state.history || []];
      for (const s of Object.values(next.saves)) {
        const h = s.history || [];
        all = all.concat(h);
        state.total_tokens += s.total_tokens || 0;
        state.total_cost += s.total_cost || 0;
        state.input_tokens += s.input_tokens || 0;
        state.output_tokens += s.output_tokens || 0;
        state.cache_hit_tokens += s.cache_hit_tokens || 0;
        state.cache_miss_tokens += s.cache_miss_tokens || 0;
        state.input_cost += s.input_cost || 0;
        state.output_cost += s.output_cost || 0;
        state.rounds += s.rounds || 0;
      }
      all.sort((a, b) => b.timestamp - a.timestamp);
      const seen = /* @__PURE__ */ new Set();
      const dedup = [];
      for (const h of all) {
        if (!seen.has(h.timestamp)) {
          seen.add(h.timestamp);
          dedup.push(h);
        }
      }
      state.history = dedup.slice(0, MAX_HISTORY);
    }
    if (next.settings !== void 0) state.settings = next.settings;
    if (next.balance !== void 0) state.balance = next.balance;
    if (next.customBalance !== void 0) state.customBalance = next.customBalance;
    if (next.messageCount !== void 0) state.messageCount = next.messageCount;
    if (next.lastUsage !== void 0) state.lastUsage = next.lastUsage;
    persist();
    if (next.settings) emit(DataEvents.SETTINGS_CHANGED);
    if (next.balance !== void 0 || next.customBalance !== void 0) emit(DataEvents.BALANCE_CHANGED);
  },
  async hydrate() {
    const hot = await loadHot();
    if (hot) {
      if (hot.history) state.history = hot.history;
      if (hot.total_tokens !== void 0) state.total_tokens = hot.total_tokens;
      if (hot.total_cost !== void 0) state.total_cost = hot.total_cost;
      if (hot.input_tokens !== void 0) state.input_tokens = hot.input_tokens;
      if (hot.output_tokens !== void 0) state.output_tokens = hot.output_tokens;
      if (hot.cache_hit_tokens !== void 0) state.cache_hit_tokens = hot.cache_hit_tokens;
      if (hot.cache_miss_tokens !== void 0) state.cache_miss_tokens = hot.cache_miss_tokens;
      if (hot.input_cost !== void 0) state.input_cost = hot.input_cost;
      if (hot.output_cost !== void 0) state.output_cost = hot.output_cost;
      if (hot.rounds !== void 0) state.rounds = hot.rounds;
      if (hot.startTime !== void 0) state.startTime = hot.startTime;
      if (hot.settings) state.settings = { ...state.settings, ...hot.settings };
      if (hot.balance) state.balance = hot.balance;
      if (hot.customBalance) state.customBalance = hot.customBalance;
      if (hot.messageCount) state.messageCount = hot.messageCount;
      if (hot.lastUsage) state.lastUsage = hot.lastUsage;
    }
    emit(DataEvents.UPDATED);
    return this.snapshot();
  }
};
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
  repository.addEntry(usage, model, messages, startTime, fullRequest, fullResponse, ttft, thinkTime);
  refresh();
}
function recalcAllCosts() {
  repository.recalcAll();
}
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
      history: stripHistory$1(state.history),
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
      // 兼容旧多存档导入：额外提供 saves 包装
      saves: { default: { name: "default", history: stripHistory$1(state.history), total_tokens: state.total_tokens, total_cost: state.total_cost, input_tokens: state.input_tokens, output_tokens: state.output_tokens, cache_hit_tokens: state.cache_hit_tokens, cache_miss_tokens: state.cache_miss_tokens, input_cost: state.input_cost, output_cost: state.output_cost, rounds: state.rounds, startTime: state.startTime } },
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
      history: (d.history || []).slice(0, MAX_HISTORY),
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
    const seen = new Set((state.history || []).map((h) => h.timestamp));
    const toAdd = [];
    for (const h of d.history || []) {
      if (!seen.has(h.timestamp)) {
        seen.add(h.timestamp);
        toAdd.push(h);
      }
    }
    const merged = [...toAdd, ...state.history].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_HISTORY);
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
      messageCount: state.messageCount
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
  const lh = toHistory(ld), rh = toHistory(rd);
  const lseen = new Set(lh.map((h) => h.timestamp));
  const rseen = new Set(rh.map((h) => h.timestamp));
  let pulled = 0, pushed = 0;
  const merged = [...rh.filter((h) => {
    if (!lseen.has(h.timestamp)) {
      pulled++;
      return true;
    }
    return false;
  }), ...lh.filter((h) => {
    if (!rseen.has(h.timestamp)) {
      pushed++;
      return true;
    }
    return false;
  }), ...lh.filter((h) => rseen.has(h.timestamp))];
  const dedup = /* @__PURE__ */ new Map();
  for (const h of merged) dedup.set(h.timestamp, h);
  let hist = Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_HISTORY);
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
function generateDebugBatch() {
  const startStr = state.settings.debugDateStart;
  const endStr = state.settings.debugDateEnd;
  if (!startStr || !endStr) return alert("请设置起始与结束日期");
  const startDate = /* @__PURE__ */ new Date(startStr + "T00:00:00Z");
  const endDate = /* @__PURE__ */ new Date(endStr + "T00:00:00Z");
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return alert("日期范围无效");
  const count = state.settings.debugBatchCount || 30;
  const model = state.settings.debugModel || "deepseek-v4-flash";
  const hit = state.settings.debugHit || 1e4;
  const miss = state.settings.debugMiss || 5e3;
  const output = state.settings.debugOutput || 2e3;
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
      const c = calcCost({ timestamp: ts.getTime(), model, prompt_cache_hit_tokens: h, prompt_cache_miss_tokens: m, completion_tokens: o }, state.settings);
      state.total_tokens += total;
      state.total_cost += c.total;
      state.input_tokens += h + m;
      state.output_tokens += o;
      state.cache_hit_tokens += h;
      state.cache_miss_tokens += m;
      state.input_cost += c.input;
      state.output_cost += c.output;
      if (isDeepSeekOfficialModel(model)) state.rounds += 1;
      state.history.unshift({ timestamp: ts.getTime(), model, prompt_tokens: h + m, cache_hit_tokens: h, cache_miss_tokens: m, completion_tokens: o, total_tokens: total, input_cost: c.input, output_cost: c.output, cost: c.total, cache_hit_rate: h + m > 0 ? h / (h + m) * 100 : 0, priceType: c.priceType, raw_usage: { prompt_cache_hit_tokens: h, prompt_cache_miss_tokens: m, completion_tokens: o, total_tokens: total }, messages: [], duration: dur, ttft, thinkTime: 300, thinkTokens: Math.floor(o * 0.2), tokenRate: Math.round(o / (dur - ttft) * 1e3), fullRequest: null, fullResponse: null });
      generated++;
    }
  }
  state.history.sort((a, b) => b.timestamp - a.timestamp);
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
  const s = state.settings;
  host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <!-- API 密钥 -->
      <div class="ds-card"><div style="font-size:11px;color:#6B7280;font-weight:500;margin-bottom:6px;">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="输入 DeepSeek API 密钥" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;outline:none;" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div></div>

      <!-- 余额 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">自动校准余额</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-auto-balance" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#E5E7EB;border-radius:12px;transition:0.2s;"><span id="aus-auto-balance-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-auto-balance-interval" style="display:${s.autoBalance ? "block" : "none"};margin-top:8px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;color:#111827;">校准间隔（分钟）</span><input type="number" id="aus-balance-interval" min="1" max="1440" style="width:90px;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;text-align:center;" /></div></div>
        <div style="margin-top:12px;display:flex;gap:8px;"><input id="aus-custom-balance" placeholder="自定义余额（覆盖 API 查询）" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /><button id="aus-save-balance" class="ds-btn-pill" style="padding:8px 14px;">保存</button><button id="aus-clear-balance" style="padding:8px 12px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">清除</button></div><div id="aus-balance-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div>
      </div>

      <!-- 新价格机制 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">新价格机制（峰谷计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-use-new-pricing" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#E5E7EB;border-radius:12px;transition:0.2s;"><span id="aus-use-new-pricing-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-new-pricing-panel" style="display:${s.useNewPricing ? "block" : "none"};margin-top:10px;display:grid;gap:8px;">
          <div style="display:flex;gap:8px;align-items:center;"><input type="date" id="aus-new-pricing-date" style="flex:1;padding:7px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /><button id="aus-btn-pricing-today" style="padding:7px 12px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:11px;cursor:pointer;white-space:nowrap;">设为今日</button></div>
          <div style="font-size:11px;color:#6B7280;">生效日期前按旧价，之后按峰谷价（仅 deepseek* 模型，周末全天低谷）。</div>
        </div>
      </div>

      <!-- 高峰时段 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">高峰时段</span><button id="aus-btn-add-peak-hour" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">+ 添加</button></div><div id="aus-peak-hours-list" style="display:grid;gap:6px;margin-top:8px;"></div><div style="font-size:10px;color:#9CA3AF;margin-top:6px;">支持跨天（如 22:00-02:00），周末自动低谷。</div></div>

      <!-- 模型与价格 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">模型与价格（¥/百万 tokens）</span><button id="aus-btn-add-model" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">+ 自定义模型</button></div><div id="aus-custom-models-list" style="display:grid;gap:8px;margin-top:8px;"></div></div>

      <!-- 调试 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">调试模式（模拟数据，不计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-debug-mode" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#E5E7EB;border-radius:12px;transition:0.2s;"><span id="aus-debug-mode-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-debug-panel" style="display:${s.debug ? "block" : "none"};margin-top:10px;display:grid;gap:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:#6B7280;margin-bottom:4px;">命中</div><input type="number" id="aus-debug-hit" style="width:100%;padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div><div><div style="font-size:11px;color:#6B7280;margin-bottom:4px;">未命中</div><input type="number" id="aus-debug-miss" style="width:100%;padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:#6B7280;margin-bottom:4px;">输出</div><input type="number" id="aus-debug-output" style="width:100%;padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div><div><div style="font-size:11px;color:#6B7280;margin-bottom:4px;">模型</div><select id="aus-debug-model" style="width:100%;padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;"></select></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><input type="date" id="aus-debug-date-start" style="padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /><input type="date" id="aus-debug-date-end" style="padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /><input type="number" id="aus-debug-batch-count" min="1" placeholder="条数" style="padding:7px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div>
          <button id="aus-btn-debug-batch" class="ds-btn-pill" style="width:100%;">生成模拟数据</button><div id="aus-debug-status" style="font-size:11px;color:#6B7280;"></div>
        </div>
      </div>

      <!-- 峰值圆点 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:#111827;">峰值提示小圆点</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-peak-dot" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#E5E7EB;border-radius:12px;transition:0.2s;"><span id="aus-peak-dot-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">重置位置</button></div>

      <!-- WebDAV -->
      <div class="ds-card"><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:6px;">WebDAV 云同步</div><div style="font-size:11px;color:#6B7280;margin-bottom:8px;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
        <div style="display:grid;gap:8px;">
          <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" />
          <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div>
          <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" />
          <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" />
          <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button>
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
  const peakSlider = doc.getElementById("aus-peak-dot-slider");
  if (peakSlider) peakSlider.style.left = state.settings.peakDot !== false ? "23px" : "3px";
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
    if (pass && el) el.value = decryptKey(pass);
  } catch {
  }
  doc.getElementById("aus-save-key").onclick = () => {
    const v = doc.getElementById("aus-api-key").value.trim();
    saveApiKey(v);
    const sEl = doc.getElementById("aus-key-status");
    sEl.textContent = v ? "已保存" : "已清空";
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
  if (autoCb) autoCb.onchange = () => {
    state.settings.autoBalance = autoCb.checked;
    if (autoSlider) autoSlider.style.left = autoCb.checked ? "23px" : "3px";
    doc.getElementById("aus-auto-balance-interval").style.display = autoCb.checked ? "block" : "none";
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-balance-interval").onchange = (e) => {
    state.settings.balanceInterval = parseInt(e.target.value) || 10;
    saveHot({ settings: state.settings });
  };
  if (newCb) newCb.onchange = () => {
    state.settings.useNewPricing = newCb.checked;
    if (newSlider) newSlider.style.left = newCb.checked ? "23px" : "3px";
    doc.getElementById("aus-new-pricing-panel").style.display = newCb.checked ? "block" : "none";
    saveHot({ settings: state.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  if (newDate) newDate.onchange = () => {
    if (newDate.value) {
      const p = newDate.value.split("-");
      state.settings.newPricingDate = (/* @__PURE__ */ new Date(p[0] + "-" + p[1] + "-" + p[2] + "T00:00:00+08:00")).getTime();
    } else state.settings.newPricingDate = 0;
    saveHot({ settings: state.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  doc.getElementById("aus-btn-pricing-today").onclick = () => {
    const d = /* @__PURE__ */ new Date();
    d.setHours(0, 0, 0, 0);
    state.settings.newPricingDate = d.getTime();
    if (newDate) newDate.value = localDay(d.getTime());
    if (newCb && !newCb.checked) {
      newCb.checked = true;
      if (newSlider) newSlider.style.left = "23px";
      doc.getElementById("aus-new-pricing-panel").style.display = "block";
    }
    saveHot({ settings: state.settings });
    recalcAllCosts();
    try {
      globalThis.ApiUsageStat?.refreshUI?.();
    } catch {
    }
  };
  if (dbgCb) dbgCb.onchange = () => {
    state.settings.debug = dbgCb.checked;
    if (dbgSlider) dbgSlider.style.left = dbgCb.checked ? "23px" : "3px";
    doc.getElementById("aus-debug-panel").style.display = dbgCb.checked ? "block" : "none";
    const st = doc.getElementById("aus-debug-status");
    if (st) st.textContent = dbgCb.checked ? "调试模式已开启，下次对话将使用模拟参数，不计费" : "";
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-hit").onchange = (e) => {
    state.settings.debugHit = parseInt(e.target.value) || 0;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-miss").onchange = (e) => {
    state.settings.debugMiss = parseInt(e.target.value) || 0;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-output").onchange = (e) => {
    state.settings.debugOutput = parseInt(e.target.value) || 0;
    saveHot({ settings: state.settings });
  };
  const dbgModel = doc.getElementById("aus-debug-model");
  if (dbgModel) dbgModel.onchange = (e) => {
    state.settings.debugModel = e.target.value;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-date-start").onchange = (e) => {
    state.settings.debugDateStart = e.target.value;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-date-end").onchange = (e) => {
    state.settings.debugDateEnd = e.target.value;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-debug-batch-count").onchange = (e) => {
    state.settings.debugBatchCount = parseInt(e.target.value) || 1;
    saveHot({ settings: state.settings });
  };
  doc.getElementById("aus-btn-debug-batch").onclick = () => generateDebugBatch();
  doc.getElementById("aus-peak-dot").onchange = (e) => {
    state.settings.peakDot = e.target.checked;
    const sl = doc.getElementById("aus-peak-dot-slider");
    if (sl) sl.style.left = e.target.checked ? "23px" : "3px";
    saveHot({ settings: state.settings });
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
  renderPeakHoursEditor(doc);
  renderModelsEditor(doc);
  fillDebugModelSelect(doc);
}
function renderPeakHoursEditor(doc) {
  const list = doc.getElementById("aus-peak-hours-list");
  if (!list) return;
  const hours = state.settings.peakHours || [];
  list.innerHTML = hours.map((h, i) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="time" value="${esc(h.start || "")}" data-idx="${i}" data-field="start" style="flex:1;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" />
      <span style="font-size:11px;color:#6B7280;">至</span>
      <input type="time" value="${esc(h.end || "")}" data-idx="${i}" data-field="end" style="flex:1;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" />
      <button data-del="${i}" style="padding:6px 8px;border:1px solid #FCA5A5;border-radius:8px;background:#FEF2F2;color:#DC2626;font-size:11px;cursor:pointer;">删除</button>
    </div>
  `).join("");
  list.querySelectorAll('input[type="time"]').forEach((el) => {
    el.onchange = () => {
      const idx = parseInt(el.getAttribute("data-idx"));
      const field2 = el.getAttribute("data-field");
      state.settings.peakHours[idx][field2] = el.value;
      saveHot({ settings: state.settings });
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
      state.settings.peakHours.splice(idx, 1);
      if (!state.settings.peakHours.length) state.settings.peakHours = JSON.parse(JSON.stringify(DEFAULT_PEAK_HOURS));
      saveHot({ settings: state.settings });
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
    state.settings.peakHours.push({ start: "09:00", end: "12:00" });
    saveHot({ settings: state.settings });
    renderPeakHoursEditor(doc);
  };
}
function renderModelsEditor(doc) {
  const list = doc.getElementById("aus-custom-models-list");
  if (!list) return;
  const builtin = Object.keys(PRICING);
  const cms = state.settings.customModels || [];
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
      saveHot({ settings: state.settings });
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
      state.settings.customModels = state.settings.customModels.filter((c) => c.model !== model);
      saveHot({ settings: state.settings });
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
    const name = "custom-model-" + (state.settings.customModels.length + 1);
    state.settings.customModels.push({ model: name, usePeakPricing: true, offpeak: {}, peak: {} });
    saveHot({ settings: state.settings });
    renderModelsEditor(doc);
    fillDebugModelSelect(doc);
  };
}
function modelRow(model, p, isBuiltin, usePeak) {
  const hit = (v) => v !== void 0 && v !== "" ? v : "";
  return `<div data-model="${esc(model)}" data-builtin="${isBuiltin ? "1" : "0"}" style="border:1px solid #E5E7EB;border-radius:10px;padding:10px;background:#fff;display:grid;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <input value="${esc(model)}" ${isBuiltin ? "readonly" : ""} style="flex:1;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:${isBuiltin ? "#F9FAFB" : "#fff"};font-size:12px;" />
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6B7280;cursor:pointer;"><input type="checkbox" class="aus-cm-peak" ${usePeak ? "checked" : ""} /> 峰谷</label>
      ${isBuiltin ? "" : '<button data-del="1" style="padding:4px 8px;border:1px solid #FCA5A5;border-radius:6px;background:#FEF2F2;color:#DC2626;font-size:11px;cursor:pointer;">删除</button>'}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:#F9FAFB;border-radius:8px;padding:8px;display:grid;gap:6px;">
        <div style="font-size:10px;font-weight:600;color:#0BA25E;">非峰</div>
        ${field("offpeak.hit", hit(p.offpeak.hit))}${field("offpeak.miss", hit(p.offpeak.miss))}${field("offpeak.output", hit(p.offpeak.output))}
      </div>
      <div style="background:#FFFBEB;border-radius:8px;padding:8px;display:grid;gap:6px;${usePeak ? "" : "opacity:0.45;pointer-events:none;"}">
        <div style="font-size:10px;font-weight:600;color:#D97706;">高峰</div>
        ${field("peak.hit", hit(p.peak.hit))}${field("peak.miss", hit(p.peak.miss))}${field("peak.output", hit(p.peak.output))}
      </div>
    </div>
    <div style="font-size:10px;color:#9CA3AF;">单位：¥/百万 tokens · 内置模型不可删除，价格可覆盖</div>
  </div>`;
}
function field(key, val) {
  const label = key.endsWith(".hit") ? "命中" : key.endsWith(".miss") ? "未命中" : "输出";
  return `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;color:#6B7280;width:44px;">${label}</span><input type="number" step="0.001" min="0" data-price="${key}" value="${esc(val)}" style="flex:1;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;" /></div>`;
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
  const cms = state.settings.customModels;
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
  const cms = state.settings.customModels;
  const idx = cms.findIndex((c) => c.model === model);
  if (isBuiltin && prices.usePeakPricing && same) {
    if (idx !== -1) cms.splice(idx, 1);
  } else {
    const entry = { model, usePeakPricing: prices.usePeakPricing, offpeak: prices.offpeak, peak: prices.peak };
    if (idx !== -1) cms[idx] = entry;
    else cms.push(entry);
  }
  saveHot({ settings: state.settings });
  recalcAllCosts();
  try {
    globalThis.ApiUsageStat?.refreshUI?.();
  } catch {
  }
}
function getPricing(model) {
  const m = model || "deepseek-v4-flash";
  const base = PRICING[m] || PRICING["deepseek-v4-flash"];
  for (const cm of state.settings.customModels || []) {
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
  const models = Object.keys(PRICING).concat((state.settings.customModels || []).map((c) => c.model).filter(Boolean));
  const uniq = Array.from(new Set(models));
  sel.innerHTML = uniq.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
  const cur = state.settings.debugModel;
  if (uniq.indexOf(cur) === -1) state.settings.debugModel = uniq[0] || "deepseek-v4-flash";
  sel.value = state.settings.debugModel;
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
  const aCtx = a.slice(Math.max(0, i - ctx), i) + '<span style="background:#FEE2E2;color:#B91C1C;padding:0 2px;border-radius:3px;">' + esc$1(a.slice(i, i + 200)) + "</span>" + esc$1(a.slice(i + 200, i + 280));
  const bCtx = b.slice(Math.max(0, i - ctx), i) + '<span style="background:#DCFCE7;color:#15803D;padding:0 2px;border-radius:3px;">' + esc$1(b.slice(i, i + 200)) + "</span>" + esc$1(b.slice(i + 200, i + 280));
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
function computeOverview() {
  const s = getSelectedSave();
  if (!s) return { balanceText: "¥0.00 CNY", totalCost: 0, totalTokens: 0, hit: 0, miss: 0, output: 0, hitRate: 0, savings: 0, inputCost: 0, outputCost: 0, avgCost: 0, avgTokens: 0, avgDuration: 0, avgRate: 0, rounds: 0 };
  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const hit = s.cache_hit_tokens || 0, miss = s.cache_miss_tokens || 0, output = s.output_tokens || 0;
  const hitRate = hit + miss > 0 ? hit / (hit + miss) * 100 : 0;
  let savings = 0;
  try {
    for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings);
  } catch {
  }
  const rounds = s.rounds || 0;
  const avgCost = rounds ? totalCost / rounds : 0;
  const avgTokens = rounds ? totalTokens / rounds : 0;
  const avgDuration = s.history?.length ? s.history.reduce((a, h) => a + (h.duration || 0), 0) / s.history.length / 1e3 : 0;
  const avgRate = s.history?.length ? s.history.reduce((a, h) => a + (h.tokenRate || 0), 0) / s.history.length : 0;
  const bal = state.customBalance || state.balance?.balance;
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
    rounds
  };
}
function fmt(n) {
  return n.toLocaleString("zh-CN");
}
function CNY(n) {
  return "¥" + n.toFixed(4) + " CNY";
}
function renderOverview() {
  const doc = window.parent?.document ?? document;
  const v = computeOverview();
  const balEl = doc.getElementById("aus-balance");
  if (balEl) balEl.textContent = v.balanceText;
  const costEl = doc.getElementById("aus-total-cost");
  if (costEl) costEl.textContent = "¥" + v.totalCost.toFixed(4) + " CNY";
  const tokEl = doc.getElementById("aus-total-tokens");
  if (tokEl) tokEl.textContent = fmt(v.totalTokens) + " tokens";
  const histHost = doc.getElementById("aus-overview-history");
  if (histHost) {
    histHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">Token 历史消耗</span><span style="font-weight:600;color:#111827;">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（命中缓存）</span><span style="font-weight:600;color:#0BA25E;">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（未命中缓存）</span><span style="font-weight:600;color:#DC2626;">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输出</span><span style="font-weight:600;color:#111827;">${fmt(v.output)} tokens</span></div>
      </div>
    `;
  }
  const spendHost = doc.getElementById("aus-overview-spend");
  if (spendHost) {
    spendHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">预计节省</span><span style="text-align:right;"><div style="font-weight:600;color:#0BA25E;">${CNY(v.savings)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.hit)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">支出在输入</span><span style="text-align:right;"><div style="font-weight:600;color:#111827;">${CNY(v.inputCost)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.hit + v.miss)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">支出在输出</span><span style="text-align:right;"><div style="font-weight:600;color:#111827;">${CNY(v.outputCost)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.output)} tokens</div></span></div>
      </div>
    `;
  }
  const fourHost = doc.getElementById("aus-overview-four");
  if (fourHost) {
    fourHost.innerHTML = `
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮费用</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">¥${v.avgCost.toFixed(4)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">CNY</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮 Token</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${Math.round(v.avgTokens).toLocaleString("zh-CN")}</div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">平均耗时</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${v.avgDuration.toFixed(1)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">s</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">输出速率</div><div style="font-size:18px;font-weight:600;color:#0BA25E;margin-top:4px;">${Math.round(v.avgRate)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">t/s</span></div></div>
    `;
  }
}
let currentRange = "30d";
let customStart = "";
let customEnd = "";
let pickerOpen = false;
function getDoc$2() {
  return window.parent?.document ?? document;
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
function renderCalendar() {
  const doc = getDoc$2();
  const cal = doc.getElementById("aus-date-calendar");
  if (!cal) return;
  const todayStr = localDay$1(Date.now());
  const today = /* @__PURE__ */ new Date(todayStr + "T00:00:00Z");
  const months = [];
  months.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)));
  months.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  let html = '<div style="display:flex;gap:16px;">';
  for (const m of months) {
    const y = m.getUTCFullYear(), mo = m.getUTCMonth();
    const first = new Date(Date.UTC(y, mo, 1));
    const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const startDow = first.getUTCDay();
    html += `<div style="min-width:220px;"><div style="text-align:center;font-weight:600;font-size:13px;margin-bottom:8px;">${y}年${mo + 1}月</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:11px;">`;
    const week = ["日", "一", "二", "三", "四", "五", "六"];
    for (const w of week) html += `<div style="text-align:center;color:#9CA3AF;padding:4px;">${w}</div>`;
    for (let i = 0; i < startDow; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(y, mo, d));
      const key = date.toISOString().slice(0, 10);
      const { start, end } = getRangeDates();
      const inRange = key >= start && key <= end;
      const isToday = key === todayStr;
      const bg = inRange ? "#111827" : "#fff";
      const color = inRange ? "#fff" : "#111827";
      const ring = isToday && !inRange ? "border:1px solid #111827;" : "";
      html += `<div data-date="${key}" style="text-align:center;padding:6px;border-radius:999px;background:${bg};color:${color};cursor:pointer;${ring}">${d}</div>`;
    }
    html += `</div></div>`;
  }
  html += "</div>";
  cal.innerHTML = html;
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
      renderStatsView();
      renderCalendar();
    });
  });
}
function updatePickerLabel() {
  const doc = getDoc$2();
  const label = doc.getElementById("aus-range-label");
  if (!label) return;
  const map2 = { today: "今天", yesterday: "昨天", "7d": "近 7 天", "30d": "近 30 天", month: "本月", lastMonth: "上月", custom: "自定义" };
  if (currentRange === "custom" && customStart && customEnd) {
    label.textContent = customStart === customEnd ? customStart : `${customStart} ~ ${customEnd}`;
  } else label.textContent = map2[currentRange] || "近 30 天";
}
function bindPicker() {
  const doc = getDoc$2();
  const btn = doc.getElementById("aus-range-btn");
  const dropdown = doc.getElementById("aus-range-dropdown");
  if (!btn || !dropdown) return;
  btn.onclick = () => {
    pickerOpen = !pickerOpen;
    dropdown.style.display = pickerOpen ? "flex" : "none";
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
  doc.addEventListener("click", (e) => {
    if (!pickerOpen) return;
    const t = e.target;
    if (!t.closest("#aus-range-dropdown") && !t.closest("#aus-range-btn")) {
      pickerOpen = false;
      dropdown.style.display = "none";
    }
  });
}
let stackedChart = null;
async function renderStackedChart(filtered) {
  const doc = getDoc$2();
  const el = doc.getElementById("aus-stats-chart");
  if (!el) return;
  if (!filtered.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#9CA3AF;font-size:12px;">该时间段无数据</div>';
    return;
  }
  el.innerHTML = "";
  const dayMap = {};
  const models = /* @__PURE__ */ new Set();
  for (const e of filtered) {
    const k = localDay$1(e.timestamp);
    if (!dayMap[k]) dayMap[k] = {};
    const m = e.model || "unknown";
    models.add(m);
    dayMap[k][m] = (dayMap[k][m] || 0) + (e.cost || 0);
  }
  const days = Object.keys(dayMap).sort();
  const modelList = Array.from(models);
  const colors = ["#FF6A00", "#FF9A00", "#FFB800", "#0BA25E", "#6366F1", "#06B6D4", "#8B5CF6", "#EC4899"];
  const echarts = await import("./core-4qmyf-VR.js").then(async (ec) => {
    const { BarChart } = await import("./charts-CzKPy1hm.js");
    const { GridComponent, TooltipComponent, LegendComponent } = await import("./components-mQVYgrGD.js");
    const { CanvasRenderer } = await import("./renderers-BZeVs9I2.js");
    ec.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
    return ec;
  });
  if (!stackedChart) stackedChart = echarts.init(el);
  const series = modelList.map((m, i) => ({
    name: m,
    type: "bar",
    stack: "total",
    data: days.map((k) => Number((dayMap[k][m] || 0).toFixed(4))),
    itemStyle: { color: colors[i % colors.length], borderRadius: [4, 4, 0, 0] },
    barWidth: 12
  }));
  stackedChart.setOption({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#fff",
      borderColor: "#E5E7EB",
      borderWidth: 1,
      textStyle: { color: "#111827", fontSize: 11 },
      formatter: (params) => {
        if (!params?.length) return "";
        const day = params[0].axisValue;
        const total = params.reduce((a, p) => a + (p.value || 0), 0);
        let html = `<div style="font-weight:600;margin-bottom:6px;">${day} <span style="float:right;">¥${total.toFixed(2)}</span></div>`;
        for (const p of params) {
          if (!p.value) continue;
          html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;">¥${p.value.toFixed(2)}</span></div>`;
        }
        return `<div style="padding:4px 2px;">${html}</div>`;
      }
    },
    legend: { show: false },
    grid: { left: 40, right: 12, top: 8, bottom: 24 },
    xAxis: { type: "category", data: days.map((k) => k.slice(5).replace("-", "/")), axisLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 } },
    yAxis: { type: "value", axisLine: { show: false }, splitLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 } },
    series
  });
}
function renderStatsView() {
  const doc = getDoc$2();
  const s = getSelectedSave();
  if (!s) return;
  const filtered = filterByRange(s.history || []);
  let totalCost = 0, totalReq = filtered.length, totalTok = 0;
  for (const e of filtered) {
    totalCost += e.cost || 0;
    totalTok += e.total_tokens || 0;
  }
  const costEl = doc.getElementById("aus-stats-cost");
  if (costEl) costEl.textContent = "¥" + totalCost.toFixed(2) + " CNY";
  const reqEl = doc.getElementById("aus-stats-req");
  if (reqEl) reqEl.textContent = String(totalReq);
  const tokEl = doc.getElementById("aus-stats-tok");
  if (tokEl) tokEl.textContent = totalTok.toLocaleString("zh-CN");
  renderStackedChart(filtered);
}
function initStatsView() {
  bindPicker();
  updatePickerLabel();
  renderStatsView();
}
const statsView = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  initStatsView,
  renderStatsView
}, Symbol.toStringTag, { value: "Module" }));
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
    const bal = state.customBalance || state.balance?.balance;
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
  const hist = s.history || [];
  if (!hist.length) {
    host.innerHTML = '<div style="text-align:center;padding:16px;color:#9CA3AF;font-size:12px;">暂无历史记录</div>';
    return;
  }
  host.innerHTML = hist.slice(0, 50).map((h) => {
    const total = h.total_tokens || 1;
    const hp = (h.cache_hit_tokens || 0) / total * 100;
    const mp = (h.cache_miss_tokens || 0) / total * 100;
    const op = (h.completion_tokens || 0) / total * 100;
    const hps = hp.toFixed(1), mps = mp.toFixed(1), ops = op.toFixed(1);
    return `
    <div style="padding:10px 12px;background:#F6F7F8;border-radius:10px;margin-bottom:8px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc$1(h.model)} · ${esc$1(localDay$1(h.timestamp))}</div>
          <div style="color:#6B7280;margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.duration || 0}ms · ${h.tokenRate || 0} t/s</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
          <div>
            <div style="font-weight:700;color:#111827;">¥${(h.cost || 0).toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">旧</button>
            <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">新</button>
            <button class="aus-detail-toggle" data-ts="${h.timestamp}" style="padding:4px 8px;border:1px solid #111827;border-radius:6px;background:#111827;color:#fff;font-size:10px;cursor:pointer;">详情</button>
          </div>
        </div>
      </div>
      <div style="background:#E5E7EB;border-radius:999px;height:6px;overflow:hidden;margin-top:8px;display:flex;">
        <div style="background:#0BA25E;width:${hp}%;height:100%;"></div>
        <div style="background:#FCA5A5;width:${mp}%;height:100%;"></div>
        <div style="background:#A5B4FC;width:${op}%;height:100%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px;">
        <div style="display:flex;gap:8px;"><span style="color:#0BA25E;font-weight:500;">${hps}% 命中</span><span style="color:#DC2626;font-weight:500;">${mps}% 未命中</span><span style="color:#6366F1;font-weight:500;">${ops}% 输出</span></div>
        <span style="color:#6B7280;">${total.toLocaleString()}t</span>
      </div>
      <div class="aus-detail-panel" data-detail="${h.timestamp}" style="display:none;margin-top:8px;border-top:1px solid #E5E7EB;padding-top:8px;height:520px;overflow:hidden;display:none;flex-direction:column;gap:8px;">
        <!-- 归类块 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:#9CA3AF;font-weight:600;letter-spacing:0.5px;">基础信息</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:#6B7280;font-size:10px;">模型</div><div style="font-weight:600;color:#111827;margin-top:2px;word-break:break-all;">${esc$1(h.model || "—")}</div></div>
              <div><div style="color:#6B7280;font-size:10px;">时段</div><div style="font-weight:600;margin-top:2px;">${h.priceType === "new-peak" ? "🔴 高峰" : h.priceType === "new-offpeak" ? "🟢 非高峰" : "⚪ 旧价格"}</div></div>
              <div style="grid-column:1/-1;"><div style="color:#6B7280;font-size:10px;">时间</div><div style="font-weight:600;color:#111827;margin-top:2px;">${new Date(h.timestamp).toLocaleString("zh-CN")}</div></div>
            </div>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:#9CA3AF;font-weight:600;letter-spacing:0.5px;">性能</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:#6B7280;font-size:10px;">耗时</div><div style="font-weight:600;color:#111827;margin-top:2px;">${((h.duration || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:#6B7280;font-size:10px;">首字延迟</div><div style="font-weight:600;color:#111827;margin-top:2px;">${((h.ttft || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:#6B7280;font-size:10px;">速率</div><div style="font-weight:600;color:#0BA25E;margin-top:2px;">${h.tokenRate || 0} t/s</div></div>
              <div><div style="color:#6B7280;font-size:10px;">思维链耗时</div><div style="font-weight:600;color:#111827;margin-top:2px;">${((h.thinkTime || 0) / 1e3).toFixed(1)}s</div></div>
              <div><div style="color:#6B7280;font-size:10px;">思维链 Token</div><div style="font-weight:600;color:#111827;margin-top:2px;">${h.thinkTokens || 0}</div></div>
              <div><div style="color:#6B7280;font-size:10px;">总时长</div><div style="font-weight:600;color:#111827;margin-top:2px;">${((h.duration || 0) / 1e3).toFixed(1)}s</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:#9CA3AF;font-weight:600;letter-spacing:0.5px;">Token 消耗</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:#6B7280;font-size:10px;">缓存命中</div><div style="font-weight:600;color:#0BA25E;margin-top:2px;">${(h.cache_hit_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:#6B7280;font-size:10px;">缓存未命中</div><div style="font-weight:600;color:#DC2626;margin-top:2px;">${(h.cache_miss_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:#6B7280;font-size:10px;">输出 Token</div><div style="font-weight:600;color:#6366F1;margin-top:2px;">${(h.completion_tokens || 0).toLocaleString()}</div></div>
              <div><div style="color:#6B7280;font-size:10px;">总 Token</div><div style="font-weight:700;color:#111827;margin-top:2px;">${(h.total_tokens || 0).toLocaleString()}</div></div>
            </div>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:#9CA3AF;font-weight:600;letter-spacing:0.5px;">费用明细</div>
            <div style="display:grid;gap:6px;margin-top:6px;font-size:11px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入费用</span><span style="font-weight:600;color:#111827;">¥${(h.input_cost || 0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输出费用</span><span style="font-weight:600;color:#111827;">¥${(h.output_cost || 0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid #F6F7F8;padding-top:6px;margin-top:2px;"><span style="color:#111827;font-weight:600;">总费用</span><span style="font-weight:700;color:#111827;">¥${(h.cost || 0).toFixed(6)}</span></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="aus-tab-btn" data-tab="req" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid #111827;border-radius:999px;background:#111827;color:#fff;font-size:11px;cursor:pointer;">请求参数 (Request Body)</button>
          <button class="aus-tab-btn" data-tab="res" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">API 完整响应 (Full Response)</button>
          <button class="aus-tab-btn" data-tab="raw" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">原始 Token 用量 (Raw Usage)</button>
          <button class="aus-tab-btn" data-tab="msg" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">消息内容 (Messages)</button>
        </div>
        <pre class="aus-tab-content" data-content="req-${h.timestamp}" style="flex:1;min-height:160px;margin-top:2px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${esc$1(JSON.stringify(h.fullRequest || h.raw_usage || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="res-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${esc$1(JSON.stringify(h.fullResponse || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="raw-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${esc$1(JSON.stringify(h.raw_usage || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="msg-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;">${esc$1(JSON.stringify(h.messages || [], null, 2))}</pre>
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
        btn.style.background = "#111827";
        btn.style.color = "#fff";
      } else {
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        btn.textContent = "收起";
        btn.style.background = "#fff";
        btn.style.color = "#111827";
        btn.style.borderColor = "#111827";
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
        b.style.background = "#fff";
        b.style.color = "#111827";
        b.style.borderColor = "#E5E7EB";
      });
      btn.style.background = "#111827";
      btn.style.color = "#fff";
      btn.style.borderColor = "#111827";
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
  const overlay = doc.createElement("div");
  overlay.id = "aus-overlay";
  overlay.style.cssText = "position:absolute;top:0;left:0;background:rgba(0,0,0,0.45);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePanel();
  });
  const panel = doc.createElement("div");
  panel.id = "aus-panel";
  panel.setAttribute("data-extension", "api-usage-stat");
  panel.setAttribute("data-ds-theme", "light");
  panel.style.cssText = "position:absolute;top:0;left:0;z-index:100001;background:#FFFFFF;color:#111827;font-family:'Microsoft YaHei','微软雅黑',system-ui,-apple-system,sans-serif;display:none;flex-direction:row;overflow:hidden;transform:none;filter:none;will-change:auto;";
  panel.innerHTML = `
    <div id="aus-sidebar" style="width:220px;flex-shrink:0;background:#F9FAFB;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden;">
      <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;min-width:0;" id="aus-brand">
          <span style="font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">API用量统计</span>
          <span style="font-size:11px;color:#6B7280;white-space:nowrap;">v3.0.0</span>
        </div>
        <button id="aus-sidebar-toggle" style="width:28px;height:28px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;color:#6B7280;cursor:pointer;flex-shrink:0;">‹</button>
      </div>
      <div style="flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;">
          <div class="aus-nav-item" data-nav="overview" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#111827;"><span>◈</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>▦</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>≡</span><span class="aus-nav-label">历史记录</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;border-top:1px solid #E5E7EB;padding-top:8px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>⚙</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>?</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>ⓘ</span><span class="aus-nav-label">关于</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#FFFFFF;">
      <div style="flex-shrink:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid #E5E7EB;background:#fff;">
        <span id="aus-page-title" style="font-size:14px;font-weight:600;color:#111827;">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;color:#6B7280;cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div id="aus-main" style="flex:1;overflow:auto;padding:20px;background:#FFFFFF;">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <!-- 用量概览：新布局 -->
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导入</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.0000<small>CNY</small></div><div style="font-size:11px;color:#9CA3AF;margin-top:2px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="ds-card" id="aus-overview-history"></div>
              <div class="ds-card" id="aus-overview-spend"></div>
            </div>
            <div id="aus-overview-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
          </div>
          <!-- 用量统计：日历 + 三卡 + 堆叠柱 -->
          <div data-view="stats" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;">
              <div id="aus-range-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:12px;cursor:pointer;"><span style="color:#6B7280;">时间维度</span><span id="aus-range-label" style="font-weight:600;color:#111827;">近 30 天</span><span style="font-size:10px;">▼</span></div>
              <div id="aus-range-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:#fff;border:1px solid #E5E7EB;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden;flex-direction:row;">
                <div style="min-width:120px;border-right:1px solid #F6F7F8;padding:8px;display:grid;gap:2px;">
                  <div data-range="today" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">今天</div>
                  <div data-range="yesterday" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">昨天</div>
                  <div data-range="7d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">近 7 天</div>
                  <div data-range="30d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;background:#F6F7F8;">近 30 天</div>
                  <div data-range="month" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">本月</div>
                  <div data-range="lastMonth" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">上月</div>
                  <div data-range="custom" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;">自定义</div>
                </div>
                <div id="aus-date-calendar" style="padding:12px;"></div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
              <div class="ds-card"><div style="font-size:11px;color:#6B7280;">消费金额</div><div id="aus-stats-cost" style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">¥0.00 CNY</div></div>
              <div class="ds-card"><div style="font-size:11px;color:#6B7280;">API 请求次数</div><div id="aus-stats-req" style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">0</div></div>
              <div class="ds-card"><div style="font-size:11px;color:#6B7280;">Tokens</div><div id="aus-stats-tok" style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">0</div></div>
            </div>
            <div class="ds-card" style="margin-top:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">消费金额（CNY）</span><span style="font-size:11px;color:#6B7280;">多模型堆叠</span></div><div id="aus-stats-chart" style="height:280px;"></div></div>
          </div>
          <!-- 历史记录 -->
          <div data-view="history" style="display:none;">
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:#9CA3AF;">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <!-- 设置 -->
          <div data-view="settings" style="display:none;">
            <div id="aus-settings"></div>
          </div>
          <!-- 使用说明 -->
          <div data-view="help" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:#111827;">
              <div style="font-size:14px;font-weight:600;margin-bottom:8px;">使用说明</div>
              <div style="color:#6B7280;">
                <p>1. 在设置中填入 DeepSeek API Key 后，点击查询余额。</p>
                <p>2. 正常对话，扩展自动记录 token/费用/命中率等。</p>
                <p>3. 用量概览查看趋势，历史记录对比缓存断点，支持导出/导入与 WebDAV 同步。</p>
                <p>4. 峰值时段按北京时区计费，周末全天低谷。</p>
              </div>
            </div>
          </div>
          <!-- 关于 -->
          <div data-view="about" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:#111827;">
              <div style="font-size:14px;font-weight:600;">关于</div>
              <div style="margin-top:8px;color:#6B7280;">API用量统计 v3.0.0 · SillyTavern 原生扩展<br/>DeepSeek 官方浅色风格 · Vite + ECharts · 内容与脚本 1:1<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:#111827;">janmk1453/Api-Usage</a></div>
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
  Promise.resolve().then(() => statsView).then((m) => m.initStatsView());
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
  await repository.hydrate();
}
function injectWandEntry() {
  const doc = getDoc();
  const menu = doc.getElementById("extensionsMenu") || doc.querySelector("#extensionsMenu, #extensions_menu");
  if (!menu) return;
  if (doc.getElementById("aus_wand_container")) return;
  const container = doc.createElement("div");
  container.id = "aus_wand_container";
  container.className = "extension_container";
  container.innerHTML = '<div id="aus_wand_entry" class="list-group-item flex-container flexGap5"><div class="fa-solid fa-chart-column extensionsMenuExtensionButton"></div>API用量统计</div>';
  menu.appendChild(container);
  const btn = doc.getElementById("aus_wand_entry");
  if (btn) btn.addEventListener("click", () => togglePanel());
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
  const mount = () => {
    createPanel();
    injectWandEntry();
    createPeakDot();
    refreshUI();
  };
  if (globalThis.SillyTavern?.getContext) mount();
  else window.setTimeout(mount, 1500);
  try {
    const ctx = globalThis.SillyTavern?.getContext?.();
    ctx?.eventSource?.on?.(ctx?.event_types?.APP_READY, () => {
      createPanel();
      injectWandEntry();
      refreshUI();
    });
  } catch {
  }
  try {
    getDoc().addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePanel();
    });
  } catch {
  }
  globalThis.ApiUsageStat = { MODULE, refreshUI, updatePeakDot, openPanel, closePanel, togglePanel, state };
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
