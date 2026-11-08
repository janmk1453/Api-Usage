import { describe, expect, it } from 'vitest';
import { chartAxisPickerHTML, chartCardHTML, chartPillHTML } from './chart-picker';

/**
 * 图表卡片骨架的契约测试：
 *  - 胶囊 id 必须能被 pill.ts 配对（-btn → -dropdown / -drop）；
 *  - 下拉 id 必须命中 style.css 的开合动画选择器；
 *  - 纯切换胶囊不画箭头、不生成下拉；
 *  - 标题等文本一律转义。
 */
describe('chart-picker', () => {
  const pill = {
    key: 'Y',
    btnId: 'aus-extra-y-btn-token',
    labelId: 'aus-extra-y-label-token',
    dropId: 'aus-extra-y-drop-token',
    label: '3 项',
  };

  it('胶囊按钮带 aus-chart-pill 类、id 与键名，并回填初始文案', () => {
    const html = chartPillHTML(pill);
    expect(html).toContain('class="aus-chart-pill"');
    expect(html).toContain('id="aus-extra-y-btn-token"');
    expect(html).toContain('id="aus-extra-y-label-token">3 项</span>');
    expect(html).toContain('aus-chart-pill-key');
    expect(html).toContain('<svg');
  });

  it('下拉 id 与 pill.ts 的配对规则一致（-btn → -dropdown / -drop）', () => {
    const html = chartAxisPickerHTML([pill]);
    // pill.ts 在按钮 id 里把 -btn 换成 -dropdown 与 -drop 两个候选逐个查找
    const candidates = [pill.btnId.replace('-btn', '-dropdown'), pill.btnId.replace('-btn', '-drop')];
    expect(html).toContain('id="' + candidates[1] + '"');
    expect(html).toContain('data-axis="y"');
    // 关闭态由模板内联 display 决定，pill.ts 据此打/撤 data-aus-open
    expect(html).toContain('style="display:none;"');
  });

  it('X 轴下拉从右端展开，Y 轴从左端展开', () => {
    const html = chartAxisPickerHTML([
      pill,
      { ...pill, key: 'X', btnId: 'aus-extra-x-btn-token', labelId: 'aus-extra-x-label-token', dropId: 'aus-extra-x-drop-token', label: '轮次' },
    ]);
    expect(html).toContain('data-axis="x"');
    expect(html.indexOf('data-axis="y"')).toBeLessThan(html.indexOf('data-axis="x"'));
  });

  it('dropdown 为 false 的纯切换胶囊不画箭头、不生成下拉', () => {
    const toggle = { key: '口径', btnId: 'aus-pie-toggle', labelId: 'aus-pie-toggle-val', dropId: '', label: 'Token', dropdown: false };
    const single = chartPillHTML(toggle);
    expect(single).toContain('口径');
    expect(single).not.toContain('<svg');
    const picker = chartAxisPickerHTML([toggle]);
    expect(picker).not.toContain('aus-chart-dropdown');
  });

  it('卡片骨架输出标题、图表容器与默认高度', () => {
    const html = chartCardHTML({ title: 'Token 趋势', chartId: 'aus-chart-token', pills: [pill] });
    expect(html).toContain('class="ds-card aus-chart-card"');
    expect(html).toContain('aus-chart-card-head');
    expect(html).toContain('>Token 趋势</span>');
    expect(html).toContain('id="aus-chart-token" style="height:220px;"');
    // 未传 cardId 时不产生空的 id 属性
    expect(html).not.toContain(' id=""');
  });

  it('支持自定义容器高度与卡片 id', () => {
    const html = chartCardHTML({ title: '图表', chartId: 'aus-stats-chart', cardId: 'aus-stats-chart-card', height: 300 });
    expect(html).toContain('id="aus-stats-chart-card"');
    expect(html).toContain('id="aus-stats-chart" style="height:300px;"');
  });

  it('没有胶囊时只留标题（不产生空的设置区）', () => {
    const html = chartCardHTML({ title: '无设置', chartId: 'aus-chart-none' });
    expect(html).not.toContain('aus-chart-picker');
  });

  it('标题与 id 中的特殊字符被转义', () => {
    const html = chartCardHTML({ title: '<b>&"x', chartId: 'a"b' });
    expect(html).toContain('&lt;b&gt;&amp;&quot;x');
    expect(html).toContain('id="a&quot;b"');
  });
});
