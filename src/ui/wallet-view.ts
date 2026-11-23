import { icon } from './icons';
import { repository } from '../data/repository';
import {
  cloneWallet,
  defaultContextLimitForModel,
  walletBalanceToCny,
  walletPendingModelCount,
} from '../data/wallets';
import { formatMoney, getDisplayCurrency, getWalletExchangeRate } from '../services/currency';
import { queryWalletBalance } from '../services/balance';
import { getWalletApiKey, saveWalletApiKey } from '../services/wallet-secrets';
import { walletSyncStatus } from '../services/pricing-sync';
import { openWalletSyncPreview } from './wallet-sync-preview';
import { resolveVendor, vendorById, vendorInitialFallback } from '../services/provider-registry';
import { BALANCE_ADAPTERS, resolveBalanceAdapter } from '../services/balance-adapters';
import { renderPlanBlock, bindPlanBlock, hasPlanCapability } from './wallet-plan';
import { afterNextPaint, closeDropdownInstant } from './dropdown-close';
import { switchHTML } from './switch';
import { vendorIconSvg } from './vendor-icons';
import { toast } from '../utils/logger';
import { esc } from '../utils/date';
import { CN_HOLIDAY_COVERAGE_LABEL } from '../constants/holidays';
import {
  DEEPSEEK_WALLET_ID,
  WALLET_CATALOG_PROVIDERS,
  type WalletConfig,
  type WalletCurrency,
  type WalletModel,
  type WalletPriceTier,
} from '../types/wallet';

/* 钱包卡内部只有三段内容：余额与校准 / 模型与价格 / 套餐额度，峰谷规则降为末尾一行可折叠摘要。
   所有尺寸与配色都在 style.css 的「钱包页（重做）」段里；模板只保留动态值（浮层 display、隐藏条目的显隐）。
   峰谷折叠与「保存密钥」的展开状态只在本会话记住，不落盘、不进导出与同步。 */
const billingOpenWallets = new Set<string>();
const keyOpenWallets = new Set<string>();

type WalletPriceKey = 'hit' | 'miss' | 'output';

const TIER_LABEL: Record<'offpeak' | 'peak', string> = { offpeak: '非峰', peak: '高峰' };
const PRICE_KEY_LABEL: Record<WalletPriceKey, string> = { hit: '命中', miss: '未命中', output: '输出' };

function getDoc(): Document {
  return (window.parent as any)?.document ?? document;
}

function money(cny: number, digits = 4): string {
  try { return formatMoney(cny, digits); } catch { return `¥${cny.toFixed(digits)} CNY`; }
}

function walletBalanceText(wallet: WalletConfig): string {
  const amount = wallet.balance.amount == null || wallet.balance.amount === ''
    ? NaN
    : parseFloat(String(wallet.balance.amount));
  if (!Number.isFinite(amount)) return '未设置';
  return `${wallet.balance.currency === 'USD' ? '$' : '¥'}${amount.toFixed(2)} ${wallet.balance.currency}`;
}

function displayToCny(value: unknown): number {
  const number = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(number)) return 0;
  const currency = getDisplayCurrency();
  return currency.code === 'USD' ? number * currency.rate : number;
}

function cnyToDisplay(value: unknown): string {
  const number = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(number)) return '0';
  const currency = getDisplayCurrency();
  const result = currency.code === 'USD' ? number / currency.rate : number;
  return String(Math.round(result * 1000000) / 1000000);
}

function closeDropdowns(): void {
  const doc = getDoc();
  doc.querySelectorAll('[data-wallet-dropdown]').forEach((el: any) => {
    el.style.display = 'none';
  });
}

/** 选中某一项后要重建钱包页时用：先瞬时收掉全部浮层，重绘留到下一帧。 */
function closeDropdownsInstant(): void {
  const doc = getDoc();
  doc.querySelectorAll('[data-wallet-dropdown]').forEach((el: any) => {
    closeDropdownInstant(el);
  });
}

function closeOtherDropdowns(id: string): void {
  const doc = getDoc();
  doc.querySelectorAll('[data-wallet-dropdown]').forEach((el: any) => {
    if (el.id !== id) el.style.display = 'none';
  });
}

function dropdownHtml(
  walletId: string,
  kind: string,
  options: Array<{ id: string; label: string; active?: boolean }>,
): string {
  return options.map((option) =>
    '<div class="aus-wallet-drop-opt' + (option.active ? ' is-active' : '') + '" data-wallet-select="' + esc(kind)
      + '" data-wallet-id="' + esc(walletId) + '" data-value="' + esc(option.id) + '">'
      + esc(option.label) + '</div>',
  ).join('');
}

/** 浮层外壳：样式全在 CSS，只有 display 是动态值。 */
function dropPanelHTML(id: string, body: string, opt: { align?: 'left' | 'right'; wide?: boolean } = {}): string {
  const cls = 'aus-wallet-drop is-' + (opt.align || 'left') + (opt.wide ? ' is-wide' : '');
  return '<div id="' + esc(id) + '" data-wallet-dropdown="1" class="' + cls + '" style="display:none;">' + body + '</div>';
}

function sourceLabel(model: WalletModel): string {
  if (model.source === 'builtin') return '内置';
  if (model.source === 'sync') return '同步';
  if (model.source === 'manual') return '自定义';
  return '待定价';
}

function priceField(
  walletId: string,
  modelId: string,
  tier: 'offpeak' | 'peak',
  key: WalletPriceKey,
  value: number,
  pending = false,
): string {
  return '<input type="number" step="0.000001" min="0" inputmode="decimal" class="aus-field aus-field-num aus-wallet-price'
    + (pending ? ' is-pending' : '') + '" data-wallet-price="1" data-wallet-id="' + esc(walletId)
    + '" data-model-id="' + esc(modelId) + '" data-tier="' + tier + '" data-key="' + key
    + '" value="' + esc(cnyToDisplay(value)) + '" aria-label="' + TIER_LABEL[tier] + PRICE_KEY_LABEL[key] + '" />';
}

/** 已识别密钥压缩成一行摘要：`2 个 · 末位 aad/9f3`，不再把每个标签铺成一行。 */
function credentialSummary(wallet: WalletConfig): string {
  const list = wallet.credentials || [];
  if (!list.length) return '未识别';
  const tails = Array.from(new Set(list.map((item) => String(item.label || '').trim().slice(-4) || '—')));
  return list.length + ' 个 · 末位 ' + tails.join('/');
}

