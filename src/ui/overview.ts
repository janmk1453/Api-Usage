import { getSelectedSave, state } from '../store/index';
import { calcSavings } from '../services/pricing';

function fmt(n: number) { return n.toLocaleString('zh-CN'); }
function CNY(n: number) { return '¥' + n.toFixed(4) + ' CNY'; }

export function renderOverview() {
  const doc = (window.parent as any)?.document ?? document;
  const s: any = getSelectedSave();
  if (!s) return;

  // 充值余额 / 累计消费 已在 panel 静态中，刷新数值
  const bal = state.customBalance || state.balance?.balance;
  const balEl = doc.getElementById('aus-balance');
  if (balEl) balEl.textContent = bal ? '¥' + bal + ' CNY' : '¥0.00 CNY';

  const totalCost = s.total_cost || 0;
  const totalTokens = s.total_tokens || 0;
  const costEl = doc.getElementById('aus-total-cost');
  if (costEl) costEl.textContent = '¥' + totalCost.toFixed(4) + ' CNY';
  const tokEl = doc.getElementById('aus-total-tokens');
  if (tokEl) tokEl.textContent = fmt(totalTokens) + ' tokens';

  // 历史消耗块
  const histHost = doc.getElementById('aus-overview-history');
  if (histHost) {
    const hit = s.cache_hit_tokens || 0;
    const miss = s.cache_miss_tokens || 0;
    const out = s.output_tokens || 0;
    histHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">Token 历史消耗</span><span style="font-weight:600;color:#111827;">${fmt(totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（命中缓存）</span><span style="font-weight:600;color:#0BA25E;">${fmt(hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（未命中缓存）</span><span style="font-weight:600;color:#DC2626;">${fmt(miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输出</span><span style="font-weight:600;color:#111827;">${fmt(out)} tokens</span></div>
      </div>
    `;
  }

  // 支出明细块
  const spendHost = doc.getElementById('aus-overview-spend');
  if (spendHost) {
    let savings = 0;
    try { for (const h of s.history || []) savings += calcSavings({ timestamp: h.timestamp, model: h.model, prompt_cache_hit_tokens: h.cache_hit_tokens || 0, prompt_cache_miss_tokens: h.cache_miss_tokens || 0, completion_tokens: h.completion_tokens || 0 }, state.settings as any); } catch {}
    const inCost = s.input_cost || 0;
    const outCost = s.output_cost || 0;
    const inTok = (s.cache_hit_tokens || 0) + (s.cache_miss_tokens || 0);
    const outTok = s.output_tokens || 0;
    spendHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">预计节省</span><span style="font-weight:600;color:#0BA25E;">${CNY(savings)} · ${fmt(s.cache_hit_tokens || 0)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">支出在输入</span><span style="font-weight:600;color:#111827;">${CNY(inCost)} · ${fmt(inTok)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">支出在输出</span><span style="font-weight:600;color:#111827;">${CNY(outCost)} · ${fmt(outTok)} tokens</span></div>
      </div>
    `;
  }

  // 四小块
  const fourHost = doc.getElementById('aus-overview-four');
  if (fourHost) {
    const rounds = s.rounds || 1;
    const avgCost = totalCost / (s.rounds || 1);
    const avgTok = totalTokens / (s.rounds || 1);
    const avgDur = (s.history || []).length ? (s.history.reduce((a: number, h: any) => a + (h.duration || 0), 0) / (s.history.length)) / 1000 : 0;
    const avgRate = (s.history || []).length ? (s.history.reduce((a: number, h: any) => a + (h.tokenRate || 0), 0) / s.history.length) : 0;
    fourHost.innerHTML = `
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮费用</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">¥${avgCost.toFixed(4)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">CNY</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮 Token</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${Math.round(avgTok).toLocaleString('zh-CN')}</div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">平均耗时</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${avgDur.toFixed(1)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">s</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">输出速率</div><div style="font-size:18px;font-weight:600;color:#0BA25E;margin-top:4px;">${Math.round(avgRate)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">t/s</span></div></div>
    `;
  }
}
