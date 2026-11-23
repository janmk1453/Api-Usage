import { describe, it, expect } from 'vitest';
import statsSrc from './stats-view.ts?raw';

/** 去掉注释再断言：注释里提到旧写法不算违规 */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const src = stripComments(statsSrc);

function sliceFrom(anchor: string, length = 900): string {
  const at = src.indexOf(anchor);
  expect(at).toBeGreaterThanOrEqual(0);
  return src.slice(at, at + length);
}

describe('统计页下拉：展开状态以 DOM 为准，多选不自动收起', () => {
  it('下拉开关不再用模块变量记录（变量会与瞬时关闭脱节，导致再点一次才打开）', () => {
    expect(src).not.toMatch(/\blet\s+(pickerOpen|modelPickerOpen|chatPickerOpen|endpointPickerOpen|credentialPickerOpen|typePickerOpen|chartYOpen|chartXOpen)\b/);
    // 赋值残留也不行（变量删了还赋值会直接编译失败，这里守的是别又加回来）
    expect(src).not.toMatch(/\b(pickerOpen|modelPickerOpen|chatPickerOpen|endpointPickerOpen|credentialPickerOpen|typePickerOpen|chartYOpen|chartXOpen)\s*=/);
  });

  it('展开判定只认 DOM 的 inline display，六枚筛选胶囊 + 图表 Y/X 全走同一函数', () => {
    expect(src).toContain('function isDropOpen(');
    expect(src).toContain("return display === 'block' || display === 'flex';");
    const toggles = src.match(/const willOpen = !isDropOpen\(/g) || [];
    expect(toggles.length).toBe(8);
  });

  it('图表 Y 是多选：勾选后浮层不收起，只就地刷新勾选态并给图表留到下一帧', () => {
    const block = sliceFrom("yDrop.querySelectorAll('input[data-ykey]')", 700);
    expect(block).not.toContain('closeDropdownThenPaint(yDrop');
    expect(block).toContain('el.checked = on;');
    expect(block).toContain('afterNextPaint(() => { void renderStatsView(); });');
    // 连续勾选时列表不能自己跳回顶部
    expect(src).toContain('const yScrollTop = yDrop.scrollTop;');
    expect(src).toContain('yDrop.scrollTop = yScrollTop;');
  });

  it('统计页模型筛选是多选：勾选后浮层不收起，重画前记住滚动位置', () => {
    const start = src.indexOf('function renderModelPicker(');
    const end = src.indexOf('function renderChatPicker(');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    expect(block).not.toContain('closeDropdownThenPaint');
    expect(block).toContain('renderModelPicker(lastStatsHistory);');
    expect(block).toContain('afterNextPaint(() => { void renderStatsView(); });');
    expect(block).toContain('const dropdownScrollTop = dropdown.scrollTop;');
    expect(block).toContain('dropdown.scrollTop = dropdownScrollTop;');
  });

  it('单选下拉（展示方式 / 轴标签 / X / 六维筛选）仍保持「点选即关」', () => {
    const singles = [
      '[data-chart-type]',
      '[data-axis-label]',
      '[data-xkey]',
      '[data-chat]',
      '[data-endpoint]',
      '[data-credential]',
      '[data-request-type]',
    ];
    for (const selector of singles) {
      // 锚在 querySelectorAll('<selector>') 的绑定处，避开模板属性与高亮更新里的同名查询
      const block = sliceFrom("querySelectorAll('" + selector + "')", 700);
      expect(block, selector + ' 应仍走 closeDropdownThenPaint').toContain('closeDropdownThenPaint(');
    }
    // 时间维度：选中项先就地改标签，再瞬时关闭浮层
    expect(sliceFrom('        updatePickerLabel();', 200)).toContain('closeDropdownThenPaint(dropdown');
    // 各 renderXxxPicker 内的单选 handler 各有且只有一处「点选即关」
    for (const fn of ['renderChatPicker', 'renderEndpointPicker', 'renderCredentialPicker', 'renderTypePicker']) {
      const start = src.indexOf('function ' + fn + '(');
      const end = src.indexOf('\nfunction ', start + 1);
      expect(start).toBeGreaterThanOrEqual(0);
      const body = src.slice(start, end);
      expect((body.match(/closeDropdownThenPaint\(/g) || []).length, fn).toBe(1);
    }
  });

  it('点外部关闭按浮层自己的 display 判断，不依赖变量', () => {
    expect(src).toContain('if (!isDropOpen(d)) continue;');
    expect(src).toContain('if (isDropOpen(yD)');
    expect(src).toContain('if (isDropOpen(xD)');
  });
});