function peaksHTML(wallet: WalletConfig): string {
  const items = wallet.peakHours.length
    ? wallet.peakHours.map((item, index) => [
        '<div class="aus-wallet-peak-chip">',
        '  <input type="time" class="aus-field aus-wallet-peak-time" data-wallet-peak="1" data-wallet-id="' + esc(wallet.id)
          + '" data-peak-index="' + index + '" data-peak-field="start" value="' + esc(item.start) + '" aria-label="高峰开始" />',
        '  <span class="aus-wallet-peak-dash">–</span>',
        '  <input type="time" class="aus-field aus-wallet-peak-time" data-wallet-peak="1" data-wallet-id="' + esc(wallet.id)
          + '" data-peak-index="' + index + '" data-peak-field="end" value="' + esc(item.end) + '" aria-label="高峰结束" />',
        '  <button type="button" class="aus-wallet-chip-x" data-wallet-peak-delete="1" data-wallet-id="' + esc(wallet.id)
          + '" data-peak-index="' + index + '" aria-label="删除该时段">' + icon('close', 12) + '</button>',
        '</div>',
      ].join('')).join('')
    : '<span class="aus-wallet-hint">暂无高峰时段</span>';
  return [
    '<div class="aus-wallet-peaks">',
    items,
    '  <button type="button" class="aus-wallet-chip-add" data-wallet-add-peak="1" data-wallet-id="' + esc(wallet.id) + '">+ 添加时段</button>',
    '</div>',
  ].join('');
}

function modelRowHTML(wallet: WalletConfig, model: WalletModel): string {
  const pending = !model.price.priceConfigured;
  const canDelete = model.source !== 'builtin';
  const peakOff = !model.price.usePeakPricing;
  const meta = esc(model.sourceModel)
    + (model.aliases.length ? ' · 别名 ' + esc(model.aliases.join('、')) : '')
    + (model.hidden === true ? ' · 已隐藏' : '');
  const matchLine = model.priceMatch
    ? '<div class="aus-wallet-mmeta" title="来源：' + esc(model.priceMatch.provider + ' / ' + model.priceMatch.catalogModel) + '">↳ '
      + esc(model.priceMatch.catalogModel) + ' · ' + Math.round(model.priceMatch.score * 100) + '%</div>'
    : '';
  const tierHTML = (tier: 'offpeak' | 'peak') => {
    const parts = (['hit', 'miss', 'output'] as WalletPriceKey[]).map((key) =>
      '<label class="aus-wallet-pf"><span>' + PRICE_KEY_LABEL[key] + '</span>'
      + priceField(wallet.id, model.id, tier, key, model.price[tier][key], pending) + '</label>',
    );
    const off = tier === 'peak' && peakOff;
    return [
      '<div class="aus-wallet-mtier" data-tier="' + tier + '"' + (off ? ' data-off="1"' : '') + '>',
      '  <div class="aus-wallet-mtier-label">' + TIER_LABEL[tier] + (off ? ' <span class="aus-wallet-mtier-off">已关闭</span>' : '') + '</div>',
      '  <div class="aus-wallet-pricegrid">' + parts.join('') + '</div>',
      '</div>',
    ].join('');
  };
  const menu = '<div id="aus-wallet-model-drop-' + esc(model.id) + '" data-wallet-dropdown="1" class="aus-wallet-drop is-right" style="display:none;">'
    + '<label class="aus-wallet-menu-item"><input type="checkbox" class="aus-checkbox" data-wallet-model-peak="1" data-wallet-id="' + esc(wallet.id)
    + '" data-model-id="' + esc(model.id) + '"' + (model.price.usePeakPricing ? ' checked' : '') + ' /> 峰谷计价</label>'
    + '<label class="aus-wallet-menu-item"><input type="checkbox" class="aus-checkbox" data-wallet-model-lock="1" data-wallet-id="' + esc(wallet.id)
    + '" data-model-id="' + esc(model.id) + '"' + (model.locked ? ' checked' : '') + ' /> 锁定价格</label>'
    + (canDelete
      ? '<button type="button" class="aus-wallet-menu-item is-danger" data-wallet-model-delete="1" data-wallet-id="' + esc(wallet.id)
        + '" data-model-id="' + esc(model.id) + '">删除模型</button>'
      : '<div class="aus-wallet-menu-note">内置模型不可删除</div>')
    + '</div>';
  return [
    '<div class="aus-wallet-mrow" data-wallet-model-row="' + esc(model.id) + '"'
      + (model.hidden === true ? ' data-hidden="1"' : '') + (pending ? ' data-pending="1"' : '') + '>',
    '  <div class="aus-wallet-mname">',
    '    <input class="aus-field aus-wallet-model-name" data-wallet-model-name="1" data-wallet-id="' + esc(wallet.id)
      + '" data-model-id="' + esc(model.id) + '" value="' + esc(model.model) + '" aria-label="模型名" />',
    '    <div class="aus-wallet-mmeta">' + meta + '</div>',
    matchLine,
    '    <label class="aus-wallet-mctx">上下文',
    '      <input type="number" min="1" step="1000" class="aus-field aus-field-num aus-wallet-ctx" data-wallet-context-limit="1" data-wallet-id="' + esc(wallet.id)
      + '" data-model-id="' + esc(model.id) + '" value="' + (model.contextLimit ?? '') + '" placeholder="未知" aria-label="上下文上限" />',
    '    </label>',
    '  </div>',
    tierHTML('offpeak'),
    tierHTML('peak'),
    '  <div class="aus-wallet-mops">',
    '    <span class="aus-wallet-src' + (pending ? ' is-pending' : model.source === 'sync' ? ' is-sync' : '') + '">' + sourceLabel(model) + '</span>',
    '    <button type="button" class="aus-wallet-more-btn" data-wallet-more-btn="1" data-wallet-id="' + esc(wallet.id)
      + '" data-model-id="' + esc(model.id) + '" aria-label="更多操作" aria-haspopup="true">' + icon('menu', 16) + '</button>',
    menu,
    '  </div>',
    '</div>',
  ].join('\n');
}

