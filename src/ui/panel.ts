import { state, getSelectedSave, getHistoryForDisplay } from '../store/index';
import { esc, localDay, localTimeHM } from '../utils/date';
import { saveHot } from '../store/persistence';
import { queryBalance } from '../services/balance';
import { bindImportExport } from '../services/import-export';
import { renderSettings } from './settings';
import { bindHistoryCompare, renderUsageDetail } from './compare';
import { renderOverview } from './overview';
import { initStatsView, renderStatsView } from './stats-view';
import { initExtraCharts, renderExtraCharts } from './extra-charts';
import { applyTheme } from '../services/theme';

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
    const bal = state.customBalance || state.balance?.balance;
    const balEl = doc.getElementById('aus-balance');
    if (balEl) balEl.textContent = bal ? '¥' + bal + ' CNY' : '¥0.00 CNY';
    const totalCostEl = doc.getElementById('aus-total-cost');
    if (totalCostEl) totalCostEl.textContent = '¥' + (s.total_cost || 0).toFixed(4) + ' CNY';
    const tokEl = doc.getElementById('aus-total-tokens');
    if (tokEl) tokEl.textContent = (s.total_tokens || 0).toLocaleString('zh-CN') + ' tokens';
    renderHistory(doc, s);
    renderOverview();
    renderStatsView();
  } catch {}
}

