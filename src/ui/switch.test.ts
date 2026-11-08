import { describe, it, expect } from 'vitest';
import settingsSrc from './settings.ts?raw';
import styleSrc from '../../style.css?raw';
import { switchHTML } from './switch';

// 这些断言守的是「胶囊开关的开 / 关必须能靠颜色分辨」：
// 旧写法把状态全押在滑钮 left 上，轨道颜色开与关完全相同，浅色下还和卡片灰底糊在一起。
describe('统一胶囊开关：结构与语义', () => {
  it('默认关闭：不写 checked，语义为 role="switch"', () => {
    const html = switchHTML('aus-demo');
    expect(html).toContain('id="aus-demo"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('class="aus-switch"');
    expect(html).toContain('aus-switch-track');
    expect(html).toContain('aus-switch-thumb');
    expect(html).not.toContain('checked');
    expect(html).not.toContain('disabled');
  });

  it('开启 / 禁用 / 无障碍标签都落到原生属性上', () => {
    const html = switchHTML('aus-demo', { checked: true, disabled: true, ariaLabel: '匿名使用统计' });
    expect(html).toMatch(/\bchecked\b/);
    expect(html).toMatch(/\bdisabled\b/);
    expect(html).toContain('aria-label="匿名使用统计"');
  });

  it('aria-label 做属性转义，不会截断标签', () => {
    expect(switchHTML('x', { ariaLabel: 'a"b<c' })).toContain('aria-label="a&quot;b&lt;c"');
  });
});

describe('统一胶囊开关：设置页只交给组件，不再手改滑钮位置', () => {
  it('四处胶囊开关全部改用 switchHTML', () => {
    for (const id of ['aus-mobile-compat-ui', 'aus-telemetry-enabled', 'aus-debug-mode', 'aus-peak-dot']) {
      expect(settingsSrc).toContain(`switchHTML('${id}'`);
    }
  });

  it('不再残留内联滑钮（-slider + style.left）', () => {
    expect(settingsSrc).not.toContain('-slider');
    expect(settingsSrc).not.toMatch(/style\.left\s*=\s*enabled/);
  });
});

describe('统一胶囊开关：开 / 关必须是两套颜色', () => {
  it('开启态轨道换成品牌橙，默认态是中性灰', () => {
    expect(styleSrc).toMatch(/\.aus-switch input:checked ~ \.aus-switch-track \{[^}]*background: var\(--aus-switch-on\)/);
    expect(styleSrc).toMatch(/\.aus-switch \.aus-switch-track \{[^}]*background: var\(--aus-switch-off\)/);
  });

  it('浅色与深色主题各自定义 --aus-switch-off，开启色统一取提亮后的品牌橙', () => {
    const offVars = styleSrc.match(/--aus-switch-off:\s*#[0-9A-Fa-f]{6}/g) || [];
    expect(offVars.length).toBeGreaterThanOrEqual(2);
    expect(new Set(offVars).size).toBeGreaterThanOrEqual(2);
    const onVars = styleSrc.match(/--aus-switch-on:\s*([^;]+);/g) || [];
    expect(onVars.length).toBeGreaterThanOrEqual(2);
    expect(onVars.every((v) => v.includes('var(--ds-orange)'))).toBe(true);
  });

  it('滑钮位移按宽度换算（窄屏放大后仍然对齐），并带描边保证轮廓', () => {
    expect(styleSrc).toMatch(/translateX\(calc\(var\(--aus-switch-w\)/);
    expect(styleSrc).toMatch(/--aus-switch-thumb-border:/);
  });

  it('触屏命中区与减少动效兜底都在', () => {
    expect(styleSrc).toMatch(/\.aus-switch::before \{[^}]*inset: -6px/);
    expect(styleSrc).toMatch(/prefers-reduced-motion: reduce/);
  });
});
