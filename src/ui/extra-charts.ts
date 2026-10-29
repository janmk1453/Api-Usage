import { localDay } from '../utils/date';
import { bucketTip, roundTip, rangeTip } from './chart-time';
import { CHART_TOOLTIP_SURFACE } from './chart-tooltip';
import { BAR_SQUARE, barTopRadius, estimateBarWidth } from './chart-bar';
import { Y_OPTIONS, X_OPTIONS, X_OPTIONS_WITHOUT_ROUND, getYSelected as getMainY, getXSelected as getMainX, tokenStackDrawOrder, sortTooltipParams } from './chart-config';
import { formatMoney, getDisplayCurrency } from '../services/currency';
import { attachChartZoom, detachChartZoom, getChartRange } from './range-zoom';
import { readChartPrefs, writeChartPrefs } from './chart-prefs';

type ChartId = 'token'|'cost'|'hit'|'req'|'dur'|'pie';
type XKey = 'round'|'hour'|'day'|'week'|'month';

type ChartDef = { title:string; yOpts: Array<{ key:any; label:string; unit:string; kind:any; color:string }>; hasX:boolean };
const CHART_DEFS: Record<ChartId, ChartDef> = {
  token: { title:'Token 趋势', yOpts: Y_OPTIONS.filter(o=>o.kind==='token'), hasX:true },
  cost: { title:'费用 趋势', yOpts: Y_OPTIONS.filter(o=>o.kind==='cost'), hasX:true },
  hit: { title:'缓存命中 趋势', yOpts: [{key:'hit_rate' as any,label:'命中率',unit:'%',kind:'cost' as any,color:'#0BA25E'}], hasX:true },
  req: { title:'API请求数 趋势', yOpts: [{key:'req_count' as any,label:'请求数',unit:'次',kind:'token' as any,color:'#6366F1'}], hasX:true },
  dur: { title:'耗时与速率 趋势', yOpts: [{key:'duration' as any,label:'耗时',unit:'s',kind:'token' as any,color:'#2563EB'},{key:'rate' as any,label:'速率',unit:'t/s',kind:'cost' as any,color:'#10B981'}], hasX:true },
  pie: { title:'模型用量占比', yOpts: [], hasX:false },
};

const state: Record<ChartId, {y:Set<string>,x:XKey,pieMode:'token'|'count'}> = {
  token: { y: new Set(['input_hit_token','input_miss_token','output_token']), x:'round', pieMode:'token' },
  cost: { y: new Set(['total_cost']), x:'round', pieMode:'token' },
  hit: { y: new Set(['hit_rate']), x:'round', pieMode:'token' },
  req: { y: new Set(['req_count']), x:'day', pieMode:'token' },
  dur: { y: new Set(['duration','rate']), x:'round', pieMode:'token' },
  pie: { y: new Set([]), x:'day', pieMode:'token' },
};

/** 从 localStorage 恢复各图上次的 Y/X 与占比模式（刷新后保持不变）；非法键逐项丢弃回退默认 */
function restoreExtraPrefs(): void {
  const { extra, pie } = readChartPrefs();
  for (const id of Object.keys(state) as ChartId[]) {
    const saved = extra[id];
    if (!saved) continue;
    if (Array.isArray(saved.y)) {
      const allowed = CHART_DEFS[id].yOpts.map(o => o.key);
      const y = (saved.y as unknown[]).filter((k): k is string => typeof k === 'string' && allowed.includes(k));
      if (y.length) state[id].y = new Set(y);
    }
    const options = id === 'req' ? X_OPTIONS_WITHOUT_ROUND : X_OPTIONS;
    if (typeof saved.x === 'string' && options.some(o => o.key === saved.x)) state[id].x = saved.x as XKey;
  }
  if (pie.mode === 'count' || pie.mode === 'token') state.pie.pieMode = pie.mode;
}
restoreExtraPrefs();

/** 改动即落盘：按图表 id 分片写入，不会覆盖其他图已保存的配置 */
function persistExtraPrefs(id: ChartId): void {
  if (id === 'pie') { writeChartPrefs({ pie: { mode: state.pie.pieMode } }); return; }
  writeChartPrefs({ extra: { [id]: { y: Array.from(state[id].y), x: state[id].x } } });
}

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
  if (x==='hour') { const d=new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:00`; }
  if (x==='day') return localDay(ts);
  if (x==='week') { const d=new Date(ts); const tmp=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dayNum=tmp.getUTCDay()||7; tmp.setUTCDate(tmp.getUTCDate()+4-dayNum); const yearStart=new Date(Date.UTC(tmp.getUTCFullYear(),0,1)); const weekNo=Math.ceil((((tmp as any)-(yearStart as any))/86400000+1)/7); return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`; }
  if (x==='month') { const d=new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
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
  const { GridComponent, TooltipComponent, LegendComponent, DataZoomInsideComponent } = await import('echarts/components');
  const { CanvasRenderer } = await import('echarts/renderers');
  ec.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, DataZoomInsideComponent, CanvasRenderer]);
  return ec;
}

