/**
 * API用量统计 · 匿名使用统计接收端（Cloudflare Worker + D1）
 *
 * 路由：
 *   POST /collect       接收匿名上报（跨域简单请求，返回 204）
 *   GET  /dashboard     口令保护的数据看板页
 *   GET  /api/summary   口令保护的汇总 JSON（Cache API 缓存，减少 D1 读）
 *   GET  /health        健康检查
 * 定时：每月 1 号清理超过保留期的逐设备日数据。
 *
 * 省额度要点：客户端会话内聚合后再上报（每设备每天通常 1~3 个请求）；
 * 上报体走 text/plain 简单请求，不触发 CORS 预检；看板走缓存 + day 索引。
 */
import dashboardHtml from './dashboard.html';
import { MAX_BODY_BYTES, PAGE_KEYS, normalizePayload } from './payload.js';

/** 逐设备日数据保留天数（设备环境快照表长期保留） */
const RETENTION_DAYS = 730;
/** device 表 last_seen/版本的回写间隔（毫秒），避免每次上报都写这一行 */
const DEVICE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const DEVICE_UPSERT_SQL = `
INSERT INTO device (
  device_id, first_seen, last_seen, app_version, browser, browser_major, os, arch,
  lang, width_bucket, dark, standalone, touch, tz_offset
) VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
ON CONFLICT(device_id) DO UPDATE SET
  last_seen = excluded.last_seen,
  app_version = excluded.app_version
WHERE excluded.last_seen - device.last_seen > ${DEVICE_REFRESH_MS}
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
    if (path === '/dashboard' || path === '/') {
      return new Response(dashboardHtml, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' },
      });
    }
    if (path === '/api/summary') return handleSummary(url, env);
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
  const deviceStmt = db.prepare(DEVICE_UPSERT_SQL).bind(
    payload.id, now, payload.app,
    env.b, env.bv, env.os, env.arch, env.lang,
    env.w, env.dark, env.standalone, env.touch, payload.tz,
  );
  const dailyStmt = db.prepare(DEVICE_DAILY_UPSERT_SQL).bind(
    payload.day, payload.id,
    counters.opens, counters.dur_ms,
    counters.pages.overview, counters.pages.stats, counters.pages.history, counters.pages.forecast,
    counters.pages.wallet, counters.pages.settings, counters.pages.help, counters.pages.about,
    counters.render[0], counters.render[1], counters.render[2], counters.render[3], counters.render[4],
    payload.app, payload.seq, now,
  );
  await db.batch([deviceStmt, dailyStmt]);
}

/* ---------------------------------- /api/summary ---------------------------------- */

/**
 * 看板汇总接口。这里刻意不做任何缓存（包括 Cache API 与 HTTP 缓存）：
 * 不同时间范围各自缓存时会停留在不同时刻的快照上，让「近 7 天」与「近 30 天」看起来互相矛盾，
 * 而两者其实读的是同一份数据。看板由开发者手动查看，请求量极低，实时查询的读放大可以接受。
 */
async function handleSummary(url, env) {
  const days = clampDays(url.searchParams.get('days'));
  try {
    const data = await buildSummary(env, days);
    return jsonResponse(data, { status: 200, headers: noStore() });
  } catch (error) {
    return jsonResponse({ ok: false, error: '查询失败' }, { status: 500, headers: noStore() });
  }
}

function clampDays(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 30;
  return Math.min(365, Math.max(1, Math.floor(num)));
}

function dayKey(offsetDays = 0, now = Date.now()) {
  return new Date(now - offsetDays * 86400000).toISOString().slice(0, 10);
}

async function queryAll(env, sql, params = []) {
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const res = await stmt.all();
  return res?.results || [];
}

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function tally(rows, key, limit = 12) {
  const map = new Map();
  for (const row of rows) {
    const raw = row?.[key];
    const label = raw === null || raw === undefined || raw === '' ? '未知' : String(raw);
    map.set(label, (map.get(label) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function buildSummary(env, days) {
  const since = dayKey(days - 1);
  const today = dayKey(0);
  const since7 = dayKey(6);
  const since30 = dayKey(29);

  const [
    totalRows,
    windowRows,
    todayRows,
    weekRows,
    monthRows,
    usageRows,
    dailyRows,
    versionRows,
    deviceRows,
  ] = await Promise.all([
    queryAll(env, 'SELECT COUNT(*) AS c FROM device'),
    queryAll(env, 'SELECT COUNT(DISTINCT device_id) AS c FROM device_daily WHERE day >= ?1', [since]),
    queryAll(env, 'SELECT COUNT(DISTINCT device_id) AS c FROM device_daily WHERE day = ?1', [today]),
    queryAll(env, 'SELECT COUNT(DISTINCT device_id) AS c FROM device_daily WHERE day >= ?1', [since7]),
    queryAll(env, 'SELECT COUNT(DISTINCT device_id) AS c FROM device_daily WHERE day >= ?1', [since30]),
    queryAll(
      env,
      `SELECT SUM(sessions) AS sessions, SUM(opens) AS opens, SUM(dur_ms) AS dur_ms,
              ${PAGE_KEYS.map((key) => `SUM(p_${key}) AS p_${key}`).join(', ')},
              SUM(r0) AS r0, SUM(r1) AS r1, SUM(r2) AS r2, SUM(r3) AS r3, SUM(r4) AS r4
       FROM device_daily WHERE day >= ?1`,
      [since],
    ),
    queryAll(
      env,
      `SELECT day, COUNT(DISTINCT device_id) AS devices, SUM(opens) AS opens, SUM(sessions) AS sessions,
              SUM(dur_ms) AS dur_ms,
              ${PAGE_KEYS.map((key) => `SUM(p_${key}) AS p_${key}`).join(', ')}
       FROM device_daily WHERE day >= ?1 GROUP BY day ORDER BY day`,
      [since],
    ),
    queryAll(
      env,
      // 每台设备只归入它在范围内最后上报的版本，避免同一设备跨版本重复计数
      `SELECT version, COUNT(*) AS c FROM (
         SELECT app_version AS version,
                ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY day DESC, last_seq DESC) AS rn
         FROM device_daily WHERE day >= ?1
       ) WHERE rn = 1 GROUP BY version ORDER BY c DESC LIMIT 10`,
      [since],
    ),
    // 环境维度按设备快照聚合：一次性取回后在 Worker 内统计，避免多次全表扫描
    queryAll(
      env,
      `SELECT browser, os, arch, lang, width_bucket, dark, standalone, touch, tz_offset FROM device`,
    ),
  ]);

  const usage = usageRows[0] || {};
  const pages = {};
  let pageTotal = 0;
  for (const key of PAGE_KEYS) {
    const value = numberOrZero(usage[`p_${key}`]);
    pages[key] = value;
    pageTotal += value;
  }

  return {
    generatedAt: Date.now(),
    days,
    devices: {
      total: numberOrZero(totalRows[0]?.c),
      dau: numberOrZero(todayRows[0]?.c),
      wau: numberOrZero(weekRows[0]?.c),
      mau: numberOrZero(monthRows[0]?.c),
      window: numberOrZero(windowRows[0]?.c),
    },
    usage: {
      sessions: numberOrZero(usage.sessions),
      opens: numberOrZero(usage.opens),
      durMs: numberOrZero(usage.dur_ms),
    },
    pages: { ...pages, total: pageTotal },
    daily: dailyRows.map((row) => {
      const dayPages = {};
      let pageTotal = 0;
      for (const key of PAGE_KEYS) {
        const value = numberOrZero(row[`p_${key}`]);
        dayPages[key] = value;
        pageTotal += value;
      }
      return {
        day: String(row.day),
        devices: numberOrZero(row.devices),
        opens: numberOrZero(row.opens),
        sessions: numberOrZero(row.sessions),
        durMs: numberOrZero(row.dur_ms),
        pageTotal,
        pages: dayPages,
      };
    }),
    versions: versionRows.map((row) => ({
      label: row.version ? String(row.version) : '未知',
      count: numberOrZero(row.c),
    })),
    render: [0, 1, 2, 3, 4].map((index) => numberOrZero(usage[`r${index}`])),
    env: {
      browser: tally(deviceRows, 'browser'),
      os: tally(deviceRows, 'os'),
      arch: tally(deviceRows, 'arch'),
      lang: tally(deviceRows, 'lang'),
      width: tally(deviceRows, 'width_bucket'),
      tz: tally(deviceRows.map((row) => ({ ...row, tz_label: `UTC${row.tz_offset >= 0 ? '+' : ''}${row.tz_offset}` })), 'tz_label'),
      dark: [
        { label: '深色偏好', count: deviceRows.filter((row) => Number(row.dark) === 1).length },
        { label: '浅色偏好', count: deviceRows.filter((row) => Number(row.dark) !== 1).length },
      ],
      standalone: [
        { label: 'standalone', count: deviceRows.filter((row) => Number(row.standalone) === 1).length },
        { label: '浏览器标签', count: deviceRows.filter((row) => Number(row.standalone) !== 1).length },
      ],
      touch: [
        { label: '触屏/粗指针', count: deviceRows.filter((row) => Number(row.touch) === 1).length },
        { label: '鼠标/精确指针', count: deviceRows.filter((row) => Number(row.touch) !== 1).length },
      ],
    },
  };
}

/* ---------------------------------- 定时清理 ---------------------------------- */

async function prune(env) {
  if (!env?.DB) return;
  const cutoff = dayKey(RETENTION_DAYS);
  try {
    await env.DB.prepare('DELETE FROM device_daily WHERE day < ?1').bind(cutoff).run();
  } catch {}
}

/* ---------------------------------- 工具 ---------------------------------- */

function jsonResponse(data, init = {}) {
  const headers = { 'Content-Type': 'application/json; charset=UTF-8', ...(init.headers || {}) };
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

function noStore() {
  return { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=UTF-8' };
}

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
