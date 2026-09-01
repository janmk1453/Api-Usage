import { computeOverview } from '../data/computed';
import { renderHeatmap } from './heatmap';
import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import type { OverviewFourKey } from '../types/settings';

function fmt(n: number) { return n.toLocaleString('zh-CN'); }
function CNY(n: number) { return '¥' + n.toFixed(4) + ' CNY'; }

type FourOpt = { key: OverviewFourKey; label: string };
const FOUR_OPTIONS: FourOpt[] = [
  { key: 'avg_cost', label: '每轮费用' },
  { key: 'avg_tokens', label: '每轮 Token' },
  { key: 'avg_duration', label: '平均耗时' },
  { key: 'avg_rate', label: '输出速率' },
  { key: 'avg_input_cost', label: '每轮平均输入费用' },
  { key: 'avg_input_tokens', label: '每轮平均输入 Token' },
  { key: 'avg_output_cost', label: '每轮平均输出费用' },
  { key: 'avg_output_tokens', label: '每轮平均输出 Token' },
  { key: 'avg_think_time', label: '思维链平均耗时' },
  { key: 'avg_think_tokens', label: '思维链平均 Token' },
  { key: 'avg_hit_rate', label: '平均缓存命中率' },
  { key: 'latest_hit_rate', label: '最新命中率' },
  { key: 'max_output', label: '单轮最大输出' },
  { key: 'max_input', label: '单轮最大输入' },
  { key: 'max_total', label: '单轮最大总 Token' },
];
const FOUR_LABEL_MAP = new Map<string,string>(FOUR_OPTIONS.map(o=>[o.key,o.label]));

function ensureFour(): OverviewFourKey[] {
  let cur: any = (state.settings as any).overviewFour;
  const valid = new Set(FOUR_OPTIONS.map(o=>o.key));
  const defaults: OverviewFourKey[] = ['avg_cost','avg_tokens','avg_duration','avg_rate','avg_input_tokens','avg_output_tokens','avg_hit_rate','max_total'];
  if (!Array.isArray(cur) || cur.some((k:any)=>!valid.has(k))) {
    cur = defaults.slice();
    (state.settings as any).overviewFour = cur;
    try { saveHot({ settings: state.settings }); } catch {}
    return cur as OverviewFourKey[];
  }
  if (cur.length === 4) {
    // 旧4块迁移至8块：保留原4，补齐后4默认
    cur = [...cur, ...defaults.slice(4)] as OverviewFourKey[];
    (state.settings as any).overviewFour = cur;
    try { saveHot({ settings: state.settings }); } catch {}
  }
  if (cur.length !== 8) {
    cur = defaults.slice();
    (state.settings as any).overviewFour = cur;
    try { saveHot({ settings: state.settings }); } catch {}
  }
  return cur as OverviewFourKey[];
}