function renderModelRows(wallet: WalletConfig, showHidden = false): string {
  const models = wallet.models
    .filter((model) => showHidden || model.hidden !== true)
    .sort((a, b) => {
      const pending = Number(!a.price.priceConfigured) - Number(!b.price.priceConfigured);
      return pending || a.model.localeCompare(b.model, 'zh-CN');
    });
  if (!models.length) {
    return '<div class="aus-wallet-empty">尚未识别到模型，可手动添加或等待请求接入</div>';
  }
  return models.map((model) => modelRowHTML(wallet, model)).join('');
}

function renderCredentialPicker(wallet: WalletConfig): string {
  const current = wallet.credentials.find((item) => item.id === wallet.balance.primaryCredentialId);
  return '<div class="aus-wallet-rel aus-wallet-inline">'
    + '<button type="button" data-wallet-credential-btn="1" data-wallet-id="' + esc(wallet.id) + '" class="aus-pill aus-pill-sm aus-wallet-pill" title="选择用于查询余额的主密钥">'
    + '<span class="aus-wallet-pill-label">主密钥</span>'
    + '<span class="aus-wallet-pill-value">' + esc(current?.label || '未指定') + '</span>'
    + icon('chevron-down', 14)
    + '</button>'
    + dropPanelHTML('aus-wallet-credential-drop-' + wallet.id, dropdownHtml(wallet.id, 'credential', [
        { id: '', label: '无（使用钱包内校准密钥）', active: !wallet.balance.primaryCredentialId },
        ...wallet.credentials.map((item) => ({ id: item.id, label: item.label, active: item.id === wallet.balance.primaryCredentialId })),
      ]), { wide: true })
    + '</div>';
}

function renderCatalogPicker(wallet: WalletConfig): string {
  const current = WALLET_CATALOG_PROVIDERS.find((item) => item.id === wallet.catalogProvider);
  const providerVendor = vendorById(wallet.catalogProvider);
  const providerIcon = providerVendor ? vendorIconSvg(providerVendor.id, 14) : '';
  const status = walletSyncStatus(wallet);
  return '<div class="aus-wallet-rel aus-wallet-catalog-picker">'
    + '<button type="button" data-wallet-catalog-btn="1" data-wallet-id="' + esc(wallet.id) + '" title="选择价格来源" class="aus-pill aus-pill-sm aus-wallet-pill aus-wallet-catalog-btn">'
    + '<span class="aus-wallet-pill-label">价格来源</span>'
    + (providerIcon ? '<span class="aus-wallet-pill-icon">' + providerIcon + '</span>' : '')
    + '<span class="aus-wallet-pill-value">' + esc(current?.label || '不自动同步') + '</span>'
    + icon('chevron-down', 14)
    + '</button>'
    + '<div class="aus-wallet-pill-note' + (status.pending ? ' is-warn' : '') + '" title="' + esc(status.label) + '">'
    + esc(status.label) + (status.pending ? ' · ' + status.pending + ' 个待匹配' : '') + '</div>'
    + dropPanelHTML('aus-wallet-catalog-drop-' + wallet.id, dropdownHtml(wallet.id, 'catalog', [
        { id: '', label: '不自动同步', active: !wallet.catalogProvider },
        ...WALLET_CATALOG_PROVIDERS.map((item) => ({ id: item.id, label: item.label, active: item.id === wallet.catalogProvider })),
      ]), { align: 'right' })
    + '</div>';
}

function renderAdapterPicker(wallet: WalletConfig): string {
  const current = BALANCE_ADAPTERS.find((item) => item.id === wallet.balance.adapter);
  return '<div class="aus-wallet-rel aus-wallet-adapter-row">'
    + '<button type="button" data-wallet-adapter-btn="1" data-wallet-id="' + esc(wallet.id) + '" class="aus-pill aus-pill-sm aus-wallet-pill" title="选择余额查询适配器">'
    + '<span class="aus-wallet-pill-label">查询适配器</span>'
    + '<span class="aus-wallet-pill-value">' + esc(current?.label || '自动识别') + '</span>'
    + icon('chevron-down', 14)
    + '</button>'
    + '<input class="aus-field aus-wallet-adapter-id" data-wallet-adapter-user-id="1" data-wallet-id="' + esc(wallet.id)
    + '" value="' + esc(wallet.balance.userId || '') + '" placeholder="用户 ID（new-api 需要）" aria-label="用户 ID" />'
    + dropPanelHTML('aus-wallet-adapter-drop-' + wallet.id, dropdownHtml(wallet.id, 'adapter', [
        { id: '', label: '自动识别', active: !wallet.balance.adapter },
        ...BALANCE_ADAPTERS.map((item) => ({ id: item.id, label: item.label + (item.experimental ? '（实验）' : ''), active: item.id === wallet.balance.adapter })),
      ]), { wide: true })
    + '</div>';
}

