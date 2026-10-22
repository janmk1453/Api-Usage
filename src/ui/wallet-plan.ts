import { icon } from './icons';
import { esc } from '../utils/date';
import { repository } from '../data/repository';
import { toast } from '../utils/logger';
import { getWalletApiKey } from '../services/wallet-secrets';
import { queryWalletBalance } from '../services/balance';
import { resolveBalanceAdapter } from '../services/balance-adapters';
import {
  PLAN_UNIT_LABEL,
  computeAllPlanUsage,
  describePlanWindow,
  estimateExhaustion,
  formatPlanUnit,
  planWindowSpan,
  planWindowsForAdapter,
  type PlanUsageEntry,
} from '../services/plan-quota';
import type { WalletConfig, WalletPlan, WalletPlanWindow } from '../types/wallet';

/** 该钱包是否具备「可查询套餐额度」能力（无则整块不显示） */
export function hasPlanCapability(wallet: WalletConfig): boolean {
  return resolveBalanceAdapter(wallet)?.supports.plan === true;
}

function bar(ratio: number, color: string): string {
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return '<div style="height:6px;border-radius:999px;background:var(--ds-border);overflow:hidden;"><div style="height:100%;width:'
    + percent + '%;background:' + color + ';"></div></div>';
}

function ratioColor(ratio: number): string {
  if (ratio >= 0.85) return 'var(--ds-red)';
  if (ratio >= 0.6) return 'var(--ds-orange)';
  return 'var(--ds-green)';
}

function relativeTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  const diff = timestamp - Date.now();
  if (!Number.isFinite(diff)) return '—';
  if (diff <= 0) return '已重置';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return minutes + ' 分钟后';
  const hours = Math.round(minutes / 60);
  if (hours < 36) return hours + ' 小时后';
  return Math.round(hours / 24) + ' 天后';
}

function resetLabel(window: WalletPlanWindow, resetAt: number | null): string {
  if (!resetAt) {
    const hours = Math.round(planWindowSpan(window) / 3600000);
    return '滚动窗口（' + (hours >= 24 ? Math.round(hours / 24) + ' 天' : hours + ' 小时') + '）';
  }
  return '重置 ' + relativeTime(resetAt);
}

/** 远端真值：查到哪个展示哪个 */
function renderRemote(wallet: WalletConfig): string {
  const remote = wallet.plan?.remote || [];
  if (!remote.length) return '';
  const rows = remote.map((item) => {
    const ratio = item.used != null && item.limit ? Math.min(1, item.used / item.limit) : 0;
    const percent = Math.round(ratio * 100);
    const left = item.remaining != null
      ? formatPlanUnit(item.remaining, item.unit === 'percent' ? 'percent' : item.unit === 'count' ? 'count' : item.unit)
      : formatPlanUnit(Math.max(0, 100 - percent), 'percent');
    return '<div style="display:grid;gap:4px;">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;font-size:var(--aus-fs-sm);">'
      + '<span style="color:var(--ds-text-2);">' + esc(item.label) + '</span>'
      + '<span style="color:' + ratioColor(ratio) + ';font-weight:600;">已用 ' + percent + '% · 剩余 ' + esc(left) + '</span>'
      + '</div>'
      + bar(ratio, ratioColor(ratio))
      + '<div style="font-size:var(--aus-fs-xs,11px);color:var(--ds-text-3);">厂商返回 · ' + esc(resetLabel({ id: 'custom', label: item.label, unit: 'token', limit: 0, resetMode: item.resetAt ? 'calendar' : 'rolling' }, item.resetAt))
      + ' · 查询于 ' + esc(item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString('zh-CN') : '—') + '</div>'
      + '</div>';
  }).join('');
  return '<div style="border:1px solid var(--ds-border);border-radius:8px;padding:8px;display:grid;gap:8px;">' + rows + '</div>';
}

