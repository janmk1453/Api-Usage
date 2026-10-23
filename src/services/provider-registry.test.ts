import { describe, expect, it } from 'vitest';
import { resolveVendor, vendorFromHost, vendorInitialFallback } from './provider-registry';

describe('vendorFromHost', () => {
  it('子域命中主域', () => {
    expect(vendorFromHost('api.deepseek.com')?.id).toBe('deepseek');
    expect(vendorFromHost('https://api.moonshot.cn/v1')?.id).toBe('moonshot');
    expect(vendorFromHost('open.bigmodel.cn')?.id).toBe('zhipu');
  });

  it('仿冒域名不误判', () => {
    expect(vendorFromHost('api-deepseek.com.evil.net')).toBeNull();
    expect(vendorFromHost('notdeepseek.com')).toBeNull();
    expect(vendorFromHost('deepseek.com.evil.net')).toBeNull();
  });
});

describe('resolveVendor', () => {
  it('按接入地址优先', () => {
    expect(resolveVendor({ endpointDisplay: 'api.anthropic.com', sourceType: 'openai' })?.id).toBe('anthropic');
  });

  it('地址无法识别时按接入类型', () => {
    expect(resolveVendor({ endpointDisplay: 'relay.example.com', sourceType: 'claude' })?.id).toBe('anthropic');
  });

  it('都识别不到时按模型名前缀（过半命中）', () => {
    expect(resolveVendor({ sourceType: 'custom', models: ['claude-sonnet-4-5', 'claude-haiku-4-5'] })?.id).toBe('anthropic');
    // 混合族时取多数族
    expect(resolveVendor({ sourceType: 'custom', models: ['claude-sonnet-4-5', 'gpt-4o', 'gpt-4o-mini'] })?.id).toBe('openai');
  });
});

describe('vendorInitialFallback', () => {
  it('剥离协议与 api/www 前缀', () => {
    expect(vendorInitialFallback('https://api.example-relay.com')).toBe('E');
    expect(vendorInitialFallback('')).toBe('?');
  });
});
