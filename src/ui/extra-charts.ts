import { localDay } from '../utils/date';
import { Y_OPTIONS, X_OPTIONS, getYSelected as getMainY, getXSelected as getMainX } from './chart-config';

type ChartId = 'token'|'cost'|'hit'|'req'|'dur'|'pie';
type XKey = 'round'|'hour'|'day'|'week'|'month';

const CHART_DEFS: Record<ChartId, {title:string, yOpts: typeof Y_OPTIONS, hasX:boolean}> = {
  token: { title:'Token 趋势', yOpts: Y_OPTIONS.filter(o=>o.kind==='token'), hasX:true },
  cost: { title:'费用 趋势', yOpts: Y_OPTIONS.filter(o=>o.kind==='cost'), hasX:true },
  hit: { title:'缓存命中 趋势', yOpts: [{key:'hit_rate' as any,label:'命中率',unit:'%',kind:'cost' as any,color:'#0BA25E'}], hasX:true },
  req: { title:'API请求数 趋势', yOpts: [{key:'req_count' as any,label:'请求数',unit:'次',kind:'token' as any,color:'#6366F1'}], hasX:true },
  dur: { title:'耗时与速率 趋势', yOpts: [{key:'duration' as any,label:'耗时',unit:'s',kind:'token' as any,color:'#2563EB'},{key:'rate' as any,label:'速率',unit:'t/s',kind:'cost' as any,color:'#10B981'}], hasX:true },
  pie: { title:'模型用量占比', yOpts: [], hasX:false },
};

const state: Record<ChartId, {y:Set<string>,x:XKey,pieMode:'token'|'count'}> = {
  token: { y: new Set(['input_hit_token','input_miss_token','output_token']), x:'day', pieMode:'token' },
  cost: { y: new Set(['total_cost']), x:'day', pieMode:'token' },
  hit: { y: new Set(['hit_rate']), x:'day', pieMode:'token' },
  req: { y: new Set(['req_count']), x:'day', pieMode:'token' },
  dur: { y: new Set(['duration','rate']), x:'day', pieMode:'token' },
  pie: { y: new Set([]), x:'day', pieMode:'token' },
};

