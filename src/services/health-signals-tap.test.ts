import { describe, expect, it } from 'vitest';
import { scanTapHealth } from './health-signals';

/** 造一条「看起来就是正常对话」的孤儿探针记录 */
function tap(over: Record<string, any> = {}): any {
  return {
    id: 'tap:' + Math.random().toString(16).slice(2),
    at: 1000,
    endedAt: 1500,
    url: '/api/backends/chat-completions/generate',
    endpoint: 'chat',
    actorKind: 'tavern',
    actorId: 'main',
    actorLabel: '酒馆主窗',
    stackTop: '',
    attribution: 'tavern',
    model: 'deepseek-v4',
    requestType: 'normal',
    stream: true,
    messageCount: 12,
    promptChars: 900,
    structured: true,
    purposeKey: 'k1',
    purposeLabel: '结构化输出',
    promptHint: '',
    usage: { prompt: 100, completion: 50, total: 150 },
    usageMissing: false,
    durationMs: 1200,
    ttftMs: 200,
    status: 200,
    error: '',
    state: 'orphan',
    settledBy: '',
    settledAt: 0,
    ...over,
  };
}

describe('scanTapHealth 提示文案', () => {
  it('偶发一条孤儿探针不提示', () => {
    expect(scanTapHealth([tap()])).toHaveLength(0);
  });

  it('同簇累计到两次才提示，文案带上用途与发起方', () => {
    const out = scanTapHealth([tap(), tap({ at: 2000 })]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('missing-usage');
    expect(out[0].detail).toContain('2 次');
    expect(out[0].detail).toContain('结构化输出');
    expect(out[0].detail).toContain('酒馆主窗');
    expect(out[0].detail).toContain('12 条消息');
  });

  it('不同发起方的同用途聚簇文案互不相同，用户能分辨', () => {
    const out = scanTapHealth([
      tap(),
      tap({ at: 2000 }),
      tap({ at: 3000, actorKind: 'plugin', actorLabel: 'some-extension', purposeKey: 'k2' }),
      tap({ at: 4000, actorKind: 'plugin', actorLabel: 'some-extension', purposeKey: 'k2' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].detail).not.toBe(out[1].detail);
    expect(out.map((s) => s.detail).join(' ')).toContain('some-extension');
    expect(new Set(out.map((s) => s.signature)).size).toBe(2);
  });
});
