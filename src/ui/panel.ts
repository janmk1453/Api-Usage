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

let panelCreated = false;
let panelOpen = false;
let currentView: 'overview' | 'stats' | 'history' | 'settings' | 'help' | 'about' = 'overview';
let collapsed = false;

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
    refreshSaveSelect(doc);
  } catch {}
}

function refreshSaveSelect(doc: Document) {
  const sel = doc.getElementById('aus-save-select') as HTMLSelectElement | null;
  if (!sel) return;
  const cur = state.currentSave as string;
  sel.innerHTML = '<option value="__all__"' + (cur === '__all__' ? ' selected' : '') + '>全部存档（合并统计）</option>' +
    Object.keys(state.saves).sort((a, b) => ((state.saves[b] as any).startTime || 0) - ((state.saves[a] as any).startTime || 0))
      .map(k => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc((state.saves as any)[k].name)} (${(state.saves as any)[k].history?.length || 0}条)</option>`).join('');
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

function switchView(view: typeof currentView) {
  currentView = view;
  const doc = getDoc();
  doc.querySelectorAll('[data-view]').forEach((el: any) => {
    const v = el.getAttribute('data-view');
    el.style.display = v === view ? 'block' : 'none';
    if (v === view) { el.style.opacity = '0'; requestAnimationFrame(() => { el.style.transition = 'opacity 0.15s'; el.style.opacity = '1'; }); }
  });
  doc.querySelectorAll('.aus-nav-item').forEach((el: any) => {
    const v = el.getAttribute('data-nav');
    if (v === view) el.classList.add('active');
    else el.classList.remove('active');
  });
  // 更新标题
  const titles: any = { overview: '用量概览', stats: '用量统计', history: '历史记录', settings: '设置', help: '使用说明', about: '关于' };
  const titleEl = doc.getElementById('aus-page-title');
  if (titleEl) titleEl.textContent = titles[view] || '';
  refreshUI();
}

export function createPanel() {
  if (panelCreated) return;
  const doc = getDoc();
  if (doc.getElementById('aus-panel')) { panelCreated = true; return; }
  panelCreated = true;
  const overlay = doc.createElement('div');
  overlay.id = 'aus-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  const panel = doc.createElement('div');
  panel.id = 'aus-panel';
  panel.setAttribute('data-extension', 'api-usage-stat');
  panel.setAttribute('data-ds-theme', 'light');
  panel.style.cssText = 'position:fixed;inset:0;z-index:100001;background:#FFFFFF;color:#111827;font-family:\'Microsoft YaHei\',\'微软雅黑\',system-ui,-apple-system,sans-serif;display:none;flex-direction:row;overflow:hidden;transform:none;filter:none;will-change:auto;';
  panel.innerHTML = `
    <div id="aus-sidebar" style="width:220px;flex-shrink:0;background:#F9FAFB;border-right:1px solid #E5E7EB;display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden;">
      <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;min-width:0;" id="aus-brand">
          <span style="font-size:13px;font-weight:700;color:#111827;white-space:nowrap;">API用量统计</span>
          <span style="font-size:11px;color:#6B7280;white-space:nowrap;">v3.0.0</span>
        </div>
        <button id="aus-sidebar-toggle" style="width:28px;height:28px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;color:#6B7280;cursor:pointer;flex-shrink:0;">‹</button>
      </div>
      <div style="flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;">
          <div class="aus-nav-item" data-nav="overview" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#111827;"><span>◈</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>▦</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>≡</span><span class="aus-nav-label">历史记录</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;border-top:1px solid #E5E7EB;padding-top:8px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>⚙</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>?</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:#6B7280;"><span>ⓘ</span><span class="aus-nav-label">关于</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#FFFFFF;">
      <div style="flex-shrink:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid #E5E7EB;background:#fff;">
        <span id="aus-page-title" style="font-size:14px;font-weight:600;color:#111827;">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;color:#6B7280;cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div id="aus-main" style="flex:1;overflow:auto;padding:20px;background:#FFFFFF;">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <!-- 用量概览 -->
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">导入</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.00</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
              <select id="aus-save-select" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;background:#fff;font-size:12px;"></select>
              <span style="font-size:11px;color:#6B7280;">共 <span id="aus-rounds">0 轮</span> · 命中 <span id="aus-hit-rate">0%</span></span>
            </div>
            <div style="display:grid;gap:12px;">
              <div class="ds-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">消费金额 (CNY)</span><span style="font-size:11px;color:#6B7280;">近 30 天</span></div><div id="aus-chart-bar" style="height:180px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
            </div>
          </div>
          <!-- 用量统计 -->
          <div data-view="stats" style="display:none;">
            <div id="aus-stats"></div>
            <div id="aus-customizer" style="margin-top:12px;"></div>
            <div class="ds-card" style="margin-top:12px;"><div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">Tokens 热力</div><div id="aus-heatmap" style="height:120px;display:flex;align-items:center;justify-content:center;color:#9CA3AF;font-size:12px;">加载中…</div></div>
          </div>
          <!-- 历史记录 -->
          <div data-view="history" style="display:none;">
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:#111827;">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid #E5E7EB;border-radius:6px;background:#fff;font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:#9CA3AF;">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <!-- 设置 -->
          <div data-view="settings" style="display:none;">
            <div id="aus-settings"></div>
          </div>
          <!-- 使用说明 -->
          <div data-view="help" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:#111827;">
              <div style="font-size:14px;font-weight:600;margin-bottom:8px;">使用说明</div>
              <div style="color:#6B7280;">
                <p>1. 在设置中填入 DeepSeek API Key 后，点击查询余额。</p>
                <p>2. 正常对话，扩展自动记录 token/费用/命中率等。</p>
                <p>3. 用量概览查看趋势，历史记录对比缓存断点，支持导出/导入与 WebDAV 同步。</p>
                <p>4. 峰值时段按北京时区计费，周末全天低谷。</p>
              </div>
            </div>
          </div>
          <!-- 关于 -->
          <div data-view="about" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:#111827;">
              <div style="font-size:14px;font-weight:600;">关于</div>
              <div style="margin-top:8px;color:#6B7280;">API用量统计 v3.0.0 · SillyTavern 原生扩展<br/>DeepSeek 官方浅色风格 · Vite + ECharts · 内容与脚本 1:1<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:#111827;">janmk1453/Api-Usage</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  doc.body.appendChild(overlay);
  doc.body.appendChild(panel);
  doc.getElementById('aus-panel-close')?.addEventListener('click', closePanel);
  // 导航
  doc.querySelectorAll('.aus-nav-item').forEach((el: any) => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-nav');
      if (v) switchView(v as any);
    });
  });
  doc.getElementById('aus-sidebar-toggle')?.addEventListener('click', () => {
    collapsed = !collapsed;
    const sb = doc.getElementById('aus-sidebar') as HTMLElement | null;
    const brand = doc.getElementById('aus-brand') as HTMLElement | null;
    const btn = doc.getElementById('aus-sidebar-toggle') as HTMLElement | null;
    if (!sb) return;
    sb.style.width = collapsed ? '60px' : '220px';
    if (brand) brand.style.display = collapsed ? 'none' : 'flex';
    if (btn) btn.textContent = collapsed ? '›' : '‹';
    doc.querySelectorAll('.aus-nav-label').forEach((el: any) => { el.style.display = collapsed ? 'none' : 'inline'; });
  });
  bindPanel(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  renderCustomizer();
  switchView('overview');
  refreshUI();
}

export function openPanel() {
  const doc = getDoc();
  const ov = doc.getElementById('aus-overlay') as HTMLElement | null;
  const pn = doc.getElementById('aus-panel') as HTMLElement | null;
  if (!ov || !pn) { createPanel(); return openPanel(); }
  ov.style.display = 'block';
  pn.style.display = 'flex';
  requestAnimationFrame(() => { ov.style.opacity = '1'; });
  panelOpen = true;
  refreshUI();
}
export function closePanel() {
  const doc = getDoc();
  const ov = doc.getElementById('aus-overlay') as HTMLElement | null;
  const pn = doc.getElementById('aus-panel') as HTMLElement | null;
  if (ov) { ov.style.opacity = '0'; setTimeout(() => { ov.style.display = 'none'; }, 200); }
  if (pn) pn.style.display = 'none';
  panelOpen = false;
}
export function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }
export function injectPanel() { createPanel(); }