function renderWalletCard(wallet: WalletConfig, history: any[]): string {
  const balanceAdapter = resolveBalanceAdapter(wallet);
  const supportsAuto = !!balanceAdapter && (balanceAdapter.supports.balance || balanceAdapter.supports.plan);
  const visibleModels = wallet.models.filter((model) => model.hidden !== true);
  const hiddenCount = wallet.models.length - visibleModels.length;
  // 供应商识别（地址 → 接入类型 → 模型名前缀），失败退回名称首字符
  const vendor = resolveVendor({
    sourceType: wallet.sourceType,
    endpointDisplay: wallet.endpointDisplay,
    endpointLabel: wallet.endpointLabel,
    endpointId: wallet.endpointId,
    models: visibleModels.map((model) => model.model),
  });
  const avatarLetter = vendorInitialFallback(wallet.name || wallet.endpointDisplay || wallet.endpointLabel || '');
  let showHidden = false;
  try { showHidden = (window.parent as any)?.localStorage?.getItem('aus_wallet_show_hidden_v1') === '1'; } catch {}
  const pending = walletPendingModelCount(wallet);
  const isOfficial = wallet.id === DEEPSEEK_WALLET_ID;
  const selectedCredential = wallet.credentials.find((item) => item.id === wallet.balance.primaryCredentialId);
  const collapsed = wallet.collapsed !== false;
  const billingOpen = billingOpenWallets.has(wallet.id);
  const keyOpen = keyOpenWallets.has(wallet.id);
  const hasSavedKey = !!getWalletApiKey(wallet.id);
  const peakCount = wallet.peakHours.length;
  const peakSummary = (peakCount ? peakCount + ' 个高峰时段' : '未设置高峰时段')
    + (wallet.weekendOffpeak ? ' · 周末全天低谷' : '');
  const currencyCode = getDisplayCurrency().code;
  const vendorSvg = vendor ? vendorIconSvg(vendor.id, 22) : null;
  const avatarHTML = vendor
    ? '<div class="aus-wallet-avatar" title="' + esc(vendor.label) + '" style="--aus-wallet-avatar-bg:' + esc(vendor.color) + '"'
      + (vendorSvg ? ' data-has-icon="1"' : (vendor.mark.length > 1 ? ' data-mark="multi"' : '')) + '>'
      + (vendorSvg || esc(vendor.mark)) + '</div>'
    : '<div class="aus-wallet-avatar" title="' + esc(wallet.name) + '">' + esc(avatarLetter) + '</div>';
  const autoSwitch = switchHTML('aus-wallet-auto-' + wallet.id, {
    checked: wallet.balance.mode === 'auto',
    disabled: !supportsAuto,
    ariaLabel: '自动校准余额',
    data: { 'data-wallet-auto-balance': '1', 'data-wallet-id': wallet.id },
  });
  const weekendSwitch = switchHTML('aus-wallet-weekend-' + wallet.id, {
    checked: wallet.weekendOffpeak === true,
    ariaLabel: '周末全天按低谷计价',
    data: { 'data-wallet-weekend': '1', 'data-wallet-id': wallet.id },
  });
  const currencyPicker = '<div class="aus-wallet-rel aus-wallet-inline">'
    + '<button type="button" data-wallet-currency-btn="1" data-wallet-id="' + esc(wallet.id) + '" class="aus-pill aus-pill-sm aus-wallet-pill" title="余额币种">'
    + esc(wallet.balance.currency) + icon('chevron-down', 14) + '</button>'
    + dropPanelHTML('aus-wallet-currency-drop-' + wallet.id, dropdownHtml(wallet.id, 'currency', [
        { id: 'CNY', label: 'CNY', active: wallet.balance.currency === 'CNY' },
        { id: 'USD', label: 'USD', active: wallet.balance.currency === 'USD' },
      ]), { align: 'right' })
    + '</div>';
  const header = [
    '<div class="aus-wallet-header">',
    avatarHTML,
    '  <div class="aus-wallet-identity">',
    '    <div class="aus-wallet-name-row">',
    '      <input data-wallet-name="1" data-wallet-id="' + esc(wallet.id) + '" class="aus-wallet-name-input" value="' + esc(wallet.name) + '" aria-label="钱包名称" />',
    '      <span class="aus-wallet-badge ' + (isOfficial ? 'aus-wallet-badge-official' : 'aus-wallet-badge-relay') + '">'
      + (isOfficial ? 'DeepSeek 官方' : esc(vendor?.label || '中转/自定义')) + '</span>',
    pending ? '      <span class="aus-wallet-badge is-warn">' + pending + ' 个待定价</span>' : '',
    '    </div>',
    '    <div class="aus-wallet-sub">' + esc(wallet.endpointDisplay || wallet.endpointLabel || '本机官方接口')
      + ' · ' + esc(wallet.sourceType || '未识别') + '</div>',
    '  </div>',
    '  <div class="aus-wallet-metrics"><div class="aus-wallet-metric" title="' + esc(walletBalanceText(wallet)) + '">'
      + '<div class="aus-wallet-metric-label">余额</div><div class="aus-wallet-metric-value">' + esc(walletBalanceText(wallet)) + '</div></div></div>',
    '  <div class="aus-wallet-actions">',
    '    <button type="button" class="aus-wallet-icon-btn" data-wallet-toggle="1" data-wallet-id="' + esc(wallet.id) + '" title="'
      + (collapsed ? '展开钱包详情' : '收起钱包详情') + '" aria-label="' + (collapsed ? '展开钱包详情' : '收起钱包详情') + '">'
      + (collapsed ? icon('chevron-down', 16) : icon('chevron-up', 16)) + '</button>',
    '    <button type="button" class="aus-wallet-icon-btn" data-wallet-sync="1" data-wallet-id="' + esc(wallet.id) + '" title="'
      + (wallet.catalogProvider ? '预览并应用价格同步（按已识别模型模糊匹配）' : '先选择价格来源，再同步价格') + '" aria-label="预览价格同步">' + icon('refresh', 16) + '</button>',
    isOfficial ? '' : '    <button type="button" class="aus-wallet-icon-btn is-danger" data-wallet-ignore="1" data-wallet-id="' + esc(wallet.id) + '" title="忽略该钱包（历史与统计保留）" aria-label="忽略钱包">' + icon('close', 16) + '</button>',
    '  </div>',
    '</div>',
  ].join('\n');
  const keyRow = keyOpen
    ? '<div class="aus-wallet-key-row">'
      + '<input type="password" class="aus-field aus-field-grow" data-wallet-api-key="1" data-wallet-id="' + esc(wallet.id) + '" value="" placeholder="'
      + (hasSavedKey ? '已保存钱包校准密钥（留空不修改）' : '填写钱包校准密钥') + '" aria-label="钱包校准密钥" />'
      + '<button type="button" class="aus-btn-ghost" data-wallet-save-key="1" data-wallet-id="' + esc(wallet.id) + '">保存密钥</button>'
      + '</div>'
    : '<div class="aus-wallet-key-row">'
      + '<button type="button" class="aus-wallet-linkbtn" data-wallet-key-toggle="1" data-wallet-id="' + esc(wallet.id) + '">'
      + (hasSavedKey ? '已保存校准密钥 · 修改' : '设置校准密钥') + '</button>'
      + '</div>';
  const calib = supportsAuto
    ? [
        '<div class="aus-wallet-calib-row">',
        renderCredentialPicker(wallet),
        '  <button type="button" class="aus-btn-primary" data-wallet-calibrate="1" data-wallet-id="' + esc(wallet.id) + '">立即校准</button>',
        '</div>',
        keyRow,
        '<div class="aus-wallet-calib-row">' + renderAdapterPicker(wallet) + '</div>',
        '<div class="aus-wallet-hint">查询方式：' + esc(balanceAdapter?.label || '无')
          + (balanceAdapter?.note ? '（' + esc(balanceAdapter.note) + '）' : '')
          + '；勾选「自动校准」后按设置页的校准间隔轮询；主密钥：' + esc(selectedCredential?.label || '未指定') + '</div>',
      ].join('\n')
    : [
        '<div class="aus-wallet-hint">该接入暂无可用查询适配器，可直接手工维护余额；中转站可在下方「查询适配器」中选择 new-api 并填写系统访问令牌与用户 ID。</div>',
        '<div class="aus-wallet-calib-row">' + renderAdapterPicker(wallet) + '</div>',
      ].join('\n');
  const balanceSection = [
    '<section class="aus-wallet-sec">',
    '  <div class="aus-wallet-sec-head">',
    '    <h4 class="aus-wallet-sec-title">余额与校准</h4>',
    '    <label class="aus-wallet-switch-row" title="按设置页的校准间隔自动查询余额">自动校准' + autoSwitch + '</label>',
    '  </div>',
    '  <div class="aus-wallet-balance-row">',
    '    <div class="aus-wallet-balance-val">' + esc(walletBalanceText(wallet)) + '</div>',
    '    <input data-wallet-balance-amount="1" data-wallet-id="' + esc(wallet.id) + '" class="aus-field aus-field-num aus-wallet-balance-input" value="'
      + esc(wallet.balance.amount ?? '') + '" placeholder="手工余额" aria-label="手工余额" />',
    currencyPicker,
    '  </div>',
    calib,
    '  <div class="aus-wallet-hint">已识别密钥：' + esc(credentialSummary(wallet)) + '</div>',
    '</section>',
  ].join('\n');
  const modelSection = [
    '<section class="aus-wallet-sec">',
    '  <div class="aus-wallet-sec-head">',
    '    <h4 class="aus-wallet-sec-title">模型与价格<span class="aus-wallet-sec-note">单位 ' + esc(currencyCode) + '/百万 tokens；改名会保留旧名别名</span></h4>',
    '    <div class="aus-wallet-sec-actions">',
    renderCatalogPicker(wallet),
    '      <button type="button" class="aus-btn-ghost" data-wallet-toggle-hidden="1" data-wallet-id="' + esc(wallet.id) + '" style="display:' + (hiddenCount ? 'inline-flex' : 'none') + ';">'
      + (showHidden ? '隐藏' : '显示') + ' ' + hiddenCount + ' 个隐藏条目</button>',
    '      <button type="button" class="aus-btn-ghost" data-wallet-add-model="1" data-wallet-id="' + esc(wallet.id) + '">+ 添加模型</button>',
    '    </div>',
    '  </div>',
    '  <div class="aus-wallet-table-head"><span>模型</span><span>非峰 命中 / 未命中 / 输出</span><span>高峰 命中 / 未命中 / 输出</span><span></span></div>',
    '  <div class="aus-wallet-rows">' + renderModelRows(wallet, showHidden) + '</div>',
    '</section>',
  ].join('\n');
  const billingSection = [
    '<section class="aus-wallet-sec aus-wallet-sec-billing">',
    '  <button type="button" class="aus-wallet-billing-toggle" data-wallet-billing-toggle="1" data-wallet-id="' + esc(wallet.id) + '" aria-expanded="' + (billingOpen ? 'true' : 'false') + '">',
    '    <span class="aus-wallet-sec-title">峰谷规则</span>',
    '    <span class="aus-wallet-billing-summary">' + esc(peakSummary) + '</span>',
    icon(billingOpen ? 'chevron-up' : 'chevron-down', 14),
    '  </button>',
    billingOpen
      ? '<div class="aus-wallet-billing-body">'
        + peaksHTML(wallet)
        + '<label class="aus-wallet-switch-row">' + weekendSwitch + '周末全天按低谷</label>'
        + (isOfficial
          ? '<div class="aus-wallet-hint">官方接口按 DeepSeek 规则计费：中国法定节假日全天空闲（内置数据覆盖 ' + esc(CN_HOLIDAY_COVERAGE_LABEL)
            + '），调休上班的周末同样按空闲计价，可在设置中补充额外空闲日期。</div>'
          : '')
        + '</div>'
      : '',
    '</section>',
  ].join('\n');
  const body = [
    '<div class="aus-wallet-body" data-wallet-body="1" style="display:' + (collapsed ? 'none' : 'grid') + ';">',
    balanceSection,
    modelSection,
    hasPlanCapability(wallet) ? '<section class="aus-wallet-sec">' + renderPlanBlock(wallet, history) + '</section>' : '',
    billingSection,
    '</div>',
  ].join('\n');
  return '<section class="ds-card aus-wallet-card" data-wallet-card="' + esc(wallet.id) + '">' + header + body + '</section>';
}

