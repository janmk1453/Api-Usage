import { describe, it, expect } from 'vitest';
import { decideTurnOutcome } from './turn-outcome';

const base = { hasUsage: false, usageUsable: false, hasOutput: false, pendingStop: false, streamError: null as string | null };

describe('轮次收尾判定', () => {
  it('上游给了可用用量：正常记录', () => {
    const outcome = decideTurnOutcome({ ...base, hasUsage: true, usageUsable: true, hasOutput: true });
    expect(outcome).toEqual({ kind: 'record', interrupted: null, reason: 'usage' });
  });

  it('有可用用量但用户点了停止：仍记录，标用户中断', () => {
    const outcome = decideTurnOutcome({ ...base, hasUsage: true, usageUsable: true, pendingStop: true });
    expect(outcome.kind).toBe('record');
    expect(outcome.interrupted).toBe('user');
    expect(outcome.reason).toBe('usage-user-interrupted');
  });

  it('有可用用量且流式出错：标上游中断', () => {
    const outcome = decideTurnOutcome({ ...base, hasUsage: true, usageUsable: true, streamError: 'ECONNRESET' });
    expect(outcome.kind).toBe('record');
    expect(outcome.interrupted).toBe('upstream');
    expect(outcome.reason).toBe('usage-upstream-interrupted');
  });

  it('没有任何输出：静默丢弃（用户停止也不例外）', () => {
    expect(decideTurnOutcome({ ...base })).toEqual({ kind: 'drop', interrupted: null, reason: 'no-usage-no-output' });
    expect(decideTurnOutcome({ ...base, pendingStop: true }).kind).toBe('drop');
    expect(decideTurnOutcome({ ...base, streamError: 'AbortError' }).kind).toBe('drop');
    expect(decideTurnOutcome({ ...base, hasUsage: true }).reason).toBe('usage-all-zero-no-output');
  });

  it('有输出但没用量且用户停止：中断 + 估算', () => {
    const outcome = decideTurnOutcome({ ...base, hasOutput: true, pendingStop: true });
    expect(outcome).toEqual({ kind: 'interrupted', interrupted: 'user', reason: 'no-usage-user-stop' });
  });

  it('有输出但没用量且流式出错：上游中断', () => {
    const outcome = decideTurnOutcome({ ...base, hasOutput: true, streamError: 'socket hang up' });
    expect(outcome.kind).toBe('interrupted');
    expect(outcome.interrupted).toBe('upstream');
    expect(outcome.reason).toBe('no-usage-stream-error');
  });

  it('用户停止优先于流式错误', () => {
    const outcome = decideTurnOutcome({ ...base, hasOutput: true, pendingStop: true, streamError: 'AbortError' });
    expect(outcome.interrupted).toBe('user');
  });

  it('有输出、没用量、没中断线索：按估算补记', () => {
    const outcome = decideTurnOutcome({ ...base, hasOutput: true });
    expect(outcome).toEqual({ kind: 'estimate', interrupted: null, reason: 'no-usage-with-output' });
  });

  it('用量存在但不可用（全 0）且有输出：按估算补记', () => {
    const outcome = decideTurnOutcome({ ...base, hasUsage: true, usageUsable: false, hasOutput: true });
    expect(outcome.kind).toBe('estimate');
    expect(outcome.reason).toBe('usage-all-zero-with-output');
  });
});
