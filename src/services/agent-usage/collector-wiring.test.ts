import { afterEach, describe, expect, it } from 'vitest';
import collectorSrc from './collector.ts?raw';
import apiSrc from './tt-agent-api.ts?raw';

/** collector 是事件接线层，用源码字符串断言守住「Agent 起点识别」的两条路径 */
describe('Agent 起点识别接线', () => {
  it('ABI 1 走同步判定，ABI 2 及以上留引用待事件后复查', () => {
    expect(collectorSrc).toContain('if (hasFrozenRunSnapshot(data)) {');
    expect(collectorSrc).toContain('if (needsSnapshotProbe(getHostAbiVersion())) snapshotProbe.remember(data);');
    expect(collectorSrc).toContain('flushSnapshotProbe();');
    expect(collectorSrc).toContain('if (!snapshotProbe.flush()) return;');
  });

  it('不引入任何定时轮询去等快照', () => {
    const start = collectorSrc.indexOf('export function notifyGenerateAfterData');
    const body = collectorSrc.slice(start, collectorSrc.indexOf('function markPending()', start));
    expect(body).not.toContain('setTimeout');
    expect(body).not.toContain('setInterval');
  });

  it('每个后续事件入口都会复查一次', () => {
    expect(collectorSrc).toContain('chatChangedHandler = () => { flushSnapshotProbe();');
    expect(collectorSrc).toContain('appReadyHandler = () => { flushSnapshotProbe();');
    const probeCalls = (collectorSrc.match(/flushSnapshotProbe\(\);/g) || []).length;
    // 生成入口 + 消息入口 + 切对话 + 启动 + 打开面板，至少五处
    expect(probeCalls).toBeGreaterThanOrEqual(5);
  });

  it('对账不再按水位提前收手（失败/取消的 Run 才能补回来）', () => {
    expect(collectorSrc).not.toContain('created <= watermark) break;');
    expect(collectorSrc).toContain('if (await captureAgentRun(runId, run)) count += 1;');
  });

  it('卸载时丢弃待复查引用', () => {
    expect(collectorSrc).toContain('snapshotProbe.clear();');
  });

  it('适配层仍只读门面、不假设字段存在', () => {
    expect(apiSrc).toContain('export function getHostAbiVersion(): number {');
    expect(apiSrc).toContain('.abiVersion');
  });
});
