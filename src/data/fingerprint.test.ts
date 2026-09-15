import { describe, expect, it } from 'vitest';
import { usageFingerprint } from './fingerprint';

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

  it('不同请求标识不会因 Token 相同而互相去重', () => {
    const connection = { endpointId: 'endpoint-a', credentialId: 'secret:a' };
    const first = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:1');
    const second = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:2');
    const duplicateStage = usageFingerprint('model', 100, 60, 20, 20, connection, 'req:1');

    expect(first).not.toBe(second);
    expect(first).toBe(duplicateStage);
  });
});
