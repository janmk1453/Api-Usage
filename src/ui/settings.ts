import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { saveApiKey } from '../services/balance';
import { doSyncNow, saveWebdavPass } from '../services/sync';
import { decryptKey } from '../utils/crypto';
import { applyTheme } from '../services/theme';
import { PRICING, DEFAULT_PEAK_HOURS } from '../constants/pricing';
import { recalcAllCosts } from '../services/interception';
import { generateDebugBatch } from '../services/debug';

function esc(s: string) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function localDay(ts: number) { return new Date(ts + 8*3600*1000).toISOString().slice(0,10); }

export function renderSettings(doc: Document) {
  const host = doc.getElementById('aus-settings');
  if (!host) return;
  const s = state.settings as any;
  host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <!-- 颜色模式 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">颜色模式</span><select id="aus-theme-select" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);color:var(--ds-text);font-size:12px;"><option value="light">浅色</option><option value="dark">深色</option></select></div><div style="font-size:11px;color:var(--ds-text-2);margin-top:6px;">切换后立即生效，深色模式针对夜间可读性优化</div></div>

      <!-- API 密钥 -->
      <div class="ds-card"><div style="font-size:11px;color:var(--ds-text-2);font-weight:500;margin-bottom:6px;">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="输入 DeepSeek API 密钥" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;outline:none;" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;"></div></div>

      <!-- 余额 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">自动校准余额</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-auto-balance" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-auto-balance-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-auto-balance-interval" style="display:${s.autoBalance ? 'block':'none'};margin-top:8px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;color:var(--ds-text);">校准间隔（分钟）</span><input type="number" id="aus-balance-interval" min="1" max="1440" style="width:90px;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;text-align:center;" /></div></div>
        <div style="margin-top:12px;display:flex;gap:8px;"><input id="aus-custom-balance" placeholder="自定义余额（覆盖 API 查询）" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><button id="aus-save-balance" class="ds-btn-pill" style="padding:8px 14px;">保存</button><button id="aus-clear-balance" style="padding:8px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">清除</button></div><div id="aus-balance-status" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;"></div>
      </div>

      <!-- 新价格机制 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">新价格机制（峰谷计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-use-new-pricing" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-use-new-pricing-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-new-pricing-panel" style="display:${s.useNewPricing ? 'block':'none'};margin-top:10px;display:grid;gap:8px;">
          <div style="display:flex;gap:8px;align-items:center;"><input type="date" id="aus-new-pricing-date" style="flex:1;padding:7px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><button id="aus-btn-pricing-today" style="padding:7px 12px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;white-space:nowrap;">设为今日</button></div>
          <div style="font-size:11px;color:var(--ds-text-2);">生效日期前按旧价，之后按峰谷价（仅 deepseek* 模型，周末全天低谷）。</div>
        </div>
      </div>

      <!-- 高峰时段 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">高峰时段</span><button id="aus-btn-add-peak-hour" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">+ 添加</button></div><div id="aus-peak-hours-list" style="display:grid;gap:6px;margin-top:8px;"></div><div style="font-size:10px;color:var(--ds-text-3);margin-top:6px;">支持跨天（如 22:00-02:00），周末自动低谷。</div></div>

      <!-- 模型与价格 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">模型与价格（¥/百万 tokens）</span><button id="aus-btn-add-model" style="padding:6px 10px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">+ 自定义模型</button></div><div id="aus-custom-models-list" style="display:grid;gap:8px;margin-top:8px;"></div></div>

      <!-- 调试 -->
      <div class="ds-card">
        <div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">调试模式（模拟数据，不计费）</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-debug-mode" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-debug-mode-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div>
        <div id="aus-debug-panel" style="display:${s.debug ? 'block':'none'};margin-top:10px;display:grid;gap:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">命中</div><input type="number" id="aus-debug-hit" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">未命中</div><input type="number" id="aus-debug-miss" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">输出</div><input type="number" id="aus-debug-output" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div><div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:4px;">模型</div><select id="aus-debug-model" style="width:100%;padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;"></select></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;"><input type="date" id="aus-debug-date-start" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input type="date" id="aus-debug-date-end" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input type="number" id="aus-debug-batch-count" min="1" placeholder="条数" style="padding:7px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>
          <button id="aus-btn-debug-batch" class="ds-btn-pill" style="width:100%;">生成模拟数据</button><div id="aus-debug-status" style="font-size:11px;color:var(--ds-text-2);"></div>
        </div>
      </div>

      <!-- 峰值圆点 -->
      <div class="ds-card"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="font-size:12px;font-weight:600;color:var(--ds-text);">峰值提示小圆点</span><label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;"><input type="checkbox" id="aus-peak-dot" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:var(--ds-border);border-radius:12px;transition:0.2s;"><span id="aus-peak-dot-slider" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:var(--ds-card-inner);border-radius:50%;transition:0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.15);"></span></span></label></div><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);font-size:11px;cursor:pointer;">重置位置</button></div>

      <!-- WebDAV -->
      <div class="ds-card"><div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:6px;">WebDAV 云同步</div><div style="font-size:11px;color:var(--ds-text-2);margin-bottom:8px;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
        <div style="display:grid;gap:8px;">
          <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>
          <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
          <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button>
        </div>
      </div>
    </div>
  `;

  // 填充 API Key
  const apiKeyEl = doc.getElementById('aus-api-key') as HTMLInputElement | null;
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const v = ctx?.extensionSettings?.['api_usage_stat']?.apiKey;
    if (v && apiKeyEl) apiKeyEl.value = decryptKey(v);
  } catch {}
  (doc.getElementById('aus-custom-balance') as HTMLInputElement | null)!.value = state.customBalance || '';
  (doc.getElementById('aus-peak-dot') as HTMLInputElement | null)!.checked = state.settings.peakDot !== false;
  const peakSlider = doc.getElementById('aus-peak-dot-slider') as HTMLElement | null;
  if (peakSlider) peakSlider.style.left = state.settings.peakDot !== false ? '23px' : '3px';

  const autoCb = doc.getElementById('aus-auto-balance') as HTMLInputElement | null;
  const autoSlider = doc.getElementById('aus-auto-balance-slider') as HTMLElement | null;
  if (autoCb) autoCb.checked = !!s.autoBalance;
  if (autoSlider) autoSlider.style.left = s.autoBalance ? '23px' : '3px';
  (doc.getElementById('aus-balance-interval') as HTMLInputElement | null)!.value = String(s.balanceInterval ?? 10);
  const newCb = doc.getElementById('aus-use-new-pricing') as HTMLInputElement | null;
  const newSlider = doc.getElementById('aus-use-new-pricing-slider') as HTMLElement | null;
  if (newCb) newCb.checked = !!s.useNewPricing;
  if (newSlider) newSlider.style.left = s.useNewPricing ? '23px' : '3px';
  const newDate = doc.getElementById('aus-new-pricing-date') as HTMLInputElement | null;
  if (newDate) newDate.value = s.newPricingDate ? localDay(s.newPricingDate) : '';
  const dbgCb = doc.getElementById('aus-debug-mode') as HTMLInputElement | null;
  const dbgSlider = doc.getElementById('aus-debug-mode-slider') as HTMLElement | null;
  if (dbgCb) dbgCb.checked = !!s.debug;
  if (dbgSlider) dbgSlider.style.left = s.debug ? '23px' : '3px';
  (doc.getElementById('aus-debug-hit') as HTMLInputElement | null)!.value = String(s.debugHit ?? 10000);
  (doc.getElementById('aus-debug-miss') as HTMLInputElement | null)!.value = String(s.debugMiss ?? 5000);
  (doc.getElementById('aus-debug-output') as HTMLInputElement | null)!.value = String(s.debugOutput ?? 2000);
  (doc.getElementById('aus-debug-date-start') as HTMLInputElement | null)!.value = s.debugDateStart || '';
  (doc.getElementById('aus-debug-date-end') as HTMLInputElement | null)!.value = s.debugDateEnd || '';
  (doc.getElementById('aus-debug-batch-count') as HTMLInputElement | null)!.value = String(s.debugBatchCount ?? 30);
  (doc.getElementById('aus-webdav-url') as HTMLInputElement | null)!.value = (s.webdav as any)?.url || '';
  (doc.getElementById('aus-webdav-user') as HTMLInputElement | null)!.value = (s.webdav as any)?.username || '';
  (doc.getElementById('aus-webdav-path') as HTMLInputElement | null)!.value = (s.webdav as any)?.path || '';
  (doc.getElementById('aus-webdav-proxy') as HTMLInputElement | null)!.value = (s.webdav as any)?.proxy || '';
  try {
    const pass = localStorage.getItem('ds_ds_webdav_pass') || '';
    const el = doc.getElementById('aus-webdav-pass') as HTMLInputElement | null;
    if (pass && el) el.value = decryptKey(pass);
  } catch {}

  // 颜色模式绑定
  const themeSel = doc.getElementById('aus-theme-select') as HTMLSelectElement | null;
  if (themeSel) {
    themeSel.value = (s.theme || 'light');
    themeSel.onchange = () => {
      const v = themeSel.value as any;
      (state.settings as any).theme = v;
      saveHot({ settings: state.settings });
      applyTheme(v);
      try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
  }

  // 绑定
  doc.getElementById('aus-save-key')!.onclick = () => {
    const v = (doc.getElementById('aus-api-key') as HTMLInputElement).value.trim();
    saveApiKey(v); const sEl = doc.getElementById('aus-key-status')!; sEl.textContent = v ? '已保存' : '已清空';
  };
  doc.getElementById('aus-save-balance')!.onclick = () => {
    const v = (doc.getElementById('aus-custom-balance') as HTMLInputElement).value.trim();
    if (v && isNaN(parseFloat(v))) return alert('请输入有效金额');
    state.customBalance = v || null; saveHot({ customBalance: state.customBalance }); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    doc.getElementById('aus-balance-status')!.textContent = v ? '已保存' : '已清除';
  };
  doc.getElementById('aus-clear-balance')!.onclick = () => {
    state.customBalance = null; saveHot({ customBalance: null }); (doc.getElementById('aus-custom-balance') as HTMLInputElement).value = ''; doc.getElementById('aus-balance-status')!.textContent = '已清除';
    try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  };
  if (autoCb) autoCb.onchange = () => {
    state.settings.autoBalance = autoCb.checked;
    if (autoSlider) autoSlider.style.left = autoCb.checked ? '23px' : '3px';
    (doc.getElementById('aus-auto-balance-interval') as HTMLElement).style.display = autoCb.checked ? 'block' : 'none';
    saveHot({ settings: state.settings });
  };
  (doc.getElementById('aus-balance-interval') as HTMLInputElement).onchange = (e: any) => {
    state.settings.balanceInterval = parseInt(e.target.value) || 10;
    saveHot({ settings: state.settings });
  };
  if (newCb) newCb.onchange = () => {
    state.settings.useNewPricing = newCb.checked;
    if (newSlider) newSlider.style.left = newCb.checked ? '23px' : '3px';
    (doc.getElementById('aus-new-pricing-panel') as HTMLElement).style.display = newCb.checked ? 'block' : 'none';
    saveHot({ settings: state.settings }); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  };
  if (newDate) newDate.onchange = () => {
    if (newDate.value) {
      const p = newDate.value.split('-');
      state.settings.newPricingDate = new Date(p[0] + '-' + p[1] + '-' + p[2] + 'T00:00:00+08:00').getTime();
    } else state.settings.newPricingDate = 0;
    saveHot({ settings: state.settings }); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  };
  doc.getElementById('aus-btn-pricing-today')!.onclick = () => {
    const d = new Date(); d.setHours(0,0,0,0);
    state.settings.newPricingDate = d.getTime();
    if (newDate) newDate.value = localDay(d.getTime());
    if (newCb && !newCb.checked) { newCb.checked = true; if (newSlider) newSlider.style.left = '23px'; (doc.getElementById('aus-new-pricing-panel') as HTMLElement).style.display = 'block'; }
    saveHot({ settings: state.settings }); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  };
  if (dbgCb) dbgCb.onchange = () => {
    state.settings.debug = dbgCb.checked;
    if (dbgSlider) dbgSlider.style.left = dbgCb.checked ? '23px' : '3px';
    (doc.getElementById('aus-debug-panel') as HTMLElement).style.display = dbgCb.checked ? 'block' : 'none';
    const st = doc.getElementById('aus-debug-status') as HTMLElement | null;
    if (st) st.textContent = dbgCb.checked ? '调试模式已开启，下次对话将使用模拟参数，不计费' : '';
    saveHot({ settings: state.settings });
  };
  (doc.getElementById('aus-debug-hit') as HTMLInputElement).onchange = (e: any) => { state.settings.debugHit = parseInt(e.target.value) || 0; saveHot({ settings: state.settings }); };
  (doc.getElementById('aus-debug-miss') as HTMLInputElement).onchange = (e: any) => { state.settings.debugMiss = parseInt(e.target.value) || 0; saveHot({ settings: state.settings }); };
  (doc.getElementById('aus-debug-output') as HTMLInputElement).onchange = (e: any) => { state.settings.debugOutput = parseInt(e.target.value) || 0; saveHot({ settings: state.settings }); };
  const dbgModel = doc.getElementById('aus-debug-model') as HTMLSelectElement | null;
  if (dbgModel) dbgModel.onchange = (e: any) => { state.settings.debugModel = e.target.value; saveHot({ settings: state.settings }); };
  (doc.getElementById('aus-debug-date-start') as HTMLInputElement).onchange = (e: any) => { state.settings.debugDateStart = e.target.value; saveHot({ settings: state.settings }); };
  (doc.getElementById('aus-debug-date-end') as HTMLInputElement).onchange = (e: any) => { state.settings.debugDateEnd = e.target.value; saveHot({ settings: state.settings }); };
  (doc.getElementById('aus-debug-batch-count') as HTMLInputElement).onchange = (e: any) => { state.settings.debugBatchCount = parseInt(e.target.value) || 1; saveHot({ settings: state.settings }); };
  doc.getElementById('aus-btn-debug-batch')!.onclick = () => generateDebugBatch();
  doc.getElementById('aus-peak-dot')!.onchange = (e: any) => { state.settings.peakDot = e.target.checked; const sl = doc.getElementById('aus-peak-dot-slider') as HTMLElement | null; if (sl) sl.style.left = e.target.checked ? '23px' : '3px'; saveHot({ settings: state.settings }); try { (globalThis as any).ApiUsageStat?.updatePeakDot?.(); } catch {} };
  doc.getElementById('aus-reset-dot')!.onclick = () => { try { localStorage.removeItem('ds_ds_peak_dot_pos'); const dot = (window.parent as any)?.document?.getElementById('aus-peak-dot-indicator') as HTMLElement | null; if (dot) { dot.style.left = ''; dot.style.top = '60px'; dot.style.right = '16px'; } } catch {} alert('已重置'); };
  const wUrl = doc.getElementById('aus-webdav-url') as HTMLInputElement | null;
  const wUser = doc.getElementById('aus-webdav-user') as HTMLInputElement | null;
  const wPath = doc.getElementById('aus-webdav-path') as HTMLInputElement | null;
  const wProxy = doc.getElementById('aus-webdav-proxy') as HTMLInputElement | null;
  const wPass = doc.getElementById('aus-webdav-pass') as HTMLInputElement | null;
  if (wUrl) wUrl.onchange = () => { (state.settings.webdav as any).url = wUrl.value.trim(); saveHot({ settings: state.settings }); };
  if (wUser) wUser.onchange = () => { (state.settings.webdav as any).username = wUser.value.trim(); saveHot({ settings: state.settings }); };
  if (wPath) wPath.onchange = () => { (state.settings.webdav as any).path = wPath.value.trim(); saveHot({ settings: state.settings }); };
  if (wProxy) wProxy.onchange = () => { (state.settings.webdav as any).proxy = wProxy.value.trim(); saveHot({ settings: state.settings }); };
  if (wPass) wPass.onchange = () => saveWebdavPass(wPass.value);
  doc.getElementById('aus-webdav-sync')!.onclick = () => doSyncNow();

  renderPeakHoursEditor(doc);
  renderModelsEditor(doc);
  fillDebugModelSelect(doc);
}

function renderPeakHoursEditor(doc: Document) {
  const list = doc.getElementById('aus-peak-hours-list') as HTMLElement | null;
  if (!list) return;
  const hours: any[] = (state.settings as any).peakHours || [];
  list.innerHTML = hours.map((h: any, i: number) => `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="time" value="${esc(h.start || '')}" data-idx="${i}" data-field="start" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
      <span style="font-size:11px;color:var(--ds-text-2);">至</span>
      <input type="time" value="${esc(h.end || '')}" data-idx="${i}" data-field="end" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" />
      <button data-del="${i}" style="padding:6px 8px;border:1px solid var(--ds-red-border);border-radius:8px;background:var(--ds-red-bg);color:var(--ds-red);font-size:11px;cursor:pointer;">删除</button>
    </div>
  `).join('');
  list.querySelectorAll('input[type="time"]').forEach((el: any) => {
    el.onchange = () => {
      const idx = parseInt(el.getAttribute('data-idx')); const field = el.getAttribute('data-field');
      (state.settings as any).peakHours[idx][field] = el.value;
      saveHot({ settings: state.settings }); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
  });
  list.querySelectorAll('button[data-del]').forEach((el: any) => {
    el.onclick = () => {
      const idx = parseInt(el.getAttribute('data-del'));
      (state.settings as any).peakHours.splice(idx, 1);
      if (!(state.settings as any).peakHours.length) (state.settings as any).peakHours = JSON.parse(JSON.stringify(DEFAULT_PEAK_HOURS));
      saveHot({ settings: state.settings });
      renderPeakHoursEditor(doc); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
  });
  const addBtn = doc.getElementById('aus-btn-add-peak-hour') as HTMLElement | null;
  if (addBtn) addBtn.onclick = () => {
    (state.settings as any).peakHours.push({ start: '09:00', end: '12:00' });
    saveHot({ settings: state.settings }); renderPeakHoursEditor(doc);
  };
}

function renderModelsEditor(doc: Document) {
  const list = doc.getElementById('aus-custom-models-list') as HTMLElement | null;
  if (!list) return;
  const builtin = Object.keys(PRICING);
  const cms: any[] = (state.settings as any).customModels || [];
  const rows: string[] = [];
  for (const m of builtin) {
    const p: any = getPricing(m);
    const usePeak = p.usePeakPricing !== false;
    rows.push(modelRow(m, p, true, usePeak));
  }
  for (const e of cms) {
    if (e?.model && builtin.indexOf(e.model) === -1) {
      const p: any = getPricing(e.model);
      rows.push(modelRow(e.model, p, false, p.usePeakPricing !== false));
    }
  }
  list.innerHTML = rows.join('');
  list.querySelectorAll('input[type="checkbox"].aus-cm-peak').forEach((el: any) => {
    el.onchange = () => {
      const row = el.closest('[data-model]') as HTMLElement;
      const model = row.getAttribute('data-model') || '';
      const usePeak = el.checked;
      upsertCustom(model, { usePeakPricing: usePeak });
      saveHot({ settings: state.settings });
      renderModelsEditor(doc); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
  });
  list.querySelectorAll('input[data-price]').forEach((el: any) => {
    el.onchange = () => {
      const row = el.closest('[data-model]') as HTMLElement;
      const model = row.getAttribute('data-model') || '';
      const isBuiltin = row.getAttribute('data-builtin') === '1';
      const prices = readRow(row);
      saveCustomRow(model, prices, isBuiltin);
    };
  });
  list.querySelectorAll('button[data-del]').forEach((el: any) => {
    el.onclick = () => {
      const row = el.closest('[data-model]') as HTMLElement;
      const model = row.getAttribute('data-model') || '';
      (state.settings as any).customModels = (state.settings as any).customModels.filter((c: any) => c.model !== model);
      saveHot({ settings: state.settings });
      renderModelsEditor(doc); fillDebugModelSelect(doc); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
    };
  });
  const addBtn = doc.getElementById('aus-btn-add-model') as HTMLElement | null;
  if (addBtn) addBtn.onclick = () => {
    const name = 'custom-model-' + ((state.settings as any).customModels.length + 1);
    (state.settings as any).customModels.push({ model: name, usePeakPricing: true, offpeak: {}, peak: {} });
    saveHot({ settings: state.settings }); renderModelsEditor(doc); fillDebugModelSelect(doc);
  };
}

function modelRow(model: string, p: any, isBuiltin: boolean, usePeak: boolean) {
  const hit = (v: any) => v !== undefined && v !== '' ? v : '';
  return `<div data-model="${esc(model)}" data-builtin="${isBuiltin ? '1':'0'}" style="border:1px solid var(--ds-border);border-radius:10px;padding:10px;background:var(--ds-card-inner);display:grid;gap:8px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <input value="${esc(model)}" ${isBuiltin ? 'readonly' : ''} style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:${isBuiltin ? 'var(--ds-sidebar-bg)':'var(--ds-card-inner)'};font-size:12px;" />
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ds-text-2);cursor:pointer;"><input type="checkbox" class="aus-cm-peak" ${usePeak ? 'checked':''} /> 峰谷</label>
      ${isBuiltin ? '' : '<button data-del="1" style="padding:4px 8px;border:1px solid var(--ds-red-border);border-radius:6px;background:var(--ds-red-bg);color:var(--ds-red);font-size:11px;cursor:pointer;">删除</button>'}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:var(--ds-sidebar-bg);border-radius:8px;padding:8px;display:grid;gap:6px;">
        <div style="font-size:10px;font-weight:600;color:var(--ds-green);">非峰</div>
        ${field('offpeak.hit', hit(p.offpeak.hit))}${field('offpeak.miss', hit(p.offpeak.miss))}${field('offpeak.output', hit(p.offpeak.output))}
      </div>
      <div style="background:var(--ds-card-inner)BEB;border-radius:8px;padding:8px;display:grid;gap:6px;${usePeak ? '' : 'opacity:0.45;pointer-events:none;'}">
        <div style="font-size:10px;font-weight:600;color:#D97706;">高峰</div>
        ${field('peak.hit', hit(p.peak.hit))}${field('peak.miss', hit(p.peak.miss))}${field('peak.output', hit(p.peak.output))}
      </div>
    </div>
    <div style="font-size:10px;color:var(--ds-text-3);">单位：¥/百万 tokens · 内置模型不可删除，价格可覆盖</div>
  </div>`;
}
function field(key: string, val: any) {
  const label = key.endsWith('.hit') ? '命中' : key.endsWith('.miss') ? '未命中' : '输出';
  return `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:11px;color:var(--ds-text-2);width:44px;">${label}</span><input type="number" step="0.001" min="0" data-price="${key}" value="${esc(val)}" style="flex:1;padding:6px 8px;border:1px solid var(--ds-border);border-radius:8px;background:var(--ds-card-inner);font-size:12px;" /></div>`;
}
function readRow(row: HTMLElement) {
  const peak = (row.querySelector('.aus-cm-peak') as HTMLInputElement)?.checked ?? true;
  const out: any = { usePeakPricing: peak, offpeak: {}, peak: {} };
  row.querySelectorAll('input[data-price]').forEach((el: any) => {
    const k = el.getAttribute('data-price'); const v = el.value.trim();
    const num = v === '' ? '' : parseFloat(v);
    const [zone, field] = k.split('.');
    out[zone][field] = v === '' || isNaN(num as any) ? '' : num;
  });
  return out;
}
function upsertCustom(model: string, patch: any) {
  const cms: any[] = (state.settings as any).customModels;
  let found = cms.find((c: any) => c.model === model);
  if (found) Object.assign(found, patch);
  else cms.push({ model, usePeakPricing: patch.usePeakPricing, offpeak: {}, peak: {} });
}
function saveCustomRow(model: string, prices: any, isBuiltin: boolean) {
  const base: any = (PRICING as any)[model];
  let same = true;
  for (const f of ['hit','miss','output']) {
    if (prices.offpeak[f] !== '' && prices.offpeak[f] !== base?.offpeak?.[f]) same = false;
    if (prices.peak[f] !== '' && prices.peak[f] !== base?.peak?.[f]) same = false;
  }
  const cms: any[] = (state.settings as any).customModels;
  const idx = cms.findIndex((c: any) => c.model === model);
  if (isBuiltin && prices.usePeakPricing && same) {
    if (idx !== -1) cms.splice(idx, 1);
  } else {
    const entry = { model, usePeakPricing: prices.usePeakPricing, offpeak: prices.offpeak, peak: prices.peak };
    if (idx !== -1) cms[idx] = entry; else cms.push(entry);
  }
  saveHot({ settings: state.settings }); recalcAllCosts(); try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
}
function getPricing(model: string) {
  const m = model || 'deepseek-v4-flash';
  const base: any = (PRICING as any)[m] || (PRICING as any)['deepseek-v4-flash'];
  for (const cm of (state.settings as any).customModels || []) {
    if (cm?.model === m) {
      const merge = (b: any, c: any) => ({ hit: c?.hit !== '' && c?.hit !== undefined ? parseFloat(c.hit) : b.hit, miss: c?.miss !== '' && c?.miss !== undefined ? parseFloat(c.miss) : b.miss, output: c?.output !== '' && c?.output !== undefined ? parseFloat(c.output) : b.output });
      return { usePeakPricing: cm.usePeakPricing !== false, offpeak: merge(base.offpeak, cm.offpeak), peak: merge(base.peak, cm.peak) };
    }
  }
  return base;
}
function fillDebugModelSelect(doc: Document) {
  const sel = doc.getElementById('aus-debug-model') as HTMLSelectElement | null;
  if (!sel) return;
  const models = Object.keys(PRICING).concat(((state.settings as any).customModels || []).map((c: any) => c.model).filter(Boolean));
  const uniq = Array.from(new Set(models));
  sel.innerHTML = uniq.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  const cur = (state.settings as any).debugModel;
  if (uniq.indexOf(cur) === -1) (state.settings as any).debugModel = uniq[0] || 'deepseek-v4-flash';
  sel.value = (state.settings as any).debugModel;
}
