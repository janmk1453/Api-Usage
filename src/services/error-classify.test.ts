import { describe, it, expect } from 'vitest';
import { classifyErrorText, errorSignature, normalizeErrorText } from './error-classify';

/** 真机原始文本（反馈包 signalKey plugin-error|8bd68160|8bd68160 对应的控制台条目）：别的扩展发起、穿我们 fetch 透传层失败 */
const PASSTHROUGH_STACK = [
  'TypeError: Failed to fetch',
  '    at patched (http://127.0.0.1:3512/scripts/extensions/third-party/Api-Usage/interception-BHW4SG4V.js:1258:20)',
  '    at window.fetch (http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:74:145210)',
  '    at EX (http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:761:4278)',
  '    at DX (http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:761:4548)',
  '    at http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:864:19268',
].join('\n');

describe('classifyErrorText 网络透传判定', () => {
  it('外部扩展的请求失败从 fetch 透传层穿过时判 minor，不记「本扩展代码」', () => {
    const c = classifyErrorText(PASSTHROUGH_STACK);
    expect(c.severity).toBe('minor');
    expect(c.label).toBe('网络请求（透传）');
    expect(c.signature).toMatch(/^[0-9a-f]{8}$/);
  });

  it('栈里出现本扩展业务帧时不降级（真功能报错仍要提示）', () => {
    const text = PASSTHROUGH_STACK + '\n    at addEntry (http://127.0.0.1:3512/scripts/extensions/third-party/Api-Usage/repository-GlOd_EFe.js:1094:15)';
    const c = classifyErrorText(text);
    expect(c.severity).toBe('major');
    expect(c.label).toBe('本扩展代码');
  });

  it('入库链路自己抛错照旧判 major', () => {
    const text = "TypeError: Cannot read properties of undefined (reading 'length')\n    at addEntry (repository-GlOd_EFe.js:1024:9)";
    const c = classifyErrorText(text);
    expect(c.severity).toBe('major');
    expect(c.label).toBe('本扩展核心链路');
  });

  it('本扩展全局名与存储名仍是最强证据', () => {
    expect(classifyErrorText('ApiUsageStat addEntry failed').label).toBe('本扩展代码');
    expect(classifyErrorText('ApiUsageStat addEntry failed').severity).toBe('major');
    expect(classifyErrorText('AusPanel not ready: api-usage-stat').severity).toBe('major');
  });

  it('与本扩展无关的纯网络错误仍是 minor（走通用网络规则）', () => {
    const c = classifyErrorText('TypeError: Failed to fetch\n    at EX (http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:761:4278)');
    expect(c.severity).toBe('minor');
    expect(c.label).toBe('网络请求');
  });

  it('普通未归因错误保持 minor，空输入不产生签名', () => {
    expect(classifyErrorText('ReferenceError: registerMvuSchema is not defined').severity).toBe('minor');
    expect(classifyErrorText('ReferenceError: registerMvuSchema is not defined').label).toBe('未归因');
    const empty = classifyErrorText('');
    expect(empty).toEqual({ severity: 'minor', signature: '', label: '空错误' });
  });

  it('Error 对象与字符串走同一判定', () => {
    const err = new Error('Failed to fetch');
    const c = classifyErrorText(err);
    expect(c.label).toBe('网络请求');
    expect(c.signature).toBe(errorSignature('Error: Failed to fetch'));
  });
});

describe('normalizeErrorText', () => {
  it('折叠空白、数字与十六进制，保留语义片段', () => {
    expect(normalizeErrorText('TypeError:  x\n\n  at 1 (0xab12)')).toBe('TypeError: x at # (0x#)');
  });

  it('超长文本截到 300 字符，保证签名稳定', () => {
    expect(normalizeErrorText('a'.repeat(400))).toHaveLength(300);
  });
});
