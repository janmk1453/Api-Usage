import { describe, it, expect, beforeEach } from 'vitest';
import {
  LOG_BODY_LIMIT,
  LOG_STORAGE_KEY,
  clipBody,
  clearRequestLog,
  headersToPairs,
  patchRequestLog,
  readRequestLog,
  redactHeader,
  redactValue,
  noteRecentTurns,
  readRecentTurns,
  saveRequestStart,
  summarizeRequestLog,
} from './request-log';

function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  return store;
}

describe('request-log：只保留最后一轮', () => {
  let store: Map<string, string>;
  beforeEach(() => { store = installStorage(); });

  it('请求开始即整体覆盖上一条记录，响应字段回到空态', () => {
    saveRequestStart({ at: 1, method: 'post', url: 'https://a/v1/generate', headers: { a: '1' }, body: '{"m":1}' });
    patchRequestLog({ status: 200, durationMs: 25, usage: { total_tokens: 9 } });
    saveRequestStart({ at: 2, method: 'POST', url: 'https://a/v1/generate', headers: { a: '2' }, body: '{"m":2}' });
    const rec = readRequestLog()!;
    expect(rec.at).toBe(2);
    expect(rec.requestBody).toBe('{"m":2}');
    expect(rec.response.status).toBe(0);
    expect(rec.response.usage).toBeNull();
    expect(rec.response.durationMs).toBeNull();
    // 仍然只有一条记录
    expect(store.size).toBe(1);
    expect(store.has(LOG_STORAGE_KEY)).toBe(true);
  });

  it('响应字段分次合并，互不覆盖', () => {
    saveRequestStart({ at: 1, url: 'u', body: '{}' });
    patchRequestLog({ status: 200, statusText: 'OK', firstByteMs: 40 });
    patchRequestLog({ model: 'deepseek-flash', finishReason: 'stop', usage: { total_tokens: 11 } });
    patchRequestLog({ durationMs: 500, streamed: true });
    const r = readRequestLog()!.response;
    expect(r.status).toBe(200);
    expect(r.statusText).toBe('OK');
    expect(r.firstByteMs).toBe(40);
    expect(r.model).toBe('deepseek-flash');
    expect(r.finishReason).toBe('stop');
    expect(r.usage).toEqual({ total_tokens: 11 });
    expect(r.durationMs).toBe(500);
    expect(r.streamed).toBe(true);
  });

  it('失败请求也留下记录，错误文案单独存放', () => {
    saveRequestStart({ at: 1, url: 'u', body: '' });
    patchRequestLog({ error: 'Failed to fetch' });
    const r = readRequestLog()!.response;
    expect(r.error).toBe('Failed to fetch');
    expect(r.status).toBe(0);
  });

  it('清空后读不到记录', () => {
    saveRequestStart({ at: 1, url: 'u', body: 'x' });
    clearRequestLog();
    expect(readRequestLog()).toBeNull();
    expect(summarizeRequestLog(null)).toBe('暂无记录');
  });

  it('坏数据不抛错，按空记录处理', () => {
    (globalThis as any).localStorage.setItem(LOG_STORAGE_KEY, '{not json');
    expect(readRequestLog()).toBeNull();
  });
});

describe('request-log：隐私与截断', () => {
  beforeEach(() => { installStorage(); });

  it('Authorization / x-api-key / cookie 打码且保留可辨识首尾', () => {
    const secret = 'sk-1234567890abcdefghijklmn';
    const masked = redactValue(secret);
    expect(masked).not.toContain('1234567890abcdefgh');
    expect(masked.startsWith('sk-123')).toBe(true);
    expect(masked.endsWith('klmn')).toBe(true);
    expect(redactHeader('Authorization', 'Bearer abcdefghijklmnopqrst')).toMatch(/^Bearer /);
    expect(redactHeader('x-api-key', secret)).not.toBe(secret);
    // 酒馆的 CSRF 令牌等同于会话凭证，页面上也不该明文出现
    expect(redactHeader('X-CSRF-Token', 'ed5ebebb993f0b08e6c8caedf9291e31e4b1d571')).not.toContain('ed5ebebb993f0b08');
    expect(redactHeader('Content-Type', 'application/json')).toBe('application/json');
  });

  it('headers 支持数组 / 普通对象 / Headers 三种形态并排序', () => {
    const pairs = headersToPairs({ b: '2', a: '1' });
    expect(pairs.map((p) => p[0])).toEqual(['a', 'b']);
    expect(headersToPairs([['x', 'y']])).toEqual([['x', 'y']]);
    const headers = new Headers();
    headers.set('Zeta', 'z');
    headers.set('alpha', 'a');
    const normalized = headersToPairs(headers);
    expect(normalized[0][0].toLowerCase()).toBe('alpha');
  });

  it('正文超限被截断并标记', () => {
    const big = 'x'.repeat(LOG_BODY_LIMIT + 10);
    expect(clipBody(big).truncated).toBe(true);
    expect(clipBody(big).body.length).toBe(LOG_BODY_LIMIT);
    saveRequestStart({ at: 1, url: 'u', body: big });
    expect(readRequestLog()!.requestBodyTruncated).toBe(true);
    expect(clipBody('short')).toEqual({ body: 'short', truncated: false });
  });

  it('最近三轮按对白成对取，尾部注入的提示词不占位', () => {
    const messages = [
      { role: 'user', content: '第一问' },
      { role: 'assistant', content: '第一答' },
      { role: 'user', content: '第二问' },
      { role: 'assistant', content: '第二答' },
      { role: 'user', content: '人称准则' },
      { role: 'user', content: '字数准则' },
      { role: 'user', content: '输出模板' },
    ];
    noteRecentTurns(messages, 777);
    const rows = readRecentTurns();
    expect(rows.map((r) => r.text)).toEqual(['第一问', '第一答', '第二问', '第二答']);
    expect(rows.every((r) => r.kind === 'dialogue')).toBe(true);
    expect(rows[0].at).toBe(777);
  });

  it('一条 assistant 都没有时只留最后一条 user，并标 prompt-tail', () => {
    noteRecentTurns([{ role: 'user', content: '早期提示' }, { role: 'user', content: '尾部提示' }], 888);
    const rows = readRecentTurns();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: 'user', text: '尾部提示', kind: 'prompt-tail' });
  });

  it('摘要按状态与耗时生成一行文案', () => {
    saveRequestStart({ at: 1, url: 'u', body: '' });
    expect(summarizeRequestLog(readRequestLog())).toBe('请求已发出，等待响应');
    patchRequestLog({ status: 200, durationMs: 321 });
    expect(summarizeRequestLog(readRequestLog())).toBe('200 · 321ms');
  });
});
