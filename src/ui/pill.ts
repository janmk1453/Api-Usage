/**
 * 全站胶囊下拉的「打开状态」标记。
 *
 * 面板里所有下拉胶囊的开关逻辑都是手写 inline `style.display`（`block` / `none`），
 * 没有统一的状态类。为了让胶囊能在展开时把箭头转 180°、并在悬停时有一点反馈，
 * 这里用 MutationObserver 监听 `#aus-panel` 内的 style 变化，按「下拉当前是否可见」
 * 给对应触发器打 `data-aus-open`，视觉全部交给 `style.css`，不干预任何开关逻辑。
 *
 * 配对规则（与既有命名约定一致，无需逐个登记）：
 *  - `aus-xxx-btn`      ↔ `aus-xxx-dropdown`（如 aus-range-btn / aus-chart-y-btn）
 *  - `aus-xxx-btn-<后缀>` ↔ `aus-xxx-drop-<后缀>`（如 aus-four-btn-0 / aus-extra-y-btn-token）
 *  - 钱包卡触发器 `[data-wallet-<kind>-btn][data-wallet-id]` ↔ `aus-wallet-<kind>-drop-<钱包 id>`
 *
 * 各页 innerHTML 重绘会换掉按钮节点，所以扫描是幂等的：每次变化都重新标注一遍，
 * 找不到下拉的按钮直接跳过，不影响任何现有交互。
 */

const PILL_ATTR = 'data-aus-pill';
const OPEN_ATTR = 'data-aus-open';
const DROP_OPEN_ATTR = 'data-aus-drop-open';
const WALLET_KINDS = ['credential', 'catalog', 'adapter', 'currency'];

// 触发器既有 <button> 也有 <div>（如图表 Y/X 轴胶囊），统一按 id 命名与钱包属性匹配；
// 找不到配对下拉的一律跳过，所以宽泛选择器不会误伤普通按钮。
const TRIGGER_SELECTOR = [
  '[id$="-btn"]',
  '[id*="-btn-"]',
  ...WALLET_KINDS.map((kind) => `[data-wallet-${kind}-btn]`),
].join(', ');

let observer: MutationObserver | null = null;
let observedPanel: HTMLElement | null = null;

function dropdownFor(button: HTMLElement, doc: Document): HTMLElement | null {
  const id = button.id || '';
  if (id.includes('-btn')) {
    const candidates = [id.replace('-btn', '-dropdown'), id.replace('-btn', '-drop')];
    for (const candidate of candidates) {
      const el = doc.getElementById(candidate);
      if (el) return el as HTMLElement;
    }
  }
  for (const kind of WALLET_KINDS) {
    if (!button.hasAttribute(`data-wallet-${kind}-btn`)) continue;
    const walletId = button.getAttribute('data-wallet-id') || '';
    const el = doc.getElementById(`aus-wallet-${kind}-drop-${walletId}`);
    if (el) return el as HTMLElement;
  }
  return null;
}

/** 下拉是否处于展开状态：先看 inline display（绝大多数），再看计算样式（趋势预测写在 class 里） */
function isOpen(drop: HTMLElement): boolean {
  const inline = drop.style.display;
  if (inline === 'none') return false;
  if (inline) return true;
  try {
    const view = drop.ownerDocument?.defaultView;
    if (!view) return false;
    return view.getComputedStyle(drop).display !== 'none';
  } catch {
    return false;
  }
}

function syncPillState(): void {
  const panel = observedPanel;
  if (!panel || !panel.isConnected) return;
  const doc = panel.ownerDocument;
  const buttons = Array.from(panel.querySelectorAll(TRIGGER_SELECTOR)) as HTMLElement[];
  for (const button of buttons) {
    const drop = dropdownFor(button, doc);
    if (!drop) {
      if (button.hasAttribute(PILL_ATTR)) {
        button.removeAttribute(PILL_ATTR);
        button.removeAttribute(OPEN_ATTR);
      }
      continue;
    }
    if (button.getAttribute(PILL_ATTR) !== '1') button.setAttribute(PILL_ATTR, '1');
    const open = isOpen(drop);
    if (open) {
      if (button.getAttribute(OPEN_ATTR) !== '1') button.setAttribute(OPEN_ATTR, '1');
      if (drop.getAttribute(DROP_OPEN_ATTR) !== '1') drop.setAttribute(DROP_OPEN_ATTR, '1');
    } else {
      if (button.hasAttribute(OPEN_ATTR)) button.removeAttribute(OPEN_ATTR);
      if (drop.hasAttribute(DROP_OPEN_ATTR)) drop.removeAttribute(DROP_OPEN_ATTR);
    }
  }
}

/** 绑定面板（幂等）：同一 panel 重复调用只补一次扫描，换面板则重建监听 */
export function initPillState(doc: Document): void {
  const panel = doc.getElementById('aus-panel') as HTMLElement | null;
  if (!panel) return;
  if (observer && observedPanel === panel) {
    syncPillState();
    return;
  }
  disposePillState();
  observedPanel = panel;
  const View = (doc.defaultView || window) as any;
  if (!View || typeof View.MutationObserver !== 'function') return;
  try {
    const local = new View.MutationObserver((records: MutationRecord[]) => {
      // 只关心下拉显隐；但按钮节点被 innerHTML 替换（childList）时也需要重新标注
      let need = false;
      for (const record of records) {
        if (record.type === 'childList') { need = true; break; }
        const target = record.target as HTMLElement;
        if (target && target !== panel) { need = true; break; }
      }
      if (need) syncPillState();
    });
    local.observe(panel, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    observer = local;
  } catch {
    observer = null;
  }
  syncPillState();
}

export function disposePillState(): void {
  try { observer?.disconnect(); } catch {}
  observer = null;
  observedPanel = null;
}
