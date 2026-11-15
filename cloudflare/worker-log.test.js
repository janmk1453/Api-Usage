import { describe, it, expect } from 'vitest';
import worker from './worker.js';

const TOKEN = 'test-token';

function authHeaders() {
  return { Authorization: 'Basic ' + btoa('user:' + TOKEN) };
}

/** 专用假 D1：request_log 的三类语句各自可预置结果 */
function createLogDb(options) {
  const opts = options || {};
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const stmt = {
        sql,
        params: [],
        bind(...params) {
          stmt.params = params;
          return stmt;
        },
        async all() {
          calls.push({ type: 'all', sql, params: stmt.params });
          if (opts.failTable) throw new Error('D1_ERROR: no such table: request_log');
          if (sql.includes('UNION ALL')) return { results: opts.rateRows || [] };
          if (sql.includes('FROM request_log')) return { results: opts.rows || [] };
          return { results: [] };
        },
        async run() {
          calls.push({ type: 'run', sql, params: stmt.params });
          if (opts.failTable) throw new Error('D1_ERROR: no such table: request_log');
          return { meta: { last_row_id: 42 } };
        },
      };
      return stmt;
    },
  };
}

function logEnv(options) {
  const db = createLogDb(options);
  return { env: { DB: db, DASHBOARD_TOKEN: TOKEN }, db };
}

const PACK = {
  kind: 'aus_request_log',
  schema: 2,
  appVersion: '3.2.1',
  uploadedAt: 1794719000000,
  report: { problem: 'not-recorded', note: '这条对话没有进历史' },
  client: { userAgent: 'UA/1.0', timeZone: 'Asia/Shanghai', language: 'zh-CN' },
  record: {
    at: 1794718999000,
    method: 'post',
    url: 'https://revnovel.org/v1/chat/completions',
    requestHeaders: [['authorization', '***']],
    requestBody: '{"model":"deepseek-flash"}',
    response: { status: 200, streamed: true, durationMs: 5400, model: 'deepseek-flash' },
  },
  diagnostics: {
    history: [{ model: 'deepseek-flash', total_tokens: 15 }],
    tap: [],
    tapSummary: { total: 1, orphan: 1, settled: 0, pending: 0 },
    console: [{ level: 'error', text: 'boom' }],
    extensions: [],
  },
};

function uploadRequest(body, init) {
  const options = init || {};
  return new Request('https://stat.example.com/api/log', {
    method: options.method || 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...(options.headers || {}) },
    body: options.raw === undefined ? JSON.stringify(body) : options.raw,
  });
}

function insertCall(db) {
  return db.calls.find((call) => call.type === 'run' && call.sql.includes('INSERT INTO request_log'));
}

describe('/api/log 请求日志上传', () => {
  it('接受公开上传并写入 request_log（含 IP 哈希）', async () => {
    const { env, db } = logEnv();
    const res = await worker.fetch(uploadRequest(PACK), env, { waitUntil() {} });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.id).toBe(42);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const insert = insertCall(db);
    expect(insert).toBeTruthy();
    const [receivedAt, ipHash, appVersion, userAgent, timeZone, language, bytes, payload] = insert.params;
    expect(typeof receivedAt).toBe('number');
    expect(ipHash).toMatch(/^[0-9a-f]{16}$/);
    expect(appVersion).toBe('3.2.1');
    expect(userAgent).toBe('UA/1.0');
    expect(timeZone).toBe('Asia/Shanghai');
    expect(language).toBe('zh-CN');
    expect(bytes).toBeGreaterThan(0);
    const stored = JSON.parse(payload);
    expect(stored.schema).toBe(2);
    expect(stored.record.method).toBe('POST');
    expect(stored.report.problem).toBe('not-recorded');
    expect(stored.diagnostics.console[0].text).toBe('boom');
  });

  it('同一个 IP 哈希稳定，不同 IP 不同', async () => {
    const one = logEnv();
    await worker.fetch(uploadRequest(PACK), one.env, { waitUntil() {} });
    const two = logEnv();
    await worker.fetch(uploadRequest(PACK), two.env, { waitUntil() {} });
    const other = logEnv();
    await worker.fetch(uploadRequest(PACK, { headers: { 'cf-connecting-ip': '198.51.100.4' } }), other.env, { waitUntil() {} });
    expect(insertCall(one.db).params[1]).toBe(insertCall(two.db).params[1]);
    expect(insertCall(other.db).params[1]).not.toBe(insertCall(one.db).params[1]);
  });

  it('触发限流时返回 429 且不写库', async () => {
    const { env, db } = logEnv({ rateRows: [{ k: 'minute', c: 6 }, { k: 'day', c: 6 }, { k: 'global', c: 6 }] });
    const res = await worker.fetch(uploadRequest(PACK), env, { waitUntil() {} });
    expect(res.status).toBe(429);
    expect(await res.text()).toContain('频繁');
    expect(db.calls.some((call) => call.type === 'run')).toBe(false);
  });

  it('单 IP 日上限与全站日上限分别生效', async () => {
    const perDay = logEnv({ rateRows: [{ k: 'minute', c: 0 }, { k: 'day', c: 40 }, { k: 'global', c: 40 }] });
    expect((await worker.fetch(uploadRequest(PACK), perDay.env, { waitUntil() {} })).status).toBe(429);
    const global = logEnv({ rateRows: [{ k: 'minute', c: 0 }, { k: 'day', c: 1 }, { k: 'global', c: 800 }] });
    expect((await worker.fetch(uploadRequest(PACK), global.env, { waitUntil() {} })).status).toBe(429);
    const fine = logEnv({ rateRows: [{ k: 'minute', c: 5 }, { k: 'day', c: 39 }, { k: 'global', c: 799 }] });
    expect((await worker.fetch(uploadRequest(PACK), fine.env, { waitUntil() {} })).status).toBe(200);
  });

  it('拒绝坏 JSON、非 POST 与超大体积', async () => {
    const { env } = logEnv();
    const badJson = await worker.fetch(uploadRequest(null, { raw: '{not json' }), env, { waitUntil() {} });
    expect(badJson.status).toBe(400);

    const getRes = await worker.fetch(new Request('https://stat.example.com/api/log', { method: 'GET' }), env, { waitUntil() {} });
    expect(getRes.status).toBe(405);

    const huge = JSON.stringify({ ...PACK, record: { ...PACK.record, requestBody: 'x'.repeat(300000) } });
    const tooLarge = await worker.fetch(uploadRequest(null, { raw: huge }), env, { waitUntil() {} });
    expect(tooLarge.status).toBe(413);
  });

  it('上报体形状不合法时返回 400', async () => {
    const { env } = logEnv();
    const res = await worker.fetch(uploadRequest({ kind: 'other', schema: 2 }), env, { waitUntil() {} });
    expect(res.status).toBe(400);
  });

  it('存储未建表时返回 503 而不是 500', async () => {
    const { env } = logEnv({ failTable: true });
    const res = await worker.fetch(uploadRequest(PACK), env, { waitUntil() {} });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('稍后重试');
  });

  it('没有绑定 D1 时返回 503', async () => {
    const res = await worker.fetch(uploadRequest(PACK), { DASHBOARD_TOKEN: TOKEN }, { waitUntil() {} });
    expect(res.status).toBe(503);
  });
});

