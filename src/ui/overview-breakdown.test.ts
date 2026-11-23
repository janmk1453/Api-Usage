import { describe, it, expect } from 'vitest';
import {
  tokenBreakdown,
  costBreakdown,
  savingSharePercent,
  percentText,
  historyBreakdownHTML,
  spendBreakdownHTML,
} from './overview-breakdown';
import overviewSrc from './overview.ts?raw';
import cssSrc from '../../style.css?raw';

/** 截图里的真实数据：三段之和 4,357,028 比总计 4,497,587 少 140,559（旧记录缺分项） */
const SAMPLE = {
  totalTokens: 4497587,
  hit: 1565220,
  miss: 2357628,
  output: 434180,
  totalCost: 3.5463,
  inputCost: 2.0216,
  outputCost: 1.5247,
  savings: 1.6265,
  hitRate: 39.9,
};

const text = { fmt: (n: number) => n.toLocaleString('zh-CN'), money: (n: number) => '¥' + n.toFixed(4) };

describe('overview-breakdown：分项口径', () => {
  it('token 四段：分母取 max(总计, 三段之和)，差额单列为未分项', () => {
    const { total, parts } = tokenBreakdown(SAMPLE);
    expect(total).toBe(4497587);
    expect(parts.map((p) => p.key)).toEqual(['hit', 'miss', 'output', 'rest']);
    expect(parts.map((p) => p.percent)).toEqual([34.8, 52.4, 9.7, 3.1]);
    expect(parts[3].value).toBe(140559);
  });

  it('token：只有分项没有总计、或分项之和超过总计，都不出现未分项', () => {
    expect(tokenBreakdown({ totalTokens: 0, hit: 10, miss: 20, output: 30 })).toMatchObject({
      total: 60,
      parts: [{ key: 'hit', percent: 16.7 }, { key: 'miss', percent: 33.3 }, { key: 'output', percent: 50 }],
    });
    const over = tokenBreakdown({ totalTokens: 100, hit: 80, miss: 40, output: 10 });
    expect(over.total).toBe(130);
    expect(over.parts.some((p) => p.key === 'rest')).toBe(false);
  });

  it('token：空数据 / 脏数据都归零，不出现 NaN 与负段', () => {
    const zero = tokenBreakdown({});
    expect(zero.total).toBe(0);
    expect(zero.parts.map((p) => p.percent)).toEqual([0, 0, 0]);
    const dirty = tokenBreakdown({ totalTokens: NaN as any, hit: -5 as any, miss: '20' as any, output: undefined as any });
    expect(dirty.total).toBe(20);
    expect(dirty.parts.map((p) => p.value)).toEqual([0, 20, 0]);
  });

  it('cost：合计与输入 + 输出差额超过半分钱才补未分项', () => {
    const { total, parts } = costBreakdown(SAMPLE);
    expect(total).toBeCloseTo(3.5463, 4);
    expect(parts.map((p) => p.key)).toEqual(['input', 'output']);
    expect(parts[0].value).toBeCloseTo(2.0216, 4);
    expect(parts[1].percent).toBeCloseTo(43, 0);

    const gap = costBreakdown({ totalCost: 3.6, inputCost: 2, outputCost: 1.5 });
    expect(gap.parts.map((p) => p.key)).toEqual(['input', 'output', 'rest']);
    expect(gap.parts[2].value).toBeCloseTo(0.1, 4);

    const tiny = costBreakdown({ totalCost: 3.0003, inputCost: 1.5, outputCost: 1.5 });
    expect(tiny.parts.some((p) => p.key === 'rest')).toBe(false);
  });

  it('缓存省下的输入费用比例 = 节省 ÷（节省 + 实际输入支出）', () => {
    expect(savingSharePercent(SAMPLE)).toBe(44.6);
    expect(savingSharePercent({ savings: 0, inputCost: 2 })).toBe(0);
    expect(savingSharePercent({})).toBe(0);
  });

  it('百分比文案：整数不带小数（0% / 100%），其余一位小数', () => {
    expect(percentText(0)).toBe('0%');
    expect(percentText(100)).toBe('100%');
    expect(percentText(34.8)).toBe('34.8%');
    expect(percentText(NaN as any)).toBe('0%');
  });
});

describe('overview-breakdown：两块卡的模板', () => {
  it('左卡：合计大字 + 三段占比条 + 四行明细 + 命中率附注', () => {
    const html = historyBreakdownHTML(SAMPLE, text);
    expect(html).toContain('<div class="ds-card-title">历史消耗</div>');
    expect(html).toContain('aus-ovm-total ds-card-val">4,497,587<small>tokens</small>');
    expect(html).toContain('aria-label="命中缓存 34.8%，未命中缓存 52.4%，输出 9.7%，未分项 3.1%"');
    expect(html).toContain('is-hit" style="--aus-ovm-seg:34.8"');
    expect(html).toContain('is-rest" style="--aus-ovm-seg:3.1"');
    expect(html).toContain('命中缓存</span>');
    expect(html).toContain('1,565,220<small>34.8%</small>');
    expect(html).toContain('缓存命中率');
    expect(html).toContain('39.9%');
  });

  it('右卡：金额走注入的 money 回调（币种不再写死），附注带节省比例', () => {
    const html = spendBreakdownHTML(SAMPLE, text);
    expect(html).toContain('<div class="ds-card-title">支出明细</div>');
    expect(html).toContain('aus-ovm-total ds-card-val">¥3.5463');
    expect(html).toContain('输入支出');
    expect(html).toContain('¥2.0216');
    expect(html).toContain('预计节省');
    expect(html).toContain('¥1.6265');
    expect(html).toContain('省下输入 44.6%');
    expect(html).not.toContain('未分项');
  });

  it('右卡：合计与分项对不上时补「未分项」一行', () => {
    const html = spendBreakdownHTML({ totalCost: 3.6, inputCost: 2, outputCost: 1.5, savings: 0 }, text);
    expect(html).toContain('未分项');
    expect(html).toContain('¥0.1000');
  });
});

describe('overview-breakdown：接线契约', () => {
  it('overview.ts 只调模块产出 HTML，内联样式已清空', () => {
    expect(overviewSrc).toContain("from './overview-breakdown'");
    expect(overviewSrc).toContain('historyBreakdownHTML(breakdownInput, breakdownText)');
    expect(overviewSrc).toContain('spendBreakdownHTML(breakdownInput, breakdownText)');
    expect(overviewSrc).not.toContain('Token 历史消耗');
    expect(overviewSrc).not.toContain('支出在输入');
    expect(overviewSrc).not.toContain('function CNY(');
  });

  it('style.css：桌面明细就是两行两列，窄屏同两列但行内改纵向', () => {
    expect(cssSrc).toContain('#aus-panel .aus-ovm-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 18px; margin-bottom: 12px; }');
    const stacked = (cssSrc.match(/#aus-panel \.aus-ovm-row \{ flex-direction: column; align-items: flex-start; gap: 2px; \}/g) || []).length;
    expect(stacked).toBe(2);
  });

  it('style.css：占比条窄屏与桌面口径，两套断点同步', () => {
    expect(cssSrc).toContain('#aus-panel .aus-ovm-bar {');
    expect(cssSrc).toContain('#aus-panel .aus-ovm-seg { flex: var(--aus-ovm-seg, 0) 1 0; min-width: 0; }');
    expect(cssSrc).toContain('#aus-panel .aus-ovm-foot {');
    const media = (cssSrc.match(/#aus-panel \.aus-ovm-rows \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 8px 10px; \}/g) || []).length;
    expect(media).toBe(2);
  });
});
