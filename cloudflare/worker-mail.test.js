import { describe, it, expect } from 'vitest';
import worker from './worker.js';

const TOKEN = 'test-token';

function authHeaders() {
  return { Authorization: 'Basic ' + btoa('user:' + TOKEN) };
}

/** 请求日志假库：request_log 计数 / 插入，device 聚合走 batch 预置 */
function createMailEnv(options) {
  const opts = options || {};
  const metrics = opts.metrics || {};
  const calls = [];
  const sent = [];
  const db = {
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
          if (sql.includes('COUNT(*) AS c FROM request_log')) {
            return { results: [{ c: opts.dayReports === undefined ? 1 : opts.dayReports }] };
          }
          return { results: [] };
        },
        async run() {
          calls.push({ type: 'run', sql, params: stmt.params });
          return { meta: { last_row_id: 9 } };
        },
      };
      return stmt;
    },
    async batch(stmts) {
      calls.push({ type: 'batch', count: stmts.length });
      return [
        { results: [{ devices: metrics.dau, sessions: 210, opens: 640, active_ms: 7200000, run_ms: 5400000 }] },
        { results: [{ devices: metrics.prevDau }] },
        { results: [{ devices: metrics.newDevices }] },
        { results: [{ devices: metrics.totalDevices }] },
        { results: metrics.versions || [] },
        { results: [{ reports: metrics.feedbacks }] },
        { results: [{ avg_dau: metrics.sevenDayAvgDau }] },
      ];
    },
  };
  const env = {
    DB: db,
    DASHBOARD_TOKEN: TOKEN,
    PANEL_URL: 'https://stat.example.com/dashboard',
    EMAIL: {
      async send(payload) {
        sent.push(payload);
        return { messageId: 'msg-1' };
      },
    },
  };
  return { env, db, sent, calls };
}

const PACK = {
  kind: 'aus_request_log',
  schema: 2,
  appVersion: '3.2.1',
  uploadedAt: 1794719000000,
  report: { problem: 'wrong-data', note: '费用算多了' },
  client: { userAgent: 'UA/1.0', timeZone: 'Asia/Shanghai', language: 'zh-CN' },
  record: {
    at: 1794718999000,
    method: 'post',
    url: 'https://api.example.com/v1/chat/completions',
    requestHeaders: [['authorization', '***']],
    requestBody: '{"model":"deepseek-flash"}',
    response: { status: 502, streamed: true, durationMs: 5400, model: 'deepseek-flash' },
  },
  diagnostics: { history: [], tap: [], tapSummary: { total: 0, orphan: 0, settled: 0, pending: 0 }, console: [], extensions: [] },
};

function uploadRequest() {
  return new Request('https://stat.example.com/api/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9' },
    body: JSON.stringify(PACK),
  });
}

describe('错误反馈邮件提醒', () => {
  it('入库成功后发一封带编号与说明的邮件', async () => {
    const { env, sent } = createMailEnv();
    const pending = [];
    const res = await worker.fetch(uploadRequest(), env, { waitUntil: (promise) => pending.push(promise) });
    expect(res.status).toBe(200);
    await Promise.all(pending);
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('2855564331@qq.com');
    expect(sent[0].subject).toContain('新反馈 #9');
    expect(sent[0].text).toContain('费用算多了');
    expect(sent[0].text).toContain('deepseek-flash');
    expect(sent[0].text).toContain('502');
  });

  it('当天反馈条数超过上限时不再打扰', async () => {
    const { env, sent } = createMailEnv({ dayReports: 21 });
    const pending = [];
    const res = await worker.fetch(uploadRequest(), env, { waitUntil: (promise) => pending.push(promise) });
    expect(res.status).toBe(200);
    await Promise.all(pending);
    expect(sent.length).toBe(0);
  });

  it('发信失败不影响上传结果', async () => {
    const { env } = createMailEnv();
    env.EMAIL.send = async () => {
      throw new Error('E_RECIPIENT_NOT_ALLOWED');
    };
    const pending = [];
    const res = await worker.fetch(uploadRequest(), env, { waitUntil: (promise) => pending.push(promise) });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});

describe('每日零点总结', () => {
  const metrics = {
    dau: 86,
    prevDau: 93,
    newDevices: 3,
    totalDevices: 439,
    feedbacks: 2,
    sevenDayAvgDau: 80.4,
    versions: [{ version: '3.2.1', devices: 60 }],
  };

  it('日报 cron 触发发信，且不执行清理', async () => {
    const { env, sent, calls } = createMailEnv({ metrics });
    const pending = [];
    await worker.scheduled({ cron: '0 16 * * *', scheduledTime: Date.now() }, env, {
      waitUntil: (promise) => pending.push(promise),
    });
    await Promise.all(pending);
    expect(sent.length).toBe(1);
    expect(sent[0].subject).toContain('日报');
    expect(sent[0].subject).toContain('日活 86');
    expect(sent[0].text).toContain('新增设备：3');
    expect(sent[0].text).toContain('累计设备：439');
    expect(sent[0].text).toContain('7 日均日活：80.4');
    expect(calls.some((call) => call.type === 'run' && call.sql.includes('DELETE FROM device_daily'))).toBe(false);
  });

  it('清理 cron 继续走 prune，不发日报', async () => {
    const { env, sent, calls } = createMailEnv({ metrics });
    const pending = [];
    await worker.scheduled({ cron: '0 3 1 * *' }, env, { waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
    expect(sent.length).toBe(0);
    expect(calls.some((call) => call.type === 'run' && call.sql.includes('DELETE FROM device_daily'))).toBe(true);
  });

  it('存储未绑定时不发信也不抛错', async () => {
    const pending = [];
    await worker.scheduled({ cron: '0 16 * * *', scheduledTime: Date.now() }, { EMAIL: { async send() {} } }, {
      waitUntil: (promise) => pending.push(promise),
    });
    await expect(Promise.all(pending)).resolves.toBeDefined();
  });
});

describe('/api/digest 预览与补发', () => {
  const metrics = { dau: 86, prevDau: 93, newDevices: 3, totalDevices: 439, feedbacks: 2, sevenDayAvgDau: 80.4 };

  it('未登录时要求口令', async () => {
    const { env } = createMailEnv({ metrics });
    const res = await worker.fetch(new Request('https://stat.example.com/api/digest'), env, { waitUntil() {} });
    expect(res.status).toBe(401);
  });

  it('预览返回统计口径但不发信', async () => {
    const { env, sent } = createMailEnv({ metrics });
    const res = await worker.fetch(new Request('https://stat.example.com/api/digest?day=2026-11-27', { headers: authHeaders() }), env, {
      waitUntil() {},
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.day).toBe('2026-11-27');
    expect(json.prevDay).toBe('2026-11-26');
    expect(json.metrics.dau).toBe(86);
    expect(json.subject).toContain('11-27 日报');
    expect(json.text).toContain('新增设备：3');
    expect(sent.length).toBe(0);
  });

  it('send=1 时真发信', async () => {
    const { env, sent } = createMailEnv({ metrics });
    const res = await worker.fetch(
      new Request('https://stat.example.com/api/digest?day=2026-11-27&send=1', { headers: authHeaders() }),
      env,
      { waitUntil() {} },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(sent.length).toBe(1);
  });

  it('非法日期返回 400', async () => {
    const { env } = createMailEnv({ metrics });
    const res = await worker.fetch(new Request('https://stat.example.com/api/digest?day=2026-13-40', { headers: authHeaders() }), env, {
      waitUntil() {},
    });
    expect(res.status).toBe(400);
  });
});