/** 本地估算（可选，仅作补充） */
function renderLocal(wallet: WalletConfig, history: PlanUsageEntry[]): string {
  const plan = wallet.plan;
  if (!plan || !plan.windows.length) return '';
  const usages = computeAllPlanUsage(plan.windows, history, wallet.id);
  const rows = usages.map((usage, index) => {
    const window = usage.window;
    const eta = estimateExhaustion(usage);
    const hasLimit = usage.limit > 0;
    return '<div style="display:grid;gap:4px;">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:space-between;">'
      + '<span style="font-size:var(--aus-fs-sm);color:var(--ds-text-2);">' + esc(describePlanWindow(window)) + '</span>'
      + '<span style="display:flex;align-items:center;gap:4px;font-size:var(--aus-fs-sm);">'
      + '<input type="number" min="0" step="1000" data-plan-limit="' + index + '" value="' + (window.limit || '') + '" placeholder="额度" style="width:96px;padding:3px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);" />'
      + '<span style="color:var(--ds-text-3);">' + esc(PLAN_UNIT_LABEL[window.unit]) + '</span>'
      + '<button data-plan-reset="' + index + '" title="切换重置方式：滚动窗口 / 自然月" style="padding:2px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;">' + (window.resetMode === 'calendar' ? '自然月' : '滚动') + '</button>'
      + '<button data-plan-remove="' + index + '" title="移除该窗口" style="padding:2px 6px;border:1px solid var(--ds-red-border);border-radius:999px;background:var(--ds-red-bg);color:var(--ds-red);font-size:var(--aus-fs-sm);cursor:pointer;">' + icon('close', 12) + '</button>'
      + '</span></div>'
      + (hasLimit ? bar(usage.ratio, ratioColor(usage.ratio)) : '<div style="height:6px;border-radius:999px;background:var(--ds-border);"></div>')
      + '<div style="font-size:var(--aus-fs-xs,11px);color:var(--ds-text-3);">本地估算 · 已用 ' + esc(formatPlanUnit(usage.used, window.unit))
      + (hasLimit ? ' / ' + esc(formatPlanUnit(usage.limit, window.unit)) + '（' + Math.round(usage.ratio * 100) + '%）· 剩余 ' + esc(formatPlanUnit(usage.remaining, window.unit)) : '（填额度后显示比例）')
      + ' · ' + resetLabel(window, usage.resetAt)
      + (eta ? ' · 预计 ' + esc(relativeTime(eta)) + '耗尽' : '')
      + '</div></div>';
  }).join('');
  return rows;
}

export function renderPlanBlock(wallet: WalletConfig, history: PlanUsageEntry[]): string {
  const adapter = resolveBalanceAdapter(wallet);
  // 只对**能查询套餐额度**的钱包展示；查不到接口的供应商整块不出现
  if (!adapter?.supports.plan) return '';
  const plan: WalletPlan | undefined = wallet.plan;
  const remote = plan?.remote || [];
  const localEnabled = plan?.enabled === true && (plan?.windows || []).length > 0;
  const hasKey = !!getWalletApiKey(wallet.id);

  const header = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
    + '<div><div style="font-size:var(--aus-fs-sm);font-weight:600;color:var(--ds-text);">套餐额度</div>'
    + '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">' + esc(adapter.label) + ' · 仅供展示参考，不参与计费与导出</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
    + '<button data-plan-query="1" style="padding:6px 11px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:var(--aus-fs-sm);cursor:pointer;display:inline-flex;align-items:center;gap:4px;">' + icon('refresh', 13) + ' 查询额度</button>'
    + (localEnabled
      ? '<button data-plan-disable="1" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:var(--aus-fs-sm);cursor:pointer;">关闭本地估算</button>'
      : '<button data-plan-enable="1" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">启用本地估算</button>')
    + '</div></div>';

  const error = plan?.remoteError
    ? '<div style="font-size:var(--aus-fs-sm);color:var(--ds-red);">查询失败：' + esc(plan.remoteError) + '</div>'
    : '';
  const remoteHtml = renderRemote(wallet);
  const localHtml = localEnabled ? renderLocal(wallet, history) : '';
  const empty = !remoteHtml && !localHtml
    ? '<div style="font-size:var(--aus-fs-sm);color:var(--ds-text-3);">'
      + (hasKey ? '点击「查询额度」获取厂商返回的额度与剩余。' : '先在下方填写查询密钥，再点「查询额度」。')
      + '</div>'
    : '';
  const localTools = localEnabled && !remoteHtml
    ? '<div style="display:flex;gap:6px;"><button data-plan-add="1" style="padding:5px 9px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:var(--aus-fs-sm);cursor:pointer;">+ 添加本地窗口</button></div>'
    : '';

  return '<div style="border:1px solid var(--ds-border);border-radius:10px;padding:10px;display:grid;gap:8px;">'
    + header + error + empty
    + (remoteHtml ? '<div style="display:grid;gap:8px;">' + remoteHtml + '</div>' : '')
    + (localHtml ? '<div style="display:grid;gap:8px;">' + localHtml + '</div>' : '')
    + localTools
    + '</div>';
}