describe('/api/logs 与 /api/log/view 查看上传内容', () => {
  const rows = [
    {
      id: 7,
      received_at: 1794719000000,
      app_version: '3.2.1',
      bytes: 2048,
      payload: JSON.stringify(PACK),
    },
  ];

  it('未登录时两个接口都要求口令', async () => {
    const { env } = logEnv({ rows });
    expect((await worker.fetch(new Request('https://stat.example.com/api/logs'), env, { waitUntil() {} })).status).toBe(401);
    expect(
      (await worker.fetch(new Request('https://stat.example.com/api/log/view?id=7'), env, { waitUntil() {} })).status
    ).toBe(401);
  });

  it('列表只回摘要，详情回完整上报体', async () => {
    const { env } = logEnv({ rows });
    const allowed = await worker.fetch(new Request('https://stat.example.com/api/logs', { headers: authHeaders() }), env, {
      waitUntil() {},
    });
    expect(allowed.status).toBe(200);
    const list = await allowed.json();
    expect(list.count).toBe(1);
    expect(list.items[0].id).toBe(7);
    expect(list.items[0].problem).toBe('not-recorded');
    expect(list.items[0].model).toBe('deepseek-flash');
    expect(list.items[0].url).toBe('https://revnovel.org/v1/chat/completions');
    expect(list.items[0].payload).toBe(undefined);

    const detail = await worker.fetch(
      new Request('https://stat.example.com/api/log/view?id=7', { headers: authHeaders() }),
      env,
      { waitUntil() {} }
    );
    expect(detail.status).toBe(200);
    const item = (await detail.json()).item;
    expect(item.id).toBe(7);
    expect(item.payload.record.url).toBe('https://revnovel.org/v1/chat/completions');
    expect(item.payload.diagnostics.console[0].text).toBe('boom');
  });

  it('不存在的 id 返回 404，非法 id 返回 400', async () => {
    const missing = await worker.fetch(
      new Request('https://stat.example.com/api/log/view?id=999', { headers: authHeaders() }),
      logEnv({ rows: [] }).env,
      { waitUntil() {} }
    );
    expect(missing.status).toBe(404);

    const badId = await worker.fetch(
      new Request('https://stat.example.com/api/log/view?id=0', { headers: authHeaders() }),
      logEnv({ rows }).env,
      { waitUntil() {} }
    );
    expect(badId.status).toBe(400);
  });

  it('表未建时列表返回 503 可读错误', async () => {
    const res = await worker.fetch(
      new Request('https://stat.example.com/api/logs', { headers: authHeaders() }),
      logEnv({ failTable: true }).env,
      { waitUntil() {} }
    );
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('log_table_missing');
  });
});

describe('请求日志的定时清理', () => {
  it('按保留期与行数上限删除', async () => {
    const { env, db } = logEnv();
    const pending = [];
    await worker.scheduled({}, env, { waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
    const byAge = db.calls.find(
      (call) => call.type === 'run' && call.sql.includes('DELETE FROM request_log WHERE received_at <')
    );
    expect(byAge).toBeTruthy();
    expect(byAge.params[0]).toBeGreaterThan(0);
    const byCount = db.calls.find(
      (call) => call.type === 'run' && call.sql.includes('NOT IN (SELECT id FROM request_log')
    );
    expect(byCount).toBeTruthy();
    expect(byCount.params[0]).toBe(2000);
  });
});