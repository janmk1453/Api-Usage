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
      <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">Token 历史消耗</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输入（命中缓存）</span><span style="font-weight:600;color:var(--ds-green);">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输入（未命中缓存）</span><span style="font-weight:600;color:var(--ds-red);">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输出</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.output)} tokens</span></div>
      </div>
    `;
  }

  const spendHost = doc.getElementById('aus-overview-spend');
  if (spendHost) {
    spendHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">支出明细</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">预计节省</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-green);">${CNY(v.savings)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">支出在输入</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-text);">${CNY(v.inputCost)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.hit + v.miss)} tokens</div></span></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;"><span style="color:var(--ds-text-2);padding-top:2px;">支出在输出</span><span style="text-align:right;"><div style="font-weight:600;color:var(--ds-text);">${CNY(v.outputCost)}</div><div style="font-size:10px;color:var(--ds-text-3);margin-top:1px;">${fmt(v.output)} tokens</div></span></div>
      </div>
    `;
  }

  const fourHost = doc.getElementById('aus-overview-four');
  if (fourHost) {
    fourHost.innerHTML = `
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:var(--ds-text-2);">每轮费用</div><div style="font-size:18px;font-weight:600;color:var(--ds-text);margin-top:4px;">¥${v.avgCost.toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:var(--ds-text-2);">每轮 Token</div><div style="font-size:18px;font-weight:600;color:var(--ds-text);margin-top:4px;">${Math.round(v.avgTokens).toLocaleString('zh-CN')}</div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:var(--ds-text-2);">平均耗时</div><div style="font-size:18px;font-weight:600;color:var(--ds-text);margin-top:4px;">${v.avgDuration.toFixed(1)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">s</span></div></div>
      <div class="ds-card" style="padding:14px;"><div style="font-size:11px;color:var(--ds-text-2);">输出速率</div><div style="font-size:18px;font-weight:600;color:var(--ds-green);margin-top:4px;">${Math.round(v.avgRate)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">t/s</span></div></div>
    `;
  }
}
