import { describe, it, expect } from 'vitest';
import { API_ERROR_MAX_CHARS, apiErrorPayloadTag, detectApiErrorPayload } from './api-error-payload';

/** 真机样本：TauriTavern 把上游 500 包成 HTTP 200 + SSE，正文只有这段客户端拼的文案 */
const TT_500 = '[API 错误]\nCustom OpenAI endpoint failed with status 500: 服务处理请求时发生错误，请稍后重试。 (request id: 2026112313000000000000000000)';

describe('上游错误文案识别', () => {
  it('认出 TauriTavern 的 endpoint failed 模板，并带长度', () => {
    const hit = detectApiErrorPayload(TT_500);
    // 真机样本带界面标题，按标题锚点记（更稳，不依赖 provider 名）
    expect(hit?.marker).toBe('tavern-api-error-title');
    expect(hit?.chars).toBe(TT_500.trim().length);
    // 没有标题时靠 endpoint 模板也能认
    expect(detectApiErrorPayload(TT_500.split('\n')[1])?.marker).toBe('tauritavern-endpoint-status');
  });

  it('只有模板句、没有界面标题也认', () => {
    const hit = detectApiErrorPayload('Custom OpenAI endpoint failed with status 503: upstream unavailable');
    expect(hit?.marker).toBe('tauritavern-endpoint-status');
  });

  it('酒馆界面标题前缀（中英文）作为补充锚点', () => {
    expect(detectApiErrorPayload('[API 错误] 400 请求体不合法')?.marker).toBe('tavern-api-error-title');
    expect(detectApiErrorPayload('[API Error] invalid api key')?.marker).toBe('tavern-api-error-title');
  });

  it('整段透传的上游错误 JSON 也认', () => {
    const hit = detectApiErrorPayload('{"error":{"message":"rate limit exceeded","type":"rate_limit"}}');
    expect(hit?.marker).toBe('upstream-error-json');
  });

  it('短回复里引用同样的字样不算错误（必须落在行首）', () => {
    // 用户让模型解释这条报错时，正常回复里会出现一模一样的句子
    const reply = '这个 500 是 Custom OpenAI endpoint failed with status 500 引起的，先看中转日志。';
    expect(reply.length).toBeLessThan(API_ERROR_MAX_CHARS);
    expect(detectApiErrorPayload(reply)).toBeNull();
  });

  it('长回复里讨论同样的字样不算错误（长度上限挡住）', () => {
    const long = '这个报错通常是 Custom OpenAI endpoint failed with status 500 引起的，' + '排查一下中转配置。'.repeat(200);
    expect(long.length).toBeGreaterThan(API_ERROR_MAX_CHARS);
    expect(detectApiErrorPayload(long)).toBeNull();
  });

  it('空值 / 普通回复 / 超长模板句一律不认', () => {
    expect(detectApiErrorPayload('')).toBeNull();
    expect(detectApiErrorPayload(null)).toBeNull();
    expect(detectApiErrorPayload(undefined)).toBeNull();
    expect(detectApiErrorPayload('这是一段正常的模型回复。')).toBeNull();
    expect(detectApiErrorPayload('endpoint failed with status ' + '5'.repeat(API_ERROR_MAX_CHARS))).toBeNull();
  });

  it('诊断串带锚点与字符数，便于按锚点统计', () => {
    expect(apiErrorPayloadTag(null)).toBeNull();
    expect(apiErrorPayloadTag({ marker: 'tauritavern-endpoint-status', chars: 128 })).toBe('tauritavern-endpoint-status:128');
  });
});
