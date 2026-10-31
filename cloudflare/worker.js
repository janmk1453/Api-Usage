/**
 * API用量统计 · 匿名使用统计接收端（Cloudflare Worker + D1）
 *
 * 路由：
 *   POST /collect            接收匿名上报（跨域简单请求，返回 204）
 *   GET  /dashboard          口令保护的数据看板（首屏数据内联注入，Cache API 缓存）
 *   GET  /api/summary        口令保护的总计类汇总（总计 / 画像 / 分布）
 *   GET  /api/trend          口令保护的趋势汇总（from/to/parts/bucket）
 *   GET  /health             健康检查
 * 定时：每月 1 号清理超过保留期的逐设备日数据。
 *
 * 省额度要点：
 *   1) 客户端会话内聚合后再上报（每设备每天通常 1~3 个请求）；
 *   2) device 表维护去标识化的累计列，看板「总计 + 画像」一次全表读即可（行数 = 设备数）；
 *   3) device_daily / device_hourly 只在需要粒度趋势时按索引范围扫描（行数 = 天数或小时数 × 日活）；
 *   4) 看板首屏与接口都走 Cache API（默认 10 分钟），看板「刷新」按钮用 ?force=1 绕过并回填；
 *   5) 上报体走 text/plain 简单请求，不触发 CORS 预检；device_daily.last_seq 与 device.last_seq 双重幂等。
 *
 * 分工：本文件只管上报写入、鉴权与路由；看板侧只读聚合全部在 api.js（可被离线预览脚本复用），
 * 模板注入在 boot.js（纯函数）。
 */
import dashboardHtml from './dashboard.html';
import { MAX_BODY_BYTES, normalizePayload } from './payload.js';
import { beijingDayKey, beijingHourKey } from './summary.js';
import {
  DEVICE_BASE_COLUMNS,
  TOTAL_COLUMNS,
  buildBootPayload,
  handleSummary,
  handleTrend,
  jsonResponse,
  noStore,
  respondWithCache,
} from './api.js';
import { renderDashboard } from './boot.js';

/** 逐设备日数据保留天数（设备维度汇总表长期保留） */
const RETENTION_DAYS = 730;
/** 逐设备小时数据保留天数：只服务小时粒度趋势，按较短周期清理以省 D1 空间 */
const HOURLY_RETENTION_DAYS = 180;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** 设备维度通用 UPSERT 片段：环境字段刷新为最近状态，累计列按本次上报增量累加 */
const DEVICE_UPSERT_SET = `ON CONFLICT(device_id) DO UPDATE SET
  last_seen = excluded.last_seen,
  last_seq = excluded.last_seq,
  app_version = COALESCE(NULLIF(excluded.app_version, ''), device.app_version),
  browser = COALESCE(NULLIF(excluded.browser, ''), device.browser),
  browser_major = COALESCE(NULLIF(excluded.browser_major, ''), device.browser_major),
  os = COALESCE(NULLIF(excluded.os, ''), device.os),
  arch = CASE WHEN excluded.arch = 'unknown' THEN COALESCE(device.arch, excluded.arch) ELSE excluded.arch END,
  lang = COALESCE(NULLIF(excluded.lang, ''), device.lang),
  width_bucket = COALESCE(NULLIF(excluded.width_bucket, ''), device.width_bucket),
  dark = excluded.dark,
  standalone = excluded.standalone,
  touch = excluded.touch,
  tz_offset = excluded.tz_offset,
  opens_total = device.opens_total + excluded.opens_total,
  dur_ms_total = device.dur_ms_total + excluded.dur_ms_total,
  ${TOTAL_COLUMNS.map((column) => `${column} = device.${column} + excluded.${column}`).join(',\n  ')}`;

const DEVICE_BASE_VALUES = `?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
  ?14, ?15, ?16, ?17`;

/**
 * 设备维度汇总上行（新库首选）：在酒馆版本、TauriTavern 版本、历史条数与开关状态之外，
 * 额外写入颜色模式 theme_mode（light / dark / auto），空值不覆盖既有状态；
 * `WHERE excluded.last_seq > device.last_seq` 保证重复/重发上报不重复累加，
 * 与 device_daily / device_hourly 的幂等判据一致。
 */
