import { computeOverview } from '../data/computed';

function fmt(n: number) { return n.toLocaleString('zh-CN'); }
function CNY(n: number) { return '¥' + n.toFixed(4) + ' CNY'; }

export function renderOverview() {
  const doc = (window.parent as any)?.document ?? document;
  const v = computeOverview();

  const balEl = doc.getElementById('aus-balance');
  if (balEl) balEl.textContent = v.balanceText;
  const costEl = doc.getElementById('aus-total-cost');
  if (costEl) costEl.textContent = '¥' + v.totalCost.toFixed(4) + ' CNY';
  const tokEl = doc.getElementById('aus-total-tokens');
  if (tokEl) tokEl.textContent = fmt(v.totalTokens) + ' tokens';

  const histHost = doc.getElementById('aus-overview-history');
  if (histHost) {
    histHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">Token 历史消耗</span><span style="font-weight:600;color:#111827;">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（命中缓存）</span><span style="font-weight:600;color:#0BA25E;">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输入（未命中缓存）</span><span style="font-weight:600;color:#DC2626;">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#6B7280;">输出</span><span style="font-weight:600;color:#111827;">${fmt(v.output)} tokens</span></div>
      </div>
    `;
  }

  const spendHost = doc.getElementById('aus-overview-spend');
  if (spendHost) {
    spendHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">预计节省</span><span style="text-align:right;"><div style="font-weight:600;color:#0BA25E;">${CNY(v.savings)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.hit)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">支出在输入</span><span style="text-align:right;"><div style="font-weight:600;color:#111827;">${CNY(v.inputCost)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.hit + v.miss)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:#6B7280;padding-top:2px;">支出在输出</span><span style="text-align:right;"><div style="font-weight:600;color:#111827;">${CNY(v.outputCost)}</div><div style="font-size:10px;color:#9CA3AF;margin-top:1px;">${fmt(v.output)} tokens</div></span></div>
      </div>
    `;
  }

  const fourHost = doc.getElementById('aus-overview-four');
  if (fourHost) {
    fourHost.innerHTML = `
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮费用</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">¥${v.avgCost.toFixed(4)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">CNY</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">每轮 Token</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${Math.round(v.avgTokens).toLocaleString('zh-CN')}</div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">平均耗时</div><div style="font-size:18px;font-weight:600;color:#111827;margin-top:4px;">${v.avgDuration.toFixed(1)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">s</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:#6B7280;">输出速率</div><div style="font-size:18px;font-weight:600;color:#0BA25E;margin-top:4px;">${Math.round(v.avgRate)} <span style="font-size:11px;color:#9CA3AF;font-weight:400;">t/s</span></div></div>
    `;
  }
}
