import { icon } from './icons';
import { esc } from '../utils/date';
import { toast } from '../utils/logger';
import { repository } from '../data/repository';
import { formatMoney, getDisplayCurrency } from '../services/currency';
import { vendorById, resolveVendor } from '../services/provider-registry';
import {
  applySyncPlan,
  buildSyncPlan,
  fetchModelsDevCatalog,
  type SyncMode,
  type SyncPlan,
  type SyncPlanRow,
} from '../services/pricing-sync';

const OVERLAY_ID = 'aus-wallet-sync-overlay';

const MODE_LABELS: Array<{ id: SyncMode; label: string }> = [
  { id: 'add-missing', label: '只补未定价' },
  { id: 'overwrite-unlocked', label: '覆盖未锁定' },
  { id: 'overwrite-all', label: '全部覆盖' },
];

function getDoc(): Document {
  return (window.parent as any)?.document ?? document;
}

function money(value: number | null | undefined): string {
  if (value == null) return '—';
  try { return formatMoney(value, 6); } catch { return String(value); }
}

function scoreLabel(row: SyncPlanRow): string {
  if (row.action === 'unmatched') return '<span style="color:var(--ds-text-3);">未匹配</span>';
  const percent = Math.round(row.score * 100);
  const exact = row.reason === 'exact' || row.reason === 'normalized' || row.reason === 'alias';
  const color = exact ? 'var(--ds-green)' : row.ambiguous ? 'var(--ds-red)' : 'var(--ds-orange)';
  const text = exact ? '精确' : (row.ambiguous ? '歧义 ' + percent + '%' : '模糊 ' + percent + '%');
  return '<span style="color:' + color + ';font-weight:600;">' + text + '</span>';
}

function actionLabel(row: SyncPlanRow): string {
  if (row.action === 'write') return '<span style="color:var(--ds-red);">待写入</span>';
  if (row.action === 'update') return '<span style="color:var(--ds-orange);">将更新</span>';
  if (row.action === 'skip-locked') return '<span style="color:var(--ds-text-3);">已锁定</span>';
  if (row.action === 'skip-same') return '<span style="color:var(--ds-text-3);">无变化</span>';
  return '<span style="color:var(--ds-text-3);">—</span>';
}

function tierText(row: SyncPlanRow): string {
  if (!row.next) return '—';
  const before = row.current
    ? money(row.current.hit) + ' / ' + money(row.current.miss) + ' / ' + money(row.current.output)
    : '未定价';
  const after = money(row.next.hit) + ' / ' + money(row.next.miss) + ' / ' + money(row.next.output);
  if (!row.current) return '<span style="color:var(--ds-red);">' + after + '</span>';
  if (row.current.hit === row.next.hit && row.current.miss === row.next.miss && row.current.output === row.next.output) {
    return '<span style="color:var(--ds-text-3);">' + after + '</span>';
  }
  return '<span style="color:var(--ds-text-3);text-decoration:line-through;">' + before + '</span> → <b>' + after + '</b>';
}

