import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildHealthReport,
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

  it('没取到用量被事件层丢弃 → 「没有取到用量」', () => {
    noteCaptureStage('event-drop', { model: 'deepseek-flash', reason: 'no-usage', at: 1794719000000 });
    const signals = scanCaptureHealth();
    expect(signals[0].kind).toBe('missing-usage');
  });

  it('入库失败与控制台 error 都算「功能报错」', () => {
    noteCaptureStage('entry-error', { model: 'deepseek-flash', reason: 'boom', at: 1794719000000 });
    noteConsole('error', ['读取失败'], 1794719005000);
    const signals = scanCaptureHealth().concat(scanConsoleHealth());
    expect(signals.every((s) => s.kind === 'plugin-error')).toBe(true);
    expect(signals).toHaveLength(2);
  });

  it('同类型且时间接近的信号只算一次', () => {
    noteCaptureStage('event-drop', { model: 'a', at: 1794719000000 });
    noteCaptureStage('event-drop', { model: 'b', at: 1794719000000 + HEALTH_DEDUPE_MS - 1000 });
    const report = buildHealthReport({ stages: undefined, history: [] });
    expect(report.counts['missing-usage']).toBe(1);
  });

  it('没有任何异常时不显示', () => {
    const report = buildHealthReport({ history: [entry()], stages: [], consoleEntries: [] });
    expect(report.shouldShow).toBe(false);
    expect(report.total).toBe(0);
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
