import { describe, expect, it } from 'vitest';
import { decryptKey, encryptKey, maskApiKey } from './crypto';

describe('密钥加密工具', () => {
  it('支持中文和 Emoji 往返', () => {
    const plaintext = 'sk-中文密钥-🔐-test';
    const encrypted = encryptKey(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptKey(encrypted)).toBe(plaintext);
  });

  it('空值保持空字符串', () => {
    expect(encryptKey('')).toBe('');
    expect(decryptKey('')).toBe('');
  });

  it('无效密文按原值回退', () => {
    expect(decryptKey('not-base64!')).toBe('not-base64!');
  });

  it('密钥掩码只保留末四位', () => {
    expect(maskApiKey('short')).toBe('****');
    expect(maskApiKey('sk-abcdef123456')).toBe('****3456');
  });
});
