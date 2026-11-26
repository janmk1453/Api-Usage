import { describe, expect, it } from 'vitest';
import panelSrc from './panel.ts?raw';
import persistenceSrc from '../store/persistence.ts?raw';
import repositorySrc from '../data/repository.ts?raw';
import cssSrc from '../../style.css?raw';
import { coldReadWarnHTML, COLD_WARN_RETRY_ID } from './cold-read-warn';

/**
 * 冷库读不出来时，列表只剩热区那点记录——这是「数据看起来丢了」的现场。
 * 告警条必须说清「不是删除」「只显示多少条」，并给一个能自证的重试按钮；
 * 纯函数部分在这里测，接线（容器 / 重试 / catch 分支）用源码契约守。
 */
describe('coldReadWarnHTML（冷库读取失败告警条）', () => {
  it('没有失败信息时返回空串，不占位', () => {
    expect(coldReadWarnHTML(null, 2000)).toBe('');
  });

  it('说清影响范围：只显示最近 N 条，并注明记录没有被删除', () => {
    const html = coldReadWarnHTML({ message: 'QuotaExceededError', at: 1 }, 2000);
    expect(html).toContain('更早的历史记录没能读出来');
    expect(html).toContain('这里只显示最近 2000 条');
    expect(html).toContain('更早的记录没有被删除');
    expect(html).toContain('IndexedDB');
  });

  it('带上可重试按钮与固定 id（panel 靠它绑定）', () => {
    const html = coldReadWarnHTML({ message: 'boom' }, 2000);
    expect(html).toContain(`id="${COLD_WARN_RETRY_ID}"`);
    expect(html).toContain('重试');
    expect(html).toContain('role="alert"');
  });

  it('失败原因经过转义，不会注入标记', () => {
    const html = coldReadWarnHTML({ message: '<img src=x onerror=alert(1)>' }, 2000);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('没有原因文案时不渲染「失败原因」一行', () => {
    const html = coldReadWarnHTML({ message: '  ' }, 2000);
    expect(html).not.toContain('失败原因');
  });

  it('条数缺失或非法时退化成「热区的部分记录」，不显示 0 条', () => {
    const html = coldReadWarnHTML({ message: 'boom' }, 0);
    expect(html).toContain('这里只显示热区的部分记录');
    expect(html).not.toContain('最近 0 条');
  });
});

describe('冷库告警接线（源码契约）', () => {
  it('历史页有独立告警容器，且在运行健康提示条之前', () => {
    const cold = panelSrc.indexOf('id="${COLD_WARN_HOST_ID}"');
    const health = panelSrc.indexOf('id="aus-history-health"');
    expect(cold).toBeGreaterThan(-1);
    expect(health).toBeGreaterThan(-1);
    expect(cold).toBeLessThan(health);
  });

  it('全量读取失败时补常驻告警，而不是空 catch 吞掉', () => {
    expect(panelSrc).toMatch(/catch \{\s*\/\/ 冷库读不出来[\s\S]{0,160}?renderColdReadWarn\(doc\);/);
    expect(panelSrc).toContain('const all: any[] = await repository.getAllHistory();');
    // 历史页不再绕过仓库层直读 persistence（那样就没有失败提示）
    expect(panelSrc).not.toContain("await import('../store/persistence')");
  });

  it('重试会先清失败标记再重载，让成功后的告警条自己消失', () => {
    const start = panelSrc.indexOf('retry.onclick = () => {');
    const end = panelSrc.indexOf('function renderHistory(doc');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const retry = panelSrc.slice(start, end);
    expect(retry).toContain('clearColdReadFailure()');
    expect(retry).toContain('invalidateHistoryCache()');
    expect(retry).toContain('refreshUI()');
  });

  it('数据层记录失败原因，读取成功时清空', () => {
    expect(persistenceSrc).toContain('export function getColdReadFailure()');
    expect(persistenceSrc).toContain('export function clearColdReadFailure()');
    expect(persistenceSrc).toContain('coldReadFailure = { message: describeReadError(error), at: Date.now() };');
    expect(persistenceSrc).toMatch(/coldReadFailure = null;\s*return parsed;/);
  });

  it('仓库层在失败时提示一次，并把错误继续抛出', () => {
    expect(repositorySrc).toContain('function notifyColdReadFailure(error: unknown): void {');
    expect(repositorySrc).toContain('COLD_READ_NOTIFY_INTERVAL_MS');
    expect(repositorySrc).toMatch(/catch \(error\) \{\s*notifyColdReadFailure\(error\);\s*throw error;/);
  });

  it('告警条样式含窄屏两套断点（否则部分机型不生效）', () => {
    expect(cssSrc).toContain('#aus-panel .aus-cold-warn {');
    expect(cssSrc).toContain('#aus-panel .aus-cold-warn-retry {');
    const mediaRule = cssSrc.match(/@media \(max-width: 760px\) \{[\s\S]{0,200}?aus-cold-warn \{[\s\S]{0,120}?padding: 10px 11px;/);
    expect(mediaRule).not.toBeNull();
    const containerRule = cssSrc.match(/@container ausbody \(max-width: 760px\) \{[\s\S]{0,200}?aus-cold-warn \{[\s\S]{0,120}?padding: 10px 11px;/);
    expect(containerRule).not.toBeNull();
  });
});