const charts: Record<string, any> = {};

/**
 * 主题重绘：ECharts 实例在跨主题切换时复用，option 中的颜色是绘制时取值的，
 * 不会随 CSS 变量自动更新，因此「跟随系统」实时切换后需要主动重绘。
 * 仅释放本模块内部持有的实例，实例容器留在 DOM 中，各视图自身的 render 会重新 init 并取新配色。
 */
export function resetChartThemeCache(): void {
  for (const id of Object.keys(charts) as ChartId[]) {
    try { charts[id]?.dispose?.(); } catch {}
    charts[id] = null as any;
  }
}
let lastFiltered: any[] = [];

/** 容器被文案覆盖时同步销毁实例，否则下次有数据会往已脱离 DOM 的 canvas 上 setOption（表现为图表空白） */
function dropChart(id: ChartId){
  const c = (charts as any)[id];
  if (!c) return;
  try { detachChartZoom(c); } catch {}
  try { c.dispose(); } catch {}
  (charts as any)[id] = null;
}

export function renderExtraCharts(filtered:any[]){
  lastFiltered = filtered || [];
  for (const id of Object.keys(CHART_DEFS) as ChartId[]){
    renderOne(id, filtered);
  }
}

async function renderOne(id:ChartId, filtered:any[]){
  try {
  const doc=getDoc();
  const el=doc.getElementById(`aus-chart-${id}`) as HTMLElement | null;
  if (!el) return;
  if (id==='req' && state[id].x==='round') state[id].x='day';
  // pie special
  if (id==='pie'){
    const mode = state.pie.pieMode;
    if (!filtered.length){ dropChart(id); el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ds-text-3);">暂无数据</div>'; return; }
    const map: Record<string, number> = {};
    for (const e of filtered){ const m=e.model||'unknown'; const v = mode==='token' ? (e.total_tokens||0) : 1; map[m]=(map[m]||0)+v; }
    const data = Object.entries(map).map(([name,value])=>({name, value}));
    const ec = await getEcharts();
    let c = charts[id];
    if (!c || (c as any).isDisposed?.()) {
      el.innerHTML=''; (el as any).style.height='260px';
      // 兜底尺寸：容器尚不可见时 clientWidth 为 0，ECharts 会画出 0 宽空白（表现为「图表无法加载」）
    c = charts[id]=ec.init(el, undefined, { width: el.clientWidth || 320, height: el.clientHeight || 260 });
    }
    c.setOption({
      backgroundColor:'transparent',
      tooltip:{ trigger:'item', ...CHART_TOOLTIP_SURFACE, backgroundColor:themeColor('--ds-card-inner','#FFFFFF'), borderColor:themeColor('--ds-border','#E5E7EB'), textStyle:{fontSize: 12, color:themeColor('--ds-text','#111827')},
        formatter: (p:any)=>{
          const range = rangeTip(filtered);
          const val = mode==='token' ? Number(p.value).toLocaleString() + ' tokens' : Number(p.value).toLocaleString() + ' 次请求';
          const pct = Number(p.percent || 0).toFixed(1);
          let html = `<div style="display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:4px;">${p.marker||''}${p.name}</div>`;
          html += `<div style="display:flex;gap:16px;"><span>用量</span><span style="margin-left:auto;font-weight:600;">${val}</span></div>`;
          html += `<div style="display:flex;gap:16px;"><span>占比</span><span style="margin-left:auto;font-weight:600;">${pct} %</span></div>`;
          if (range) html += `<div style="margin-top:4px;font-size:11px;color:#9CA3AF;">时间范围 ${range}</div>`;
          return `<div style="padding:2px 2px;min-width:170px;">${html}</div>`;
        }
      },
      legend:{ bottom:0, textStyle:{fontSize: 12,color:themeColor('--ds-text-2','#6B7280')} },
      series:[{ type:'pie', radius:['40%','70%'], itemStyle:{borderRadius:6,borderColor:themeColor('--ds-card-inner','#FFFFFF'),borderWidth:2}, label:{fontSize: 12}, data }],
    }, true);
    setTimeout(()=>{ try{ c.resize(); }catch{} }, 60);
    return;
  }
  const yKeys = Array.from(state[id].y);
  const xKey = state[id].x;
  if (!yKeys.length){ dropChart(id); el.innerHTML='<div style="text-align:center;padding:30px;color:var(--ds-text-3);font-size:var(--aus-fs-sm);">请选择 Y 轴</div>'; return; }
  // 聚合
  if (xKey==='round'){
    const labels = filtered.map((_,i)=>`#${i+1}`);
    // X 轴保持 #N 紧凑，悬浮窗补完整日期时间
    const tips = filtered.map((e,i)=> roundTip(i+1, e?.timestamp));
    const yMeta = new Map(CHART_DEFS[id].yOpts.map(o=>[o.key,o] as any));
    // hit/req/duration 需特殊：hit_rate 按单点直接值
    const series = yKeys.map(k=>{
      const meta:any = yMeta.get(k) || Y_OPTIONS.find(o=>o.key===k) || {label:k,color:'var(--ds-text-2)'};
      const data = filtered.map(e=> {
        const v=getYValue(e,k);
        return Number(v.toFixed(k.includes('cost')||k==='hit_rate'?2:0));
      });
      return { key: k, name: meta.label, data, color: meta.color, kind: meta.kind || 'token' };
    });
    await drawBarLine(el, id, labels, series, tips);
    return;
  }
  // 分桶（同时记录桶内首末时间戳，供悬浮窗显示完整日期时间）
  type Bucket = { list:any[]; first:number; last:number };
  const buckets = new Map<string, Bucket>();
  filtered.forEach(e=>{
    const key = bucketKey(e.timestamp, xKey, 0);
    const ts = Number(e?.timestamp) || 0;
    const bucket = buckets.get(key);
    if (!bucket) buckets.set(key, { list:[e], first:ts, last:ts });
    else {
      bucket.list.push(e);
      if (ts && (!bucket.first || ts < bucket.first)) bucket.first = ts;
      if (ts > bucket.last) bucket.last = ts;
    }
  });
  const sortedKeys = Array.from(buckets.keys()).sort();
  const labels = sortedKeys.map(k=> xKey==='day'?k.slice(5).replace('-','/'):xKey==='hour'?k.slice(5):k);
  const tips = sortedKeys.map(k=>{
    const bucket = buckets.get(k)!;
    return bucketTip(xKey, bucket.first, bucket.last) || k;
  });
  const yOptsMap = new Map(CHART_DEFS[id].yOpts.map(o=>[o.key,o] as any));
  // 补充 Y_OPTIONS 中未在 CHART_DEFS 的 hit_rate 等
  const fullMap = new Map([...Y_OPTIONS, ...CHART_DEFS[id].yOpts].map(o=>[o.key,o] as any));
  const series = yKeys.map(k=>{
    const meta:any = fullMap.get(k) || {label:k,color:'var(--ds-text-2)',kind:'token'};
    let data: number[];
    if (k==='hit_rate'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!.list;
        let hit=0, tot=0; for(const e of arr){ hit+=e.cache_hit_tokens||0; tot+= (e.cache_hit_tokens||0)+(e.cache_miss_tokens||0); }
        return tot? Number((hit/tot*100).toFixed(1)):0;
      });
    } else if (k==='duration'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!.list;
        const avg = arr.reduce((a:any,c:any)=>a+(c.duration||0),0)/arr.length/1000;
        return Number(avg.toFixed(1));
      });
    } else if (k==='rate'){
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!.list;
        // 只统计有效速率样本：非流式/未测速的 0 不参与分母，避免拉低均值
        const valid = arr.map((c:any)=>c.tokenRate||0).filter((v:number)=>v>0);
        if (!valid.length) return 0;
        const avg = valid.reduce((a:number,c:number)=>a+c,0)/valid.length;
        return Math.round(avg);
      });
    } else if (k==='req_count'){
      data = sortedKeys.map(key=> buckets.get(key)!.list.length);
    } else {
      data = sortedKeys.map(key=>{
        const arr=buckets.get(key)!.list;
        let sum=0; for(const e of arr) sum+=getYValue(e,k);
        return Number(sum.toFixed(k.includes('cost')?2:0));
      });
    }
    return { key: k, name: meta.label, data, color: meta.color, kind: meta.kind || 'token' };
  });
  await drawBarLine(el, id, labels, series, tips);
  } catch(e:any){
    dropChart(id);
    try{ const doc2=getDoc(); const el2=doc2.getElementById(`aus-chart-${id}`) as HTMLElement | null; if(el2) el2.innerHTML='<div style="text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-sm);">图表加载失败: '+(e?.message||e)+'</div>'; }catch{}
    try{ console.error('[Api-Usage] renderOne failed', id, e); }catch{}
  }
}

