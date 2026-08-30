import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { saveApiKey } from '../services/balance';
import { doSyncNow, saveWebdavPass } from '../services/sync';
import { decryptKey } from '../utils/crypto';

function getDoc(): Document { return (window.parent as any)?.document ?? document; }

export function renderSettings(doc: Document) {
  const host = doc.getElementById('aus-settings');
  if (!host) return;
  host.innerHTML = `
    <div style="display:grid;gap:12px;">
      <div class="ds-card"><div class="ds-card-title">API 密钥</div><div style="display:flex;gap:8px;"><input id="aus-api-key" type="password" placeholder="sk-..." style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" value="" /><button id="aus-save-key" class="ds-btn-pill" style="padding:8px 14px;">保存</button></div><div id="aus-key-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div></div>
      <div class="ds-card"><div class="ds-card-title">自定义余额</div><div style="display:flex;gap:8px;"><input id="aus-custom-balance" placeholder="如 50.00" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /><button id="aus-save-balance" class="ds-btn-pill" style="padding:8px 14px;">保存</button><button id="aus-clear-balance" style="padding:8px 14px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:12px;cursor:pointer;">清除</button></div><div id="aus-balance-status" style="font-size:11px;color:#6B7280;margin-top:6px;"></div></div>
      <div class="ds-card"><div class="ds-card-title">峰值提示小圆点</div><label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;"><input type="checkbox" id="aus-peak-dot" /> 启用峰值圆点（红/黄/绿）</label><button id="aus-reset-dot" style="margin-top:8px;padding:6px 12px;border:1px solid #E5E7EB;border-radius:999px;background:#fff;font-size:11px;cursor:pointer;">重置位置</button></div>
      <div class="ds-card"><div class="ds-card-title">WebDAV 云同步</div><div style="font-size:11px;color:#6B7280;margin-bottom:8px;">双向合并，仅同步统计/设置/余额，不含聊天内容与密钥。强制 https。</div>
        <div style="display:grid;gap:8px;">
          <input id="aus-webdav-url" placeholder="https://dav.jianguoyun.com/dav/" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <div style="display:flex;gap:8px;"><input id="aus-webdav-user" placeholder="用户名" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /><input id="aus-webdav-pass" type="password" placeholder="应用密码" style="flex:1;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" /></div>
          <input id="aus-webdav-path" placeholder="远程子路径（可空）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <input id="aus-webdav-proxy" placeholder="CORS 代理（可选，http://127.0.0.1:8000/proxy?url=）" style="padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:12px;" />
          <button id="aus-webdav-sync" class="ds-btn-pill">☁️ 立即同步</button><div id="aus-webdav-status" style="font-size:11px;color:#6B7280;"></div>
        </div>
      </div>
    </div>
  `;
  const apiKeyEl = doc.getElementById('aus-api-key') as HTMLInputElement | null;
  try {
    const ctx: any = (globalThis as any).SillyTavern?.getContext?.();
    const v = ctx?.extensionSettings?.['api_usage_stat']?.apiKey;
    if (v && apiKeyEl) apiKeyEl.value = decryptKey(v);
  } catch {}
  (doc.getElementById('aus-custom-balance') as HTMLInputElement | null)!.value = state.customBalance || '';
  (doc.getElementById('aus-peak-dot') as HTMLInputElement | null)!.checked = state.settings.peakDot !== false;
  (doc.getElementById('aus-webdav-url') as HTMLInputElement | null)!.value = (state.settings.webdav as any)?.url || '';
  (doc.getElementById('aus-webdav-user') as HTMLInputElement | null)!.value = (state.settings.webdav as any)?.username || '';
  (doc.getElementById('aus-webdav-path') as HTMLInputElement | null)!.value = (state.settings.webdav as any)?.path || '';
  (doc.getElementById('aus-webdav-proxy') as HTMLInputElement | null)!.value = (state.settings.webdav as any)?.proxy || '';
  try {
    const pass = localStorage.getItem('ds_ds_webdav_pass') || '';
    const el = doc.getElementById('aus-webdav-pass') as HTMLInputElement | null;
    if (pass && el) el.value = decryptKey(pass);
  } catch {}
  doc.getElementById('aus-save-key')!.onclick = () => {
    const v = (doc.getElementById('aus-api-key') as HTMLInputElement).value.trim();
    saveApiKey(v); const s = doc.getElementById('aus-key-status')!; s.textContent = v ? '已保存' : '已清空';
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
  doc.getElementById('aus-peak-dot')!.onchange = (e: any) => { state.settings.peakDot = e.target.checked; saveHot({ settings: state.settings }); try { (globalThis as any).ApiUsageStat?.updatePeakDot?.(); } catch {} };
  doc.getElementById('aus-reset-dot')!.onclick = () => { try { localStorage.removeItem('ds_ds_peak_dot_pos'); } catch {} alert('已重置'); };
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
}