function renderHistory(doc: Document, s: any) {
  const host = doc.getElementById('aus-history');
  if (!host) return;
  // 历史记录按设置过滤：all=全部，current=仅当前对话（其余块仍按全部统计）
  let hist: any[] = s.history || [];
  try {
    const scope = (state.settings as any).historyScope || 'all';
    if (scope === 'current') {
      const filtered = getHistoryForDisplay();
      // getHistoryForDisplay 已按当前 chatId 过滤，此处直接使用
      hist = filtered;
    }
  } catch {}
  if (!hist.length) {
    const scope = (state.settings as any).historyScope || 'all';
    const tip = scope === 'current'
      ? '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;line-height:1.8;">当前对话暂无记录<br/><span style="font-size:11px;">已按“当前对话”过滤，旧记录（未关联对话）仅在“全部历史”中可见</span><br/><button id="aus-history-scope-switch" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">切换为全部历史</button></div>'
      : '<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;">暂无历史记录</div>';
    host.innerHTML = tip;
    const btn = doc.getElementById('aus-history-scope-switch') as HTMLButtonElement | null;
    if (btn) btn.onclick = () => {
      (state.settings as any).historyScope = 'all';
      try { (saveHot as any)({ settings: state.settings }); } catch {}
      try { refreshUI(); } catch {}
      const host2 = doc.getElementById('aus-settings') as HTMLElement | null;
      if (host2) try { (window as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
    return;
  }
  host.innerHTML = hist.slice(0, 50).map((h: any) => {
    const total = h.total_tokens || 1;
    const hp = ((h.cache_hit_tokens || 0) / total * 100);
    const mp = ((h.cache_miss_tokens || 0) / total * 100);
    const op = ((h.completion_tokens || 0) / total * 100);
    const hps = hp.toFixed(1), mps = mp.toFixed(1), ops = op.toFixed(1);
    return `
    <div style="padding:10px 12px;background:var(--ds-card);border-radius:10px;margin-bottom:8px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;color:var(--ds-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.model)} · ${esc(localTimeHM(h.timestamp))}</div>
          <div style="color:var(--ds-text-2);margin-top:2px;">${h.prompt_tokens || 0} in · ${h.completion_tokens || 0} out · ${h.duration || 0}ms · ${h.tokenRate || 0} t/s</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;gap:6px;align-items:center;">
          <div>
            <div style="font-weight:700;color:var(--ds-text);">¥${(h.cost || 0).toFixed(4)}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="aus-compare-old" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;">旧</button>
            <button class="aus-compare-new" data-ts="${h.timestamp}" style="padding:4px 6px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;">新</button>
            <button class="aus-detail-toggle" data-ts="${h.timestamp}" style="padding:4px 8px;border:1px solid var(--ds-black);border-radius:6px;background:var(--ds-black);color:var(--ds-black-text);font-size:10px;cursor:pointer;">详情</button>
          </div>
        </div>
      </div>
      <div style="background:var(--ds-border);border-radius:999px;height:6px;overflow:hidden;margin-top:8px;display:flex;">
        <div style="background:var(--ds-green);width:${hp}%;height:100%;"></div>
        <div style="background:var(--ds-red-border);width:${mp}%;height:100%;"></div>
        <div style="background:var(--ds-purple-bg);width:${op}%;height:100%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-top:4px;">
        <div style="display:flex;gap:8px;"><span style="color:var(--ds-green);font-weight:500;">${hps}% 命中</span><span style="color:var(--ds-red);font-weight:500;">${mps}% 未命中</span><span style="color:var(--ds-purple);font-weight:500;">${ops}% 输出</span></div>
        <span style="color:var(--ds-text-2);">${total.toLocaleString()}t</span>
      </div>
      <div class="aus-detail-panel" data-detail="${h.timestamp}" style="display:none;margin-top:8px;border-top:1px solid var(--ds-border);padding-top:8px;height:520px;overflow:hidden;display:none;flex-direction:column;gap:8px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">基础信息</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">模型</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;word-break:break-all;">${esc(h.model||'—')}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">时段</div><div style="font-weight:600;margin-top:2px;color:var(--ds-text);">${h.priceType==='new-peak'?'🔴 高峰':h.priceType==='new-offpeak'?'🟢 非高峰':'⚪ 旧价格'}</div></div>
              <div style="grid-column:1/-1;"><div style="color:var(--ds-text-2);font-size:10px;">时间</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${new Date(h.timestamp).toLocaleString('zh-CN')}</div></div>
            </div>
          </div>
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">性能</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.duration||0)/1000).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">首字延迟</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.ttft||0)/1000).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">速率</div><div style="font-weight:600;color:var(--ds-green);margin-top:2px;">${h.tokenRate||0} t/s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链耗时</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.thinkTime||0)/1000).toFixed(1)}s</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">思维链 Token</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${h.thinkTokens||0}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">总时长</div><div style="font-weight:600;color:var(--ds-text);margin-top:2px;">${((h.duration||0)/1000).toFixed(1)}s</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">Token 消耗</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;font-size:11px;">
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存命中</div><div style="font-weight:600;color:var(--ds-green);margin-top:2px;">${(h.cache_hit_tokens||0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">缓存未命中</div><div style="font-weight:600;color:var(--ds-red);margin-top:2px;">${(h.cache_miss_tokens||0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">输出 Token</div><div style="font-weight:600;color:var(--ds-purple);margin-top:2px;">${(h.completion_tokens||0).toLocaleString()}</div></div>
              <div><div style="color:var(--ds-text-2);font-size:10px;">总 Token</div><div style="font-weight:700;color:var(--ds-text);margin-top:2px;">${(h.total_tokens||0).toLocaleString()}</div></div>
            </div>
          </div>
          <div style="background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;padding:10px;">
            <div style="font-size:10px;color:var(--ds-text-3);font-weight:600;letter-spacing:0.5px;">费用明细</div>
            <div style="display:grid;gap:6px;margin-top:6px;font-size:11px;">
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输入费用</span><span style="font-weight:600;color:var(--ds-text);">¥${(h.input_cost||0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输出费用</span><span style="font-weight:600;color:var(--ds-text);">¥${(h.output_cost||0).toFixed(6)}</span></div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--ds-card);padding-top:6px;margin-top:2px;"><span style="color:var(--ds-text);font-weight:600;">总费用</span><span style="font-weight:700;color:var(--ds-text);">¥${(h.cost||0).toFixed(6)}</span></div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="aus-tab-btn" data-tab="req" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-black);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:11px;cursor:pointer;">请求参数 (Request Body)</button>
          <button class="aus-tab-btn" data-tab="res" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">API 完整响应 (Full Response)</button>
          <button class="aus-tab-btn" data-tab="raw" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">原始 Token 用量 (Raw Usage)</button>
          <button class="aus-tab-btn" data-tab="msg" data-ts="${h.timestamp}" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">消息内容 (Messages)</button>
        </div>
        <pre class="aus-tab-content" data-content="req-${h.timestamp}" style="flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(h.fullRequest ? JSON.stringify(h.fullRequest, null, 2) : (h.raw_usage ? JSON.stringify(h.raw_usage, null, 2) : '（原文已清理，仅保留统计）'))}</pre>
        <pre class="aus-tab-content" data-content="res-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(h.fullResponse ? JSON.stringify(h.fullResponse, null, 2) : '（原文已清理）')}</pre>
        <pre class="aus-tab-content" data-content="raw-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(JSON.stringify(h.raw_usage || {}, null, 2))}</pre>
        <pre class="aus-tab-content" data-content="msg-${h.timestamp}" style="display:none;flex:1;min-height:160px;margin-top:2px;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:10px;font-size:11px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--ds-text);">${esc(h.messages && (h as any).messages.length ? JSON.stringify(h.messages, null, 2) : '（原文已清理——超过保留条数 10 条，仅统计可用）')}</pre>
      </div>
    </div>
  `;
  }).join('');
  host.querySelectorAll('.aus-detail-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ts = (btn as HTMLElement).getAttribute('data-ts');
      const panel = host.querySelector(`[data-detail="${ts}"]`) as HTMLElement | null;
      if (!panel) return;
      const isOpen = panel.style.display !== 'none' && panel.style.display !== '';
      if (isOpen) { panel.style.display = 'none'; btn.textContent = '详情'; (btn as HTMLElement).style.background = 'var(--ds-black)'; (btn as HTMLElement).style.color = 'var(--ds-black-text)'; }
      else { panel.style.display = 'flex'; (panel as HTMLElement).style.flexDirection = 'column'; btn.textContent = '收起'; (btn as HTMLElement).style.background = 'var(--ds-card-inner)'; (btn as HTMLElement).style.color = 'var(--ds-text)'; (btn as HTMLElement).style.borderColor = 'var(--ds-black)'; }
    });
  });
  host.querySelectorAll('.aus-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ts = (btn as HTMLElement).getAttribute('data-ts');
      const tab = (btn as HTMLElement).getAttribute('data-tab');
      const root = (btn as HTMLElement).closest('.aus-detail-panel') as HTMLElement | null;
      if (!root) return;
      root.querySelectorAll('.aus-tab-btn').forEach((b: any) => { b.style.background = 'var(--ds-card-inner)'; b.style.color = 'var(--ds-text)'; b.style.borderColor = 'var(--ds-border)'; });
      (btn as HTMLElement).style.background = 'var(--ds-black)'; (btn as HTMLElement).style.color = 'var(--ds-black-text)'; (btn as HTMLElement).style.borderColor = 'var(--ds-black)';
      root.querySelectorAll('.aus-tab-content').forEach((c: any) => { c.style.display = 'none'; });
      const target = root.querySelector(`[data-content="${tab}-${ts}"]`) as HTMLElement | null;
      if (target) target.style.display = 'block';
    });
  });
}

