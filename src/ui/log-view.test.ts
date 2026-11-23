import { describe, it, expect } from 'vitest';
import { clipValue, jsonTreeHTML, logBodyHTML, logTimeText, logTopHTML } from './log-view';
import type { RequestLogRecord } from '../services/request-log';

function record(overrides: Partial<RequestLogRecord> = {}): RequestLogRecord {
  return {
    at: new Date(2026, 10, 15, 12, 39, 44).getTime(),
    method: 'POST',
    url: 'https://revnovel.org/v1/chat/completions',
    requestHeaders: [['content-type', 'application/json']],
    requestBody: '{"model":"deepseek-flash/rewrite3-27B","messages":[{"role":"user","content":"hi"}],"stream":true}',
    requestBodyTruncated: false,
    response: {
      status: 200,
      statusText: 'OK',
      headers: [['content-type', 'text/event-stream']],
      firstByteMs: 120,
      durationMs: 900,
      streamed: true,
      model: 'deepseek-flash/rewrite3-27B',
      finishReason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, prompt_tokens_details: { cached_tokens: 4 } },
      error: null,
    },
    ...overrides,
  };
}

describe('log-view：时间与截断', () => {
  it('时间格式为 YYYY-MM-DD HH:mm:ss', () => {
    expect(logTimeText(new Date(2026, 10, 15, 12, 39, 44).getTime())).toBe('2026-11-15 12:39:44');
    expect(logTimeText(0)).toBe('—');
  });

  it('长字符串截断并标注原长度', () => {
    const text = 'a'.repeat(30);
    expect(clipValue(text, 10)).toBe('a'.repeat(10) + '…（共 30 字符）');
    expect(clipValue('short', 10)).toBe('short');
  });
});

describe('log-view：JSON 树', () => {
  it('对象顶层展开、第二层起折叠', () => {
    const html = jsonTreeHTML({ a: 1, b: { c: 2 } });
    expect(html).toContain('aus-log-node');
    expect(html.match(/ open>/g)?.length).toBe(1);
    expect(html).toContain('aus-log-key');
    expect(html).toContain('2 项');
  });

  it('数组标注元素个数，空数组直接平铺', () => {
    expect(jsonTreeHTML({ list: [1, 2, 3] })).toContain('3 项');
    expect(jsonTreeHTML({ list: [] })).toContain('[]');
  });

  it('叶子按类型着色，字符串做 HTML 转义', () => {
    const html = jsonTreeHTML({ s: '<script>x</script>', n: 1, b: true, z: null });
    expect(html).toContain('aus-log-str');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('aus-log-num');
    expect(html).toContain('aus-log-bool');
    expect(html).toContain('aus-log-null');
  });

  it('深层嵌套仍然渲染完整路径', () => {
    const html = jsonTreeHTML({ a: { b: { c: 'deep' } } });
    expect(html).toContain('deep');
    expect((html.match(/aus-log-children/g) || []).length).toBe(3);
  });
});

describe('log-view：顶部工具条', () => {
  it('四枚动作齐全，并带上「其他请求」入口', () => {
    const html = logTopHTML('200 · 1832ms');
    expect(html).toContain('data-log-action="back"');
    expect(html).toContain('data-log-action="upload"');
    expect(html).toContain('data-log-action="tap"');
    expect(html).toContain('其他请求');
    expect(html).toContain('data-log-action="refresh"');
    expect(html).toContain('data-log-action="clear"');
    expect(html).toContain('200 · 1832ms');
  });

  it('返回按钮在动作组内、排在「清空」之后（三页统一贴最右）', () => {
    const html = logTopHTML('200 · 1832ms');
    const actionsStart = html.indexOf('aus-log-actions');
    const clearIdx = html.indexOf('data-log-action="clear"');
    const backIdx = html.indexOf('data-aus-back="1"');
    expect(actionsStart).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(actionsStart);
    expect(backIdx).toBeGreaterThan(clearIdx);
    expect(html).toContain('id="aus-log-back"');
    expect(html).toContain('data-log-action="back"');
  });

  it('摘要文案做 HTML 转义', () => {
    expect(logTopHTML('<script>x</script>')).not.toContain('<script>x</script>');
    expect(logTopHTML('<b>x</b>')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('log-view：页面主体', () => {
  it('没有记录时给出空态说明', () => {
    const html = logBodyHTML(null);
    expect(html).toContain('还没有记录到请求');
    expect(html).toContain('aus-log-empty');
  });

  it('有记录时四块齐全：标头 / 正文 / 用量 / 响应标头', () => {
    const html = logBodyHTML(record());
    expect(html).toContain('请求标头');
    expect(html).toContain('请求正文');
    expect(html).toContain('用量（usage）');
    expect(html).toContain('响应标头');
    expect(html).toContain('POST');
    expect(html).toContain('200 OK');
    expect(html).toContain('is-ok');
    expect(html).toContain('cached_tokens');
    expect(html).toContain('2026-11-15 12:39:44');
  });

  it('非 2xx 与错误文案都展示出来', () => {
    const bad = record({
      response: { ...record().response, status: 500, statusText: 'Internal Server Error', error: '上游断开' },
    });
    const html = logBodyHTML(bad);
    expect(html).toContain('is-bad');
    expect(html).toContain('上游断开');
  });

  it('没有 usage 时说明上游没返回，而不是空白', () => {
    const noUsage = record({ response: { ...record().response, usage: null } });
    expect(logBodyHTML(noUsage)).toContain('上游没有返回 usage');
  });

  it('正文不是 JSON 时退回原文显示', () => {
    const plain = record({ requestBody: 'not a json body' });
    expect(logBodyHTML(plain)).toContain('aus-log-pre');
    expect(logBodyHTML(plain)).toContain('not a json body');
  });
});