function getDoc(){ return (window.parent as any)?.document ?? document; }
function themeColor(name: string, fallback: string) {
  try {
    const doc = getDoc();
    const el = doc.getElementById('aus-panel') || doc.documentElement;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

function bucketKey(ts:number, x:XKey, idx:number):string {
  if (x==='round') return `#${idx+1}`;
  if (x==='hour') { const d=new Date(ts+8*3600*1000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:00`; }
  if (x==='day') return localDay(ts);
  if (x==='week') { const d=new Date(ts); const tmp=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dayNum=tmp.getUTCDay()||7; tmp.setUTCDate(tmp.getUTCDate()+4-dayNum); const yearStart=new Date(Date.UTC(tmp.getUTCFullYear(),0,1)); const weekNo=Math.ceil((((tmp as any)-(yearStart as any))/86400000+1)/7); return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`; }
  if (x==='month') { const d=new Date(ts+8*3600*1000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
  return localDay(ts);
}

function getYValue(e:any, key:string):number {
  switch(key){
    case 'input_hit_token': return e.cache_hit_tokens||0;
    case 'input_miss_token': return e.cache_miss_tokens||0;
    case 'output_token': return e.completion_tokens||0;
    case 'total_token': return e.total_tokens||0;
    case 'input_hit_cost': { const hit=e.cache_hit_tokens||0,miss=e.cache_miss_tokens||0,tot=hit+miss; return tot? (e.input_cost||0)*(hit/tot):0; }
    case 'input_miss_cost': { const hit=e.cache_hit_tokens||0,miss=e.cache_miss_tokens||0,tot=hit+miss; return tot? (e.input_cost||0)*(miss/tot):0; }
    case 'output_cost': return e.output_cost||0;
    case 'total_cost': return e.cost||0;
    case 'hit_rate': { const h=e.cache_hit_tokens||0,m=e.cache_miss_tokens||0,tot=h+m; return tot? h/tot*100:0; }
    case 'req_count': return 1;
    case 'duration': return (e.duration||0)/1000;
    case 'rate': return e.tokenRate||0;
  }
  return 0;
}

async function getEcharts(){
  const ec:any = await import('echarts/core');
  const { BarChart, LineChart, PieChart } = await import('echarts/charts');
  const { GridComponent, TooltipComponent, LegendComponent } = await import('echarts/components');
  const { CanvasRenderer } = await import('echarts/renderers');
  ec.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
  return ec;
}

const charts: Record<string, any> = {};

export function renderExtraCharts(filtered:any[]){
  for (const id of Object.keys(CHART_DEFS) as ChartId[]){
    renderOne(id, filtered);
  }
}

async function renderOne(id:ChartId, filtered:any[]){
  const doc=getDoc();
  const el=doc.getElementById(`aus-chart-${id}`) as HTMLElement | null;
  if (!el) return;
  // pie special
  if (id==='pie'){
    const mode = state.pie.pieMode;
    if (!filtered.length){ el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ds-text-3);">暂无数据</div>'; return; }
    const map: Record<string, number> = {};
    for (const e of filtered){ const m=e.model||'unknown'; const v = mode==='token' ? (e.total_tokens||0) : 1; map[m]=(map[m]||0)+v; }
    const data = Object.entries(map).map(([name,value])=>({name, value}));
    const ec = await getEcharts();
    if (charts[id]) try{ charts[id].dispose(); }catch{}
    el.innerHTML=''; (el as any).style.height='260px';
    const c = charts[id]=ec.init(el);
    c.setOption({
      backgroundColor:'transparent',
      tooltip:{ trigger:'item', backgroundColor:themeColor('--ds-card-inner','#FFFFFF'), borderColor:themeColor('--ds-border','#E5E7EB'), textStyle:{fontSize:11, color:themeColor('--ds-text','#111827')} },
      legend:{ bottom:0, textStyle:{fontSize:10,color:themeColor('--ds-text-2','#6B7280')} },
      series:[{ type:'pie', radius:['40%','70%'], itemStyle:{borderRadius:6,borderColor:themeColor('--ds-card-inner','#FFFFFF'),borderWidth:2}, label:{fontSize:11}, data }],
    });
    return;
  }
  const yKeys = Array.from(state[id].y);
  const xKey = state[id].x;
  if (!yKeys.length){ el.innerHTML='<div style="text-align:center;padding:30px;color:var(--ds-text-3);font-size:11px;">请选择 Y 轴</div>'; return; }
  // 聚合
  if (xKey==='round'){
    const labels = filtered.map((_,i)=>`#${i+1}`);
    const yMeta = new Map(CHART_DEFS[id].yOpts.map(o=>[o.key,o] as any));
    // hit/req/duration 需特殊：hit_rate 按单点直接值
    const series = yKeys.map(k=>{
      const meta:any = yMeta.get(k) || Y_OPTIONS.find(o=>o.key===k) || {label:k,color:'var(--ds-text-2)'};
      const data = filtered.map(e=> {
        const v=getYValue(e,k);
        return Number(v.toFixed(k.includes('cost')||k==='hit_rate'?2:0));
      });
      return { name: meta.label, data, color: meta.color, kind: meta.kind || 'token' };
    });
    await drawBarLine(el, id, labels, series);
    return;
  }
  // 分桶
  const buckets = new Map<string, any[]>();
  filtered.forEach(e=>{
    const key = bucketKey(e.timestamp, xKey, 0);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  });
  const sortedKeys = Array.from(buckets.keys()).sort();
  const labels = sortedKeys.map(k=> xKey==='day'?k.slice(5).replace('-','/'):xKey==='hour'?k.slice(5):k);
  const yOptsMap = new Map(CHART_DEFS[id].yOpts.map(o=>[o.key,o] as any));
  // 补充 Y_OPTIONS 中未在 CHART_DEFS 的 hit_rate 等
  const fullMap = new Map([...Y_OPTIONS, ...CHART_DEFS[id].yOpts].map(o=>[o.key,o] as any));
  const series = yKeys.map(k=>{
    const meta:any = fullMap.get(k) || {label:k,color:'var(--ds-text-2)',kind:'token'};
    let data: number[];
    if (k==='hit_rate'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!;
        let hit=0, tot=0; for(const e of arr){ hit+=e.cache_hit_tokens||0; tot+= (e.cache_hit_tokens||0)+(e.cache_miss_tokens||0); }
        return tot? Number((hit/tot*100).toFixed(1)):0;
      });
    } else if (k==='duration'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!;
        const avg = arr.reduce((a:any,c:any)=>a+(c.duration||0),0)/arr.length/1000;
        return Number(avg.toFixed(1));
      });
    } else if (k==='rate'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!;
        const avg = arr.reduce((a:any,c:any)=>a+(c.tokenRate||0),0)/arr.length;
        return Math.round(avg);
      });
    } else if (k==='req_count'){
      data = sortedKeys.map(key=> buckets.get(key)!.length);
    } else {
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!;
        let sum=0; for(const e of arr) sum+=getYValue(e,k);
        return Number(sum.toFixed(k.includes('cost')?2:0));
      });
    }
    return { name: meta.label, data, color: meta.color, kind: meta.kind || 'token' };
  });
  await drawBarLine(el, id, labels, series);
}

