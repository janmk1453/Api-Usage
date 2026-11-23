/**
 * 历史记录页 / 统计页筛选行右侧两枚动作（重置筛选、历史页的请求日志）必须与同排筛选胶囊
 * （.aus-pill）同高同字。2026-11-23 用户截图：重置筛选是内联 8px 12px + 14px，请求日志挂的是小号
 * .aus-pill-sm（6px 10px / 12px），两者贴着放明显一大一小。
 * 这里守三件事：请求日志不再挂小号胶囊；重置筛选的尺寸只能来自样式表（模板写内联就不跟窄屏收）；
 * 样式表给出的桌面 / 窄屏口径与 .aus-pill 完全一致。
 */
import { describe, it, expect } from 'vitest';
import cssSrc from '../../style.css?raw';
import panelSrc from './panel.ts?raw';

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

const panelCode = stripComments(panelSrc);

function attrOf(id: string, attr: string): string {
  const tag = new RegExp('<[a-z]+ id="' + id + '"[^>]*>').exec(panelCode);
  if (!tag) throw new Error('模板里找不到 #' + id);
  const m = new RegExp(attr + '="([^"]*)"').exec(tag[0]);
  return m ? m[1] : '';
}

function block(selector: string, scope: string = cssSrc): string {
  const idx = scope.indexOf(selector);
  if (idx < 0) throw new Error('样式表里找不到 ' + selector);
  const start = scope.indexOf('{', idx);
  const end = scope.indexOf('}', start);
  return scope.slice(start + 1, end);
}

describe('筛选行右侧动作：与筛选胶囊同尺寸', () => {
  it('历史页「请求日志」不再挂小号胶囊，与筛选胶囊同为 .aus-pill', () => {
    const cls = attrOf('aus-history-log-btn', 'class');
    expect(cls).toContain('aus-pill');
    expect(cls).not.toContain('aus-pill-sm');
  });

  it('重置筛选的尺寸只在样式表里，模板不再写内联 padding / font-size', () => {
    for (const id of ['aus-history-filter-reset', 'aus-stats-filter-reset']) {
      const style = attrOf(id, 'style');
      expect(style).not.toContain('padding');
      expect(style).not.toContain('font-size');
      // 外形与底色仍留在内联（背景是简写，会吃掉 hover 叠层，见 .aus-pill 段注释）
      expect(style).toContain('border-radius:999px');
      expect(style).toContain('background:transparent');
    }
  });

  it('样式表给重置筛选的口径与 .aus-pill 桌面口径一致', () => {
    const reset = block('#aus-panel #aus-stats-filter-reset,');
    const pill = block('#aus-panel .aus-pill {');
    for (const decl of ['padding: 6px 11px', 'min-height: 32px', 'font-size: var(--aus-fs-base)', 'box-sizing: border-box']) {
      expect(pill).toContain(decl);
      expect(reset).toContain(decl);
    }
  });

  it('窄屏（≤760px）重置筛选跟着胶囊一起收小', () => {
    const media = /@media \(max-width: 760px\) \{\s*#aus-panel \.aus-pill \{([^}]*)\}/.exec(cssSrc);
    expect(media).toBeTruthy();
    const pillNarrow = (media as RegExpExecArray)[1];
    const resetNarrow = /@media \(max-width: 760px\) \{\s*#aus-panel #aus-stats-filter-reset,\s*#aus-panel #aus-history-filter-reset \{([^}]*)\}/.exec(cssSrc);
    expect(resetNarrow).toBeTruthy();
    const reset = (resetNarrow as RegExpExecArray)[1];
    for (const decl of ['padding: 6px 10px', 'min-height: 30px', 'font-size: var(--aus-fs-sm)']) {
      expect(pillNarrow).toContain(decl);
      expect(reset).toContain(decl);
    }
  });

  it('窄屏容器查询下重置筛选仍是图标按钮（尺寸不让上面的胶囊口径顶掉）', () => {
    const region = cssSrc.slice(cssSrc.indexOf('@container ausbody (max-width: 760px) {', cssSrc.indexOf('#aus-panel #aus-stats-filter-reset,')));
    const iconBtn = block('#aus-panel .aus-filter-reset {', region.slice(0, region.indexOf('@container ausbody (max-width: 420px)')));
    expect(iconBtn).toContain('width: 36px');
    expect(iconBtn).toContain('padding: 0 !important');
  });
});
