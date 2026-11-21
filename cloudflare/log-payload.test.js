import { describe, it, expect } from 'vitest';
import {
  LOG_SCHEMAS,
  MAX_DIAG_CONSOLE,
  MAX_DIAG_EXTENSIONS,
  MAX_DIAG_HISTORY,
  MAX_DIAG_TAP,
  MAX_EVIDENCE_ITEMS,
  MAX_EVIDENCE_TAP,
  MAX_HEADER_PAIRS,
  MAX_NOTE_CHARS,
  MAX_RECENT_TURNS,
  MAX_RECORD_BODY_CHARS,
  MAX_REPORT_TARGETS,
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

/** 一条指向历史记录的反馈目标（扩展 schema 4 的实际形状） */
function targetOf(index) {
  return {
    signalKey: 'missing-usage|gemini-3.8-flash|tap:abc' + index,
    kind: 'missing-usage',
    at: NOW - 60000 - index,
    detail: '有 2 次疑似正常对话的请求没有被记进历史',
    model: 'gemini-3.8-flash',
    reason: 'tap-cluster',
    signature: 'tap:abc' + index,
    requestId: 'req-' + index,
    tapId: 'tap-' + index,
    historyTimestamp: NOW - 90000 - index,
  };
}

function v4Pack(overrides) {
  const targets = [targetOf(0), targetOf(1), targetOf(2)];
  return Object.assign(
    {
      kind: 'aus_request_log',
      schema: 4,
      appVersion: '3.2.2',
      uploadedAt: NOW - 500,
      report: { problem: 'not-recorded', note: '三条都没进历史', scope: 'all', target: null, targets, targetTotal: 3 },
      client: { userAgent: 'UA', timeZone: 'Asia/Shanghai', language: 'zh-CN' },
      record: baseRecord(),
      diagnostics: {
        history: [{ timestamp: NOW - 9000, model: 'gemini-3.8-flash', total_tokens: 15, usageSource: 'estimated', estimateMethod: 'char-heuristic-v1' }],
        tap: [],
        tapSummary: { total: 3, orphan: 3, settled: 0, pending: 0 },
        console: [{ level: 'error', text: 'boom' }],
        extensions: [],
        evidence: {
          scope: 'all',
          targetTotal: 3,
          sampleLimit: MAX_REPORT_TARGETS,
          signal: targets[0],
          request: { requestId: 'req-0', logAt: NOW - 400 },
          history: {
            target: { timestamp: NOW - 90000, model: 'gemini-3.8-flash', total_tokens: 21 },
            before: { timestamp: NOW - 120000, model: 'gemini-3.8-flash', total_tokens: 18 },
            after: null,
          },
          tap: {
            target: { id: 'tap-0', at: NOW - 60000, endpoint: '/api/backends/chat-completions/generate', model: 'gemini-3.8-flash', actorLabel: '酒馆主窗', purposeKey: 'abc', messageCount: 12, promptChars: 900, usageMissing: true },
            cluster: [{ id: 'tap-0', at: NOW - 60000 }, { id: 'tap-1', at: NOW - 61000 }],
          },
          console: [{ at: NOW - 60000, level: 'uncaught', text: 'Uncaught TypeError: x' }],
          items: targets.map((target, index) => ({
            signal: target,
            request: { requestId: target.requestId, logAt: NOW - 400 },
            history: { target: { timestamp: target.historyTimestamp, model: target.model }, before: null, after: null },
            tap: { target: null, cluster: [] },
            console: [{ at: target.at, level: 'error', text: 'e' + index }],
          })),
          recentTurns: [
            { at: NOW - 300000, role: 'user', chars: 120, text: '你好' },
            { at: NOW - 200000, role: 'assistant', chars: 300, text: '' },
          ],
        },
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
    expect(result.value.report).toMatchObject({
      problem: 'not-recorded',
      note: '这一条没进历史',
      scope: 'recent',
      target: null,
      targets: [],
      targetTotal: 0,
    });
    const diag = result.value.diagnostics;
    expect(diag.history.length).toBe(1);
    expect(diag.history[0].total_tokens).toBe(15);
    expect(diag.evidence).toBe(null);
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
    expect(normalizeLogUpload(v2Pack({ schema: 6 }), NOW).error).toBe('bad_schema');
    expect(normalizeLogUpload(v2Pack({ schema: '2' }), NOW).ok).toBe(true);
  });

  it('接受 schema 4 的逐条点名包', () => {
    const result = normalizeLogUpload(v4Pack(), NOW);
    expect(result.ok).toBe(true);
    const report = result.value.report;
    expect(report.scope).toBe('all');
    expect(report.targetTotal).toBe(3);
    expect(report.target).toBe(null);
    expect(report.targets.length).toBe(3);
    expect(report.targets[0]).toMatchObject({ kind: 'missing-usage', model: 'gemini-3.8-flash', tapId: 'tap-0' });
    const evidence = result.value.diagnostics.evidence;
    expect(evidence.scope).toBe('all');
    expect(evidence.items.length).toBe(3);
    expect(evidence.items[1].signal.tapId).toBe('tap-1');
    expect(evidence.items[2].console[0].text).toBe('e2');
    expect(evidence.history.before.total_tokens).toBe(18);
    expect(evidence.history.after).toBe(null);
    expect(evidence.tap.target.usageMissing).toBe(true);
    expect(evidence.tap.cluster.length).toBe(2);
    expect(evidence.recentTurns.length).toBe(2);
    expect(evidence.recentTurns[0].text).toBe('你好');
  });

  it('schema 4 允许没有记录到请求（历史页反馈常见）', () => {
    const result = normalizeLogUpload(v4Pack({ record: null }), NOW);
    expect(result.ok).toBe(true);
    expect(result.value.record).toBe(null);
    expect(result.value.report.targets.length).toBe(3);
  });

  it('未知的信号类型归 other，逐条点名按上限截断但保留总数', () => {
    const many = Array.from({ length: MAX_REPORT_TARGETS + 4 }, (_, index) => targetOf(index));
    const result = normalizeLogUpload(
      v4Pack({
        report: { problem: 'other', note: '', scope: 'all', target: null, targets: many, targetTotal: many.length },
        diagnostics: { evidence: { scope: 'all', targetTotal: many.length, items: many.map((target) => ({ signal: { ...target, kind: 'weird' }, request: {}, history: {}, tap: {}, console: [] })) } },
      }),
      NOW
    );
    const report = result.value.report;
    expect(report.targets.length).toBe(MAX_REPORT_TARGETS);
    expect(report.targetTotal).toBe(many.length);
    expect(report.targets[0].kind).toBe('missing-usage');
    const evidence = result.value.diagnostics.evidence;
    expect(evidence.items.length).toBe(MAX_EVIDENCE_ITEMS);
    expect(evidence.items[0].signal.kind).toBe('other');
    expect(evidence.targetTotal).toBe(many.length);
  });

  it('schema 3 的单条点名仍按一条目标入库', () => {
    const target = targetOf(0);
    const result = normalizeLogUpload(
      v2Pack({
        schema: 3,
        report: { problem: 'wrong-data', note: '', scope: 'single', target, targets: [target], targetTotal: 1 },
        diagnostics: { evidence: { scope: 'single', targetTotal: 1, signal: target, request: { requestId: 'req-0', logAt: NOW - 400 }, history: { target: null, before: null, after: null }, tap: { target: null, cluster: [] }, console: [], items: [{ signal: target, request: {}, history: {}, tap: {}, console: [] }], recentTurns: [] } },
      }),
      NOW
    );
    expect(result.ok).toBe(true);
    expect(result.value.report.scope).toBe('single');
    expect(result.value.report.target.tapId).toBe('tap-0');
    expect(result.value.diagnostics.evidence.items.length).toBe(1);
    expect(result.value.diagnostics.evidence.request.requestId).toBe('req-0');
  });

  it('逐条点名的控制台与探针按上限截断', () => {
    const many = Array.from({ length: MAX_EVIDENCE_TAP + 5 }, (_, index) => ({ id: 'tap-' + index, at: NOW - index }));
    const consoles = Array.from({ length: 30 }, (_, index) => ({ at: NOW - index, level: 'error', text: 'c' + index }));
    const turns = Array.from({ length: MAX_RECENT_TURNS + 3 }, (_, index) => ({ at: NOW - index, role: 'user', chars: index, text: 'x' }));
    const result = normalizeLogUpload(
      v4Pack({
        diagnostics: {
          evidence: {
            scope: 'all',
            targetTotal: 1,
            items: [{ signal: targetOf(0), request: {}, history: {}, tap: { target: null, cluster: many }, console: consoles }],
            recentTurns: turns,
          },
        },
      }),
      NOW
    );
    const evidence = result.value.diagnostics.evidence;
    expect(evidence.items[0].tap.cluster.length).toBe(MAX_EVIDENCE_TAP);
    expect(evidence.items[0].console.length).toBe(20);
    expect(evidence.recentTurns.length).toBe(MAX_RECENT_TURNS);
  });

  it('接受 schema 5：请求证据标 matched、最近几轮带 kind、空串归 null', () => {
    const result = normalizeLogUpload(
      v4Pack({
        schema: 5,
        diagnostics: {
          evidence: {
            scope: 'single',
            targetTotal: 1,
            consoleFallback: true,
            signal: targetOf(0),
            request: { requestId: '', logAt: null, matched: false },
            items: [{ signal: targetOf(0), request: { requestId: '', logAt: null, matched: false }, history: {}, tap: {}, console: [], consoleFallback: true }],
            recentTurns: [
              { at: NOW - 1, role: 'user', kind: 'dialogue', chars: 1, text: 'a' },
              { at: NOW - 2, role: 'user', kind: 'prompt-tail', chars: 1, text: '人称准则' },
            ],
          },
          history: [{ timestamp: NOW, model: 'm', total_tokens: 3, usageSource: '', interrupted: '', estimateMethod: '' }],
          tap: [{ id: 'tap-x', at: NOW, settledBy: '' }],
        },
      }),
      NOW
    );
    expect(result.ok).toBe(true);
    expect(result.value.schema).toBe(5);
    const evidence = result.value.diagnostics.evidence;
    expect(evidence.request.matched).toBe(false);
    expect(evidence.request.logAt).toBe(null);
    expect(evidence.consoleFallback).toBe(true);
    expect(evidence.items[0].consoleFallback).toBe(true);
    expect(evidence.recentTurns.map((row) => row.kind)).toEqual(['dialogue', 'prompt-tail']);
    const historyRow = result.value.diagnostics.history[0];
    expect(historyRow.usageSource).toBe(null);
    expect(historyRow.interrupted).toBe(null);
    expect(historyRow.estimateMethod).toBe(null);
    expect(result.value.diagnostics.tap[0].settledBy).toBe(null);
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

/**
 * 排查关键字段：曾经因为接收端白名单没跟上客户端，rateEstimated / 采集失聪阶段 /
 * 构建号全在上传包里消失，导致「设备明明是新包，却被判成旧包」。
 */
describe('诊断摘要保留排查关键字段', () => {
  it('历史行保留 rateEstimated，枚举外的值归 null', () => {
    const pack = v2Pack({
      diagnostics: {
        history: [
          { timestamp: NOW - 9000, model: 'm', rateEstimated: 'prefill' },
          { timestamp: NOW - 8000, model: 'm', rateEstimated: 'duration' },
          { timestamp: NOW - 7000, model: 'm', rateEstimated: 'guess' },
        ],
      },
    });
    const rows = normalizeLogUpload(pack, NOW).value.diagnostics.history;
    expect(rows.map((row) => row.rateEstimated)).toEqual(['prefill', 'duration', null]);
  });

  it('采集快照保留 turn-unmatched 与 install-failed，未知阶段丢弃', () => {
    const pack = v2Pack({
      diagnostics: {
        capture: [
          { at: NOW - 3000, stage: 'turn-unmatched', model: 'm', reason: 'turn-unmatched' },
          { at: NOW - 2000, stage: 'install-failed', model: '', reason: 'depth-limit:7' },
          { at: NOW - 1000, stage: 'unknown-stage', model: 'm' },
        ],
      },
    });
    const rows = normalizeLogUpload(pack, NOW).value.diagnostics.capture;
    expect(rows.map((row) => row.stage)).toEqual(['turn-unmatched', 'install-failed']);
    expect(rows[1].reason).toBe('depth-limit:7');
  });

  it('设置摘要保留构建号与构建标签', () => {
    const pack = v2Pack({
      diagnostics: { settings: { appVersion: '3.2.3', buildNo: '2', buildTag: '3.2.3|2' } },
    });
    const settings = normalizeLogUpload(pack, NOW).value.diagnostics.settings;
    expect(settings.buildNo).toBe('2');
    expect(settings.buildTag).toBe('3.2.3|2');
  });
});