function calcXInterval(labels: string[], el: HTMLElement): number {
  const w = el.clientWidth || 320;
  const minPerLabel = w < 500 ? 42 : w < 760 ? 56 : 68; // 窄屏更密，宽屏更疏
  const maxLabels = Math.max(8, Math.floor(w / minPerLabel));
  if (labels.length <= maxLabels) return 0;
  return Math.ceil(labels.length / maxLabels) - 1;
}

async function drawBarLine(el:HTMLElement, id:ChartId, labels:string[], series:Array<{name:string,data:number[],color:string,kind:string}>){
  const ec = await getEcharts();
  if (charts[id]) try{ charts[id].dispose(); }catch{}
  el.innerHTML=''; (el as any).style.height='260px';
  const c = charts[id]=ec.init(el);
  // 前两张：重叠柱 + 曲线（Token/费用）
  const isTokenCost = id==='token' || id==='cost';
  const interval = calcXInterval(labels, el);
  const opts:any = {
    backgroundColor:'transparent',
    tooltip:{ trigger:'axis', backgroundColor:themeColor('--ds-card-inner','#FFFFFF'), borderColor:themeColor('--ds-border','#E5E7EB'), textStyle:{fontSize:11} },
    grid:{ left:40, right:20, top:8, bottom:24 },
    xAxis:{ type:'category', data: labels, axisLine:{lineStyle:{color:themeColor('--ds-border','#E5E7EB')}}, axisLabel:{fontSize:10,color:themeColor('--ds-text-3','#9CA3AF'),rotate: labels.length>12?30:0, interval: interval, hideOverlap: false} },
    yAxis:{ type:'value', axisLabel:{fontSize:10,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{lineStyle:{color:themeColor('--ds-card','#F6F7F8')}} },
    dataZoom: labels.length > 8 ? [{ type:'inside', xAxisIndex:0, start: Math.max(0, (labels.length - Math.max(8, Math.min(labels.length, Math.floor((el.clientWidth||320)/44)))) / labels.length * 100), end: 100, zoomOnMouseWheel: false, moveOnMouseMove: true }] : undefined,
    series: (() => {
      // 堆叠柱仅最顶段有圆角，中间段直角以无缝衔接
      const barIndices = series.map((s, i) => ({ s, i })).filter(({ s }) => !(isTokenCost && s.name.includes('总'))).map(({ i }) => i);
      const topIdx = barIndices.length ? barIndices[barIndices.length - 1] : -1;
      return series.map((s, idx)=>{
        const isTotal = s.name.includes('总');
        if (isTokenCost && isTotal) return { name:s.name, type:'line', data:s.data, smooth:true, lineStyle:{color:s.color,width:2}, itemStyle:{color:s.color}, symbolSize:2 };
        const isTop = idx === topIdx;
        return { name:s.name, type:'bar', stack:'total', data:s.data, itemStyle:{color:s.color,borderRadius: isTop ? [4,4,0,0] as any : [0,0,0,0] as any}, barMaxWidth:16, barGap:'-100%' as any };
      });
    })(),
  };
  // 命中/请求等单指标改为线+面积更可读
  if (id==='hit'){ opts.series = [{ name:'命中率', type:'line', data: series[0].data, areaStyle:{opacity:0.12,color:series[0].color}, lineStyle:{color:series[0].color}, itemStyle:{color:series[0].color}, smooth:true }]; opts.yAxis={ max:100, axisLabel:{formatter:(v:number)=>v+'%'} } as any; }
  if (id==='dur'){
    opts.yAxis=[
      {type:'value', name:'耗时 s', position:'left', axisLabel:{fontSize:10,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{lineStyle:{color:themeColor('--ds-card','#F6F7F8')}}},
      {type:'value', name:'速率 t/s', position:'right', axisLabel:{fontSize:10,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{show:false}}
    ] as any;
    opts.series = series.map(s=>({
      name: s.name,
      type:'line',
      yAxisIndex: s.name.includes('速率')||s.name.toLowerCase().includes('rate') ? 1 : 0,
      data: s.data,
      smooth: true,
      symbolSize: 4,
      lineStyle:{ color:s.color, width:2 },
      itemStyle:{ color:s.color },
      areaStyle: s.name.includes('耗时') ? { opacity:0.08, color:s.color } : undefined,
    }));
  }
  c.setOption(opts);
}

export function initExtraCharts(){
  const doc=getDoc();
  // 绑定每图 Y/X
  for (const id of Object.keys(CHART_DEFS) as ChartId[]){
    if (!CHART_DEFS[id].hasX) continue;
    const yBtn=doc.getElementById(`aus-extra-y-${id}`);
    const yDrop=doc.getElementById(`aus-extra-y-drop-${id}`);
    const xBtn=doc.getElementById(`aus-extra-x-${id}`);
    const xDrop=doc.getElementById(`aus-extra-x-drop-${id}`);
    if (yBtn && yDrop){
      yBtn.onclick=()=>{
        yDrop.style.display = yDrop.style.display==='block'?'none':'block';
        if (yDrop.style.display==='block') renderExtraY(id);
      };
    }
    if (xBtn && xDrop){
      xBtn.onclick=()=>{
        xDrop.style.display = xDrop.style.display==='block'?'none':'block';
        if (xDrop.style.display==='block') renderExtraX(id);
      };
    }
  }
  // pie 模式切换
  const pieToggle = doc.getElementById('aus-pie-toggle');
  if (pieToggle){
    pieToggle.onclick = ()=>{
      state.pie.pieMode = state.pie.pieMode==='token'?'count':'token';
      (pieToggle as any).textContent = state.pie.pieMode==='token'?'Token':'次数';
      const s:any = (window as any).ApiUsageStat?.state ? (window as any).ApiUsageStat.state : null;
      // 触发重绘由外层 refresh 调用，此处直接
      const hist = (window as any).ApiUsageStat?.state?.history || [];
      // 轻量：直接重绘
      renderExtraCharts(hist);
    };
  }
  doc.addEventListener('click', (e:any)=>{
    const t=e.target as HTMLElement;
    for (const id of Object.keys(CHART_DEFS) as ChartId[]){
      if (!CHART_DEFS[id].hasX) continue;
      const yDrop=doc.getElementById(`aus-extra-y-drop-${id}`);
      const yBtn=doc.getElementById(`aus-extra-y-${id}`);
      const xDrop=doc.getElementById(`aus-extra-x-drop-${id}`);
      const xBtn=doc.getElementById(`aus-extra-x-${id}`);
      if (yDrop && yBtn && !t.closest(`#aus-extra-y-drop-${id}`) && !t.closest(`#aus-extra-y-${id}`)) yDrop.style.display='none';
      if (xDrop && xBtn && !t.closest(`#aus-extra-x-drop-${id}`) && !t.closest(`#aus-extra-x-${id}`)) xDrop.style.display='none';
    }
  });
}

function renderExtraY(id:ChartId){
  const doc=getDoc();
  const drop=doc.getElementById(`aus-extra-y-drop-${id}`);
  const label=doc.getElementById(`aus-extra-y-label-${id}`);
  if (!drop) return;
  const opts=CHART_DEFS[id].yOpts;
  const sel=state[id].y;
  if (label) label.textContent = sel.size? `${sel.size} 项` : '选择';
  drop.innerHTML = opts.map(o=>{
    const checked = sel.has(o.key);
    return `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:11px;${checked?'background:var(--ds-active-bg);':''}"><input type="checkbox" data-y="${o.key}" data-chart="${id}" ${checked?'checked':''} style="accent-color:var(--ds-text);" /><span style="width:8px;height:8px;background:${o.color};border-radius:2px;"></span>${o.label}</label>`;
  }).join('');
  drop.querySelectorAll('input[data-y]').forEach((el:any)=>{
    el.onchange=()=>{
      const k=el.getAttribute('data-y'), cid=el.getAttribute('data-chart') as ChartId;
      if (el.checked) state[cid].y.add(k); else { if (state[cid].y.size>1) state[cid].y.delete(k); else el.checked=true; }
      renderExtraY(cid);
      const hist = (window as any).ApiUsageStat?.state?.history || [];
      renderExtraCharts(hist);
    };
  });
}

function renderExtraX(id:ChartId){
  const doc=getDoc();
  const drop=doc.getElementById(`aus-extra-x-drop-${id}`);
  const label=doc.getElementById(`aus-extra-x-label-${id}`);
  if (!drop) return;
  const cur = state[id].x;
  if (label) label.textContent = X_OPTIONS.find(o=>o.key===cur)?.label || cur;
  drop.innerHTML = X_OPTIONS.map(o=>{
    const active=o.key===cur;
    return `<div data-x="${o.key}" data-chart="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active?'background:var(--ds-active-bg);font-weight:600;':''}">${o.label}</div>`;
  }).join('');
  drop.querySelectorAll('[data-x]').forEach((el:any)=>{
    el.onclick=()=>{
      const k=el.getAttribute('data-x') as XKey, cid=el.getAttribute('data-chart') as ChartId;
      state[cid].x = k;
      drop.style.display='none';
      renderExtraX(cid);
      const hist = (window as any).ApiUsageStat?.state?.history || [];
      renderExtraCharts(hist);
    };
  });
}
