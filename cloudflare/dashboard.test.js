import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BUILD_ID,
  PLACEHOLDER_BOOT,
  PLACEHOLDER_BUILD,
  renderDashboard,
  serializeBoot,
} from './boot.js';

const html = readFileSync(new URL('./dashboard.html', import.meta.url), 'utf8');

describe('看板模板结构', () => {
  it('首屏数据占位符唯一，构建标识占位符只出现在 meta 与页脚', () => {
    expect(html.split(PLACEHOLDER_BOOT).length - 1).toBe(1);
    expect(html.split(PLACEHOLDER_BUILD).length - 1).toBe(2);
  });

  it('三段内联脚本（主题恢复 / 首屏数据 / 主脚本）成对闭合', () => {
    expect((html.match(/<script/g) || []).length).toBe(3);
    expect((html.match(/<\/script>/g) || []).length).toBe(3);
  });

  it('零依赖：不加载任何外部脚本、样式或字体', () => {
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href="https?:/i);
    const urls = (html.match(/https?:\/\/[^\s"'<>]+/g) || [])
      .filter((u) => !u.startsWith('http://www.w3.org/'));
    expect(urls).toEqual([]);
  });

  it('不再引用 ECharts 或任何图表库', () => {
    expect(html.toLowerCase()).not.toContain('echarts');
    expect(html).not.toContain('getInstanceByDom');
  });

  it('五个视图的导航入口齐全', () => {
    const views = ['overview', 'trends', 'audience', 'performance', 'explore'];
    views.forEach((view) => {
      expect(html).toContain('data-nav="' + view + '"');
      expect(html).toContain('#/' + view);
    });
    expect(html).toContain('<main id="main"');
  });

  it('主题、响应式与可访问性骨架在位', () => {
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('prefers-reduced-motion');
    expect(html).toContain('prefers-color-scheme');
    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain('tabindex="-1"');
  });

  it('首屏数据与启动入口都指向全局 TEL 命名空间', () => {
    expect(html).toContain('window.__TEL_BOOT__ = ' + PLACEHOLDER_BOOT);
    expect(html).toContain('const TEL = (window.TEL = window.TEL || {});');
    expect(html).toContain('TEL.bootShell');
    expect(html).toContain('TEL.ui.route.render');
    expect(html).toContain('TEL.api.reload');
  });

  it('坐标轴留白按刻度标签实测宽度收窄，窄屏不再白占一截', () => {
    expect(html).toContain('function labelWidth(str, fontSize)');
    expect(html).toContain('yMaxLabel * 1.06 + 9');
    expect(html).toContain('Math.round(Math.min(46, Math.max(18,');
    expect(html).not.toContain('const padL = width < 480 ? 38 : 46;');
  });

  it('触屏拖动不交给浏览器抢：容器自管手势，横滑读数、竖滑滚页、轻点读数', () => {
    // SVG 子元素上的 touch-action 在 Chrome 不生效，必须挂在 HTML 容器上
    expect(html).toContain("host.style.touchAction = 'none';");
    expect(html).not.toContain('.chart-host .c-hit { touch-action: pan-y; }');
    expect(html).toContain("if (e.pointerId !== IH.dragId) return;");
    expect(html).toContain("IH.mode = dx >= dy ? 'scrub' : 'scroll';");
    expect(html).toContain('scroller().scrollTop -= step;');
    expect(html).toContain('fling(IH.velocity);');
    expect(html).toContain('setPointerCapture(e.pointerId)');
    expect(html).toContain('IH.hideTimer = setTimeout(() => live().hide(), 2400);');
    expect(html).toContain("touch ? { touch: true } : null");
  });

  it('图表监听每个容器只绑一次，重绘只换委托，避免监听叠加把滚动放大 N 倍', () => {
    expect(html).toContain('const IH = host._ih || (host._ih = {');
    expect(html).toContain('IH.api = { showAt, hide, indexFromEvent };');
    expect(html).toContain('if (!host._ihBound) {');
    expect(html).toContain('host._ihBound = true;');
    // 一次重绘只允许出现一套 addEventListener 绑定
    expect((html.match(/host\.addEventListener\('pointermove'/g) || []).length).toBe(1);
    expect((html.match(/host\.addEventListener\('pointerdown'/g) || []).length).toBe(1);
  });

  it('图表是自绘 SVG，没有 canvas 依赖', () => {
    expect(html).not.toContain('<canvas');
    expect(html).toContain('createElementNS');
  });
});

describe('首屏数据注入', () => {
  const boot = {
    generatedAt: '2026-10-31T03:00:00.000Z',
    meta: { dailyFrom: '2026-10-10', dailyTo: '2026-10-31', timezone: 'Asia/Shanghai' },
    daily: [['2026-10-31', 56, 42, 36000000, 150, 1020, 0, 0, 0, 0, 0, 0, 0]],
    render: [{ v: '3.1.7', samples: 659, avgMs: 233 }],
  };

  it('注入 JSON 与构建号，占位符全部被替换', () => {
    const out = renderDashboard(html, boot, BUILD_ID);
    expect(out).not.toContain(PLACEHOLDER_BOOT);
    expect(out).not.toContain(PLACEHOLDER_BUILD);
    expect(out).toContain('"dailyFrom":"2026-10-10"');
    expect(out).toContain('"avgMs":233');
    expect(out).toContain(BUILD_ID);
    expect((out.match(/<\/script>/g) || []).length).toBe(3);
  });

  it('上报数据里的脚本结束标签被转义，不会提前闭合脚本', () => {
    const evil = { note: '</script><script>alert(1)</script>', line: '\u2028\u2029' };
    const out = renderDashboard(html, evil);
    expect(out).not.toContain('</script><script>alert(1)');
    expect(out).toContain('\\u003c/script\\u003e');
    expect((out.match(/<\/script>/g) || []).length).toBe(3);
    expect(serializeBoot(evil)).not.toMatch(/[\u2028\u2029]/);
  });

  it('占位符缺失时直接抛错，避免部署出空看板', () => {
    expect(() => renderDashboard('<html></html>', boot)).toThrow(/占位符/);
  });

  it('空数据也能注入（冷启动返回全零结构）', () => {
    const out = renderDashboard(html, null);
    expect(out).toContain('window.__TEL_BOOT__ = null;');
    expect(out).toContain(BUILD_ID);
  });
});