const DEVICE_UPSERT_THEME_SQL = `
INSERT INTO device (
  ${DEVICE_BASE_COLUMNS},
  ${TOTAL_COLUMNS.join(', ')}, st_version, tt_version, history_count, telemetry_off, theme_mode
) VALUES (
  ${DEVICE_BASE_VALUES},
  ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30
)
${DEVICE_UPSERT_SET},
  st_version = COALESCE(NULLIF(excluded.st_version, ''), device.st_version),
  tt_version = COALESCE(NULLIF(excluded.tt_version, ''), device.tt_version),
  history_count = excluded.history_count,
  telemetry_off = excluded.telemetry_off,
  theme_mode = COALESCE(NULLIF(excluded.theme_mode, ''), device.theme_mode)
WHERE excluded.last_seq > device.last_seq
`;

/**
 * 含酒馆与 TauriTavern 版本号、但不含 theme_mode 的语句：
 * 已执行 migrate-tt-version.sql、尚未执行 migrate-theme-mode.sql 的库使用。
 */
const DEVICE_UPSERT_SQL = `
INSERT INTO device (
  ${DEVICE_BASE_COLUMNS},
  ${TOTAL_COLUMNS.join(', ')}, st_version, tt_version, history_count, telemetry_off
) VALUES (
  ${DEVICE_BASE_VALUES},
  ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29
)
${DEVICE_UPSERT_SET},
  st_version = COALESCE(NULLIF(excluded.st_version, ''), device.st_version),
  tt_version = COALESCE(NULLIF(excluded.tt_version, ''), device.tt_version),
  history_count = excluded.history_count,
  telemetry_off = excluded.telemetry_off
WHERE excluded.last_seq > device.last_seq
`;

/** 仅执行到 migrate-st-version.sql、尚未执行 migrate-tt-version.sql 的库：保留酒馆版本，跳过 tt_version */
const DEVICE_UPSERT_ST_ONLY_SQL = `
INSERT INTO device (
  ${DEVICE_BASE_COLUMNS},
  ${TOTAL_COLUMNS.join(', ')}, st_version, history_count, telemetry_off
) VALUES (
  ${DEVICE_BASE_VALUES},
  ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28
)
${DEVICE_UPSERT_SET},
  st_version = COALESCE(NULLIF(excluded.st_version, ''), device.st_version),
  history_count = excluded.history_count,
  telemetry_off = excluded.telemetry_off
WHERE excluded.last_seq > device.last_seq
`;

/** 未执行 migrate-st-version.sql 的旧库回退语句：列集合与旧版完全一致 */
const DEVICE_UPSERT_LEGACY_SQL = `
INSERT INTO device (
  ${DEVICE_BASE_COLUMNS},
  ${TOTAL_COLUMNS.join(', ')}
) VALUES (
  ${DEVICE_BASE_VALUES},
  ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25
)
${DEVICE_UPSERT_SET}
WHERE excluded.last_seq > device.last_seq
`;

const DEVICE_DAILY_UPSERT_SQL = `
INSERT INTO device_daily (
  day, device_id, sessions, opens, dur_ms,
  p_overview, p_stats, p_history, p_forecast, p_wallet, p_settings, p_help, p_about,
  r0, r1, r2, r3, r4, app_version, last_seq, first_ts, last_ts
) VALUES (
  ?1, ?2, 1, ?3, ?4,
  ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
  ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?20
)
ON CONFLICT(day, device_id) DO UPDATE SET
  sessions = device_daily.sessions + 1,
  opens = device_daily.opens + excluded.opens,
  dur_ms = device_daily.dur_ms + excluded.dur_ms,
  p_overview = device_daily.p_overview + excluded.p_overview,
  p_stats = device_daily.p_stats + excluded.p_stats,
  p_history = device_daily.p_history + excluded.p_history,
  p_forecast = device_daily.p_forecast + excluded.p_forecast,
  p_wallet = device_daily.p_wallet + excluded.p_wallet,
  p_settings = device_daily.p_settings + excluded.p_settings,
  p_help = device_daily.p_help + excluded.p_help,
  p_about = device_daily.p_about + excluded.p_about,
  r0 = device_daily.r0 + excluded.r0,
  r1 = device_daily.r1 + excluded.r1,
  r2 = device_daily.r2 + excluded.r2,
  r3 = device_daily.r3 + excluded.r3,
  r4 = device_daily.r4 + excluded.r4,
  app_version = excluded.app_version,
  last_seq = excluded.last_seq,
  last_ts = excluded.last_ts
WHERE device_daily.last_seq < excluded.last_seq
`;

