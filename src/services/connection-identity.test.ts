import { describe, expect, it } from 'vitest';
import {
  buildConnectionContext,
  buildEndpointContext,
  normalizeEndpoint,
} from './connection-identity';

const secretKeys = {
  DEEPSEEK: 'api_key_deepseek',
  CUSTOM: 'api_key_custom',
};

const secretState = {
  api_key_deepseek: [
    { id: 'deepseek-old', label: '备用密钥', value: '*********old', active: false },
    { id: 'deepseek-active', label: '官方主密钥', value: '*********abc', active: true },
  ],
  api_key_custom: [
    { id: 'custom-active', label: '中转密钥', value: '*********xyz', active: true },
  ],
};

describe('连接身份', () => {
  it('接入来源只按协议与主机归一化，忽略路径和查询参数', () => {
    const first = normalizeEndpoint('https://OpenCode.AI:443/zen/go/v1/?b=2&a=1');
    const second = normalizeEndpoint('https://opencode.ai/zen/go/v1?a=1&b=2');
    const different = normalizeEndpoint('https://opencode.ai/zen/go/v2');
    const bare = normalizeEndpoint('youzi.today');
    const versioned = normalizeEndpoint('youzi.today/v1');
    const arbitraryPath = normalizeEndpoint('youzi.today/ababa');

    expect(first).toEqual({
      canonical: 'https://opencode.ai',
      label: 'opencode.ai',
    });
    expect(second?.canonical).toBe(first?.canonical);
    expect(different?.canonical).toBe(first?.canonical);
    expect(versioned?.canonical).toBe(bare?.canonical);
    expect(arbitraryPath?.canonical).toBe(bare?.canonical);
  });

  it('官方接口使用明确名称，自定义接口识别域名与路径', () => {
    const official = buildEndpointContext({ chat_completion_source: 'deepseek' });
    const officialCustomUrl = buildEndpointContext({
      chat_completion_source: 'custom',
      custom_url: 'https://api.deepseek.com/v1/',
    });
    const officialReverseProxy = buildEndpointContext({
      chat_completion_source: 'custom',
      reverse_proxy: 'https://api.deepseek.com/v1',
    });
    const custom = buildEndpointContext({
      chat_completion_source: 'custom',
      custom_url: 'https://opencode.ai/zen/go/v1/',
    });

    expect(official.endpointLabel).toBe('DeepSeek 官方');
    expect(official.endpointId).toBeTruthy();
    expect(officialCustomUrl.endpointId).toBe(official.endpointId);
    expect(officialCustomUrl.endpointLabel).toBe('DeepSeek 官方');
    expect(officialReverseProxy.endpointId).toBe(official.endpointId);
    expect(officialReverseProxy.endpointLabel).toBe('DeepSeek 官方');
    expect(custom.endpointLabel).toBe('opencode.ai');
    expect(custom.endpointId).not.toBe(official.endpointId);
  });

  it('优先使用请求中的密钥编号，否则快照活动条目', () => {
    const exact = buildConnectionContext({
      chat_completion_source: 'deepseek',
      secret_id: 'deepseek-old',
    }, secretState, secretKeys);
    const active = buildConnectionContext({
      chat_completion_source: 'deepseek',
    }, secretState, secretKeys);

    expect(exact).toMatchObject({
      credentialId: 'secret:api_key_deepseek:deepseek-old',
      credentialLabel: '备用密钥 •••old',
    });
    expect(active).toMatchObject({
      credentialId: 'secret:api_key_deepseek:deepseek-active',
      credentialLabel: '官方主密钥 •••abc',
    });
  });

  it('严格隐私模式忽略反向代理密码', () => {
    const rawSecret = 'sk-live-never-store';
    const context = buildConnectionContext({
      chat_completion_source: 'deepseek',
      reverse_proxy: 'https://relay.example/v1',
      proxy_password: rawSecret,
      custom_include_headers: `Authorization: Bearer ${rawSecret}`,
    }, secretState, secretKeys);

    expect(context.endpointLabel).toBe('relay.example');
    expect(context.credentialId).toBeNull();
    expect(context.credentialLabel).toBeNull();
    expect(JSON.stringify(context)).not.toContain(rawSecret);
  });

  it('旧版布尔密钥状态不伪造密钥身份', () => {
    const context = buildConnectionContext({
      chat_completion_source: 'deepseek',
    }, { api_key_deepseek: true }, secretKeys);

    expect(context.credentialId).toBeNull();
    expect(context.credentialLabel).toBeNull();
  });
});
