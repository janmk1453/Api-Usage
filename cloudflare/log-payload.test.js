import { describe, it, expect } from 'vitest';
import {
  LOG_SCHEMAS,
  MAX_DIAG_CONSOLE,
  MAX_DIAG_EXTENSIONS,
  MAX_DIAG_HISTORY,
  MAX_DIAG_TAP,
  MAX_HEADER_PAIRS,
  MAX_NOTE_CHARS,
  MAX_RECORD_BODY_CHARS,
  normalizeLogUpload,
} from './log-payload.js';

const NOW = 1794719000000;

function baseRecord(overrides) {
  return Object.assign(
    {
      at: NOW - 1000,
      method: 'post',
      url: 'https://api.example.com/v1/chat/completions',
      requestHeaders: [['authorization', '***'], ['content-type', 'application/json']],
      requestBody: '{"model":"deepseek-flash"}',
      response: {
        status: 200,
        statusText: 'OK',
        headers: [['content-type', 'text/event-stream']],
        firstByteMs: 320,
        durationMs: 5400,
        streamed: true,
        model: 'deepseek-flash',
        finishReason: 'stop',
        usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, prompt_tokens_details: { cached_tokens: 8 } },
      },
    },
    overrides || {}
  );
}

function v1Pack(overrides) {
  return Object.assign(
    { kind: 'aus_request_log', schema: 1, appVersion: '3.2.1', uploadedAt: NOW - 500, client: { userAgent: 'UA', timeZone: 'Asia/Shanghai', language: 'zh-CN' }, record: baseRecord() },
    overrides || {}
  );
}

function v2Pack(overrides) {
  return Object.assign(
    {
      kind: 'aus_request_log',
      schema: 2,
      appVersion: '3.2.1',
      uploadedAt: NOW - 500,
      report: { problem: 'not-recorded', note: '这一条没进历史' },
      client: { userAgent: 'UA', timeZone: 'Asia/Shanghai', language: 'zh-CN' },
      record: baseRecord(),
      diagnostics: {
        history: [{ timestamp: NOW - 9000, model: 'deepseek-flash', total_tokens: 15, cache_hit_tokens: 8, cost: 0.0001, sourceType: 'chat', endpointLabel: 'DeepSeek 官方', credentialLabel: 'k1', chatId: 'c1' }],
        tap: [{ at: NOW - 20000, endpoint: '/api/backends/chat-completions/generate', model: 'deepseek-flash', requestType: 'chat', actorKind: 'plugin', actorLabel: 'mvu', state: 'orphan', settledBy: '', status: 200, durationMs: 1200, messageCount: 3, usage: { prompt: 10, completion: 2, total: 12, hit: 0, miss: 10 } }],
        tapSummary: { total: 1, orphan: 1, settled: 0, pending: 0 },
        console: [{ level: 'error', text: 'boom' }],
        settings: { appVersion: '3.2.1', mobileCompatUi: true, theme: 'dark', historyScope: '7', historyCount: 156, walletCount: 3 },
        env: { userAgent: 'UA', platform: 'Android', language: 'zh-CN', timeZone: 'Asia/Shanghai', mobile: true, screenWidth: 1080, screenHeight: 2400, viewportWidth: 412, viewportHeight: 915, devicePixelRatio: 2.75 },
        conversation: { chatId: 'c1', character: '时停', stVersion: '1.19.0', extensionKeys: ['api_usage_stat', 'third-party/foo'] },
        extensions: [{ name: 'ST-Memory-Enhanced', version: '4.1.0', type: 'local', enabled: true }],
      },
    },
    overrides || {}
  );
}