function calcXInterval(labels: string[], el: HTMLElement): number {
  const w = el.clientWidth || 320;
  const minPerLabel = w < 500 ? 42 : w < 760 ? 56 : 68; // 窄屏更密，宽屏更疏
  const maxLabels = Math.max(8, Math.floor(w / minPerLabel));
  if (labels.length <= maxLabels) return 0;
  return Math.ceil(labels.length / maxLabels) - 1;
}

/** 按系列名判断数值单位，悬浮窗据此显示单位（费用按当前显示币种） */
function seriesUnit(name:string):'cost'|'percent'|'rate'|'duration'|'count'|'token'{
  const n = String(name||'');
  if (n.includes('费用') || n.includes('成本')) return 'cost';
  if (n.includes('率') || n.includes('占比')) return 'percent';
  if (n.includes('速率')) return 'rate';
  if (n.includes('耗时') || n.includes('延迟')) return 'duration';
  if (n.includes('请求')) return 'count';
  return 'token';
}

async function drawBarLine(el:HTMLElement, id:ChartId, labels:string[], series:Array<{key?:string,name:string,data:number[],color:string,kind:string}>, tips:string[] = []){
  try {
  const curCur = (()=>{ try{  return getDisplayCurrency(); } catch{ return {code:'CNY',symbol:'¥',rate:1} as any; } })();
  // 费用类数据在 USD 模式下需换算为显示币种
  if (curCur.code==='USD') {
    for (const s of series) if (s.kind==='cost' || s.name.includes('费用') || s.name.toLowerCase().includes('cost')) s.data = s.data.map((v:any)=> Number((Number(v)/curCur.rate).toFixed(4)));
  }
  const ec = await getEcharts();
  let c = charts[id];
  if (!c || (c as any).isDisposed?.()) {
    el.innerHTML=''; (el as any).style.height='290px';
    c = charts[id]=ec.init(el, undefined, { width: el.clientWidth || 320, height: el.clientHeight || 290 });
  }
  // 前两张：重叠柱 + 曲线（Token/费用）
  const isTokenCost = id==='token' || id==='cost';
  const savedZoom = getChartRange('extra-' + id);
  const interval = calcXInterval(labels, el);
  const opts:any = {
    backgroundColor:'transparent',
    tooltip:{ trigger:'axis', ...CHART_TOOLTIP_SURFACE, backgroundColor:themeColor('--ds-card-inner','#FFFFFF'), borderColor:themeColor('--ds-border','#E5E7EB'), textStyle:{fontSize: 12},
      formatter: (params:any)=>{
        const list = Array.isArray(params) ? params : [params];
        if (!list.length) return '';
        const idx = list[0].dataIndex;
        const title = tips[idx] || list[0].axisValueLabel || '';
        let html = `<div style="font-weight:600;margin-bottom:6px;">${title}</div>`;
        // 悬浮窗条目按 Y 选项顺序（命中 → 未命中 → 输出）展示
        for (const p of sortTooltipParams(list)){
          const unit = seriesUnit(p.seriesName);
          const v = Number(p.value);
          let disp:string;
          if (unit==='percent') disp = v.toFixed(1) + ' %';
          else if (unit==='rate') disp = Math.round(v).toLocaleString() + ' t/s';
          else if (unit==='duration') disp = v.toFixed(2) + ' s';
          else if (unit==='count') disp = v.toLocaleString() + ' 次';
          else disp = v.toLocaleString() + ' tokens';
          html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${disp}</span></div>`;
        }
        return `<div style="padding:4px 2px;min-width:170px;">${html}</div>`;
      }
    },
    // 旋转标签 + 底部视窗滑块都需要额外空间，否则标签被裁（表现为「X 轴名称丢失」）
    grid:{ left:40, right:20, top:8, bottom: labels.length>12 ? 62 : 46 },
    xAxis:{ type:'category', data: labels, axisLine:{lineStyle:{color:themeColor('--ds-border','#E5E7EB')}}, axisLabel:{fontSize: 12,color:themeColor('--ds-text-3','#9CA3AF'),rotate: labels.length>12?30:0, interval: 'auto', hideOverlap: false} },
    yAxis:{ type:'value', axisLabel:{fontSize: 12,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{lineStyle:{color:themeColor('--ds-card','#F5F6F7')}} },
    // 默认完整展示全部 X 轴数据（与第一张图一致），缩放交给 inside 手势/拖拽
    dataZoom: labels.length > 1 ? [{ type:'inside', xAxisIndex:0, start: savedZoom?.start ?? 0, end: savedZoom?.end ?? 100, zoomOnMouseWheel: false, moveOnMouseMove: true, zoomLock: true }] : undefined,
    series: (() => {
      // 堆叠次序：输出最深压底、命中最浅置顶（与主图表一致）
      const drawSeries = tokenStackDrawOrder(series);
      // 堆叠柱仅最顶段有圆角，中间段直角以无缝衔接
      const barIndices = drawSeries.map((s, i) => ({ s, i })).filter(({ s }) => !(isTokenCost && s.name.includes('总'))).map(({ i }) => i);
      const topIdx = barIndices.length ? barIndices[barIndices.length - 1] : -1;
      // 柱宽估算 → 顶部圆角（半径 ≈ 柱宽 1/6，见 chart-bar.ts）
      const BAR_MAX_WIDTH = 16;
      const barWidth = estimateBarWidth((el as HTMLElement)?.clientWidth || 320, 60, labels.length, BAR_MAX_WIDTH);
      const topRadius = barTopRadius(barWidth);
      return drawSeries.map((s, idx)=>{
        const isTotal = s.name.includes('总');
        if (isTokenCost && isTotal) return { name:s.name, type:'line', data:s.data, smooth:true, lineStyle:{color:s.color,width:2}, itemStyle:{color:s.color}, symbolSize:2 };
        const isTop = idx === topIdx;
        return { name:s.name, type:'bar', stack:'total', data:s.data, itemStyle:{color:s.color,borderRadius: (isTop ? topRadius : BAR_SQUARE) as any}, barMaxWidth:BAR_MAX_WIDTH, barGap:'-100%' as any };
      });
    })(),
  };
  if (id==='cost') {
    opts.yAxis = { type:'value', axisLabel:{fontSize: 12,color:themeColor('--ds-text-3','#9CA3AF'), formatter:(v:number)=> curCur.symbol + Number(v).toFixed(2)}, splitLine:{lineStyle:{color:themeColor('--ds-card','#F5F6F7')}} } as any;
    opts.tooltip = { trigger:'axis', ...CHART_TOOLTIP_SURFACE, backgroundColor:themeColor('--ds-card-inner','#FFFFFF'), borderColor:themeColor('--ds-border','#E5E7EB'), textStyle:{fontSize: 12}, formatter: (params:any)=>{ const idx = params[0]?.dataIndex ?? 0; const title = tips[idx] || params[0]?.axisValueLabel || ''; let html=`<div style="font-weight:600;margin-bottom:6px;">${title}</div>`; for(const p of sortTooltipParams(Array.isArray(params)?params:[params])){ html+=`<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;font-weight:600;">${curCur.symbol}${Number(p.value).toFixed(4)} ${curCur.code}</span></div>`; } return `<div style="padding:4px 2px;min-width:160px;">${html}</div>`; } } as any;
  }
  // 命中/请求等单指标改为线+面积更可读
  if (id==='hit'){ opts.series = [{ name:'命中率', type:'line', data: series[0].data, areaStyle:{opacity:0.12,color:series[0].color}, lineStyle:{color:series[0].color}, itemStyle:{color:series[0].color}, smooth:true }]; opts.yAxis={ max:100, axisLabel:{formatter:(v:number)=>v+'%'} } as any; }
  if (id==='dur'){
    opts.yAxis=[
      {type:'value', name:'耗时 s', position:'left', axisLabel:{fontSize: 12,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{lineStyle:{color:themeColor('--ds-card','#F5F6F7')}}},
      {type:'value', name:'速率 t/s', position:'right', axisLabel:{fontSize: 12,color:themeColor('--ds-text-3','#9CA3AF')}, splitLine:{show:false}}
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
  c.setOption(opts, true);
  attachChartZoom({ doc: getDoc(), chart: c, container: el, left: 40, right: 20, bottom: 2, enabled: labels.length > 1, rangeKey: 'extra-' + id });
  setTimeout(()=>{ try{ c.resize(); }catch{} }, 60);
  } catch(e:any){
    dropChart(id);
    try{ el.innerHTML='<div style="text-align:center;padding:20px;color:#DC2626;font-size:var(--aus-fs-sm);">图表渲染失败</div>'; }catch{}
    try{ console.error('[Api-Usage] drawBarLine failed', id, e); }catch{}
  }
}

export function initExtraCharts(){
  const doc=getDoc();
  // 先把恢复出来的配置画到胶囊上（不依赖用户点开下拉，刷新后文案即为上次选择）
  for (const id of Object.keys(CHART_DEFS) as ChartId[]){
    if (!CHART_DEFS[id].hasX) continue;
    renderExtraY(id);
    renderExtraX(id);
  }
  // 绑定每图 Y/X
  for (const id of Object.keys(CHART_DEFS) as ChartId[]){
    if (!CHART_DEFS[id].hasX) continue;
    const yBtn=doc.getElementById(`aus-extra-y-${id}`);
    const yDrop=doc.getElementById(`aus-extra-y-drop-${id}`);
    const xBtn=doc.getElementById(`aus-extra-x-${id}`);
    const xDrop=doc.getElementById(`aus-extra-x-drop-${id}`);
    if (yBtn && yDrop){
      yBtn.onclick=()=>{
        const willOpen = yDrop.style.display!=='block';
        yDrop.style.display = willOpen?'block':'none';
        if (willOpen){ if (xDrop) xDrop.style.display='none'; renderExtraY(id); }
      };
    }
    if (xBtn && xDrop){
      xBtn.onclick=()=>{
        const willOpen = xDrop.style.display!=='block';
        xDrop.style.display = willOpen?'block':'none';
        if (willOpen){ if (yDrop) yDrop.style.display='none'; renderExtraX(id); }
      };
    }
  }
  // pie 模式切换：复用已过滤的 lastFiltered，避免丢失时间/模型筛选
  const pieToggle = doc.getElementById('aus-pie-toggle');
  if (pieToggle){
    (pieToggle as any).textContent = state.pie.pieMode==='token' ? 'Token' : '次数';
    pieToggle.onclick = ()=>{
      state.pie.pieMode = state.pie.pieMode==='token'?'count':'token';
      (pieToggle as any).textContent = state.pie.pieMode==='token'?'Token':'次数';
      persistExtraPrefs('pie');
      renderOne('pie', lastFiltered);
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
    return `<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:var(--aus-fs-sm);${checked?'background:var(--ds-active-bg);':''}"><input type="checkbox" data-y="${o.key}" data-chart="${id}" ${checked?'checked':''} class="aus-checkbox" /><span style="width:8px;height:8px;background:${o.color};border-radius:2px;"></span>${o.label}</label>`;
  }).join('');
  drop.querySelectorAll('input[data-y]').forEach((el:any)=>{
    el.onchange=()=>{
      const k=el.getAttribute('data-y'), cid=el.getAttribute('data-chart') as ChartId;
      if (el.checked) state[cid].y.add(k); else { if (state[cid].y.size>1) state[cid].y.delete(k); else el.checked=true; }
      persistExtraPrefs(cid);
      renderExtraY(cid);
      renderOne(cid, lastFiltered);
    };
  });
}

function renderExtraX(id:ChartId){
  const doc=getDoc();
  const drop=doc.getElementById(`aus-extra-x-drop-${id}`);
  const label=doc.getElementById(`aus-extra-x-label-${id}`);
  if (!drop) return;
  const options = id==='req' ? X_OPTIONS_WITHOUT_ROUND : X_OPTIONS;
  const cur = state[id].x;
  if (label) label.textContent = options.find(o=>o.key===cur)?.label || cur;
  drop.innerHTML = options.map(o=>{
    const active=o.key===cur;
    return `<div data-x="${o.key}" data-chart="${id}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:var(--aus-fs-base);${active?'background:var(--ds-active-bg);font-weight:600;':''}">${o.label}</div>`;
  }).join('');
  drop.querySelectorAll('[data-x]').forEach((el:any)=>{
    el.onclick=()=>{
      const k=el.getAttribute('data-x') as XKey, cid=el.getAttribute('data-chart') as ChartId;
      state[cid].x = k;
      persistExtraPrefs(cid);
      drop.style.display='none';
      renderExtraX(cid);
      renderOne(cid, lastFiltered);
    };
  });
}
