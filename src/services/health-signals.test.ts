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
  RATE_LOW_MIN_OUTPUT,
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
    // 输出 6000 token / 生成窗口 (1200 - 200)ms = 6000 token/s
    const signals = scanHistoryHealth([entry({ prompt_tokens: 1000, completion_tokens: 6000, total_tokens: 7000, duration: 1200, ttft: 200 })]);
    expect(signals[0].kind).toBe('rate-anomaly');
    expect(signals[0].detail).toContain('偏高');
    expect(6000).toBeGreaterThan(RATE_ANOMALY_HIGH);
  });

  it('大输入 + 极短输出不算速率异常（速率只取输出侧）', () => {
    // 真机样本：输入 25438（其中 20224 命中）、输出 2、耗时 1700ms、首字 1697ms
    const sample = entry({
      prompt_tokens: 25438,
      completion_tokens: 2,
      total_tokens: 25440,
      duration: 1700,
      ttft: 1697,
      streamed: null,
    });
    expect(scanHistoryHealth([sample])).toHaveLength(0);
    // 首字正常、输出极小：按「总 Token / 总耗时」的老口径是 15 万 t/s，现在只算 10 token / 1.5s
    const tiny = entry({ prompt_tokens: 300000, completion_tokens: 10, total_tokens: 300010, duration: 2000, ttft: 500 });
    expect(scanHistoryHealth([tiny])).toHaveLength(0);
  });

  it('速率低得离谱且输出不算太小时才判异常', () => {
    // 输出 40 token / 生成窗口 398s ≈ 0.1 token/s
    const slow = scanHistoryHealth([entry({ completion_tokens: 40, total_tokens: 1040, duration: 400000, ttft: 2000 })]);
    expect(slow[0].kind).toBe('rate-anomaly');
    expect(slow[0].detail).toContain('偏低');
    // 输出太少（低于 RATE_LOW_MIN_OUTPUT）不判，几个 token 谈不上快慢
    const tiny = scanHistoryHealth([entry({ completion_tokens: 10, total_tokens: 1010, duration: 400000, ttft: 2000 })]);
    expect(tiny).toHaveLength(0);
    expect(RATE_ANOMALY_LOW).toBeGreaterThan(0);
    expect(RATE_LOW_MIN_OUTPUT).toBe(20);
  });

  it('非流式记录与测不出来的记录都不判异常', () => {
    expect(scanHistoryHealth([entry({ duration: 100, streamed: false })])).toHaveLength(0);
    // TTFT 缺失（含旧数据未记录首字时间）同样不猜
    expect(scanHistoryHealth([entry({ duration: 400000, ttft: 0 })])).toHaveLength(0);
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

  it('用户自己点停止造成的空轮次不算「没有取到用量」', () => {
    noteCaptureStage('event-drop', { model: 'hy4-flash', reason: 'user-stop-no-output', at: 1794719100000 });
    noteCaptureStage('event-drop', { model: 'hy4-flash', reason: 'user-stop-no-output', at: 1794719102000 });
    expect(scanCaptureHealth()).toHaveLength(0);
    // 上游断流 / 空回复导致的无输出丢弃仍要提示，不能被上面的豁免带偏
    noteCaptureStage('event-drop', { model: 'hy4-flash', reason: 'no-usage-no-output', at: 1794719104000 });
    noteCaptureStage('event-drop', { model: 'hy4-flash', reason: 'no-usage-no-output', at: 1794719106000 });
    const signals = scanCaptureHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].signature).toBe('no-usage-no-output');
  });

  it('事件层抢在 fetch 解析之前丢弃、同一轮后来又入库的，不算「没有取到用量」', () => {
    // 真机日志复现：GENERATION_ENDED 先到，那一刻还没有输出文本 → 判「无用量无输出」丢弃；
    // 随后同一 requestId 的 fetch 解析完成并正常 addEntry，这轮其实写进历史了。
    noteCaptureStage('event-drop', { model: 'hy4-flash', requestId: 'req:1:1', reason: 'no-usage-no-output', at: 1795003350901 });
    noteCaptureStage('entry-added', { model: 'hy4-flash', requestId: 'req:1:1', at: 1795003351006 });
    noteCaptureStage('event-drop', { model: 'hy4-flash', requestId: 'req:2:2', reason: 'no-usage-no-output', at: 1795012257501 });
    noteCaptureStage('turn-interrupted', { model: 'hy4-flash', requestId: 'req:2:2', at: 1795012259044 });
    expect(scanCaptureHealth()).toHaveLength(0);

    // 没有对应入库记录的真丢弃照常提示
    noteCaptureStage('event-drop', { model: 'hy4-flash', requestId: 'req:3:3', reason: 'no-usage-no-output', at: 1795012260000 });
    noteCaptureStage('event-drop', { model: 'hy4-flash', requestId: 'req:4:4', reason: 'no-usage-no-output', at: 1795012262000 });
    const signals = scanCaptureHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].signature).toBe('no-usage-no-output');
    expect(signals[0].detail).toContain('连续 2 轮');
  });

  it('上游把 500 包成 200 而拒绝入库的轮次：连续出现时提示「上游返回错误」', () => {
    // 这类轮次刻意不写历史（那一轮确实没有模型内容），但要和「采集故障」区分开：
    // 偶发单次不打扰，同类（模型 + 状态码）在窗口内重复才提示，且按 api-error 归因。
    noteCaptureStage('entry-rejected', { model: 'deepseek-v3', reason: 'api-error-payload:tauritavern-endpoint-status:128:status=500', at: 1794719200000 });
    expect(scanCaptureHealth()).toHaveLength(0);
    noteCaptureStage('entry-rejected', { model: 'deepseek-v3', reason: 'api-error-payload:tauritavern-endpoint-status:128:status=500', at: 1794719202000 });
    const signals = scanCaptureHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('missing-usage');
    expect(signals[0].reason).toBe('api-error');
    expect(signals[0].signature).toBe('http-500');
    expect(signals[0].detail).toContain('上游返回错误');
    expect(signals[0].detail).toContain('HTTP 500');
    expect(signals[0].detail).toContain('未计入历史');
  });

  it('采集安装反复失败要报「功能报错」（整段静默，历史里看不出来）', () => {
    noteCaptureStage('install-failed', { model: '', reason: 'depth-limit:7', at: 1794719000000 });
    noteCaptureStage('install-failed', { model: '', reason: 'depth-limit:7', at: 1794719004000 });
    // 只失败两次：可能是宿主恰好重绑，不打扰
    expect(scanCaptureHealth()).toHaveLength(0);
    noteCaptureStage('install-failed', { model: '', reason: 'replaced-during-install', at: 1794719008000 });
    const signals = scanCaptureHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('plugin-error');
    expect(signals[0].reason).toBe('install-failed');
    expect(signals[0].detail).toContain('3 次');
    // 原因里的层数/细节不进签名，同一类失败才聚得起来
    expect(signals[0].signature).toBeTruthy();
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

  it('别的扩展的网络失败穿过 fetch 透传层时，不提示「功能报错」', () => {
    // 真机包 plugin-error|8bd68160：脚本运行器发起的请求失败，栈里只有我们的 patched 透传帧
    noteConsole('error', [
      'TypeError: Failed to fetch\n' +
      '    at patched (http://127.0.0.1:3512/scripts/extensions/third-party/Api-Usage/interception-BHW4SG4V.js:1258:20)\n' +
      '    at window.fetch (http://127.0.0.1:3512/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js:74:145210)',
    ], 1794719010000);
    expect(scanConsoleHealth()).toHaveLength(0);

    // 同一环形缓冲里本扩展自己的入库报错仍要提示
    noteConsole('error', ['ApiUsageStat addEntry failed'], 1794719011000);
    const signals = scanConsoleHealth();
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('plugin-error');
    expect(signals[0].detail).toContain('本扩展代码');
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

  it('用户主动停止的那一轮不报任何提示：没用量是预期，不是故障', () => {
    // 估算补记 + 用户中断：两者叠加时最容易被误报成「本地估算」警告
    const estimated = entry({ timestamp: 1794719400000, usageSource: 'estimated', interrupted: 'user', prompt_tokens: 0 });
    expect(scanHistoryHealth([estimated])).toHaveLength(0);
    // 用量全 0 的用户中断记录同样静默
    const zero = entry({ timestamp: 1794719500000, interrupted: 'user', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    expect(scanHistoryHealth([zero])).toHaveLength(0);
    const report = buildHealthReport({ history: [estimated, zero], stages: [], consoleEntries: [] });
    expect(report.shouldShow).toBe(false);
  });

  it('上游中断导致的估算仍要提示：那是连接出了问题', () => {
    const signals = scanHistoryHealth([
      entry({ timestamp: 1794719600000, usageSource: 'estimated', interrupted: 'upstream', prompt_tokens: 0 }),
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0].kind).toBe('estimated-usage');
  });
});
