import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildHealthReport,
  healthSignalKey,
  healthTargetOf,
  healthSummaryText,
  scanCaptureHealth,
  scanConsoleHealth,
  scanHistoryHealth,
  RATE_ANOMALY_HIGH,
  RATE_ANOMALY_LOW,
  HEALTH_DEDUPE_MS,
} from './health-signals';
import { noteCaptureStage, clearCaptureStages } from './capture-digest';
import { noteConsole, clearConsoleRing } from './console-ring';

function entry(over: Record<string, any> = {}): any {
  return {
    timestamp: 1794719000000,
    model: 'deepseek-flash',
    prompt_tokens: 1000,
    completion_tokens: 200,
    total_tokens: 1200,
    duration: 4000,
    streamed: true,
    ...over,
  };
}

beforeEach(() => {
  clearCaptureStages();
  clearConsoleRing();
});

describe('历史记录页健康信号', () => {
  it('用量全 0 的历史记录判为「用量为 0」', () => {
    const signals = scanHistoryHealth([entry({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })]);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('zero-usage');
  });

  it('速率高得离谱判为「速率异常」', () => {
    // 1200 token / 0.1s = 12000 token/s
    const signals = scanHistoryHealth([entry({ duration: 100 })]);
    expect(signals[0].kind).toBe('rate-anomaly');
    expect(signals[0].detail).toContain('偏高');
    expect(12000).toBeGreaterThan(RATE_ANOMALY_HIGH);
  });

  it('速率低得离谱且用量不小才判异常', () => {
    const slow = scanHistoryHealth([entry({ total_tokens: 40, duration: 400000 })]);
    expect(slow[0].kind).toBe('rate-anomaly');
    expect(slow[0].detail).toContain('偏低');
    // 用量太小（<20）不判，避免短回复误报
    const tiny = scanHistoryHealth([entry({ total_tokens: 10, duration: 400000 })]);
    expect(tiny).toHaveLength(0);
    expect(RATE_ANOMALY_LOW).toBeGreaterThan(0);
  });

  it('非流式记录的速率不可信，不判异常', () => {
    const signals = scanHistoryHealth([entry({ duration: 100, streamed: false })]);
    expect(signals).toHaveLength(0);
  });

  it('偶发一次没取到用量不打扰，连续多次才提示「没有取到用量」', () => {
    noteCaptureStage('event-drop', { model: 'deepseek-flash', reason: 'no-usage', at: 1794719000000 });
    expect(scanCaptureHealth()).toHaveLength(0);

    noteCaptureStage('event-drop', { model: 'deepseek-flash', reason: 'no-usage', at: 1794719002000 });
    const signals = scanCaptureHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('missing-usage');
    expect(signals[0].detail).toContain('连续 2 轮');
    expect(signals[0].signature).toBe('no-usage');
  });

  it('入库失败与控制台里的本扩展报错都算「功能报错」，网络类控制台错误不算', () => {
    noteCaptureStage('entry-error', { model: 'deepseek-flash', reason: 'boom', at: 1794719000000 });
    noteConsole('error', ['ApiUsageStat addEntry failed'], 1794719005000);
    noteConsole('error', ['Failed to fetch'], 1794719006000);
    noteConsole('warn', ['ApiUsageStat 慢'], 1794719007000);
    const signals = scanCaptureHealth().concat(scanConsoleHealth());
    expect(signals.every((s) => s.kind === 'plugin-error')).toBe(true);
    expect(signals).toHaveLength(2);
    expect(signals[0].signature).toBeTruthy();
    expect(signals[1].signature).toBeTruthy();
  });

  it('同一簇内的同类信号只算一次，换模型各算各的', () => {
    noteCaptureStage('event-drop', { model: 'a', at: 1794719000000 });
    noteCaptureStage('event-drop', { model: 'a', at: 1794719000000 + 1000 });
    noteCaptureStage('event-drop', { model: 'a', at: 1794719000000 + HEALTH_DEDUPE_MS - 1000 });
    const report = buildHealthReport({ stages: undefined, history: [] });
    expect(report.counts['missing-usage']).toBe(1);

    noteCaptureStage('event-drop', { model: 'b', at: 1794719000000 + HEALTH_DEDUPE_MS });
    noteCaptureStage('event-drop', { model: 'b', at: 1794719000000 + HEALTH_DEDUPE_MS + 1000 });
    const two = buildHealthReport({ stages: undefined, history: [] });
    expect(two.counts['missing-usage']).toBe(2);
  });

  it('没有任何异常时不显示', () => {
    const report = buildHealthReport({ history: [entry()], stages: [], consoleEntries: [] });
    expect(report.shouldShow).toBe(false);
    expect(report.total).toBe(0);
    expect(healthSummaryText(report)).toBe('');
  });

  it('忽略的只是同一类问题：同类不再弹，别的模型/别的问题照旧', () => {
    const history = [
      entry({ timestamp: 1794719000000, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      // 与上一条间隔超过去重窗口，避免被当成同一次
      entry({ timestamp: 1794720000000, model: 'glm-5', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
    ];
    const before = buildHealthReport({ history, stages: [], consoleEntries: [] });
    expect(before.total).toBe(2);
    const key = healthSignalKey(before.items.find((s) => s.model === 'deepseek-flash')!);
    expect(key).toBe('zero-usage|deepseek-flash|zero');
    const after = buildHealthReport({ history, stages: [], consoleEntries: [], ignored: [key] });
    expect(after.total).toBe(1);
    expect(after.items[0].model).toBe('glm-5');
  });

  it('问题全被忽略时不显示', () => {
    const history = [entry({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })];
    const report = buildHealthReport({
      history,
      stages: [],
      consoleEntries: [],
      ignored: ['zero-usage|deepseek-flash|zero'],
    });
    expect(report.shouldShow).toBe(false);
    expect(healthSummaryText(report)).toBe('');
  });

  it('汇总文案按类型计数', () => {
    const report = buildHealthReport({
      history: [entry({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })],
      stages: [],
      consoleEntries: [],
    });
    expect(report.shouldShow).toBe(true);
    expect(healthSummaryText(report)).toBe('用量为 0 1 次');
  });
});

describe('信号 → 上传目标（指名道姓）', () => {
  it('历史类信号带上记录时间戳与请求 ID，弹窗才能指认到具体那一条', () => {
    const signals = scanHistoryHealth([
      entry({ timestamp: 1794719123456, requestId: 'req-abc', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
    ]);
    expect(signals).toHaveLength(1);
    const target = healthTargetOf(signals[0]);
    expect(target.kind).toBe('zero-usage');
    expect(target.historyTimestamp).toBe(1794719123456);
    expect(target.requestId).toBe('req-abc');
    expect(target.signalKey).toBe(healthSignalKey(signals[0]));
    expect(target.model).toBe('deepseek-flash');
  });

  it('没有 requestId 的旧记录也能靠时间戳定位，不会变成「未知指向」', () => {
    const signals = scanHistoryHealth([entry({ timestamp: 1794719000001, total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 })]);
    const target = healthTargetOf(signals[0]);
    expect(target.historyTimestamp).toBe(1794719000001);
    expect(target.requestId).toBe(null);
  });

  it('估算补记的轻提示同样可被点名（含估算方法与记录时间）', () => {
    const signals = scanHistoryHealth([
      entry({ timestamp: 1794719200000, usageSource: 'estimated', estimateMethod: 'char-heuristic-v1', prompt_tokens: 0 }),
    ]);
    const target = healthTargetOf(signals[0]);
    expect(signals[0].kind).toBe('estimated-usage');
    expect(target.historyTimestamp).toBe(1794719200000);
    expect(target.signature).toBe('char-heuristic-v1');
  });
});