export function bindPanel(doc: Document) {
  const q = doc.getElementById('aus-btn-query-balance') as HTMLButtonElement | null;
  if (q) q.onclick = () => queryBalance();
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
  const titles: any = { overview: '用量概览', stats: '用量统计', history: '历史记录', settings: '设置', help: '使用说明', about: '关于' };
  const titleEl = doc.getElementById('aus-page-title');
  if (titleEl) titleEl.textContent = titles[view] || '';
  refreshUI();
  if (view === 'stats') {
    setTimeout(() => {
      try {
        const doc2 = getDoc();
        const el = doc2.getElementById('aus-stats-chart');
        if (el && (el.clientWidth === 0 || el.clientHeight === 0)) {
          setTimeout(() => { try { renderStatsView(); } catch {} }, 80);
        } else {
          renderStatsView();
        }
      } catch {}
    }, 60);
  }
}

function positionPanel() {
  const doc = getDoc();
  const overlay = doc.getElementById('aus-overlay') as HTMLElement | null;
  const panel = doc.getElementById('aus-panel') as HTMLElement | null;
  if (!overlay || !panel || overlay.style.display === 'none') return;
  const vw = doc.documentElement.clientWidth || (window.parent as any)?.innerWidth || 0;
  const vh = doc.documentElement.clientHeight || (window.parent as any)?.innerHeight || 0;
  panel.style.left = '0px';
  panel.style.top = '0px';
  const rect = panel.getBoundingClientRect();
  const docOffX = -rect.left;
  const docOffY = -rect.top;
  overlay.style.left = docOffX + 'px';
  overlay.style.top = docOffY + 'px';
  overlay.style.width = vw + 'px';
  overlay.style.height = vh + 'px';
  panel.style.left = docOffX + 'px';
  panel.style.top = docOffY + 'px';
  panel.style.width = vw + 'px';
  panel.style.height = vh + 'px';
}

