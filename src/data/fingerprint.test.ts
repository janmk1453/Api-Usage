import { describe, expect, it } from 'vitest';
import { usageFingerprint, messageDigest } from './fingerprint';

describe('用量去重指纹', () => {
  it('相同连接保持相同指纹', () => {
    const connection = { endpointId: 'endpoint-a', credentialId: 'secret:a' };
    expect(usageFingerprint('model', 100, 60, 20, 20, connection))
      .toBe(usageFingerprint('model', 100, 60, 20, 20, connection));
  });

  it('不同接入或密钥生成不同指纹', () => {
    const base = usageFingerprint('model', 100, 60, 20, 20, {
      endpointId: 'endpoint-a',
      credentialId: 'secret:a',
    });
    const otherEndpoint = usageFingerprint('model', 100, 60, 20, 20, {
      endpointId: 'endpoint-b',
      credentialId: 'secret:a',
    });
    const otherCredential = usageFingerprint('model', 100, 60, 20, 20, {
      endpointId: 'endpoint-a',
      credentialId: 'secret:b',
    });

    expect(otherEndpoint).not.toBe(base);
    expect(otherCredential).not.toBe(base);
  });

  it('内容摘要：同一份请求体稳定、不同请求体相异，空输入返回空串', () => {
    const body = [{ role: 'system', content: '你是江知弈。' }, { role: 'user', content: '继续。' }];
    expect(messageDigest(body)).toBe(messageDigest(JSON.parse(JSON.stringify(body))));
    expect(messageDigest(body)).not.toBe(messageDigest([{ role: 'user', content: '继续。' }]));
    expect(messageDigest(body)).not.toBe(messageDigest([{ role: 'system', content: '你是江知弈。' }, { role: 'user', content: '别的。' }]));
    // 段间分隔符：["ab","c"] 与 ["a","bc"] 不能撞
    expect(messageDigest([{ role: 'u', content: 'ab' }, { role: 'u', content: 'c' }]))
      .not.toBe(messageDigest([{ role: 'u', content: 'a' }, { role: 'u', content: 'bc' }]));
    // 取不到内容时返回空串，调用方据此跳过内容去重
    expect(messageDigest([])).toBe('');
    expect(messageDigest(null as any)).toBe('');
    expect(messageDigest([{ role: 'user', content: null }])).not.toBe('');
  });

  it('不同请求标识不会因 Token 相同而互相去重', () => {
    const connection = { endpointId: 'endpoint-a', credentialId: 'secret:a' };
    const first = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:1');
    const second = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:2');
    const duplicateStage = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:1');

    expect(first).not.toBe(second);
    expect(first).toBe(duplicateStage);
  });
});
