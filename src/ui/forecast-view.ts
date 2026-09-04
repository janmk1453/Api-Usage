import { state } from '../store/index';
import { fitSegments, remainingRounds as calcR, ctxLimitRounds, costAt, nextPromptWithBand, ctxLimitForModel } from '../stats/forecast';
import { energyScore, topPowerChats } from '../stats/energyScore';
import { getPricing } from '../services/pricing';

function getDoc(){ return (window.parent as any)?.document ?? document; }
function currentChatId(): string | null {
  try { const ctx:any=(globalThis as any).SillyTavern?.getContext?.(); return ctx?.getCurrentChatId?.()||null; } catch { return null; }
}
function balanceNum(): number | null {
  const b = (state as any).customBalance || (state as any).balance?.balance;
  if (b==null||b==='') return null;
  const n = parseFloat(String(b));
  return isNaN(n)? null : n;
}


export function renderForecastView(){
  const doc=getDoc();
  const hist:any[] = (state as any).history||[];
  const chatId = currentChatId();
  const selHist = chatId? hist.filter((h:any)=>(h.chatId??null)===chatId): hist.slice();
  // 预测卡（主页面与概览复用）
  const renderCard = (host: HTMLElement | null) => {
    if (!host) return;
    if (selHist.length < 3) {
      host.innerHTML = `<div style="text-align:center;padding:16px;color:var(--ds-text-3);font-size:12px;">继续对话以启用预测（需 ≥3 轮当前对话样本）</div>`;
      return;
    }
    const fit = fitSegments(hist, chatId);
    if (!fit) { host.innerHTML = `<div style="padding:12px;color:var(--ds-text-2);font-size:12px;">暂无数据</div>`; return; }
    const bal = balanceNum();
    const model = selHist[selHist.length-1]?.model || 'deepseek-v4-flash';
    const pricing = getPricing(model, state.settings as any);
    const p = pricing.offpeak;
    const R = bal!=null? calcR(bal, fit, p): { R:0, R_low:0, R_high:0 };
    const ctxLim = ctxLimitForModel(model);
    const rCtx = ctxLimitRounds(fit, ctxLim);
    const rShow = rCtx!=null? Math.min(R.R, rCtx): R.R;
    const next = nextPromptWithBand(fit);
    const hitPct = (fit.hitEwma*100).toFixed(1);
    const deltaTok = Math.round(fit.delta);
    const cNext = costAt(fit.segLen, fit, p);
    host.innerHTML = `<div style="line-height:1.6;">
      <div style="font-size:13px;font-weight:700;color:var(--ds-text);">预计还可 <span style="color:var(--ds-green);">~${rShow} 轮</span>（余额口径）· ±${Math.abs(R.R_high-R.R_low)/2|0}</div>
      <div style="font-size:11px;color:var(--ds-text-2);margin-top:4px;">每轮新增 ≈ ${deltaTok.toLocaleString()} tok · 命中率(近5) ${hitPct}% · 下一轮成本 ≈ ¥${cNext.toFixed(4)} · 下一轮 prompt ≈ ${Math.round(next.prompt).toLocaleString()} tok</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <div style="flex:1;background:var(--ds-card);border-radius:6px;height:8px;position:relative;overflow:hidden;"><div style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(100,(R.R/ Math.max(10,R.R+(rCtx||0)))*100)}%;background:var(--ds-green);"></div></div>
        <div style="flex:1;background:var(--ds-card);border-radius:6px;height:8px;position:relative;overflow:hidden;"><div style="position:absolute;left:0;top:0;bottom:0;width:${rCtx!=null?Math.min(100,(rCtx/ Math.max(10,rCtx))*100):0}%;background:${(rCtx!=null&&rCtx<rShow)?'var(--ds-red)':'var(--ds-purple-bg)'};"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ds-text-3);margin-top:4px;"><span>R(余额) ${R.R}</span><span>R(ctx ${ (ctxLim/1000)|0}k) ${rCtx ?? '—'}</span></div>
      ${rCtx!=null && rCtx<rShow ? `<div style="font-size:11px;color:var(--ds-red);margin-top:6px;">⚠ ${rCtx} 轮后 prompt 达上限 ${ctxLim.toLocaleString()} tok，建议压缩上下文</div>` : ''}
    </div>`;
  };
  renderCard(doc.getElementById('aus-forecast-card'));
  renderCard(doc.getElementById('aus-forecast-card-overview'));
  // 能耗标识
  const badgeHost = doc.getElementById('aus-energy-badge');
  if (badgeHost) {
    const chatId2 = currentChatId();
    const r = energyScore(hist, chatId2);
    const grade = r.grade;
    const colors: Record<string,string> = { A:'#16a34a', B:'#22c55e', C:'#84cc16', D:'#eab308', E:'#f97316', F:'#ef4444', G:'#dc2626' };
    const grades: string[] = ['A','B','C','D','E','F','G'];
    const idx = grades.indexOf(grade);
    badgeHost.innerHTML = `<div style="display:flex;gap:12px;align-items:center;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        ${grades.map((g,i)=>`<div style="display:flex;align-items:center;gap:6px;"><span style="width:28px;height:22px;border-radius:4px;background:${colors[g]};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${g}</span>${i===idx?`<span style="color:${colors[g]};font-weight:700;">◀ 当前</span>`:''}</div>`).join('')}
      </div>
      <div style="flex:1;display:grid;gap:6px;font-size:11px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">增速 Δ</span><span style="font-weight:600;">${Math.round(r.metrics.delta).toLocaleString()} tok/轮</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">输出</span><span style="font-weight:600;">${Math.round(r.metrics.out).toLocaleString()} tok/轮</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:var(--ds-text-2);">效率</span><span style="font-weight:600;">${(r.metrics.efficiency*100).toFixed(1)}%</span></div>
        <div style="font-size:10px;color:var(--ds-text-3);margin-top:4px;">综合评分 ${r.score.toFixed(0)} · ${grade} 级 · 样本 ${ (chatId2? hist.filter((h:any)=>(h.chatId??null)===chatId2).length : hist.length)} 轮</div>
      </div>
    </div>`;
  }
  // 预测图
  renderForecastChart(hist, chatId);
  // 敏感度滑块
  renderSensitivity(hist, chatId);
  // 对比视图
  renderCompare(hist);
}

let forecastChart:any=null;
async function renderForecastChart(history:any[], chatId:string|null){
  const doc=getDoc();
  const el=doc.getElementById('aus-forecast-chart') as HTMLElement|null;
  if (!el) return;
  if (!history.length) { el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ds-text-3);">暂无数据</div>'; return; }
  const fit = fitSegments(history, chatId);
  if (!fit || fit.segLen<1) { el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ds-text-3);">样本不足</div>'; return; }
  const sorted = [...history].filter(h=> (h.chatId??null)===chatId).sort((a,b)=>a.timestamp-b.timestamp);
  const y = sorted.map((h:any)=> h.prompt_tokens ?? (h.cache_hit_tokens||0)+(h.cache_miss_tokens||0));
  // 历史拟合段
  const fitLine = y.map((_,i)=> fit.C0 + fit.delta * ((fit.segStart + i)>=sorted.length - fit.segLen ? ((fit.segStart + i)- (sorted.length-fit.segLen)) : 0));
  // 预测 10 轮
  const futureN=10;
  const pred:any[]=[], low:any[]=[], high:any[]=[];
  for(let k=1;k<=futureN;k++){ const n=fit.segLen + k -1; const p=fit.C0+fit.delta*n; pred.push(p); low.push(Math.max(0,p-fit.sigma)); high.push(p+fit.sigma); }
  const labels = sorted.map((_,i)=>`#${i+1}`).concat(Array.from({length:futureN},(_,i)=>`+${i+1}`));
  const histData = y.concat(Array(futureN).fill(null));
  const predData = Array(y.length).fill(null).concat(pred);
  const lowData = Array(y.length).fill(null).concat(low);
  const highData = Array(y.length).fill(null).concat(high);
  const ctxLim = ctxLimitForModel(sorted[sorted.length-1]?.model || 'deepseek-v4-flash');
  // echarts
  const ec:any = await import('echarts/core');
  const { LineChart } = await import('echarts/charts');
  const { GridComponent, TooltipComponent } = await import('echarts/components');
  const { CanvasRenderer } = await import('echarts/renderers');
  ec.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
  if (forecastChart) try{ forecastChart.dispose(); }catch{}
  el.innerHTML=''; (el as any).style.height='260px';
  forecastChart = ec.init(el);
  const cText3 = getComputedStyle(doc.getElementById('aus-panel')||doc.documentElement).getPropertyValue('--ds-text-3') || '#9CA3AF';
  const cBorder = getComputedStyle(doc.getElementById('aus-panel')||doc.documentElement).getPropertyValue('--ds-border') || '#E5E7EB';
  forecastChart.setOption({
    backgroundColor:'transparent',
    tooltip:{ trigger:'axis' },
    grid:{ left:48, right:16, top:16, bottom:24 },
    xAxis:{ type:'category', data:labels, axisLine:{lineStyle:{color:cBorder}}, axisLabel:{color:cText3,fontSize:10, interval: Math.ceil(labels.length/12)-1} },
    yAxis:{ type:'value', axisLabel:{color:cText3,fontSize:10}, splitLine:{lineStyle:{color:cBorder}} },
    series:[
      { name:'历史 prompt', type:'line', data:histData, smooth:true, symbol:'circle', symbolSize:3, lineStyle:{width:1.5}, itemStyle:{color:'#6366F1'} },
      { name:'拟合', type:'line', data:fitLine.concat(Array(futureN).fill(null)), lineStyle:{type:'dashed',width:1.5,color:'#9CA3AF'}, symbol:'none' },
      { name:'预测', type:'line', data:predData, lineStyle:{width:1.8,color:'#0BA25E'}, symbol:'none' },
      { name:'置信下', type:'line', data:lowData, lineStyle:{width:0}, symbol:'none', areaStyle:{color:'rgba(16,185,129,0.12)'} },
      { name:'置信上', type:'line', data:highData, lineStyle:{width:0}, symbol:'none' },
      { type:'line', data:Array(labels.length).fill(ctxLim), lineStyle:{type:'dashed',color:'#ef4444'}, symbol:'none', markLine:{ data:[{ yAxis: ctxLim }] } }
    ]
  }, true);
}

function renderSensitivity(history:any[], chatId:string|null){
  const host=getDoc().getElementById('aus-forecast-sensitivity');
  if (!host) return;
  const hitInit = (()=>{ const fit=fitSegments(history,chatId); return fit? Math.round(fit.hitEwma*100): 50; })();
  host.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:var(--ds-text-2);">假设命中率</span><input id="aus-sens-hit" type="range" min="0" max="100" value="${hitInit}" style="flex:1;"><span id="aus-sens-hit-val" style="font-weight:600;min-width:36px;text-align:right;">${hitInit}%</span></div><div id="aus-sens-result" style="font-size:11px;color:var(--ds-text-2);margin-top:6px;"></div>`;
  const slider = host.querySelector('#aus-sens-hit') as HTMLInputElement;
  const valEl = host.querySelector('#aus-sens-hit-val') as HTMLElement;
  const resEl = host.querySelector('#aus-sens-result') as HTMLElement;
  const update = ()=>{
    const h = Number(slider.value)/100;
    if (valEl) valEl.textContent = slider.value+'%';
    const fit = fitSegments(history,chatId);
    if (!fit) { if(resEl) resEl.textContent='样本不足'; return; }
    const bal=balanceNum();
    if (bal==null){ if(resEl) resEl.textContent='未设置余额，无法估算剩余轮数'; return; }
    // 临时覆盖 hit
    const tmp={...fit, hitEwma:h} as any;
    const model = (history.filter((hh:any)=>(hh.chatId??null)===chatId).slice(-1)[0]?.model)||'deepseek-v4-flash';
    const pricing = getPricing(model, state.settings as any);
    const R = calcR(bal, tmp, pricing.offpeak);
    if(resEl) resEl.textContent = `命中 ${slider.value}% 时预计剩余 ${R.R} 轮（±${Math.abs(R.R_high-R.R_low)/2|0}），降 10% 约少 ${Math.abs(R.R - calcR(bal,{...fit,hitEwma:Math.max(0,h-0.1)} as any,pricing.offpeak).R)} 轮`;
  };
  if (slider) slider.oninput = update;
  update();
}

function renderCompare(history:any[]){
  const host=getDoc().getElementById('aus-forecast-compare');
  if (!host) return;
  const list = topPowerChats(history, 8);
  if (!list.length) { host.innerHTML = `<div style="padding:12px;color:var(--ds-text-3);font-size:11px;">暂无对话</div>`; return; }
  host.innerHTML = list.map(r=>{
    const name = r.chatId || '全部/未分组';
    const pct = Math.max(6, Math.min(100, (r.delta/8000)*100));
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--ds-border);font-size:11px;">
      <span style="min-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
      <span style="width:18px;height:18px;border-radius:999px;background:${gradeColor(r.grade)};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;">${r.grade}</span>
      <span style="flex:1;height:6px;background:var(--ds-card);border-radius:999px;position:relative;overflow:hidden;"><span style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:var(--ds-purple-bg);"></span></span>
      <span style="min-width:60px;text-align:right;">${Math.round(r.delta).toLocaleString()} tok/轮</span>
    </div>`;
  }).join('');
  function gradeColor(g:string){ const m:any={A:'#16a34a',B:'#22c55e',C:'#84cc16',D:'#eab308',E:'#f97316',F:'#ef4444',G:'#dc2626'}; return m[g]||'#9CA3AF'; }
}

export function initForecastView(){
  const doc=getDoc();
  doc.addEventListener('click', (e:any)=>{
    // 预测页内交互已在 render 中绑定
  });
}
