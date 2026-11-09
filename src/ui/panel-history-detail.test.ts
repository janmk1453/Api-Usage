import { describe, it, expect } from 'vitest';
// 直接读源码字符串（与 panel-bottomnav.test.ts 同套路，避免引入 node 类型）
import panelSrc from './panel.ts?raw';
import cssSrc from '../../style.css?raw';

function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (line.trim().startsWith('//') ? '' : line))
    .join('\n');
}

const panelCode = stripComments(panelSrc);

describe('历史记录详情：抽屉结构', () => {
  it('抽屉分头部与滚动区，头部含把手、两行标题与关闭按钮', () => {
    expect(panelCode).toContain('<div id="aus-history-detail-head">');
    expect(panelCode).toContain('<span id="aus-history-detail-grip" aria-hidden="true"></span>');
    expect(panelCode).toContain('<span id="aus-history-detail-title">');
    expect(panelCode).toContain('<span id="aus-history-detail-sub"></span>');
    expect(panelCode).toContain('<div id="aus-history-detail-body"></div>');
  });

  it('标题第一行写模型名、第二行写时间，没有时间就隐藏第二行', () => {
    expect(panelCode).toContain("const modelName = btn.getAttribute('data-model') || '记录详情';");
    expect(panelCode).toContain("sub.style.display = recordTime ? '' : 'none';");
  });
});

describe('历史记录详情：四块信息与占比条', () => {
  it('四块用 aus-dt-block 卡片，两行排布', () => {
    expect(panelCode).toContain('<section class="aus-dt-block">');
    expect(panelCode).toContain('<div class="aus-dt-head">基础信息</div>');
    expect(panelCode).toContain('<div class="aus-dt-head">性能</div>');
    expect(panelCode).toContain('<div class="aus-dt-head">Token 消耗</div>');
    expect(panelCode).toContain('<div class="aus-dt-head">费用明细</div>');
    expect((panelCode.match(/class="aus-dt-row"/g) || []).length).toBe(2);
  });

  it('Token 块有迷你三段占比条，颜色与全站同源', () => {
    expect(panelCode).toContain('<div class="aus-dt-bar"');
    expect(panelCode).toContain('background:var(--aus-token-hit)');
    expect(panelCode).toContain('background:var(--aus-token-miss)');
    expect(panelCode).toContain('background:var(--aus-token-output)');
  });

  it('费用块总费用使用 is-total 强调行', () => {
    expect(panelCode).toContain('<div class="aus-dt-cost-row is-total">');
  });
});

describe('历史记录详情：Tab 栏', () => {
  it('Tab 用短名，避免窄屏挤爆', () => {
    expect(panelCode).toContain('data-tab="req" data-ts="${h.timestamp}" data-active="1" role="tab">请求参数</button>');
    expect(panelCode).toContain('data-tab="res" data-ts="${h.timestamp}" role="tab">完整响应</button>');
    expect(panelCode).toContain('data-tab="raw" data-ts="${h.timestamp}" role="tab">Raw 用量</button>');
    expect(panelCode).toContain('data-tab="msg" data-ts="${h.timestamp}" role="tab">消息内容</button>');
    expect(panelCode).not.toContain('请求参数（Request）');
  });

  it('选中态交给 CSS 属性，不再逐颗写 inline 颜色', () => {
    expect(panelCode).toContain("root.querySelectorAll('.aus-tab-btn').forEach((b: any) => b.removeAttribute('data-active'));");
    expect(panelCode).toContain("(btn as HTMLElement).setAttribute('data-active', '1');");
    expect(panelCode).not.toContain("b.style.background = 'var(--ds-card-inner)'");
    expect(panelCode).not.toContain("b.style.borderColor = 'var(--ds-orange)'");
  });
});

describe('历史记录详情：样式与动效', () => {
  it('抽屉灰底配白卡，块内不画描边', () => {
    expect(cssSrc).toContain('#aus-history-detail {');
    expect(cssSrc).toContain('background: var(--ds-card);');
    expect(cssSrc).toContain('border-radius: 12px;');
    expect(cssSrc).toContain('background: var(--ds-card-inner);');
  });

  it('四个入场动画齐备：抽屉左右滑入、手机底部上滑、面板与 Tab 内容淡入', () => {
    expect(cssSrc).toContain('@keyframes ausDetailSlideRight {');
    expect(cssSrc).toContain('@keyframes ausDetailSlideUp {');
    expect(cssSrc).toContain('@keyframes ausDetailBodyIn {');
    expect(cssSrc).toContain('@keyframes ausDetailTabIn {');
    expect(cssSrc).toContain('animation-name: ausDetailSlideUp;');
    expect(cssSrc).toContain('.aus-detail-panel .aus-tab-btn[data-active="1"]');
  });

  it('窄屏浮层抬到底栏之上，并显示把手', () => {
    expect(cssSrc).toContain('bottom: calc(var(--aus-bottomnav-h, 58px) + env(safe-area-inset-bottom)) !important;');
    expect(cssSrc).toContain('#aus-history-detail-grip { display: none; }');
    expect(cssSrc).toMatch(/#aus-history-detail-grip \{[^}]*display: block;/);
  });

  it('抽屉内详情面板取消限高，避免出现双层滚动', () => {
    expect(cssSrc).toContain('#aus-history-detail .aus-detail-panel {');
    expect(cssSrc).toContain('max-height: none !important;');
    expect(cssSrc).toContain('overflow: visible !important;');
  });

  it('系统开启减少动态效果时全部动画与过渡关闭', () => {
    expect(cssSrc).toContain('@media (prefers-reduced-motion: reduce) {');
    expect(cssSrc).toContain('animation: none !important;');
  });
});