export async function openWalletSyncPreview(options: { walletId?: string; onDone?: () => void } = {}): Promise<void> {
  const doc = getDoc();
  const existing = doc.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const overlay = doc.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = 'position:absolute;inset:0;z-index:140;background:rgba(15,20,25,0.32);display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = '<div style="width:min(880px,100%);max-height:86%;display:flex;flex-direction:column;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:14px;overflow:hidden;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid var(--ds-border);">'
    + '<div style="font-weight:600;color:var(--ds-text);">价格同步预览</div>'
    + '<button data-sync-close="1" style="display:flex;align-items:center;gap:4px;padding:5px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">' + icon('close', 14) + ' 关闭</button>'
    + '</div>'
    + '<div data-sync-body="1" style="padding:12px 14px;overflow:auto;display:grid;gap:10px;"></div>'
    + '</div>';
  doc.body.appendChild(overlay);

  const close = () => { overlay.remove(); doc.removeEventListener('keydown', onKey); };
  const onKey = (event: any) => { if (event?.key === 'Escape') close(); };
  doc.addEventListener('keydown', onKey);
  overlay.addEventListener('click', (event: any) => { if (event.target === overlay) close(); });
  (overlay.querySelector('[data-sync-close]') as HTMLElement | null)?.addEventListener('click', close);

  const body = overlay.querySelector('[data-sync-body]') as HTMLElement;
  body.innerHTML = '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">正在拉取价格目录…</div>';

  const walletId = options.walletId;
  const wallet = walletId ? repository.getWallet(walletId) : null;
  if (walletId && !wallet) { body.textContent = '钱包不存在'; return; }
  if (wallet && !wallet.catalogProvider) {
    body.innerHTML = '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">该钱包还没有选择价格来源，请先在「价格来源」中选择供应商。</div>';
    return;
  }

  let catalog: any = null;
  try {
    catalog = await fetchModelsDevCatalog();
  } catch (error: any) {
    body.innerHTML = '<div style="font-size:var(--aus-fs-sm);color:var(--ds-red);">价格目录拉取失败：' + esc(error?.message || error) + '</div>';
    return;
  }

  const vendor = wallet ? resolveVendor({
    sourceType: wallet.sourceType,
    endpointDisplay: wallet.endpointDisplay,
    endpointLabel: wallet.endpointLabel,
    endpointId: wallet.endpointId,
    models: wallet.models.map((item) => item.model),
  }) : null;
  const providerVendor = wallet?.catalogProvider ? vendorById(wallet.catalogProvider) : null;

  let mode: SyncMode = 'add-missing';
  let onlyChanged = true;
  let keyword = '';
  let plan = buildSyncPlan(catalog, { walletIds: walletId ? [walletId] : undefined, mode });
  const selected = new Set<string>(plan.rows.filter((row) => row.changed && !row.ambiguous).map((row) => row.key));

  const render = () => {
    const rows = plan.rows.filter((row) => {
      if (onlyChanged && !row.changed) return false;
      if (!keyword) return true;
      const haystack = (row.localModel + ' ' + (row.catalogModel || '')).toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    });
    const actionable = plan.rows.filter((row) => row.changed && !row.ambiguous);
    const head =
      '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);">'
      + (providerVendor ? '<span style="width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;background:' + providerVendor.color + ';color:#fff;font-size:10px;font-weight:700;">' + esc(providerVendor.mark) + '</span>' : '')
      + '供应商 <b style="color:var(--ds-text);">' + esc(plan.providerLabel || '未选择') + '</b></div>'
      + '<div style="display:flex;gap:4px;margin-left:auto;">'
      + MODE_LABELS.map((item) => '<button data-sync-mode="' + item.id + '" style="padding:5px 10px;border:1px solid ' + (mode === item.id ? 'var(--ds-black)' : 'var(--ds-border)') + ';border-radius:999px;background:' + (mode === item.id ? 'var(--ds-black)' : 'var(--ds-card)') + ';color:' + (mode === item.id ? 'var(--ds-black-text)' : 'var(--ds-text)') + ';font-size:var(--aus-fs-sm);cursor:pointer;">' + item.label + '</button>').join('')
      + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">'
      + '<input data-sync-search="1" value="' + esc(keyword) + '" placeholder="搜索模型" style="flex:1;min-width:140px;padding:6px 9px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);" />'
      + '<label style="display:flex;align-items:center;gap:5px;font-size:var(--aus-fs-sm);color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" data-sync-only-changed="1" ' + (onlyChanged ? 'checked' : '') + ' /> 仅看变化</label>'
      + '</div>'
      + '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);line-height:1.7;">'
      + '按钱包里已识别的模型名，在目录中用模糊匹配找到对应价格后写入该模型（不会新增模型）。'
      + ' 匹配 ' + plan.summary.matched + ' · 精确 ' + plan.summary.exact + ' · 模糊 ' + plan.summary.fuzzy
      + (plan.summary.ambiguous ? ' · 歧义 ' + plan.summary.ambiguous : '')
      + ' · 未匹配 ' + plan.summary.unmatched + ' · 单位 ' + getDisplayCurrency().code + '/百万 tokens'
      + '</div>';

    const table = rows.length
      ? '<div style="width:100%;overflow:auto;border:1px solid var(--ds-border);border-radius:10px;">'
        + '<table style="width:100%;min-width:720px;border-collapse:collapse;font-size:var(--aus-fs-sm);">'
        + '<thead><tr style="text-align:left;color:var(--ds-text-2);background:var(--ds-card);">'
        + '<th style="padding:6px;">选</th><th style="padding:6px;">钱包模型</th><th style="padding:6px;">匹配</th>'
        + '<th style="padding:6px;">目录模型</th><th style="padding:6px;">价格（命中/未命中/输出）</th><th style="padding:6px;">动作</th>'
        + '</tr></thead><tbody>'
        + rows.map((row) => {
          const checked = selected.has(row.key);
          return '<tr style="border-top:1px solid var(--ds-border);">'
            + '<td style="padding:6px;"><input type="checkbox" data-sync-row="' + esc(row.key) + '" ' + (checked ? 'checked' : '') + ' ' + (row.changed ? '' : 'disabled') + ' /></td>'
            + '<td style="padding:6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(row.localModel) + '">' + esc(row.localModel) + '</td>'
            + '<td style="padding:6px;white-space:nowrap;">' + scoreLabel(row) + '</td>'
            + '<td style="padding:6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ds-text-2);" title="' + esc(row.catalogModel || '') + '">' + esc(row.catalogModel || '—') + '</td>'
            + '<td style="padding:6px;white-space:nowrap;">' + tierText(row) + '</td>'
            + '<td style="padding:6px;white-space:nowrap;">' + actionLabel(row) + '</td>'
            + '</tr>';
        }).join('')
        + '</tbody></table></div>'
      : '<div style="padding:14px;text-align:center;color:var(--ds-text-3);font-size:var(--aus-fs-sm);">' + (onlyChanged ? '没有需要变化的价格（可关闭「仅看变化」查看全部）' : '没有可展示的模型') + '</div>';

    const footer = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">'
      + '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">已选 ' + selected.size + ' / 可写入 ' + actionable.length + '</div>'
      + '<div style="margin-left:auto;display:flex;gap:8px;">'
      + '<button data-sync-cancel="1" style="padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">取消</button>'
      + '<button data-sync-apply="1" style="padding:6px 14px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;">应用所选</button>'
      + '</div></div>';

    body.innerHTML = head + table + footer;

    body.querySelectorAll('[data-sync-mode]').forEach((button: any) => {
      button.onclick = () => {
        mode = button.getAttribute('data-sync-mode') as SyncMode;
        plan = buildSyncPlan(catalog, { walletIds: walletId ? [walletId] : undefined, mode });
        selected.clear();
        plan.rows.filter((row) => row.changed && !row.ambiguous).forEach((row) => selected.add(row.key));
        render();
      };
    });
    const search = body.querySelector('[data-sync-search]') as HTMLInputElement | null;
    if (search) search.oninput = () => { keyword = search.value; const pos = search.selectionStart; render(); const next = body.querySelector('[data-sync-search]') as HTMLInputElement | null; if (next) { next.focus(); try { next.setSelectionRange(pos ?? 0, pos ?? 0); } catch {} } };
    const onlyChangedEl = body.querySelector('[data-sync-only-changed]') as HTMLInputElement | null;
    if (onlyChangedEl) onlyChangedEl.onchange = () => { onlyChanged = onlyChangedEl.checked; render(); };
    body.querySelectorAll('[data-sync-row]').forEach((input: any) => {
      input.onchange = () => {
        const key = input.getAttribute('data-sync-row');
        if (!key) return;
        if (input.checked) selected.add(key); else selected.delete(key);
        render();
      };
    });
    body.querySelector('[data-sync-cancel]')?.addEventListener('click', close);
    body.querySelector('[data-sync-apply]')?.addEventListener('click', async () => {
      if (!selected.size) { toast('warning', '没有选中任何条目'); return; }
      const button = body.querySelector('[data-sync-apply]') as HTMLButtonElement | null;
      if (button) { button.disabled = true; button.textContent = '写入中…'; }
      const result = await applySyncPlan(plan, { selectedKeys: Array.from(selected) });
      close();
      toast(result.applied ? 'success' : 'warning', result.applied ? '已写入 ' + result.applied + ' 个模型价格' : '没有价格被写入');
      options.onDone?.();
      try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    });
  };

  render();
}
