/**
 * API用量统计 · 看板数据层（Cloudflare D1 只读聚合）
 *
 * 从 worker.js 抽出的看板侧全部逻辑，供三处复用：
 *   1) worker.js 的 /api/summary、/api/trend、/dashboard；
 *   2) scripts/build-preview.mjs（用 D1 REST shim 复用同一套 SQL 生成离线预览）；
 *   3) 单元测试（worker.test.js / boot.test.js）。
 *
 * 设计约定：
 *   - 所有查询都是只读聚合：device 表按设备行读（行数 = 设备数），
 *     device_daily / device_hourly 按 day / hour 索引范围扫描（行数 = 天数或小时数 × 日活）；
 *   - 时间基准统一北京时间（UTC+8），与 summary.js 一致；
 *   - 未迁移的新列一律降级，不让看板接口整体报错。
 */
import { PAGE_KEYS } from './payload.js';
import {
  CACHE_TTL_SECONDS,
  beijingDayKey,
  beijingHourKey,
  cumulativeGrowth,
  durationHistogram,
  envBreakdown,
  estimateRenderMs,
  historyCountCurve,
  hourKeyToMs,
  hourOfDaySeries,
  normalizeHourWindow,
  normalizeWindow,
  numberOrZero,
  renderSampleCount,
  shiftDay,
  shiftHour,
  sumBy,
  tally,
} from './summary.js';

/** 小时毫秒数 */
const HOUR_MS = 60 * 60 * 1000;
/** 渲染耗时档位下标 */
const RENDER_INDEXES = [0, 1, 2, 3, 4];
/** 累计列（与 schema.sql 的 *_total 一一对应） */
const TOTAL_COLUMNS = PAGE_KEYS.map((key) => `p_${key}_total`);

/** 设备维度读取的基础列（不含后加的可选列） */
const DEVICE_BASE_COLUMNS = `device_id, first_seen, last_seen, app_version, browser, browser_major, os, arch,
  lang, width_bucket, dark, standalone, touch, tz_offset,
  first_day, last_seq, opens_total, dur_ms_total`;


/**
 * 设备维度汇总：一次全表读（行数 = 设备数）覆盖总计、环境画像、版本分布与时长分布。
 * tt_version / theme_mode 属于后加的列，未跑对应迁移的库上整条查询会失败，
 * 因此按「两列都有 → 去掉 theme_mode → 去掉 tt_version → 两者都去掉」四档降级。
 */
function deviceSelectSql(columns) {
  const optional = [];
  if (columns.tt) optional.push('tt_version');
  if (columns.theme) optional.push('theme_mode');
  const extra = optional.length ? ',\n       ' + optional.join(', ') : '';
  return `
SELECT app_version, st_version, history_count, telemetry_off${extra},
       browser, browser_major, os, arch, lang, width_bucket,
       dark, standalone, touch, tz_offset, first_day, first_seen,
       opens_total, dur_ms_total,
       ${TOTAL_COLUMNS.join(', ')}
FROM device
`;
}

const DEVICE_SELECT_SQLS = [
  deviceSelectSql({ tt: true, theme: true }),
  deviceSelectSql({ tt: true, theme: false }),
  deviceSelectSql({ tt: false, theme: true }),
  deviceSelectSql({ tt: false, theme: false }),
];

