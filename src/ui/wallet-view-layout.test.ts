import { describe, expect, test } from 'vitest';
import walletSrc from './wallet-view.ts?raw';
import planSrc from './wallet-plan.ts?raw';
import switchSrc from './switch.ts?raw';
import cssSrc from '../../style.css?raw';

/** 去掉注释，避免注释里的反例（例如「不要再写 xxx」）被当成实现命中 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const src = stripComments(walletSrc);
const bindStart = src.indexOf('function bindWalletView');
const renderSrc = bindStart > 0 ? src.slice(0, bindStart) : src;
const css = cssSrc;

describe('钱包页：卡片结构', () => {
  test('卡内只有三段（余额与校准 / 模型与价格 / 套餐额度）+ 末尾一行折叠的峰谷规则', () => {
    const secCount = (renderSrc.match(/class="aus-wallet-sec"/g) || []).length;
    expect(secCount).toBe(3);
    expect(renderSrc).toContain('class="aus-wallet-sec aus-wallet-sec-billing"');
    // 旧的「两栏」结构已废弃，别再回来
    expect(renderSrc).not.toContain('aus-wallet-two-col');
  });

  test('头部是四区网格：标识 / 名称 / 余额 / 操作，操作只有展开、同步、忽略', () => {
    expect(renderSrc).toContain('class="aus-wallet-header"');
    expect(renderSrc).toContain('class="aus-wallet-identity"');
    expect(renderSrc).toContain('class="aus-wallet-metrics"');
    expect(renderSrc).toContain('class="aus-wallet-actions"');
    expect(renderSrc).toContain('data-wallet-toggle="1"');
    expect(renderSrc).toContain('data-wallet-sync="1"');
    expect(renderSrc).toContain('data-wallet-ignore="1"');
  });

  test('渲染区不写字面尺寸，只允许动态 display 与头像主题色变量', () => {
    const styles = [...renderSrc.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      // 允许：display:none / display:' + (折叠态三元) / --aus-wallet-avatar-bg:' + esc(颜色)
      expect(style.startsWith('display:') || style.startsWith('--aus-wallet-avatar-bg:')).toBe(true);
    }
    expect(renderSrc).not.toMatch(/style="[^"]*(padding|margin|border-radius|font-size|background)\s*:/);
  });
});

describe('钱包页：峰谷规则默认折叠', () => {
  test('折叠状态只在会话内记住，不落盘、不进设置', () => {
    expect(renderSrc).toContain('const billingOpenWallets = new Set<string>();');
    expect(renderSrc).toContain('billingOpenWallets.has(');
    // 折叠状态不能写进 WalletConfig（那样会跟着导出与 WebDAV 同步跑）
    expect(renderSrc).not.toMatch(/wallet\.billingOpen|billingOpen\s*[:=]\s*(true|false)/);
    expect(renderSrc).not.toContain('saveHot');
  });

  test('末行按钮带 aria-expanded 与概要文案，展开才渲染时段编辑', () => {
    expect(renderSrc).toContain('data-wallet-billing-toggle="1"');
    expect(renderSrc).toContain("aria-expanded=\"' + (billingOpen ? 'true' : 'false')");
    expect(renderSrc).toContain('class="aus-wallet-billing-summary"');
    expect(renderSrc).toContain('class="aus-wallet-billing-body"');
    expect(renderSrc).toContain('peaksHTML(wallet)');
  });
});

describe('钱包页：模型与价格', () => {
  test('峰谷关闭只淡化峰谷列，绝不删掉那三个价格输入（否则保存会把历史峰谷价写成 0）', () => {
    expect(renderSrc).toContain("tierHTML('offpeak')");
    expect(renderSrc).toContain("tierHTML('peak')");
    expect(renderSrc).toContain("const off = tier === 'peak' && peakOff;");
    expect(renderSrc).toContain('data-off="1"');
    // 每组仍是 命中 / 未命中 / 输出 三个输入，且都挂 data-wallet-price
    expect(renderSrc).toContain("(['hit', 'miss', 'output'] as WalletPriceKey[])");
    expect(renderSrc).toContain('data-wallet-price="1"');
    expect(renderSrc).toContain("querySelectorAll('input[data-wallet-price]')");
  });

  test('行尾 ⋯ 菜单收着峰谷开关、锁定与删除', () => {
    expect(renderSrc).toContain('data-wallet-more-btn="1"');
    expect(renderSrc).toContain('data-wallet-model-peak="1"');
    expect(renderSrc).toContain('data-wallet-model-lock="1"');
    expect(renderSrc).toContain('data-wallet-model-delete="1"');
    expect(renderSrc).toContain('class="aus-wallet-menu-item"');
    // 内置模型不可删除时要给一句话，而不是空白菜单
    expect(renderSrc).toContain('class="aus-wallet-menu-note"');
  });

  test('价格输入旁的「命中 / 未命中 / 输出」标签就近显示（窄屏才露出）', () => {
    expect(renderSrc).toContain('class="aus-wallet-pf"');
    expect(renderSrc).toContain("PRICE_KEY_LABEL[key]");
    expect(css).toContain('#aus-panel .aus-wallet-pf > span { display: none;');
    expect((css.match(/#aus-panel \.aus-wallet-pf > span \{ display: inline; \}/g) || []).length).toBe(2);
  });
});

describe('钱包页：余额与校准', () => {
  test('保存密钥默认收起成文字链，点开才是输入框', () => {
    expect(renderSrc).toContain('const keyOpenWallets = new Set<string>();');
    expect(renderSrc).toContain('keyOpenWallets.has(');
    expect(renderSrc).toContain('data-wallet-key-toggle="1"');
    expect(renderSrc).toContain('data-wallet-save-key="1"');
    expect(renderSrc).toContain('class="aus-wallet-linkbtn"');
  });

  test('自动校准与周末低谷开关用 data 透传，复用既有绑定', () => {
    expect(switchSrc).toContain('opts.data');
    expect(renderSrc).toContain("'data-wallet-auto-balance': '1'");
    expect(renderSrc).toContain("'data-wallet-weekend': '1'");
    expect(renderSrc).toContain('data-wallet-calibrate="1"');
  });

  test('已识别密钥只出现一次，并压缩成「N 个 · 末位 …」', () => {
    expect((renderSrc.match(/已识别密钥/g) || []).length).toBe(1);
    expect(renderSrc).toContain('credentialSummary(wallet)');
  });
});

describe('钱包页：样式口径', () => {
  test('模型行宽屏四列、窄屏变卡片，两套断点同步', () => {
    expect(css).toMatch(/\.aus-wallet-mrow \{/);
    expect(css).toContain('grid-template-columns: minmax(180px, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) 96px;');
    const narrow = css.match(/#aus-panel \.aus-wallet-mrow \{[^}]*grid-template-columns: minmax\(0, 1fr\)/g) || [];
    expect(narrow.length).toBe(2);
    // 两套断点都要有，缺一套部分机型不生效
    expect(css).toContain('@media (max-width: 760px) {');
    expect(css).toContain('@container ausbody (max-width: 760px) {');
    expect(css).toContain('@media (max-width: 400px) {');
    expect(css).toContain('@container ausbody (max-width: 400px) {');
  });

  test('窄屏隐藏冗余徽标，桌面主按钮只有黑底一枚', () => {
    expect((css.match(/#aus-panel \.aus-wallet-badge-relay \{ display: none; \}/g) || []).length).toBe(2);
    expect(css).toContain('#aus-panel .aus-btn-primary {');
    expect(css).toContain('#aus-panel .aus-field {');
    expect(css).not.toContain('.aus-wallet-two-col');
  });

  test('套餐块不再套一层白底卡片', () => {
    expect(planSrc).toContain('class="aus-wallet-plan"');
    expect(planSrc).not.toContain('background:var(--ds-card-inner);border-radius:10px');
    expect(css).toContain('#aus-panel .aus-wallet-plan {');
  });
});