function getFourDisplay(key: OverviewFourKey, v: any): { title:string; html:string } {
  const title = FOUR_LABEL_MAP.get(key) || key;
  const rounds = v.rounds || 0;
  const empty = (!rounds && key!=='latest_hit_rate' && key!=='avg_hit_rate' && key!=='max_output' && key!=='max_input' && key!=='max_total') || !v.history && false;
  // helpers
  switch (key) {
    case 'avg_cost': return { title, html: `¥${(v.avgCost||0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case 'avg_tokens': return { title, html: `${Math.round(v.avgTokens||0).toLocaleString('zh-CN')}` };
    case 'avg_duration': return { title, html: `${(v.avgDuration||0).toFixed(1)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">s</span>` };
    case 'avg_rate': return { title: '输出速率', html: `${Math.round(v.avgRate||0)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">t/s</span>` };
    case 'avg_input_cost': return { title, html: `¥${(v.avgInputCost||0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case 'avg_input_tokens': return { title, html: `${Math.round(v.avgInputTokens||0).toLocaleString('zh-CN')}` };
    case 'avg_output_cost': return { title, html: `¥${(v.avgOutputCost||0).toFixed(4)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">CNY</span>` };
    case 'avg_output_tokens': return { title, html: `${Math.round(v.avgOutputTokens||0).toLocaleString('zh-CN')}` };
    case 'avg_think_time': {
      const has = (v.avgThinkTime||0) > 0;
      return { title, html: has ? `${(v.avgThinkTime).toFixed(1)} <span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">s</span>` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case 'avg_think_tokens': {
      const has = (v.avgThinkTokens||0) > 0;
      return { title, html: has ? `${Math.round(v.avgThinkTokens).toLocaleString('zh-CN')}` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case 'avg_hit_rate': {
      const has = (v.avgHitRate||0) > 0;
      return { title, html: has ? `${(v.avgHitRate).toFixed(1)}<span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">%</span>` : `<span style="color:var(--ds-text-3);">—</span>` };
    }
    case 'latest_hit_rate': {
      const val = v.latestHitRate;
      if (val == null) return { title, html: `<span style="color:var(--ds-text-3);">—</span>` };
      return { title, html: `${val.toFixed(1)}<span style="font-size:11px;color:var(--ds-text-3);font-weight:400;">%</span>` };
    }
    case 'max_output': return { title, html: `${(v.maxOutput||0).toLocaleString('zh-CN')}` };
    case 'max_input': return { title, html: `${(v.maxInput||0).toLocaleString('zh-CN')}` };
    case 'max_total': return { title, html: `${(v.maxTotal||0).toLocaleString('zh-CN')}` };
    default: return { title, html: '—' };
  }
}

let fourBound = false;
function bindFour() {
  if (fourBound) return;
  fourBound = true;
  const doc = (window.parent as any)?.document ?? document;
  doc.addEventListener('click', (e: any) => {
    const t = e.target as HTMLElement;
    for (let i=0;i<8;i++) {
      const drop = doc.getElementById(`aus-four-drop-${i}`);
      const btn = doc.getElementById(`aus-four-btn-${i}`);
      if (drop && btn && !t.closest(`#aus-four-drop-${i}`) && !t.closest(`#aus-four-btn-${i}`)) drop.style.display='none';
    }
  });
}

function openFourDrop(idx:number, v:any) {
  const doc = (window.parent as any)?.document ?? document;
  const drop = doc.getElementById(`aus-four-drop-${idx}`) as HTMLElement | null;
  if (!drop) return;
  const curKeys = ensureFour();
  const cur = curKeys[idx];
  drop.innerHTML = FOUR_OPTIONS.map(o=>{
    const active = o.key===cur;
    return `<div data-four="${idx}" data-key="${o.key}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:11px;${active?'background:var(--ds-card);font-weight:600;color:var(--ds-text);':''}">${o.label}</div>`;
  }).join('');
  drop.querySelectorAll('[data-four]').forEach((el:any)=>{
    el.onclick = () => {
      const key = el.getAttribute('data-key') as OverviewFourKey;
      const at = Number(el.getAttribute('data-four'));
      const arr = ensureFour().slice() as OverviewFourKey[];
      arr[at] = key;
      (state.settings as any).overviewFour = arr;
      try { saveHot({ settings: state.settings }); } catch {}
      drop.style.display='none';
      renderOverview();
    };
  });
  drop.style.display = drop.style.display==='block' ? 'none' : 'block';
}

export function renderOverview() {
  const doc = (window.parent as any)?.document ?? document;
  const v = computeOverview();

  const balEl = doc.getElementById('aus-balance');
  if (balEl) balEl.textContent = v.balanceText;
  const remEl = doc.getElementById('aus-balance-remaining');
  if (remEl) {
    if (v.remainingRounds != null) remEl.textContent = '预计还可进行 ' + v.remainingRounds.toLocaleString('zh-CN') + ' 轮对话（仅 DeepSeek 官方）';
    else {
      const hasBal = !!(state.customBalance || state.balance?.balance);
      remEl.textContent = hasBal ? '暂无 DeepSeek 对话数据，无法预测' : '查询余额后可预测剩余轮次';
    }
  }
  const costEl = doc.getElementById('aus-total-cost');
  if (costEl) costEl.textContent = '¥' + v.totalCost.toFixed(4) + ' CNY';
  const tokEl = doc.getElementById('aus-total-tokens');
  if (tokEl) tokEl.textContent = fmt(v.totalTokens) + ' tokens';

  const histHost = doc.getElementById('aus-overview-history');
  if (histHost) {
    histHost.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--ds-text);margin-bottom:8px;">历史消耗</div>
      <div style="display:grid;gap:10px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">Token 历史消耗</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.totalTokens)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（命中缓存）</span><span style="font-weight:600;color:var(--ds-green);">${fmt(v.hit)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输入（未命中缓存）</span><span style="font-weight:600;color:var(--ds-red);">${fmt(v.miss)} tokens</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="color:var(--ds-text-2);">输出</span><span style="font-weight:600;color:var(--ds-text);">${fmt(v.output)} tokens</span></div>
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
    const keys = ensureFour();
    bindFour();
    fourHost.innerHTML = keys.map((k,i)=>{
      const d = getFourDisplay(k, v);
      const isRate = k==='avg_rate';
      const valColor = isRate ? 'var(--ds-green)' : 'var(--ds-text)';
      return `<div class="ds-card" style="padding:14px;position:relative;overflow:visible;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div style="font-size:11px;color:var(--ds-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.title}</div>
          <button id="aus-four-btn-${i}" title="切换指标" style="flex-shrink:0;padding:4px 7px;border:1px solid var(--ds-border);border-radius:999px;background:var(--ds-card-inner);color:var(--ds-text-2);font-size:10px;cursor:pointer;line-height:1;">▼</button>
          <div id="aus-four-drop-${i}" style="display:none;position:absolute;top:38px;right:8px;z-index:6;background:var(--ds-card-inner);border:1px solid var(--ds-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);padding:6px;min-width:180px;max-height:260px;overflow:auto;"></div>
        </div>
        <div style="font-size:18px;font-weight:600;color:${valColor};margin-top:6px;word-break:break-all;">${d.html}</div>
      </div>`;
    }).join('');
    keys.forEach((_,i)=>{
      const btn = doc.getElementById(`aus-four-btn-${i}`);
      if (btn) btn.onclick = () => openFourDrop(i, v);
    });
  }

  // 热力图：用量概览页展示全部历史的 token 分布（近 2 年，占满右侧）
  try {
    const hist: any[] = (state.history || []) as any[];
    renderHeatmap(hist);
  } catch {}
}