describe('请求日志上报体校验', () => {
  it('接受 schema 1 的旧版上报', () => {
    const result = normalizeLogUpload(v1Pack(), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.schema).toBe(1);
    expect(result.value.record.method).toBe('POST');
    expect(result.value.record.response.status).toBe(200);
    expect(result.value.report).toBe(null);
    expect(result.value.diagnostics).toBe(null);
  });

  it('schema 1 缺少 record 时判为无效', () => {
    const result = normalizeLogUpload(v1Pack({ record: null }), NOW);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bad_record');
  });

  it('接受 schema 2 的诊断包，并保留反馈说明', () => {
    const result = normalizeLogUpload(v2Pack(), NOW);
    expect(result.ok).toBe(true);
    expect(LOG_SCHEMAS).toContain(result.value.schema);
    expect(result.value.report).toEqual({ problem: 'not-recorded', note: '这一条没进历史' });
    const diag = result.value.diagnostics;
    expect(diag.history.length).toBe(1);
    expect(diag.history[0].total_tokens).toBe(15);
    expect(diag.tap[0].usage.total).toBe(12);
    expect(diag.tapSummary.orphan).toBe(1);
    expect(diag.console[0]).toEqual({ level: 'error', text: 'boom' });
    expect(diag.settings.mobileCompatUi).toBe(true);
    expect(diag.env.mobile).toBe(true);
    expect(diag.conversation.extensionKeys).toEqual(['api_usage_stat', 'third-party/foo']);
    expect(diag.extensions[0]).toEqual({ name: 'ST-Memory-Enhanced', version: '4.1.0', type: 'local', enabled: true });
  });

  it('schema 2 允许没有记录到请求（record 为空）', () => {
    const result = normalizeLogUpload(v2Pack({ record: null }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.record).toBe(null);
  });

  it('拒绝未知的 schema 版本', () => {
    expect(normalizeLogUpload(v2Pack({ schema: 3 }), NOW).error).toBe('bad_schema');
    expect(normalizeLogUpload(v2Pack({ schema: '2' }), NOW).ok).toBe(true);
  });

  it('拒绝错误的上报类型与空体', () => {
    expect(normalizeLogUpload(null, NOW).error).toBe('bad_body');
    expect(normalizeLogUpload([], NOW).error).toBe('bad_body');
    expect(normalizeLogUpload(v1Pack({ kind: 'other' }), NOW).error).toBe('bad_kind');
  });

  it('问题类型只保留白名单，其余归 other', () => {
    expect(normalizeLogUpload(v2Pack({ report: { problem: 'wrong-data', note: '' } }), NOW).value.report.problem).toBe('wrong-data');
    expect(normalizeLogUpload(v2Pack({ report: { problem: 'hack', note: '' } }), NOW).value.report.problem).toBe('other');
    const long = 'x'.repeat(MAX_NOTE_CHARS + 50);
    expect(normalizeLogUpload(v2Pack({ report: { problem: 'other', note: long } }), NOW).value.report.note.length).toBe(MAX_NOTE_CHARS);
  });

  it('诊断摘要按上限截断条数', () => {
    const many = (count, make) => Array.from({ length: count }, (_, index) => make(index));
    const result = normalizeLogUpload(
      v2Pack({
        diagnostics: {
          history: many(MAX_DIAG_HISTORY + 4, (i) => ({ timestamp: NOW - i, model: 'm' + i })),
          tap: many(MAX_DIAG_TAP + 5, (i) => ({ at: NOW - i, model: 'm' + i })),
          console: many(MAX_DIAG_CONSOLE + 6, (i) => ({ level: 'error', text: 'e' + i })),
          extensions: many(MAX_DIAG_EXTENSIONS + 7, (i) => ({ name: 'x' + i })),
        },
      }),
      NOW
    );
    expect(result.ok).toBe(true);
    expect(result.value.diagnostics.history.length).toBe(MAX_DIAG_HISTORY);
    expect(result.value.diagnostics.tap.length).toBe(MAX_DIAG_TAP);
    expect(result.value.diagnostics.console.length).toBe(MAX_DIAG_CONSOLE);
    expect(result.value.diagnostics.extensions.length).toBe(MAX_DIAG_EXTENSIONS);
  });

  it('诊断字段缺失时给出稳定的空结构', () => {
    const result = normalizeLogUpload(v2Pack({ diagnostics: undefined, report: undefined }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.report).toBe(null);
    expect(result.value.diagnostics).toBe(null);
    const partial = normalizeLogUpload(v2Pack({ diagnostics: { history: 'nope' } }), NOW);
    expect(partial.value.diagnostics.history).toEqual([]);
    expect(partial.value.diagnostics.tapSummary.total).toBe(0);
    expect(partial.value.diagnostics.settings.mobileCompatUi).toBe(null);
  });

  it('标头只收二元数组、超长截断、条数封顶', () => {
    const headers = Array.from({ length: MAX_HEADER_PAIRS + 10 }, (_, i) => ['h' + i, 'v']);
    headers.push(['bad']);
    headers.push(['', '空名丢弃']);
    headers.push(['long', 'x'.repeat(5000)]);
    const result = normalizeLogUpload(v1Pack({ record: baseRecord({ requestHeaders: headers }) }), NOW);
    const out = result.value.record.requestHeaders;
    expect(out.length).toBe(MAX_HEADER_PAIRS);
    expect(out.every((pair) => Array.isArray(pair) && pair.length === 2)).toBe(true);
  });

  it('usage 只保留数字与一层嵌套数字', () => {
    const result = normalizeLogUpload(
      v1Pack({
        record: baseRecord({
          response: { status: 200, usage: { prompt_tokens: 12, completion_tokens: '3', total_tokens: 15, prompt_tokens_details: { cached_tokens: 8, note: 'x' } } },
        }),
      }),
      NOW
    );
    const usage = result.value.record.response.usage;
    expect(usage.prompt_tokens).toBe(12);
    expect(usage.completion_tokens).toBe(undefined);
    expect(usage.prompt_tokens_details).toEqual({ cached_tokens: 8 });
  });

  it('正文超长截断，method 与 url 缺失判无效', () => {
    const longBody = 'x'.repeat(MAX_RECORD_BODY_CHARS + 1000);
    const result = normalizeLogUpload(v1Pack({ record: baseRecord({ requestBody: longBody }) }), NOW);
    expect(result.value.record.requestBody.length).toBe(MAX_RECORD_BODY_CHARS);
    expect(normalizeLogUpload(v1Pack({ record: baseRecord({ method: '' }) }), NOW).error).toBe('bad_record');
    expect(normalizeLogUpload(v1Pack({ record: baseRecord({ url: '' }) }), NOW).error).toBe('bad_record');
  });
});