/** 依次尝试各列组合，全部失败才抛错（未迁移的新列不影响看板出数） */
async function queryDevices(env) {
  let lastError;
  for (const sql of DEVICE_SELECT_SQLS) {
    try {
      return await queryAll(env, sql);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** 当日汇总：只扫当天行（行数 = 当日活跃设备数），同时给出当日去重设备数（日活） */
const TODAY_SELECT_SQL = `
SELECT COUNT(DISTINCT device_id) AS devices,
       COALESCE(SUM(opens), 0) AS opens, COALESCE(SUM(dur_ms), 0) AS dur_ms
FROM device_daily
WHERE day = ?1
`;

/** 日粒度趋势：按 day 索引范围扫描后按天聚合 */
const DAILY_SELECT_SQL = `
SELECT day,
       COUNT(*) AS devices,
       COALESCE(SUM(opens), 0) AS opens,
       COALESCE(SUM(dur_ms), 0) AS dur_ms,
       COALESCE(SUM(sessions), 0) AS sessions,
       ${PAGE_KEYS.map((key) => `COALESCE(SUM(p_${key}), 0) AS p_${key}`).join(',\n       ')}
FROM device_daily
WHERE day >= ?1 AND day <= ?2
GROUP BY day
ORDER BY day
`;

/** 小时粒度趋势：按 hour 索引范围扫描后按小时聚合（行数 = 小时数 × 小时活跃设备数） */
const HOURLY_SELECT_SQL = `
SELECT hour,
       COUNT(*) AS devices,
       COALESCE(SUM(opens), 0) AS opens,
       COALESCE(SUM(dur_ms), 0) AS dur_ms,
       COALESCE(SUM(sessions), 0) AS sessions,
       ${PAGE_KEYS.map((key) => `COALESCE(SUM(p_${key}), 0) AS p_${key}`).join(',\n       ')}
FROM device_hourly
WHERE hour >= ?1 AND hour <= ?2
GROUP BY hour
ORDER BY hour
`;

/**
 * 时段活跃分布：把窗口内的 device_hourly 按「一天中的第几小时」（北京时间）重新聚合。
 * devices 用 COUNT(DISTINCT device_id) 去重，反映该时段有多少台设备在用。
 */
const HOUR_OF_DAY_SELECT_SQL = `
SELECT substr(hour, 12, 2) AS hh,
       COUNT(DISTINCT device_id) AS devices,
       COALESCE(SUM(opens), 0) AS opens
FROM device_hourly
WHERE hour >= ?1 AND hour <= ?2
GROUP BY hh
ORDER BY hh
`;

/** 小时粒度累计用户：窗口内按设备首次出现时间（分钟精度）分桶 */
const GROWTH_HOUR_SELECT_SQL = `
SELECT strftime('%Y-%m-%dT%H', CAST(first_seen / 1000 AS INTEGER), 'unixepoch', '+8 hours') AS hour,
       COUNT(*) AS added
FROM device
WHERE first_seen >= ?1 AND first_seen <= ?2
GROUP BY hour
ORDER BY hour
`;

/** 小时粒度累计用户基线：窗口开始前已出现的设备数 */
const GROWTH_BASELINE_SELECT_SQL = `
SELECT COUNT(*) AS total
FROM device
WHERE first_seen < ?1
`;

/** 按扩展版本聚合渲染耗时分桶（客户端只上报 5 档，均值由 summary.js 估算） */
const RENDER_SELECT_SQL = `
SELECT app_version AS version,
       COUNT(*) AS device_days,
       COALESCE(SUM(r0 + r1 + r2 + r3 + r4), 0) AS samples,
       ${RENDER_INDEXES.map((index) => `COALESCE(SUM(r${index}), 0) AS r${index}`).join(',\n       ')}
FROM device_daily
WHERE day >= ?1 AND day <= ?2
GROUP BY app_version
`;

async function queryAll(env, sql, params = []) {
  const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
  const res = await stmt.all();
  return res?.results || [];
}

function jsonResponse(data, init = {}) {
  return jsonText(JSON.stringify(data), init);
}

function jsonText(body, init = {}) {
  const headers = { 'Content-Type': 'application/json; charset=UTF-8', ...(init.headers || {}) };
  return new Response(body, { status: init.status || 200, headers });
}

function noStore() {
  return { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=UTF-8' };
}

function handleSummary(request, env) {
  return respondWithCache(request, env, () => buildSummary(env));
}

function handleTrend(request, env) {
  return respondWithCache(request, env, async () => {
    const url = new URL(request.url);
    const parts = String(url.searchParams.get('parts') || 'both');
    // bucket=hour 时 from/to 为北京时间小时键（YYYY-MM-DDTHH），缺省为最近 24 小时
    if (url.searchParams.get('bucket') === 'hour') {
      const window = normalizeHourWindow(url.searchParams.get('from'), url.searchParams.get('to'), Date.now());
      return buildTrend(env, window, {
        hourly: parts === 'both' || parts === 'daily',
        hourOfDay: parts === 'hours',
        render: parts === 'both' || parts === 'render',
      });
    }
    const window = normalizeWindow(url.searchParams.get('from'), url.searchParams.get('to'), Date.now());
    return buildTrend(env, window, {
      daily: parts === 'both' || parts === 'daily',
      hourOfDay: parts === 'hours',
      render: parts === 'both' || parts === 'render',
    });
  });
}

/**
 * 总计类汇总：设备表一次全表读 + 一次当日聚合。
 * 「当日」按北京时间计算，与多数用户客户端上报的本地日期一致。
 */
async function buildSummary(env) {
  const now = Date.now();
  const today = beijingDayKey(now);
  const [deviceRows, todayRows] = await Promise.all([
    queryDevices(env),
    queryAll(env, TODAY_SELECT_SQL, [today]),
  ]);

  const users = deviceRows.length;
  const opens = sumBy(deviceRows, 'opens_total');
  const durMs = sumBy(deviceRows, 'dur_ms_total');
  const disabledUsers = sumBy(deviceRows, 'telemetry_off');

  const pages = {};
  let pageTotal = 0;
  for (const key of PAGE_KEYS) {
    const value = sumBy(deviceRows, `p_${key}_total`);
    pages[key] = value;
    pageTotal += value;
  }

  // 首次出现日期：优先用回填/首次上报写入的 first_day，缺失时用服务端首次见到的时间兜底
  const growthCounts = new Map();
  for (const row of deviceRows) {
    const rawDay = typeof row?.first_day === 'string' ? row.first_day : '';
    const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay)
      ? rawDay
      : (Number.isFinite(Number(row?.first_seen)) ? beijingDayKey(Number(row.first_seen)) : '');
    if (!day) continue;
    growthCounts.set(day, (growthCounts.get(day) || 0) + 1);
  }
  const userGrowth = cumulativeGrowth(
    Array.from(growthCounts.entries()).map(([day, count]) => ({ day, count })),
  );

  const todayAgg = todayRows[0] || {};
  return {
    generatedAt: now,
    today,
    totals: {
      users,
      opens,
      durMs,
      avgDurMsPerUser: users > 0 ? Math.round(durMs / users) : 0,
      todayUsers: growthCounts.get(today) || 0,
      todayActiveUsers: numberOrZero(todayAgg.devices),
      todayOpens: numberOrZero(todayAgg.opens),
      todayDurMs: numberOrZero(todayAgg.dur_ms),
      // 关闭率取每台设备最新一次上报的开关状态
      disabledUsers,
      disabledRate: users > 0 ? disabledUsers / users : 0,
    },
    userGrowth,
    pages: { ...pages, total: pageTotal },
    historyCount: historyCountCurve(deviceRows.map((row) => row?.history_count)),
    versions: tally(deviceRows.map((row) => row?.app_version), { limit: 12 }),
    env: envBreakdown(deviceRows),
    durationHistogram: durationHistogram(deviceRows.map((row) => row?.dur_ms_total)),
  };
}

/** 趋势类汇总：按天聚合（一次范围扫描）+ 按版本聚合渲染耗时（一次范围扫描） */
async function buildTrend(env, window, parts) {
  const hourlyMode = !!parts.hourly;
  const payload = {
    generatedAt: Date.now(),
    window: hourlyMode
      ? { from: window.from, to: window.to, hours: window.hours, bucket: 'hour' }
      : { from: window.from, to: window.to, days: window.days },
  };
  const tasks = [];

  if (parts.daily) {
    tasks.push(queryAll(env, DAILY_SELECT_SQL, [window.from, window.to]).then((rows) => {
      payload.daily = rows.map((row) => {
        const dayPages = {};
        let dayTotal = 0;
        for (const key of PAGE_KEYS) {
          const value = numberOrZero(row[`p_${key}`]);
          dayPages[key] = value;
          dayTotal += value;
        }
        return {
          day: String(row.day),
          devices: numberOrZero(row.devices),
          opens: numberOrZero(row.opens),
          durMs: numberOrZero(row.dur_ms),
          sessions: numberOrZero(row.sessions),
          pageTotal: dayTotal,
          pages: dayPages,
        };
      });
    }));
  }

  if (hourlyMode) {
    // 小时粒度：趋势行按小时补全（缺失补 0），累计用户以窗口开始前的设备数为基线
    const fromMs = hourKeyToMs(window.from);
    const toMs = hourKeyToMs(window.to) + HOUR_MS - 1;
    tasks.push(Promise.all([
      queryAll(env, HOURLY_SELECT_SQL, [window.from, window.to]),
      queryAll(env, GROWTH_HOUR_SELECT_SQL, [fromMs, toMs]),
      queryAll(env, GROWTH_BASELINE_SELECT_SQL, [fromMs]),
    ]).then(([rows, growthRows, baselineRows]) => {
      fillHourlyTrend(payload, window, rows, growthRows, baselineRows);
    }).catch(() => {
      // 既有库尚未执行 migrate-hourly.sql：返回全 0 曲线并标记，避免看板整体报错
      fillHourlyTrend(payload, window, [], [], []);
      payload.hourlyError = true;
    }));
  }

  if (parts.hourOfDay) {
    // 时段活跃分布：窗口按天给，内部换算成北京时间小时键范围（含首尾整天）
    const fromHour = String(window.from).slice(0, 10) + 'T00';
    const toHour = String(window.to).slice(0, 10) + 'T23';
    tasks.push(queryAll(env, HOUR_OF_DAY_SELECT_SQL, [fromHour, toHour])
      .then((rows) => { payload.hourOfDay = hourOfDaySeries(rows); })
      .catch(() => {
        // 小时表尚未迁移（migrate-hourly.sql）：返回全 0 分布而不是让接口失败
        payload.hourOfDay = hourOfDaySeries([]);
        payload.hourOfDayError = true;
      }));
  }

  if (parts.render) {
    // 小时模式的渲染图仍按天聚合：只取小时窗口覆盖到的日期范围
    const renderFrom = hourlyMode ? String(window.from).slice(0, 10) : window.from;
    const renderTo = hourlyMode ? String(window.to).slice(0, 10) : window.to;
    tasks.push(queryAll(env, RENDER_SELECT_SQL, [renderFrom, renderTo]).then((rows) => {
      payload.renderByVersion = rows
        .map((row) => {
          const buckets = RENDER_INDEXES.map((index) => numberOrZero(row[`r${index}`]));
          return {
            version: row.version ? String(row.version) : '未知',
            deviceDays: numberOrZero(row.device_days),
            samples: numberOrZero(row.samples) || renderSampleCount(buckets),
            buckets,
            avgMs: estimateRenderMs(buckets),
          };
        })
        .sort((a, b) => {
          if (a.avgMs === null && b.avgMs === null) return b.samples - a.samples;
          if (a.avgMs === null) return 1;
          if (b.avgMs === null) return -1;
          return b.avgMs - a.avgMs;
        });
    }));
  }

  await Promise.all(tasks);
  return payload;
}

/**
 * 把小时聚合结果补全为连续小时序列，并计算累计用户基线。
 * 独立成函数便于小时表缺失时以全 0 数据兜底。
 */
function fillHourlyTrend(payload, window, rows, growthRows, baselineRows) {
  const rowsByHour = new Map((rows || []).map((row) => [String(row.hour), row]));
  const addedByHour = new Map((growthRows || []).map((row) => [String(row.hour), numberOrZero(row.added)]));
  let running = numberOrZero(baselineRows?.[0]?.total);
  payload.hourly = [];
  payload.userGrowthHourly = [];
  let cursor = window.from;
  for (let i = 0; i < window.hours; i++) {
    const row = rowsByHour.get(cursor);
    const hourPages = {};
    let hourTotal = 0;
    for (const key of PAGE_KEYS) {
      const value = row ? numberOrZero(row[`p_${key}`]) : 0;
      hourPages[key] = value;
      hourTotal += value;
    }
    payload.hourly.push({
      hour: cursor,
      devices: row ? numberOrZero(row.devices) : 0,
      opens: row ? numberOrZero(row.opens) : 0,
      durMs: row ? numberOrZero(row.dur_ms) : 0,
      sessions: row ? numberOrZero(row.sessions) : 0,
      pageTotal: hourTotal,
      pages: hourPages,
    });
    const added = addedByHour.get(cursor) || 0;
    running += added;
    payload.userGrowthHourly.push({ hour: cursor, added, cumulative: running });
    cursor = shiftHour(cursor, 1);
  }
}

/**
 * Cache API 包装：默认按 URL（不含 force 参数）缓存 CACHE_TTL_SECONDS 秒。
 * 命中直接返回缓存快照；?force=1 绕过缓存重新查询并回填，便于看板「刷新」按钮取实时数据。
 * producer 返回对象时按 JSON 输出，返回字符串时按 contentType 原样输出（看板 HTML 走这条）。
 */
async function respondWithCache(request, env, producer, options = {}) {
  const contentType = options.contentType || 'application/json; charset=UTF-8';
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const keyUrl = new URL(url.toString());
  keyUrl.searchParams.delete('force');
  const cache = typeof caches !== 'undefined' && caches && caches.default ? caches.default : null;
  const cacheKey = cache ? new Request(keyUrl.toString(), { method: 'GET' }) : null;

  if (cache && !force) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return textResponse(await hit.text(), contentType, 'HIT');
    } catch {}
  }

  let body;
  try {
    const data = await producer();
    body = typeof data === 'string' ? data : JSON.stringify(data);
  } catch {
    const html = contentType.startsWith('text/html');
    return new Response(
      html ? '<!doctype html><meta charset="utf-8"><h1>看板数据加载失败</h1><p>请稍后刷新重试。</p>'
        : JSON.stringify({ ok: false, error: '查询失败' }),
      { status: 500, headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' } },
    );
  }

  if (cache) {
    try {
      await cache.put(cacheKey, new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `max-age=${CACHE_TTL_SECONDS}`,
        },
      }));
    } catch {}
  }

  return textResponse(body, contentType, force ? 'BYPASS' : 'MISS');
}