function renderIgnoredWallets(ignored: string[], wallets: WalletConfig[]): string {
  const rows = ignored.map((id) => {
    const wallet = wallets.find((item) => item.id === id);
    if (!wallet) return '';
    return '<div class="aus-wallet-ignored-row">'
      + '<div class="aus-wallet-ignored-main">'
      + '<div class="aus-wallet-ignored-name">' + esc(wallet.name) + '</div>'
      + '<div class="aus-wallet-hint">' + esc(wallet.endpointDisplay || wallet.endpointLabel || '') + '</div>'
      + '</div>'
      + '<button type="button" class="aus-btn-ghost" data-wallet-restore="1" data-wallet-id="' + esc(wallet.id) + '">恢复显示</button>'
      + '</div>';
  }).filter(Boolean).join('');
  return rows || '<div class="aus-wallet-hint">暂无已忽略接入</div>';
}

let walletRenderToken = 0;

export async function renderWalletView(): Promise<void> {
  const doc = getDoc();
  const host = doc.getElementById('aus-wallet');
  if (!host) return;
  const token = ++walletRenderToken;
  const history = await repository.getAllHistory();
  if (token !== walletRenderToken || !host.isConnected) return;
  const wallets = repository.getWallets();
  const ignored = repository.getIgnoredWalletIds();
  const ignoredSet = new Set(ignored);
  const active = wallets.filter((wallet) => !ignoredSet.has(wallet.id));
  const planCapable = active.filter((wallet) => resolveBalanceAdapter(wallet)?.supports.plan === true);
  const planRemoteCount = planCapable.filter((wallet) => (wallet.plan?.remote || []).length > 0).length;
  let walletFilter = 'all';
  let walletQuery = '';
  try {
    walletFilter = (window.parent as any)?.localStorage?.getItem('aus_wallet_filter_v1') || 'all';
    walletQuery = (window.parent as any)?.localStorage?.getItem('aus_wallet_query_v1') || '';
  } catch {}
  const filters: Array<{ id: string; label: string; count?: number }> = [
    { id: 'all', label: '全部', count: active.length },
    { id: 'pending', label: '有待定价', count: active.filter((wallet) => walletPendingModelCount(wallet) > 0).length },
    { id: 'plan', label: '可查套餐', count: planCapable.length },
  ];
  // 兼容旧存档：曾被移除的筛选值（如 official）一律回落「全部」，避免列表看起来是空的
  if (!filters.some((item) => item.id === walletFilter)) walletFilter = 'all';
  const matchesFilter = (wallet: WalletConfig) => {
    if (walletFilter === 'pending') return walletPendingModelCount(wallet) > 0;
    if (walletFilter === 'plan') return resolveBalanceAdapter(wallet)?.supports.plan === true;
    return true;
  };
  // 「展开全部 / 收起全部」合并成一个切换胶囊：只要还有收起的钱包就显示「展开全部」
  const anyCollapsed = active.some((wallet) => wallet.collapsed);
  const toolbar = [
    '<div class="ds-card aus-wallet-toolbar">',
    '  <input class="aus-field aus-wallet-search" data-wallet-search="1" value="' + esc(walletQuery) + '" placeholder="搜索钱包 / 地址 / 模型" aria-label="搜索钱包" />',
    '  <div class="aus-wallet-filters">',
    filters.map((item) => '<button type="button" class="aus-wallet-filter' + (walletFilter === item.id ? ' is-active' : '')
      + '" data-wallet-filter="' + item.id + '">' + esc(item.label)
      + (item.count != null ? ' <span>' + item.count + '</span>' : '') + '</button>').join(''),
    '  </div>',
    '  <button type="button" class="aus-wallet-filter" data-wallet-toggle-all="' + (anyCollapsed ? 'expand' : 'collapse') + '">'
      + (anyCollapsed ? '展开全部' : '收起全部') + '</button>',
    '</div>',
  ].join('\n');
  const visibleWallets = active.filter(matchesFilter);
  let balanceCny = 0;
  let balanceCount = 0;
  let pending = 0;
  for (const wallet of active) {
    const value = walletBalanceToCny(wallet, getWalletExchangeRate());
    if (value != null) {
      balanceCny += value;
      balanceCount++;
    }
    pending += walletPendingModelCount(wallet);
  }
  const summaryItems = [
    { label: '钱包余额合计', value: money(balanceCny, 2), note: balanceCount + ' 个钱包已设置余额', tone: '' },
    { label: '钱包数量', value: String(active.length), note: '已忽略 ' + ignored.length + ' 个', tone: '' },
    { label: '待定价模型', value: String(pending), note: '保存价格后自动重算', tone: pending ? ' is-warn' : ' is-ok' },
    { label: '可查套餐', value: String(planCapable.length), note: planRemoteCount ? '已查到 ' + planRemoteCount + ' 个' : '仅展示可查询的厂商', tone: '' },
  ];
  const summary = '<div class="ds-card aus-wallet-summary" id="aus-wallet-summary">'
    + summaryItems.map((item) => '<div class="aus-wallet-summary-item">'
      + '<div class="aus-wallet-summary-label">' + esc(item.label) + '</div>'
      + '<div class="aus-wallet-summary-value' + item.tone + '">' + item.value + '</div>'
      + '<div class="aus-wallet-summary-note">' + esc(item.note) + '</div>'
      + '</div>').join('')
    + '</div>';
  host.innerHTML = [
    '<div class="aus-wallet-list">',
    summary,
    toolbar,
    visibleWallets.length
      ? visibleWallets.map((wallet) => renderWalletCard(wallet, history)).join('')
      : '<div class="ds-card aus-wallet-empty">没有符合筛选条件的钱包</div>',
    '<div class="ds-card aus-wallet-ignored">',
    '  <div class="aus-wallet-sec-title">已忽略接入</div>',
    renderIgnoredWallets(ignored, wallets),
    '</div>',
    '</div>',
  ].join('\n');
  bindWalletView(doc);
}