export function createPanel() {
  if (panelCreated) return;
  const doc = getDoc();
  if (doc.getElementById('aus-panel')) { panelCreated = true; return; }
  panelCreated = true;
  const theme = (state.settings as any).theme || 'light';
  const overlay = doc.createElement('div');
  overlay.id = 'aus-overlay';
  overlay.setAttribute('data-extension', 'api-usage-stat');
  overlay.setAttribute('data-ds-theme', theme);
  overlay.style.cssText = 'position:absolute;top:0;left:0;background:var(--ds-overlay);z-index:100000;display:none;opacity:0;transition:opacity 0.2s;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
  const panel = doc.createElement('div');
  panel.id = 'aus-panel';
  panel.setAttribute('data-extension', 'api-usage-stat');
  panel.setAttribute('data-ds-theme', theme);
  panel.style.cssText = 'position:absolute;top:0;left:0;z-index:100001;background:var(--ds-panel-bg);color:var(--ds-text);font-family:\'Microsoft YaHei\',\'微软雅黑\',system-ui,-apple-system,sans-serif;display:none;flex-direction:row;overflow:hidden;transform:none;filter:none;will-change:auto;';
  panel.innerHTML = `
    <div id="aus-sidebar" style="width:220px;flex-shrink:0;background:var(--ds-sidebar-bg);border-right:1px solid var(--ds-border);display:flex;flex-direction:column;transition:width 0.2s ease;overflow:hidden;">
      <div style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;flex-shrink:0;">
        <div style="display:flex;flex-direction:column;min-width:0;" id="aus-brand">
          <span style="font-size:13px;font-weight:700;color:var(--ds-text);white-space:nowrap;">API用量统计</span>
          <span style="font-size:11px;color:var(--ds-text-2);white-space:nowrap;">v3.0.0</span>
        </div>
        <button id="aus-sidebar-toggle" style="width:28px;height:28px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;flex-shrink:0;">‹</button>
      </div>
      <div style="flex:1;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:4px;">
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;">
          <div class="aus-nav-item active" data-nav="overview" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>◈</span><span class="aus-nav-label">用量概览</span></div>
          <div class="aus-nav-item" data-nav="stats" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>▦</span><span class="aus-nav-label">用量统计</span></div>
          <div class="aus-nav-item" data-nav="history" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>≡</span><span class="aus-nav-label">历史记录</span></div>
        </div>
        <div style="flex:1;"></div>
        <div class="aus-nav-group" style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--ds-border);padding-top:8px;">
          <div class="aus-nav-item" data-nav="settings" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>⚙</span><span class="aus-nav-label">设置</span></div>
          <div class="aus-nav-item" data-nav="help" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>?</span><span class="aus-nav-label">使用说明</span></div>
          <div class="aus-nav-item" data-nav="about" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;"><span>ⓘ</span><span class="aus-nav-label">关于</span></div>
        </div>
      </div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--ds-panel-bg);">
      <div style="flex-shrink:0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--ds-border);background:var(--ds-card-inner);">
        <span id="aus-page-title" style="font-size:14px;font-weight:600;color:var(--ds-text);">用量概览</span>
        <button id="aus-panel-close" style="width:32px;height:32px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text-2);cursor:pointer;font-size:14px;">✕</button>
      </div>
      <div id="aus-main" style="flex:1;overflow:auto;padding:20px;background:var(--ds-panel-bg);">
        <div style="max-width:1100px;margin:0 auto;display:grid;gap:16px;">
          <div data-view="overview">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="ds-card"><div class="ds-card-title">充值余额</div><div class="ds-card-val" id="aus-balance">¥0.00<small>CNY</small></div><div id="aus-balance-remaining" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;min-height:16px;"></div><div style="margin-top:8px;display:flex;gap:6px;"><button id="aus-btn-query-balance" class="ds-btn-pill" style="padding:6px 12px;font-size:11px;">查询余额</button><button id="aus-btn-export" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">导出</button><button id="aus-btn-import" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">导入</button></div></div>
              <div class="ds-card"><div class="ds-card-title">累计消费</div><div class="ds-card-val" id="aus-total-cost">¥0.0000<small>CNY</small></div><div style="font-size:11px;color:var(--ds-text-3);margin-top:2px;" id="aus-total-tokens">0 tokens</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
              <div class="ds-card" id="aus-overview-history"></div>
              <div class="ds-card" id="aus-overview-spend"></div>
            </div>
            <div id="aus-overview-four" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px;"></div>
            <div id="aus-heatmap-card-overview" class="ds-card" style="margin-top:12px;width:100%;max-width:100%;overflow:hidden;box-sizing:border-box;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:12px;font-weight:600;color:var(--ds-text);">Token 使用量热力图</div>
                <div id="aus-heatmap-legend-overview" style="display:flex;align-items:center;gap:3px;font-size:10px;color:var(--ds-text-3);"></div>
              </div>
              <div style="display:flex;gap:0;overflow:hidden;max-width:100%;box-sizing:border-box;">
                <div id="aus-heatmap-labels-overview" style="flex-shrink:0;padding:4px 0"></div>
                <div id="aus-heatmap-scroll-overview" style="overflow-x:auto;overflow-y:hidden;flex:1;min-width:0;max-width:100%;padding:4px 0;cursor:grab;scrollbar-width:thin;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;">
                  <div id="aus-heatmap-container-overview" style="display:inline-block;min-width:max-content;"></div>
                </div>
              </div>
              <div style="font-size:10px;color:var(--ds-text-3);margin-top:6px;display:flex;justify-content:space-between;">
                <span>按日聚合 Token（深绿=高用量，展示近 2 年）</span>
                <span style="color:var(--ds-text-2);">悬停查看日期</span>
              </div>
            </div>
           </div>
           <div data-view="stats" style="display:none;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:relative;flex-wrap:wrap;">
              <div id="aus-range-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">时间维度</span><span id="aus-range-label" style="font-weight:600;color:var(--ds-text);">近 30 天</span><span style="font-size:10px;">▼</span></div>
              <div id="aus-model-btn" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:12px;cursor:pointer;"><span style="color:var(--ds-text-2);">模型</span><span id="aus-model-label" style="font-weight:600;color:var(--ds-text);">全部</span><span style="font-size:10px;">▼</span></div>
              <div id="aus-range-dropdown" style="display:none;position:absolute;top:40px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);overflow:hidden;flex-direction:row;">
                <div style="min-width:120px;border-right:1px solid var(--ds-card);padding:8px;display:grid;gap:2px;">
                  <div data-range="all" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">全部</div>
                  <div data-range="today" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">今天</div>
                  <div data-range="yesterday" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">昨天</div>
                  <div data-range="7d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">近 7 天</div>
                  <div data-range="30d" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">近 30 天</div>
                  <div data-range="month" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">本月</div>
                  <div data-range="lastMonth" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">上月</div>
                  <div data-range="custom" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--ds-text);">自定义</div>
                </div>
                <div id="aus-date-calendar" style="padding:12px;display:none;"></div>
              </div>
              <div id="aus-model-dropdown" style="display:none;position:absolute;top:40px;left:160px;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;max-height:260px;overflow:auto;padding:8px;"></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">消费金额</div><div id="aus-stats-cost" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">¥0.00 CNY</div></div>
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">API 请求次数</div><div id="aus-stats-req" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
              <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);">Tokens</div><div id="aus-stats-tok" style="font-size:22px;font-weight:700;color:var(--ds-text);margin-top:6px;">0</div></div>
            </div>
            <div id="aus-model-summary" class="ds-card" style="margin-top:12px;overflow:auto;">
              <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">模型汇总</div>
              <table style="width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap;">
                <thead><tr style="color:var(--ds-text-2);border-bottom:1px solid var(--ds-border);text-align:right;"><th style="text-align:left;padding:6px 8px;">模型</th><th data-sort-key="count" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">调用次数<span class="aus-sort-ind"></span></th><th data-sort-key="hit" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(命中)<span class="aus-sort-ind"></span></th><th data-sort-key="miss" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输入(未命中)<span class="aus-sort-ind"></span></th><th data-sort-key="out" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">输出<span class="aus-sort-ind"></span></th><th data-sort-key="total" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总 Tokens<span class="aus-sort-ind"></span></th><th data-sort-key="cost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">总成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgCost" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均成本<span class="aus-sort-ind"></span></th><th data-sort-key="avgDur" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均耗时<span class="aus-sort-ind"></span></th><th data-sort-key="avgRate" title="点击排序" style="padding:6px 8px;cursor:pointer;user-select:none;white-space:nowrap;">平均速率<span class="aus-sort-ind"></span></th></tr></thead>
                <tbody id="aus-summary-tbody"><tr><td colspan="10" style="text-align:center;padding:16px;color:var(--ds-text-3);">暂无数据</td></tr></tbody>
              </table>
            </div>
            <div class="ds-card" style="margin-top:12px;position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">图表</span><div style="display:flex;gap:8px;position:relative;"><div id="aus-chart-y-btn" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;"><span style="color:var(--ds-text-2);">Y</span><span id="aus-chart-y-label" style="font-weight:600;color:var(--ds-text);">总费用</span><span style="font-size:10px;">▼</span></div><div id="aus-chart-x-btn" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;"><span style="color:var(--ds-text-2);">X</span><span id="aus-chart-x-label" style="font-weight:600;color:var(--ds-text);">每日</span><span style="font-size:10px;">▼</span></div><div id="aus-chart-y-dropdown" style="display:none;position:absolute;top:34px;left:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:220px;max-height:280px;overflow:auto;"></div><div id="aus-chart-x-dropdown" style="display:none;position:absolute;top:34px;right:0;z-index:10;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:140px;"></div></div></div><div id="aus-stats-chart" style="height:300px;"></div></div>
            <div id="aus-extra-charts" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;">
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">Token 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-y-token" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-y-label-token">3 项</span> ▼</div><div id="aus-extra-x-token" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-token">每日</span> ▼</div></div></div><div id="aus-extra-y-drop-token" style="display:none;position:absolute;top:32px;left:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:180px;max-height:200px;overflow:auto;"></div><div id="aus-extra-x-drop-token" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-token" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">费用 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-y-cost" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-y-label-cost">1 项</span> ▼</div><div id="aus-extra-x-cost" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-cost">每日</span> ▼</div></div></div><div id="aus-extra-y-drop-cost" style="display:none;position:absolute;top:32px;left:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:180px;max-height:200px;overflow:auto;"></div><div id="aus-extra-x-drop-cost" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-cost" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">缓存命中 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-hit" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-hit">每日</span> ▼</div></div></div><div id="aus-extra-x-drop-hit" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-hit" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">API请求数 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-req" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-req">每日</span> ▼</div></div></div><div id="aus-extra-x-drop-req" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-req" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">耗时与速率 趋势</span><div style="display:flex;gap:6px;"><div id="aus-extra-x-dur" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text);font-size:10px;cursor:pointer;"><span id="aus-extra-x-label-dur">每日</span> ▼</div></div></div><div id="aus-extra-x-drop-dur" style="display:none;position:absolute;top:32px;right:8px;z-index:5;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:8px;padding:4px;min-width:120px;"></div><div id="aus-chart-dur" style="height:220px;"></div></div>
              <div class="ds-card" style="position:relative;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;"><span style="font-size:11px;font-weight:600;color:var(--ds-text);">模型用量占比</span><div id="aus-pie-toggle" style="padding:4px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-black);color:var(--ds-black-text);font-size:10px;cursor:pointer;">Token</div></div><div id="aus-chart-pie" style="height:220px;"></div></div>
            </div>
          </div>
          <div data-view="history" style="display:none;">
            <div id="aus-diff" class="ds-card" style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">缓存断点</span><button id="aus-diff-fullscreen" style="padding:4px 8px;border:1px solid var(--ds-border);border-radius:6px;background:var(--ds-card-inner);color:var(--ds-text);font-size:11px;cursor:pointer;">全屏</button></div><div style="font-size:11px;color:var(--ds-text-3);">在历史中各选一条 旧/新 对比，橙/绿高亮即发散点</div></div>
            <div id="aus-history"></div>
          </div>
          <div data-view="settings" style="display:none;">
            <div id="aus-settings"></div>
          </div>
          <div data-view="help" style="display:none;">
            <div style="display:grid;gap:12px;">
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#DC2626;font-weight:600;margin-bottom:6px;">⚠️ 安全提示</div><div style="color:var(--ds-text-2);">在本扩展中填入 API 密钥存在安全风险。密钥仅经 XOR 混淆后存储于 SillyTavern 设置中，建议使用权限受限的 API 密钥。</div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#2563EB;font-weight:600;margin-bottom:6px;">📊 使用统计 / 预测</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 输入 API 密钥并保存后点击“查询”获取余额（余额和缓存命中仅支持 DeepSeek 官方）</div><div>2. 正常对话，扩展自动记录每次请求的费用、token 数及缓存命中等统计数据</div><div>3. 切换时间维度或模型查看不同范围的统计</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:var(--ds-green);font-weight:600;margin-bottom:6px;">💡 高峰时间提示</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 设置中可开启峰值提示小圆点，直观显示当前高低峰状态</div><div>2. 圆点可拖动，位置自动记忆，找不到时可在设置中重置</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#DB2777;font-weight:600;margin-bottom:6px;">🔄 消息对比</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在历史记录中找到想对比的两条消息，前者点“旧”，后者点“新”</div><div>2. 系统并排显示请求消息的文字差异</div><div>3. 差异点即缓存发散起始位置（前 N 条相同为缓存命中段）</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#D97706;font-weight:600;margin-bottom:6px;">📈 统计图表</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在用量统计中按时间维度筛选数据</div><div>2. 橙色堆叠柱展示多模型消费金额占比，悬浮查看分模型明细</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#7C3AED;font-weight:600;margin-bottom:6px;">💾 请求详细参数</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 在历史记录中点击某条的“详情”展开固定区域</div><div>2. 查看：模型/时间/耗时/首字延迟/思维链/费用/Token 详情及四类原始数据（请求参数/完整响应/Raw Usage/Messages）</div><div>3. 兼容峰谷计价分段</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:#0891B2;font-weight:600;margin-bottom:6px;">🧡 模型兼容</div><div style="color:var(--ds-text-2);display:grid;gap:4px;"><div>1. 完全兼容 DeepSeek 官方 API</div><div>2. 尽量兼容不同厂商/渠道的请求格式，部分模型可能无命中数</div><div>3. 如数据异常，请携带完整请求与响应反馈</div></div></div>
              <div class="ds-card" style="line-height:1.7;font-size:12px;"><div style="font-size:11px;color:var(--ds-text-3);font-weight:600;margin-bottom:6px;">✨ 关于</div><div style="color:var(--ds-text-2);">本扩展由原脚本迁移重构（Vite + ECharts，浅色隔离）。原脚本由 AI 编写 <span style="color:var(--ds-text);">@janmk</span> · 仓库 <a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);text-decoration:underline;">janmk1453/Api-Usage</a></div></div>
            </div>
          </div>
          <div data-view="about" style="display:none;">
            <div class="ds-card" style="line-height:1.7;font-size:12px;color:var(--ds-text);">
              <div style="font-size:14px;font-weight:600;">关于<br/><br/>API用量统计 · SillyTavern 扩展</div>
              <div style="margin-top:8px;color:var(--ds-text-2);">迁移至原 DeepSeek使用预测 脚本<br/>致力于实现最全面的用量可视化统计<br/><br/>仓库：<a href="https://github.com/janmk1453/Api-Usage" target="_blank" style="color:var(--ds-text);">janmk1453/Api-Usage</a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const sbOverlay = doc.createElement('div');
  sbOverlay.id = 'aus-sidebar-overlay';
  sbOverlay.style.cssText = 'display:none;position:absolute;left:60px;top:0;right:0;bottom:0;background:rgba(0,0,0,0.08);z-index:4;';
  sbOverlay.addEventListener('click', () => applyCollapsed(true));
  panel.appendChild(sbOverlay);
  doc.body.appendChild(overlay);
  doc.body.appendChild(panel);
  try { applyTheme(theme); } catch {}
  try {
    const p = (window.parent as any) || window;
    p.addEventListener('scroll', positionPanel, { capture: true, passive: true } as any);
    p.addEventListener('resize', positionPanel, { passive: true } as any);
  } catch {}
  doc.getElementById('aus-panel-close')?.addEventListener('click', closePanel);
  doc.querySelectorAll('.aus-nav-item').forEach((el: any) => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-nav');
      if (v) switchView(v as any);
    });
  });
  const applyCollapsed = (v: boolean) => {
    collapsed = v;
    const sb = doc.getElementById('aus-sidebar') as HTMLElement | null;
    const brand = doc.getElementById('aus-brand') as HTMLElement | null;
    const btn = doc.getElementById('aus-sidebar-toggle') as HTMLElement | null;
    const overlay = doc.getElementById('aus-sidebar-overlay') as HTMLElement | null;
    if (!sb) return;
    const isMobile = (window.parent as any)?.innerWidth <= 760 || window.innerWidth <= 760;
    if (isMobile) {
      if (collapsed) {
        sb.style.setProperty('width', '60px', 'important');
        sb.style.setProperty('min-width', '60px', 'important');
        sb.style.setProperty('max-width', '60px', 'important');
        sb.style.position = ''; sb.style.left = ''; sb.style.top = ''; sb.style.bottom = ''; sb.style.zIndex = ''; sb.style.boxShadow = '';
        if (overlay) overlay.style.display = 'none';
      } else {
        sb.style.setProperty('width', '220px', 'important');
        sb.style.setProperty('min-width', '220px', 'important');
        sb.style.setProperty('max-width', '220px', 'important');
        sb.style.position = 'absolute'; sb.style.left = '0'; sb.style.top = '0'; sb.style.bottom = '0'; sb.style.zIndex = '5'; sb.style.boxShadow = '4px 0 16px rgba(0,0,0,0.12)';
        if (overlay) overlay.style.display = 'block';
      }
    } else {
      sb.style.setProperty('width', collapsed ? '60px' : '220px', 'important');
      sb.style.setProperty('min-width', collapsed ? '60px' : '220px', 'important');
      sb.style.setProperty('max-width', collapsed ? '60px' : '220px', 'important');
      sb.style.position = ''; sb.style.left = ''; sb.style.top = ''; sb.style.bottom = ''; sb.style.zIndex = ''; sb.style.boxShadow = '';
      if (overlay) overlay.style.display = 'none';
    }
    if (brand) brand.style.setProperty('display', collapsed ? 'none' : 'flex', 'important');
    if (btn) btn.textContent = collapsed ? '›' : '‹';
    doc.querySelectorAll('.aus-nav-label').forEach((el: any) => { (el as HTMLElement).style.setProperty('display', collapsed ? 'none' : 'inline', 'important'); });
    doc.querySelectorAll('.aus-nav-item').forEach((el: any) => { (el as HTMLElement).style.justifyContent = collapsed ? 'center' : 'flex-start'; });
  };
  doc.getElementById('aus-sidebar-toggle')?.addEventListener('click', () => applyCollapsed(!collapsed));
  try {
    const isMobile = (window.parent as any)?.innerWidth <= 760 || window.innerWidth <= 760;
    if (isMobile) applyCollapsed(true);
    (window.parent as any)?.addEventListener('resize', () => {
      const nowMobile = (window.parent as any)?.innerWidth <= 760;
      if (nowMobile && !collapsed) { /* 保持展开直到用户收起 */ }
    });
  } catch {}
  bindPanel(doc);
  bindImportExport(doc);
  renderSettings(doc);
  bindHistoryCompare();
  initStatsView();
  initExtraCharts();
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
  positionPanel();
  requestAnimationFrame(() => { ov.style.opacity = '1'; positionPanel(); });
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