function textResponse(body, contentType, cacheState) {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Cache': cacheState,
    },
  });
}

/** 首屏内联的日趋势天数：覆盖看板「最近一年」预设，同时保持载荷很小（每天一行） */
const BOOT_DAILY_DAYS = 730;
/** 首屏内联的小时趋势天数：与看板小时粒度的可用上限一致 */
const BOOT_HOURLY_DAYS = 32;
/** 首屏内联的渲染耗时窗口（天）：性能页默认窗口，切窗口时再由客户端按需拉取 */
const BOOT_RENDER_DAYS = 30;

/**
 * 看板首屏载荷：一次把「总计 + 画像 + 分布 + 日趋势 + 小时趋势 + 渲染耗时」取齐，
 * 让 /dashboard 直接吐出一个数据已就位的 HTML（客户端不出现空壳与二次等待）。
 * 日/小时趋势都用紧凑数组投影（每天/每小时一行），避免重复的字段名占体积。
 */
async function buildBootPayload(env, now = Date.now()) {
  const today = beijingDayKey(now);
  const dayFrom = shiftDay(today, -(BOOT_DAILY_DAYS - 1));
  const hourTo = beijingHourKey(now);
  const hourFrom = shiftHour(hourTo, -(BOOT_HOURLY_DAYS * 24 - 1));
  const renderFrom = shiftDay(today, -(BOOT_RENDER_DAYS - 1));

  const [summary, dailyTrend, hourlyTrend, renderTrend] = await Promise.all([
    buildSummary(env),
    buildTrend(env, normalizeWindow(dayFrom, today, now), { daily: true }),
    buildTrend(env, normalizeHourWindow(hourFrom, hourTo, now), { hourly: true }),
    buildTrend(env, normalizeWindow(renderFrom, today, now), { render: true }),
  ]);

  return {
    generatedAt: summary.generatedAt,
    today: summary.today,
    startDay: summary.userGrowth?.[0]?.day || today,
    endDay: today,
    pageKeys: PAGE_KEYS,
    dailyFrom: dailyTrend.window?.from || dayFrom,
    dailyTo: dailyTrend.window?.to || today,
    hourlyFrom: hourlyTrend.window?.from || hourFrom,
    hourlyTo: hourlyTrend.window?.to || hourTo,
    hourlyError: !!hourlyTrend.hourlyError,
    renderFrom: renderTrend.window?.from || renderFrom,
    renderTo: renderTrend.window?.to || today,
    summary,
    daily: (dailyTrend.daily || []).map((row) => [
      row.day,
      row.devices,
      row.opens,
      row.durMs,
      row.sessions,
      row.pageTotal,
      ...PAGE_KEYS.map((key) => numberOrZero(row.pages?.[key])),
    ]),
    hourly: (hourlyTrend.hourly || []).map((row) => [row.hour, row.devices, row.opens, row.durMs, row.sessions]),
    hourlyGrowth: (hourlyTrend.userGrowthHourly || []).map((row) => [row.hour, row.added, row.cumulative]),
    render: renderTrend.renderByVersion || [],
  };
}

export {
  DEVICE_BASE_COLUMNS,
  TOTAL_COLUMNS,
  buildBootPayload,
  buildSummary,
  buildTrend,
  handleSummary,
  handleTrend,
  jsonResponse,
  jsonText,
  noStore,
  queryAll,
  queryDevices,
  respondWithCache,
};
