import { describe, it, expect } from 'vitest';
import {
  SECRET_MASK,
  isSensitiveKey,
  sanitizeBody,
  sanitizeHeaders,
  sanitizeJson,
  sanitizeLogForUpload,
  sanitizeText,
  sanitizeUrl,
} from './log-sanitize';

describe('密钥脱敏', () => {
  it('识别常见敏感头名', () => {
    expect(isSensitiveKey('Authorization')).toBe(true);
    expect(isSensitiveKey('proxy-authorization')).toBe(true);
    expect(isSensitiveKey('X-Api-Key')).toBe(true);
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('accessToken')).toBe(true);
    expect(isSensitiveKey('proxy_password')).toBe(true);
    expect(isSensitiveKey('client_secret')).toBe(true);
    expect(isSensitiveKey('Content-Type')).toBe(false);
    expect(isSensitiveKey('model')).toBe(false);
  });

  it('抹掉文本里的密钥', () => {
    const bearer = sanitizeText('Authorization: Bearer sk-abcdefghijklmnop');
    expect(bearer).not.toContain('abcdefghijklmnop');
    const skText = sanitizeText('key=sk-1234567890abcdef');
    expect(skText).not.toContain('1234567890abcdef');
    const kv = sanitizeText('"api_key": "plainsecret"');
    expect(kv).not.toContain('plainsecret');
    expect(sanitizeText('')).toBe('');
  });

  it('抹掉 URL 查询串里的密钥，保留路径', () => {
    const url = sanitizeUrl('https://api.example.com/v1/chat?token=abcd1234&model=gpt');
    expect(url).toContain('/v1/chat');
    expect(url).not.toContain('abcd1234');
    expect(url).toContain('model=gpt');
    expect(sanitizeUrl('https://api.example.com/v1/chat')).toBe('https://api.example.com/v1/chat');
  });

  it('标头三种输入形态都能洗净', () => {
    const pairs = sanitizeHeaders([
      ['Authorization', 'Bearer secret-token'],
      ['Content-Type', 'application/json'],
      ['cookie', 'session=abc'],
    ]);
    expect(pairs).toEqual([
      ['Authorization', SECRET_MASK],
      ['Content-Type', 'application/json'],
      ['cookie', SECRET_MASK],
    ]);

    const fromObject = sanitizeHeaders({ 'X-Api-Key': 'sk-live-1', Accept: '*/*' });
    expect(fromObject).toEqual([
      ['X-Api-Key', SECRET_MASK],
      ['Accept', '*/*'],
    ]);
  });

  it('JSON 正文递归脱敏，非敏感字段原样保留', () => {
    const body = JSON.stringify({
      model: 'deepseek-flash',
      temperature: 0.7,
      authorization: 'Bearer xyz',
      nested: { api_key: 'sk-1', list: [{ token: 'abc', ok: 1 }] },
    });
    const out = sanitizeBody(body);
    const parsed = JSON.parse(out);
    expect(parsed.model).toBe('deepseek-flash');
    expect(parsed.temperature).toBe(0.7);
    expect(parsed.authorization).toBe(SECRET_MASK);
    expect(parsed.nested.api_key).toBe(SECRET_MASK);
    expect(parsed.nested.list[0].token).toBe(SECRET_MASK);
    expect(parsed.nested.list[0].ok).toBe(1);
  });

  it('非 JSON 正文按文本规则洗', () => {
    const out = sanitizeBody('prefix sk-abcdefghijklmn 后');
    expect(out).not.toContain('abcdefghijklmn');
  });

  it('sanitizeJson 保留结构且不修改原值', () => {
    const input = { a: 1, password: 'p', deep: { b: [1, 'x'] } };
    const out = sanitizeJson(input) as any;
    expect(out.password).toBe(SECRET_MASK);
    expect(out.a).toBe(1);
    expect(out.deep.b).toEqual([1, 'x']);
    expect(input.password).toBe('p');
  });

  it('整条日志清洗：URL、请求头、正文、响应头全部过一遍', () => {
    const record = {
      at: 1,
      method: 'POST',
      url: 'https://api.example.com/v1/chat?token=secret123',
      requestHeaders: [['authorization', 'Bearer abcdef'], ['content-type', 'application/json']],
      requestBody: JSON.stringify({ model: 'm', api_key: 'sk-x' }),
      requestBodyTruncated: false,
      response: {
        status: 200,
        statusText: 'OK',
        headers: [['set-cookie', 'session=1'], ['content-type', 'application/json']],
        usage: { prompt_tokens: 3 },
      },
    };
    const out = sanitizeLogForUpload(record as any) as any;
    expect(out.url).not.toContain('secret123');
    expect(out.requestHeaders[0][1]).toBe(SECRET_MASK);
    expect(out.requestHeaders[1][1]).toBe('application/json');
    expect(out.requestBody).not.toContain('sk-x');
    expect(out.response.headers[0][1]).toBe(SECRET_MASK);
    expect(out.response.usage.prompt_tokens).toBe(3);
    expect(out.method).toBe('POST');
  });
});