export function bindPlanBlock(doc: Document, walletId: string, onChange: () => void): void {
  const host = doc.querySelector('[data-wallet-card="' + walletId + '"]');
  if (!host) return;
  const updatePlan = (mutate: (plan: WalletPlan) => void) => {
    repository.updateWallet(walletId, (wallet) => {
      const plan: WalletPlan = wallet.plan || { enabled: false, windows: [] };
      mutate(plan);
      wallet.plan = plan;
    });
    onChange();
  };

  host.querySelectorAll('[data-plan-query]').forEach((button: any) => {
    button.onclick = async (event: Event) => {
      event.stopPropagation();
      const wallet = repository.getWallet(walletId);
      const adapter = resolveBalanceAdapter(wallet);
      if (!adapter?.supports.plan) return;
      if (!getWalletApiKey(walletId)) {
        toast('warning', '请先在该钱包填写查询密钥');
        return;
      }
      button.textContent = '查询中…';
      await queryWalletBalance(walletId, false);
      onChange();
    };
  });

  host.querySelectorAll('[data-plan-enable]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      const adapter = resolveBalanceAdapter(repository.getWallet(walletId));
      updatePlan((plan) => {
        plan.enabled = true;
        if (!plan.windows.length) plan.windows = planWindowsForAdapter(adapter?.id);
      });
    };
  });

  host.querySelectorAll('[data-plan-disable]').forEach((button: any) => {
    button.onclick = (event: Event) => {
      event.stopPropagation();
      updatePlan((plan) => { plan.enabled = false; });
    };
  });

  host.querySelectorAll('[data-plan-limit]').forEach((input: any) => {
    input.onchange = () => {
      const index = parseInt(input.getAttribute('data-plan-limit') || '-1', 10);
      const value = parseFloat(String(input.value || ''));
      updatePlan((plan) => {
        const window = plan.windows[index];
        if (!window) return;
        window.limit = Number.isFinite(value) && value > 0 ? value : 0;
      });
    };
  });

  host.querySelectorAll('[data-plan-reset]').forEach((button: any) => {
    button.onclick = () => {
      const index = parseInt(button.getAttribute('data-plan-reset') || '-1', 10);
      updatePlan((plan) => {
        const window = plan.windows[index];
        if (!window) return;
        window.resetMode = window.resetMode === 'calendar' ? 'rolling' : 'calendar';
      });
    };
  });

  host.querySelectorAll('[data-plan-remove]').forEach((button: any) => {
    button.onclick = () => {
      const index = parseInt(button.getAttribute('data-plan-remove') || '-1', 10);
      updatePlan((plan) => { plan.windows.splice(index, 1); });
    };
  });

  host.querySelectorAll('[data-plan-add]').forEach((button: any) => {
    button.onclick = () => {
      const adapter = resolveBalanceAdapter(repository.getWallet(walletId));
      updatePlan((plan) => {
        plan.windows.push({ id: 'custom', label: '', unit: plan.windows[0]?.unit || 'token', limit: 0, resetMode: 'rolling', hours: 5 });
        if (adapter) plan.label = adapter.label;
      });
    };
  });
}
