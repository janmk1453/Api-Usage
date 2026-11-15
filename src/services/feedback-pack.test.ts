import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../store';
import { clearTapRecords, upsertTapRecord } from './request-tap/store';
import { clearConsoleRing, noteConsole } from './console-ring';
import type { TapRecord } from './request-tap/types';
import {
  FEEDBACK_NOTE_LIMIT,
  FEEDBACK_SCHEMA,
  buildFeedbackPack,
  consoleDigest,
  conversationDigest,
  envDigest,
  extensionDigest,
  historyDigest,
  isFeedbackProblem,
  settingsDigest,
  tapDigest,
  tapSummary,
} from './feedback-pack';

function makeTap(id: string, overrides: Partial<TapRecord> = {}): TapRecord {
  return Object.assign(
    {
      id,
      at: 1794700000000,
      endedAt: 1794700001200,
      url: 'https://api.example.com/v1/chat/completions',
      endpoint: 'chat',
      actorKind: 'plugin',
      actorId: 'scripts/extensions/third-party/mvu',
      actorLabel: 'mvu',
      stackTop: 'capture.ts:120',
      attribution: 'A',
      model: 'deepseek-flash',
      requestType: 'normal',
      stream: true,
      messageCount: 12,
      promptChars: 2048,
      structured: false,
      purposeKey: 'fp1',
      purposeLabel: '摘要 / 记忆',
      promptHint: '请总结以下内容',
      usage: { prompt: 100, completion: 20, total: 120, hit: 0, miss: 100 },
      usageMissing: false,
      durationMs: 1200,
      ttftMs: 400,
      status: 200,
      error: null,
      state: 'orphan',
      settledBy: null,
      settledAt: null,
    } as TapRecord,
    overrides
  );
}

