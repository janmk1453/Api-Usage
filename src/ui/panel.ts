import { state, getSelectedSave } from '../store/index';
import { esc, localDay } from '../utils/date';
import { queryBalance } from '../services/balance';
import { bindImportExport } from '../services/import-export';
import { renderSettings } from './settings';
import { renderStats } from './stats';
import { renderCharts } from './charts';
import { bindHistoryCompare, renderUsageDetail } from './compare';
import { renderCustomizer } from './customize';

function getDoc(): Document { return (window.parent as any)?.document ?? document; }

export function refreshUI() {
  try {
    const doc = getDoc();
    const s: any = getSelectedSave();
    if (!s) return;
    const totalCostEl = doc.getElementById('aus-total-cost');
    const totalTokensEl = doc.getElementById('aus-total-tokens');
    const roundsEl = doc.getElementById('aus-rounds');
    const hitRateEl = doc.getElementById('aus-hit-rate');
    const balanceEl = doc.getElementById('aus-balance');
    const cost = (s.total_cost || 0).toFixed(4);
    const tokens = s.total_tokens || 0;
    const hitRate = (s.cache_hit_tokens || 0) + (s.cache_miss_tokens || 0) > 0
      ? ((s.cache_hit_tokens / (s.cache_hit_tokens + s.cache_miss_tokens)) * 100).toFixed(1) : '0.0';
    if (totalCostEl) totalCostEl.textContent = '¥' + cost;
    if (totalTokensEl) totalTokensEl.textContent = String(tokens);
    if (roundsEl) roundsEl.textContent = String(s.rounds || 0) + ' 轮';
    if (hitRateEl) hitRateEl.textContent = hitRate + '%';
    const bal = state.customBalance || state.balance?.balance;
    if (balanceEl) balanceEl.textContent = bal ? '¥' + bal + ' CNY' : '¥0.00 CNY';
    renderHistory(doc, s);
    renderStats();
    renderCharts();
  } catch {}
}

function renderHistory(doc: Document, s: any) {
  const host = doc.getElementById('aus-history');
  if (!host) return;
  const hist: any[] = s.history || [];
  if (!hist.length) { host.innerHTML = '<div style="text-align:center;padding:16px;color:#9CA3AF;font-size:12px;">暂无历史记录</div>'; return; }
  host.innerHTML = hist.slice(0, 50).map((h: any) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#F6F7F8;border-radius:10px;margin-bottom:6px;font-size:12px;">
      <div style="min-width:0;flex:1;">
        <div style="font-weight:600;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.model)} · ${esc(localDay(h.timestamp))}</div>
        <div style="color:#6B7280;margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.duration || 0}ms · ${h.tokenRate || 0} t/s</div>
      </div>
      <div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
        <div>
          <div style="font-weight:700;color:#111827;">¥${(h.cost || 0).toFixed(4)}</div>
          <div style="color:#9CA3AF;font-size:11px;">${(h.cache_hit_rate || 0).toFixed(1)}% 命中</div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">旧</button>
          <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:10px;cursor:pointer;">新</button>
          <button class="aus-usage-btn" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid #111827;border-radius:6px;background:#111827;color:#fff;font-size:10px;cursor:pointer;">详情</button>
        </div>
      </div>
    </div>
  `).join('');
  // 详情按钮
  host.querySelectorAll('.aus-usage-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ts = parseInt((btn as HTMLElement).getAttribute('data-ts') || '0');
      renderUsageDetail(ts);
    });
  });
}

export function bindPanel(doc: Document) {
  const q = doc.getElementById('aus-btn-query-balance') as HTMLButtonElement | null;
  if (q) q.onclick = () => queryBalance();
  const sel = doc.getElementById('aus-save-select') as HTMLSelectElement | null;
  if (sel) sel.onchange = (e: any) => { state.currentSave = e.target.value; try { (globalThis as any).SillyTavern?.getContext?.().saveSettingsDebounced?.(); } catch {} refreshUI(); };
}

export function injectPanel() {
  const doc = getDoc();
  if (doc.getElementById('api-usage-stat-panel')) return;
  const host = doc.getElementById('api-usage-stat-root');
  if (!host) return;
  const content = host.querySelector('.inline-drawer-content');
  if (!content) return;
  const panel = doc.createElement('div');
  panel.id = 'api-usage-stat-panel';
  panel.setAttribute('data-extension', 'api-usage-stat');
  panel.setAttribute('data-ds-theme', 'light');
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导入</button></div></div>
      <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.00</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px;" id="aus-total-tokens">0 tokens</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
      <select id="aus-save-select" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;"></select>
      <span style="font-size:11px;color:#6B7280;">共 <span id="aus-rounds">0 轮</span> · 命中 <span id="aus-hit-rate">0%</span></span>
    </div>
    <div id="aus-stats" style="margin-bottom:12px;"></div>
    <div id="aus-customizer" style="margin-bottom:12px;"></div>
    <div style="display:grid;gap:12px;margin-bottom:12px;">
      <div class="ds-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">消费金额 (CNY)</span><span style="font-size:11px;color:#6B7280;">近 30 天</span></div><div id="aus-chart-bar" style="height:180px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
      <div class="ds-card"><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">Tokens 热力</div><div id="aus-heatmap" style="height:120px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
    </div>
    <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:#9CA3AF;">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
    <div id="aus-history"></div>
    <div id="aus-settings" style="margin-top:16px;border-top:1px solid #E5E7EB;padding-top:12px;"></div>
  `;
  content.appendChild(panel);
  bindPanel(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  renderCustomizer();
  refreshUI();
}
