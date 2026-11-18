import { describe, expect, it } from 'vitest';
import { isTruncatedFinish, isTruncatedOf, isUserStoppedFinish } from './finish';

describe('finish_reason 截断判定', () => {
  it('正常结束不算截断', () => {
    for (const fr of ['stop', 'STOP', 'eos', 'end_turn', 'stop_sequence', 'tool_calls', 'function_call', 'tool_use', null, undefined, '']) {
      expect(isTruncatedFinish(fr as any)).toBe(false);
    }
  });

  it('达上限或异常结束算截断', () => {
    for (const fr of ['length', 'MAX_TOKENS', 'sensitive', 'content_filter', 'interrupted', 'network_error']) {
      expect(isTruncatedFinish(fr)).toBe(true);
    }
  });
});

describe('记录级截断判定（isTruncatedOf）', () => {
  it('用户手动停止一律不算截断', () => {
    expect(isUserStoppedFinish({ interrupted: 'user' })).toBe(true);
    // 即使用户停止时上游给了 length、或历史里已写入 isTruncated=true，也不计入
    expect(isTruncatedOf({ interrupted: 'user', finishReason: 'length', isTruncated: true })).toBe(false);
    expect(isTruncatedOf({ interrupted: 'user', finishReason: 'interrupted', isTruncated: true })).toBe(false);
  });

  it('上游中断仍然算截断', () => {
    expect(isTruncatedOf({ interrupted: 'upstream', finishReason: 'interrupted', isTruncated: true })).toBe(true);
    expect(isTruncatedOf({ interrupted: null, finishReason: 'length' })).toBe(true);
  });

  it('正常结束不算截断', () => {
    expect(isTruncatedOf({ interrupted: null, finishReason: 'stop', isTruncated: false })).toBe(false);
  });

  it('空值安全', () => {
    expect(isTruncatedOf(null)).toBe(false);
    expect(isTruncatedOf(undefined)).toBe(false);
    expect(isTruncatedOf({})).toBe(false);
  });
});