describe('反馈诊断包', () => {
  beforeEach(() => {
    state.history = [];
    clearTapRecords();
    clearConsoleRing();
  });

  afterEach(() => {
    clearTapRecords();
    clearConsoleRing();
    delete (globalThis as any).SillyTavern;
    vi.restoreAllMocks();
  });

  it('历史摘要按时间倒序取最近 N 条，且不含消息正文', () => {
    state.history = Array.from({ length: 14 }, (_, index) => ({
      timestamp: 1000 + index,
      model: 'm' + index,
      prompt_tokens: index,
      completion_tokens: 1,
      total_tokens: index + 1,
      cache_hit_tokens: 0,
      cost: 0.01,
      sourceType: 'chat',
      endpointLabel: 'DeepSeek 官方',
      credentialLabel: 'k',
      chatId: 'c' + index,
      messages: [{ role: 'user', content: '不该被上传的聊天正文' }],
    })) as any;
    const digest = historyDigest();
    expect(digest.length).toBe(10);
    expect(digest[0].timestamp).toBe(1013);
    expect(digest[9].timestamp).toBe(1004);
    expect(JSON.stringify(digest)).not.toContain('不该被上传的聊天正文');
    expect(digest[0].model).toBe('m13');
  });

  it('探针摘要与对账计数', () => {
    upsertTapRecord(makeTap('tap:1', { state: 'orphan', at: 1000 }));
    upsertTapRecord(makeTap('tap:2', { state: 'settled', settledBy: 'tokens', at: 2000 }));
    upsertTapRecord(makeTap('tap:3', { state: 'pending', at: 3000 }));
    const digest = tapDigest();
    expect(digest.length).toBe(3);
    expect(digest[0].at).toBe(3000);
    expect(digest[0].usage).toEqual({ prompt: 100, completion: 20, total: 120, hit: 0, miss: 100 });
    const summary = tapSummary();
    expect(summary.total).toBe(3);
    expect(summary.orphan).toBe(1);
    expect(summary.settled).toBe(1);
    expect(summary.pending).toBe(1);
  });

  it('控制台摘要脱敏且有条数上限', () => {
    noteConsole('error', ['Authorization: Bearer sk-live-abcdefghijkl'], 1000);
    noteConsole('warn', ['普通警告'], 2000);
    const digest = consoleDigest();
    expect(digest.length).toBe(2);
    expect(String(digest[0].text)).not.toContain('sk-live-abcdefghijkl');
    expect(digest[1].level).toBe('warn');
    expect(consoleDigest(1).length).toBe(1);
  });

  it('环境与会话摘要只取名字类信息', () => {
    (globalThis as any).SillyTavern = {
      getContext: () => ({
        chatId: 'chat-1',
        name2: '时停',
        version: { pkgVersion: '1.19.0' },
        extensionSettings: { api_usage_stat: {}, 'third-party/foo': {} },
      }),
    };
    const conversation = conversationDigest();
    expect(conversation.chatId).toBe('chat-1');
    expect(conversation.character).toBe('时停');
    expect(conversation.stVersion).toBe('1.19.0');
    expect(conversation.extensionKeys).toEqual(['api_usage_stat', 'third-party/foo']);

    const env = envDigest();
    expect(typeof env.timeZone).toBe('string');
    expect(typeof env.mobile).toBe('boolean');
  });

  it('会话信息缺失时不抛错', () => {
    const conversation = conversationDigest();
    expect(conversation.chatId).toBe('');
    expect(conversation.extensionKeys).toEqual([]);
  });

  it('扩展清单支持字符串数组与对象数组，失败时返回空', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ['ext-a', { name: 'ext-b', version: '1.0.0' }] }));
    (globalThis as any).fetch = fetchMock;
    const rows = await extensionDigest(500);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ name: 'ext-a', version: '', type: '' });
    expect(rows[1]).toMatchObject({ name: 'ext-b', version: '1.0.0' });

    (globalThis as any).fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(await extensionDigest(200)).toEqual([]);
  });

  it('组装诊断包：脱敏、结构齐全、问题类型兜底', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false, json: async () => [] }));
    state.history = [{ timestamp: 5, model: 'deepseek-flash', total_tokens: 9 }] as any;
    upsertTapRecord(makeTap('tap:9'));

    (globalThis as any).__APP_VERSION__ = '3.2.1';
    const pack = await buildFeedbackPack({
      problem: 'not-recorded',
      note: 'x'.repeat(FEEDBACK_NOTE_LIMIT + 20),
      appVersion: '3.2.1',
      now: 1794719000000,
      record: {
        at: 1794718999000,
        method: 'POST',
        url: 'https://api.example.com/v1/chat?token=secret123',
        requestHeaders: [['authorization', 'Bearer abcdefgh'], ['content-type', 'application/json']],
        requestBody: '{"model":"deepseek-flash","api_key":"sk-live-1"}',
        requestBodyTruncated: false,
        response: { status: 200, statusText: 'OK', headers: [['set-cookie', 'a=1']], durationMs: 900 },
      } as any,
    });

    expect(pack.kind).toBe('aus_request_log');
    expect(pack.schema).toBe(FEEDBACK_SCHEMA);
    expect(pack.appVersion).toBe('3.2.1');
    expect(pack.uploadedAt).toBe(1794719000000);
    expect(pack.report.problem).toBe('not-recorded');
    expect(pack.report.note.length).toBe(FEEDBACK_NOTE_LIMIT);
    const record = pack.record as any;
    expect(record.url).not.toContain('secret123');
    expect(record.requestHeaders[0][1]).toBe('***');
    expect(record.requestBody).not.toContain('sk-live-1');
    expect(record.response.status).toBe(200);

    const diagnostics = pack.diagnostics as any;
    expect(diagnostics.history.length).toBe(1);
    expect(diagnostics.tap.length).toBe(1);
    expect(diagnostics.tapSummary.total).toBe(1);
    expect(Array.isArray(diagnostics.console)).toBe(true);
    expect(diagnostics.settings.appVersion).toBe('3.2.1');
    expect(diagnostics.conversation).toBeTruthy();
    expect(Array.isArray(diagnostics.extensions)).toBe(true);
    expect(JSON.stringify(pack)).not.toContain('Bearer abcdefgh');
  });

  it('没有问题类型时归 other，没有日志时 record 为空', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ ok: false }));
    const pack = await buildFeedbackPack({ problem: 'weird' as any, now: 1 });
    expect(pack.report.problem).toBe('other');
    expect(pack.record).toBe(null);
    expect(isFeedbackProblem('wrong-data')).toBe(true);
    expect(isFeedbackProblem('nope')).toBe(false);
  });

  it('设置摘要给出定位问题的关键项', () => {
    const digest = settingsDigest();
    expect(typeof digest.appVersion).toBe('string');
    expect(typeof digest.historyCount).toBe('number');
    expect(typeof digest.walletCount).toBe('number');
  });
});