const DEVICE_HOURLY_UPSERT_SQL = `
INSERT INTO device_hourly (
  hour, device_id, sessions, opens, dur_ms,
  p_overview, p_stats, p_history, p_forecast, p_wallet, p_settings, p_help, p_about,
  r0, r1, r2, r3, r4, app_version, last_seq, first_ts, last_ts
) VALUES (
  ?1, ?2, 1, ?3, ?4,
  ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
  ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?20
)
ON CONFLICT(hour, device_id) DO UPDATE SET
  sessions = device_hourly.sessions + 1,
  opens = device_hourly.opens + excluded.opens,
  dur_ms = device_hourly.dur_ms + excluded.dur_ms,
  p_overview = device_hourly.p_overview + excluded.p_overview,
  p_stats = device_hourly.p_stats + excluded.p_stats,
  p_history = device_hourly.p_history + excluded.p_history,
  p_forecast = device_hourly.p_forecast + excluded.p_forecast,
  p_wallet = device_hourly.p_wallet + excluded.p_wallet,
  p_settings = device_hourly.p_settings + excluded.p_settings,
  p_help = device_hourly.p_help + excluded.p_help,
  p_about = device_hourly.p_about + excluded.p_about,
  r0 = device_hourly.r0 + excluded.r0,
  r1 = device_hourly.r1 + excluded.r1,
  r2 = device_hourly.r2 + excluded.r2,
  r3 = device_hourly.r3 + excluded.r3,
  r4 = device_hourly.r4 + excluded.r4,
  app_version = excluded.app_version,
  last_seq = excluded.last_seq,
  last_ts = excluded.last_ts
WHERE device_hourly.last_seq < excluded.last_seq
`;



export default {
  async fetch(request, env, ctx) {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (path === '/collect') return handleCollect(request, env);
    if (path === '/health') {
      return jsonResponse({ ok: true, time: Date.now() }, { status: 200, headers: noStore() });
    }
    if (!isAuthorized(request, env)) return unauthorized();
    if (path === '/dashboard' || path === '/') return handleDashboard(request, env);
    if (path === '/api/summary') return handleSummary(request, env);
    if (path === '/api/trend') return handleTrend(request, env);
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(prune(env));
  },
};

/* ---------------------------------- /collect ---------------------------------- */

