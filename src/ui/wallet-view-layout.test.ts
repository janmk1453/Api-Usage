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

  test('头部是四区网格：标识 / 名称 / 余额 / 操作，操作只剩展开与忽略', () => {
    expect(renderSrc).toContain('class="aus-wallet-header"');
    expect(renderSrc).toContain('class="aus-wallet-identity"');
    expect(renderSrc).toContain('class="aus-wallet-metrics"');
    expect(renderSrc).toContain('class="aus-wallet-actions"');
    expect(renderSrc).toContain('data-wallet-toggle="1"');
    expect(renderSrc).toContain('data-wallet-ignore="1"');
    // 价格同步不摆在钱包外面：头部片段里不许出现同步按钮
    const headerSrc = renderSrc.slice(renderSrc.indexOf('const header = ['), renderSrc.indexOf('const keyRow'));
    expect(headerSrc).not.toContain('data-wallet-sync');
  });

  test('价格同步按钮在「模型与价格」段的动作区里', () => {
    const modelSrc = renderSrc.slice(renderSrc.indexOf('const modelSection = ['));
    expect(modelSrc).toContain('data-wallet-sync="1"');
    expect(modelSrc).toContain('同步价格');
    expect(modelSrc).toContain('icon(\'refresh\', 14)');
  });

  test('余额不再重复两遍：头部数字 + 段内手工输入', () => {
    expect(renderSrc).toContain('class="aus-wallet-balance-label"');
    expect(renderSrc).not.toContain('aus-wallet-balance-val');
    expect(css).toContain('#aus-panel .aus-wallet-balance-label {');
  });

  test('余额与校准段宽屏排成两栏，右侧不再是一大片空的', () => {
    expect(renderSrc).toContain('class="aus-wallet-balance-grid"');
    expect(renderSrc).toContain('class="aus-wallet-balance-col"');
    expect(renderSrc).toContain('class="aus-wallet-calib-col"');
    // 已识别密钥跟手工余额一起放左栏，校准控件整体进右栏
    const balanceSrc = renderSrc.slice(renderSrc.indexOf('const balanceSection = ['), renderSrc.indexOf('const modelSection = ['));
    expect(balanceSrc).toContain('class="aus-wallet-balance-col"');
    expect(balanceSrc).toContain('已识别密钥');
    expect(balanceSrc).toContain('aus-wallet-calib-col');
    // 左栏别只剩一行：密钥摘要 + 上次校准都跟着手工余额
    expect(balanceSrc).toContain('上次校准：');
    expect(balanceSrc).toContain('wallet.balance.lastCalibrated');
    expect(css).toContain('#aus-panel .aus-wallet-balance-grid { display: grid; grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);');
    // 窄屏两套断点各一条，回单栏
    expect((css.match(/#aus-panel \.aus-wallet-balance-grid \{ grid-template-columns: minmax\(0, 1fr\); gap: 10px; \}/g) || []).length).toBe(2);
  });

  test('峰谷开关与上下文上限并排，第二行不再各占一行', () => {
    const footStart = renderSrc.indexOf('aus-wallet-mname-foot');
    const footSrc = renderSrc.slice(footStart, footStart + 900);
    expect(footSrc).toContain('aus-wallet-peak-toggle');
    expect(footSrc).toContain('aus-wallet-mctx');
    expect(css).toContain('#aus-panel .aus-wallet-mname-foot { display: flex; align-items: center; gap: 4px 10px;');
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
  test('未启用峰谷的模型不展示高峰价，但那三个输入仍留在 DOM 里', () => {
    expect(renderSrc).toContain("tierHTML('offpeak')");
    expect(renderSrc).toContain("tierHTML('peak')");
    // 只隐藏、不删：readModelPrices 按 input 读值，缺一格就会把历史高峰价清成 0
    expect(renderSrc).toContain("const hidden = tier === 'peak' && !peakOn;");
    expect(renderSrc).toContain('data-peak-hidden="1"');
    expect(css).toContain("#aus-panel .aus-wallet-mtier[data-peak-hidden='1'] { display: none; }");
    expect(renderSrc).not.toContain('data-off="1"');
    expect(renderSrc).toContain("(['hit', 'miss', 'output'] as WalletPriceKey[])");
    expect(renderSrc).toContain('data-wallet-price="1"');
    expect(renderSrc).toContain("querySelectorAll('input[data-wallet-price]')");
  });

  test('启用峰谷才并排两组价格，组标签随开关换文案', () => {
    expect(renderSrc).toContain("'  <div class=\"aus-wallet-prices' + (peakOn ? ' is-split' : '') + '\">',");
    expect(renderSrc).toContain("(peakOn ? TIER_LABEL[tier] : '价格')");
    expect(css).toContain('#aus-panel .aus-wallet-prices.is-split { grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('#aus-panel .aus-wallet-prices:not(.is-split) .aus-wallet-pricegrid { grid-template-columns: repeat(3, minmax(0, 180px)); }');
    // 窄屏两组叠成一列（两套断点都要）
    expect((css.match(/#aus-panel \.aus-wallet-prices\.is-split \{ grid-template-columns: minmax\(0, 1fr\); gap: 10px; \}/g) || []).length).toBe(2);
  });

  test('峰谷开关摆在模型行上（不再藏进 ⋯ 菜单），菜单只留锁定与删除', () => {
    expect(renderSrc).toContain('class="aus-wallet-peak-toggle"');
    expect(renderSrc.indexOf('data-wallet-model-peak="1"')).toBeLessThan(renderSrc.indexOf('class="aus-wallet-mops"'));
    const menuSrc = renderSrc.slice(renderSrc.indexOf('const menu =')).split('\n').slice(0, 9).join('\n');
    expect(menuSrc).not.toContain('data-wallet-model-peak');
    expect(menuSrc).toContain('data-wallet-model-lock="1"');
    expect(menuSrc).toContain('data-wallet-model-delete="1"');
    expect(renderSrc).toContain('class="aus-wallet-more-btn"');
  });

  test('价格标签就在输入框上，不再有重复的表头', () => {
    expect(renderSrc).toContain('class="aus-wallet-pf"');
    expect(renderSrc).toContain("PRICE_KEY_LABEL[key]");
    expect(css).toContain('#aus-panel .aus-wallet-pf > span { font-size: var(--aus-fs-xs);');
    expect(css).not.toContain('.aus-wallet-table-head');
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
  test('模型行宽屏三列（名称 / 价格 / 操作），窄屏变卡片，两套断点同步', () => {
    expect(css).toMatch(/\.aus-wallet-mrow \{/);
    // 模型名列给上限，余量留给价格；价格组内部再决定一组还是两组
    expect(css).toContain('grid-template-columns: minmax(200px, 320px) minmax(0, 1fr) 96px;');
    expect((css.match(/grid-template-columns: minmax\(200px, 320px\) minmax\(0, 1fr\) 96px;/g) || []).length).toBe(1);
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

  test('组标签在两套断点里都显示，不再靠宽屏表头', () => {
    expect(css).toContain('#aus-panel .aus-wallet-mtier-label { font-size: var(--aus-fs-xs);');
    expect(css).not.toContain('#aus-panel .aus-wallet-mtier-label { display: none;');
    // 峰谷关闭改成行上的开关，旧的行内「已关闭」提示与灰字段已删干净
    expect(renderSrc).not.toContain('aus-wallet-meta-off');
    expect(css).not.toContain('.aus-wallet-meta-off');
    expect(css).not.toContain('.aus-wallet-mtier-off');
  });

  test('价格来源灰字只说胶囊写不下的信息', () => {
    expect(renderSrc).toContain("status.pending ? status.pending + ' 个待匹配' : status.synced ? '已同步 ' + status.synced + ' 个' : ''");
    expect(renderSrc).toContain('(noteText');
    expect(renderSrc).not.toContain("esc(status.label) + (status.pending ?");
  });

  test('套餐块不再套一层白底卡片', () => {
    expect(planSrc).toContain('class="aus-wallet-plan"');
    expect(planSrc).not.toContain('background:var(--ds-card-inner);border-radius:10px');
    expect(css).toContain('#aus-panel .aus-wallet-plan {');
  });
});