function readModelPrices(row: HTMLElement): Record<'offpeak' | 'peak', WalletPriceTier> {
  const result: any = {
    offpeak: { hit: 0, miss: 0, output: 0 },
    peak: { hit: 0, miss: 0, output: 0 },
  };
  row.querySelectorAll('input[data-wallet-price]').forEach((input: any) => {
    const tier = input.getAttribute('data-tier');
    const key = input.getAttribute('data-key');
    if ((tier === 'offpeak' || tier === 'peak') && (key === 'hit' || key === 'miss' || key === 'output')) {
      result[tier][key] = displayToCny(input.value);
    }
  });
  return result;
}
function bindWalletView(doc: Document): void {
  doc.querySelectorAll('[data-wallet-toggle]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => {
        wallet.collapsed = wallet.collapsed === false;
      });
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-name]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const name = String(input.value || '').trim();
      if (!walletId || !name) return renderWalletView();
      repository.updateWallet(walletId, (wallet) => { wallet.name = name; });
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-balance-amount]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => {
        wallet.balance.amount = String(input.value || '').trim() || null;
        wallet.balance.mode = wallet.balance.mode === 'auto' ? 'auto' : 'manual';
      });
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-auto-balance]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => {
        wallet.balance.mode = input.checked ? 'auto' : 'manual';
      });
      try { import('../services/balance').then((mod: any) => mod.restartBalanceTimer?.()); } catch {}
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-weekend]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => { wallet.weekendOffpeak = !!input.checked; });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-save-key]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      const input = doc.querySelector(`[data-wallet-api-key][data-wallet-id="${walletId}"]`) as HTMLInputElement | null;
      if (!walletId || !input) return;
      saveWalletApiKey(walletId, input.value.trim());
      toast('success', input.value.trim() ? '钱包校准密钥已保存' : '钱包校准密钥已清除');
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-calibrate]').forEach((button: any) => {
    button.onclick = async () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      button.textContent = '校准中…';
      await queryWalletBalance(walletId, false);
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-sync]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = button.getAttribute('data-wallet-id') || undefined;
      openWalletSyncPreview({ walletId, onDone: () => { renderWalletView(); } }).catch(() => {});
    };
  });

  doc.querySelectorAll('[data-wallet-toggle-hidden]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      try {
        const storage = (window.parent as any)?.localStorage ?? null;
        const current = storage?.getItem('aus_wallet_show_hidden_v1') === '1';
        storage?.setItem('aus_wallet_show_hidden_v1', current ? '0' : '1');
      } catch {}
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-ignore]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.setWalletIgnored(walletId, true);
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-restore]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.setWalletIgnored(walletId, false);
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-add-peak]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => {
        wallet.peakHours.push({ start: '09:00', end: '12:00' });
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-peak]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const index = parseInt(input.getAttribute('data-peak-index') || '-1', 10);
      const field = input.getAttribute('data-peak-field');
      if (!walletId || index < 0 || (field !== 'start' && field !== 'end')) return;
      repository.updateWallet(walletId, (wallet) => {
        const item = wallet.peakHours[index];
        if (!item) return;
        if (field === 'start') item.start = input.value;
        else item.end = input.value;
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-peak-delete]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      const index = parseInt(button.getAttribute('data-peak-index') || '-1', 10);
      if (!walletId || index < 0) return;
      repository.updateWallet(walletId, (wallet) => {
        if (wallet.peakHours.length <= 1) return;
        wallet.peakHours.splice(index, 1);
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-add-model]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      const modelName = window.prompt('输入模型名');
      if (!modelName || !modelName.trim()) return;
      const name = modelName.trim();
      repository.updateWallet(walletId, (wallet) => {
        if (wallet.models.some((item) => item.model === name)) return;
        const now = Date.now();
        wallet.models.push({
          id: `manual:${now}:${Math.random().toString(36).slice(2, 8)}`,
          sourceModel: name,
          model: name,
          aliases: [],
          price: {
            // 与「自动识别出的模型」口径一致：非官方钱包默认关闭峰谷（DeepSeek 官方钱包仍默认开启）
            usePeakPricing: wallet.kind === 'official',
            offpeak: { hit: 0, miss: 0, output: 0 },
            peak: { hit: 0, miss: 0, output: 0 },
            priceConfigured: false,
          },
          source: 'discovered',
          locked: false,
          discoveredAt: now,
          lastSeen: now,
          updatedAt: now,
        });
      });
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-model-name]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const modelId = input.getAttribute('data-model-id');
      const nextName = String(input.value || '').trim();
      if (!walletId || !modelId || !nextName) return renderWalletView();
      repository.updateWallet(walletId, (wallet) => {
        const model = wallet.models.find((item) => item.id === modelId);
        if (!model || model.model === nextName) return;
        if (model.model && !model.aliases.includes(model.model)) model.aliases.push(model.model);
        model.model = nextName;
        model.source = model.source === 'builtin' ? 'manual' : model.source;
        model.updatedAt = Date.now();
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-context-limit]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const modelId = input.getAttribute('data-model-id');
      if (!walletId || !modelId) return;
      const value = parseFloat(String(input.value || ''));
      const contextLimit = Number.isFinite(value) && value > 0 ? Math.round(value) : null;
      repository.updateWallet(walletId, (wallet) => {
        const model = wallet.models.find((item) => item.id === modelId);
        if (model) {
          model.contextLimit = contextLimit ?? defaultContextLimitForModel(model.sourceModel);
          model.contextLimitManual = contextLimit != null;
        }
      });
      renderWalletView();
    };
  });

  doc.querySelectorAll('input[data-wallet-price]').forEach((input: any) => {
    input.onchange = () => {
      const row = input.closest('[data-wallet-model-row]') as HTMLElement | null;
      const walletId = input.getAttribute('data-wallet-id');
      const modelId = input.getAttribute('data-model-id');
      if (!row || !walletId || !modelId) return;
      const prices = readModelPrices(row);
      repository.updateWallet(walletId, (wallet) => {
        const model = wallet.models.find((item) => item.id === modelId);
        if (!model) return;
        model.price.offpeak = prices.offpeak;
        model.price.peak = prices.peak;
        model.price.priceConfigured = true;
        model.source = 'manual';
        model.updatedAt = Date.now();
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-model-peak]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const modelId = input.getAttribute('data-model-id');
      if (!walletId || !modelId) return;
      repository.updateWallet(walletId, (wallet) => {
        const model = wallet.models.find((item) => item.id === modelId);
        if (!model) return;
        model.price.usePeakPricing = !!input.checked;
        model.updatedAt = Date.now();
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-model-lock]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const modelId = input.getAttribute('data-model-id');
      if (!walletId || !modelId) return;
      repository.updateWallet(walletId, (wallet) => {
        const model = wallet.models.find((item) => item.id === modelId);
        if (model) model.locked = !!input.checked;
      });
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-model-delete]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      const modelId = button.getAttribute('data-model-id');
      if (!walletId || !modelId) return;
      repository.updateWallet(walletId, (wallet) => {
        wallet.models = wallet.models.filter((item) => item.id !== modelId || item.source === 'builtin');
      });
      repository.recalcWallet(walletId).catch(() => {});
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-currency-btn]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = button.getAttribute('data-wallet-id');
      const dropdown = doc.getElementById(`aus-wallet-currency-drop-${walletId}`) as HTMLElement | null;
      if (!dropdown) return;
      closeOtherDropdowns(dropdown.id);
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
  });

  doc.querySelectorAll('[data-wallet-adapter-btn]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = button.getAttribute('data-wallet-id');
      const dropdown = doc.getElementById('aus-wallet-adapter-drop-' + walletId) as HTMLElement | null;
      if (!dropdown) return;
      closeOtherDropdowns(dropdown.id);
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
  });

  doc.querySelectorAll('[data-wallet-adapter-user-id]').forEach((input: any) => {
    input.onchange = () => {
      const walletId = input.getAttribute('data-wallet-id');
      const value = String(input.value || '').trim();
      if (!walletId) return;
      repository.updateWallet(walletId, (wallet) => { wallet.balance.userId = value || null; });
    };
  });

  doc.querySelectorAll('[data-wallet-catalog-btn]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = button.getAttribute('data-wallet-id');
      const dropdown = doc.getElementById(`aus-wallet-catalog-drop-${walletId}`) as HTMLElement | null;
      if (!dropdown) return;
      closeOtherDropdowns(dropdown.id);
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
  });

  // 诊断：价格来源胶囊若被宿主/第三方样式或极端窄屏布局压掉，这里打一条 warn（正常设备不输出），
  // 便于复现「部分移动端看不到该入口」这类只在个别设备出现的问题时回传控制台信息。
  try {
    const win: any = (doc as any).defaultView || (typeof window !== 'undefined' ? window : null);
    const view = doc.querySelector('[data-view="wallet"]') as HTMLElement | null;
    const viewHidden = view ? win?.getComputedStyle?.(view).display === 'none' : false;
    if (win && !viewHidden) {
      doc.querySelectorAll('[data-wallet-catalog-btn]').forEach((btn: any) => {
        const box = btn.getBoundingClientRect();
        const cs = win.getComputedStyle(btn);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || box.width < 4 || box.height < 4) {
          console.warn('[Api-Usage] 价格来源胶囊不可见', {
            walletId: btn.getAttribute('data-wallet-id'),
            display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
            width: Math.round(box.width), height: Math.round(box.height),
            parentDisplay: btn.parentElement ? win.getComputedStyle(btn.parentElement).display : null,
            parentOverflow: btn.parentElement ? win.getComputedStyle(btn.parentElement).overflow : null,
          });
        }
      });
    }
  } catch {}


  doc.querySelectorAll('[data-wallet-credential-btn]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = button.getAttribute('data-wallet-id');
      const dropdown = doc.getElementById(`aus-wallet-credential-drop-${walletId}`) as HTMLElement | null;
      if (!dropdown) return;
      closeOtherDropdowns(dropdown.id);
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
  });

  doc.querySelectorAll('[data-wallet-select]').forEach((item: any) => {
    item.onclick = (event: Event) => {
      event.stopPropagation();
      const walletId = item.getAttribute('data-wallet-id');
      const kind = item.getAttribute('data-wallet-select');
      const value = item.getAttribute('data-value') || '';
      if (!walletId) return;
      if (kind === 'currency') {
        repository.updateWallet(walletId, (wallet) => { wallet.balance.currency = value as WalletCurrency; });
      } else if (kind === 'catalog') {
        repository.updateWallet(walletId, (wallet) => { wallet.catalogProvider = value || null; });
      } else if (kind === 'adapter') {
        repository.updateWallet(walletId, (wallet) => { wallet.balance.adapter = value || null; });
      } else if (kind === 'credential') {
        repository.updateWallet(walletId, (wallet) => { wallet.balance.primaryCredentialId = value || null; });
      }
      closeDropdownsInstant();
      afterNextPaint(() => renderWalletView());
    };
  });

  const searchInput = doc.querySelector('[data-wallet-search]') as HTMLInputElement | null;
  if (searchInput) {
    const applySearch = () => {
      const keyword = String(searchInput.value || '').trim().toLowerCase();
      try { (window.parent as any)?.localStorage?.setItem('aus_wallet_query_v1', keyword); } catch {}
      doc.querySelectorAll('[data-wallet-card]').forEach((card: any) => {
        const walletId = card.getAttribute('data-wallet-card');
        const wallet = repository.getWallet(walletId);
        if (!wallet) return;
        const hay = [wallet.name, wallet.endpointDisplay, wallet.endpointLabel, ...wallet.models.map((model) => model.model)]
          .filter(Boolean).join(' ').toLowerCase();
        card.style.display = !keyword || hay.includes(keyword) ? '' : 'none';
      });
    };
    searchInput.oninput = applySearch;
    if (String(searchInput.value || '').trim()) applySearch();
  }

  doc.querySelectorAll('[data-wallet-filter]').forEach((button: any) => {
    button.onclick = () => {
      try { (window.parent as any)?.localStorage?.setItem('aus_wallet_filter_v1', button.getAttribute('data-wallet-filter') || 'all'); } catch {}
      renderWalletView();
    };
  });

  doc.querySelectorAll('[data-wallet-toggle-all]').forEach((button: any) => {
    button.onclick = () => {
      const expand = button.getAttribute('data-wallet-toggle-all') === 'expand';
      const next = repository.getWallets().map((wallet) => cloneWallet(wallet));
      next.forEach((wallet) => { wallet.collapsed = !expand; });
      repository.replaceWallets(next);
      renderWalletView();
    };
  });

  // 峰谷规则段默认折叠：状态只在本次会话记住（不落盘、不进导出与同步）
  doc.querySelectorAll('[data-wallet-billing-toggle]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      if (billingOpenWallets.has(walletId)) billingOpenWallets.delete(walletId);
      else billingOpenWallets.add(walletId);
      renderWalletView();
    };
  });

  // 「保存密钥」默认收起，点文字链才展开输入框
  doc.querySelectorAll('[data-wallet-key-toggle]').forEach((button: any) => {
    button.onclick = () => {
      const walletId = button.getAttribute('data-wallet-id');
      if (!walletId) return;
      if (keyOpenWallets.has(walletId)) keyOpenWallets.delete(walletId);
      else keyOpenWallets.add(walletId);
      renderWalletView();
    };
  });

  // 模型行的行尾 ⋯ 菜单：峰谷计价 / 锁定价格 / 删除模型
  doc.querySelectorAll('[data-wallet-more-btn]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const modelId = button.getAttribute('data-model-id');
      const dropdown = doc.getElementById('aus-wallet-model-drop-' + modelId) as HTMLElement | null;
      if (!dropdown) return;
      closeOtherDropdowns(dropdown.id);
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
  });

  for (const wallet of repository.getWallets()) {
    bindPlanBlock(doc, wallet.id, () => { renderWalletView(); });
  }

  if (!(bindWalletView as any)._outsideBound) {
    (bindWalletView as any)._outsideBound = true;
    doc.addEventListener('click', (event: any) => {
      const target = event.target as HTMLElement;
      if (!target?.closest?.('[data-wallet-dropdown]') && !target?.closest?.('[data-wallet-currency-btn]') && !target?.closest?.('[data-wallet-catalog-btn]') && !target?.closest?.('[data-wallet-credential-btn]') && !target?.closest?.('[data-wallet-adapter-btn]') && !target?.closest?.('[data-wallet-more-btn]')) {
        closeDropdowns();
      }
    });
  }
}