async function handleCollect(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }
  let body = '';
  try {
    body = await request.text();
  } catch {
    return new Response('Bad Request', { status: 400, headers: CORS_HEADERS });
  }
  if (!body || body.length > MAX_BODY_BYTES) {
    return new Response('Payload Too Large', { status: 413, headers: CORS_HEADERS });
  }
  let raw;
  try {
    raw = JSON.parse(body);
  } catch {
    return new Response('Bad Request', { status: 400, headers: CORS_HEADERS });
  }
  const normalized = normalizePayload(raw, Date.now());
  if (!normalized.ok) {
    return new Response('Bad Request', { status: 400, headers: CORS_HEADERS });
  }
  if (!env?.DB) {
    return new Response('Storage Unavailable', { status: 500, headers: CORS_HEADERS });
  }
  try {
    await writeRow(env.DB, normalized.value, Date.now());
  } catch {
    return new Response('Storage Error', { status: 500, headers: CORS_HEADERS });
  }
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function writeRow(db, payload, now) {
  const { env, counters } = payload;
  // 上报时间精确到分钟：ts 由客户端给出并在 payload.js 归一，旧客户端回退服务端当前分钟
  const ts = Number.isFinite(Number(payload.ts)) ? Number(payload.ts) : now;
  const hour = beijingHourKey(ts);
  // 设备最新状态：历史记录总条数（精确值）与匿名统计开关是否已关闭
  const historyCount = Number.isFinite(Number(payload.hc)) ? Math.max(0, Math.floor(Number(payload.hc))) : 0;
  const offFlag = Number(payload.off) === 1 ? 1 : 0;
  // 颜色模式：客户端设置值（light/dark/auto），旧客户端不报时为空字符串，写入时按「空值不覆盖」处理
  const themeMode = typeof env.tm === 'string' ? env.tm : '';

  const deviceArgs = [
    payload.id, now, payload.app,
    env.b, env.bv, env.os, env.arch, env.lang,
    env.w, env.dark, env.standalone, env.touch, payload.tz,
    payload.day, payload.seq,
    counters.opens, counters.dur_ms,
    counters.pages.overview, counters.pages.stats, counters.pages.history, counters.pages.forecast,
    counters.pages.wallet, counters.pages.settings, counters.pages.help, counters.pages.about,
  ];
  const ttArgs = [...deviceArgs, env.stv, historyCount, offFlag];
  const extendedDeviceArgs = [...deviceArgs, env.stv, env.ttv, historyCount, offFlag];
  const themeArgs = [...extendedDeviceArgs, themeMode];
  const dailyArgs = [
    payload.day, payload.id,
    counters.opens, counters.dur_ms,
    counters.pages.overview, counters.pages.stats, counters.pages.history, counters.pages.forecast,
    counters.pages.wallet, counters.pages.settings, counters.pages.help, counters.pages.about,
    counters.render[0], counters.render[1], counters.render[2], counters.render[3], counters.render[4],
    payload.app, payload.seq, ts,
  ];
  const hourlyArgs = [hour, ...dailyArgs.slice(1)];

  // 每次重试重新 prepare：batch 事务失败会整体回滚，last_seq 判据保证重放不会重复累加
  const buildDevice = (mode) => {
    if (mode === 'theme') return db.prepare(DEVICE_UPSERT_THEME_SQL).bind(...themeArgs);
    if (mode === 'tt') return db.prepare(DEVICE_UPSERT_SQL).bind(...extendedDeviceArgs);
    if (mode === 'st') return db.prepare(DEVICE_UPSERT_ST_ONLY_SQL).bind(...ttArgs);
    return db.prepare(DEVICE_UPSERT_LEGACY_SQL).bind(...deviceArgs);
  };
  const buildDaily = () => db.prepare(DEVICE_DAILY_UPSERT_SQL).bind(...dailyArgs);
  const buildHourly = () => db.prepare(DEVICE_HOURLY_UPSERT_SQL).bind(...hourlyArgs);

  try {
    await db.batch([buildDevice('theme'), buildDaily(), buildHourly()]);
    return;
  } catch {
    // 继续走降级链：可能是 device_hourly 表缺失，也可能是 device 扩展列缺失
  }
  try {
    // 小时表尚未迁移（migrate-hourly.sql）：保留原有的设备 + 日两条写入
    await db.batch([buildDevice('theme'), buildDaily()]);
    return;
  } catch {}
  try {
    // theme_mode 列尚未迁移（migrate-theme-mode.sql）：保留其余扩展列，颜色模式本次不写
    await db.batch([buildDevice('tt'), buildDaily()]);
    return;
  } catch {}
  try {
    // tt_version 列尚未迁移（migrate-tt-version.sql）：保留 st_version 等扩展列
    await db.batch([buildDevice('st'), buildDaily()]);
    return;
  } catch {}
  // 设备扩展列（st_version/history_count/telemetry_off）尚未迁移：回退旧列集合。
  // 这一步保证未迁移的既有库与旧版本扩展照常上报，/collect 始终返回 204。
  await db.batch([buildDevice('legacy'), buildDaily()]);
}

/* ---------------------------------- 定时清理 ---------------------------------- */

async function prune(env) {
  if (!env?.DB) return;
  const cutoff = beijingDayKey(Date.now() - RETENTION_DAYS * 86400000);
  try {
    await env.DB.prepare('DELETE FROM device_daily WHERE day < ?1').bind(cutoff).run();
  } catch {}
  const hourCutoff = beijingHourKey(Date.now() - HOURLY_RETENTION_DAYS * 86400000);
  try {
    await env.DB.prepare('DELETE FROM device_hourly WHERE hour < ?1').bind(hourCutoff).run();
  } catch {}
}

/* ---------------------------------- 工具 ---------------------------------- */


function unauthorized() {
  return new Response('需要访问口令：请使用部署时设置的管理令牌登录。', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Basic realm="api-usage-stat", charset="UTF-8"',
    },
  });
}

function isAuthorized(request, env) {
  const token = String(env?.DASHBOARD_TOKEN || '');
  if (!token) return false;
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const separator = decoded.indexOf(':');
  const password = separator >= 0 ? decoded.slice(separator + 1) : '';
  return timingSafeEqual(password, token);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------------------------------- 看板页 ---------------------------------- */

/**
 * 看板页：总计 + 画像 + 分布 + 日/小时趋势 + 渲染耗时一次取齐并内联进 HTML，
 * 浏览器拿到即可渲染（没有空壳、没有二次等待）；结果同样进 Cache API，?force=1 绕过。
 */
function handleDashboard(request, env) {
  return respondWithCache(request, env, async () => {
    const boot = await buildBootPayload(env);
    return renderDashboard(dashboardHtml, boot);
  }, { contentType: 'text/html; charset=UTF-8' });
}
