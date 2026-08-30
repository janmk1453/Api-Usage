import { getSelectedSave } from '../store/index';
import { localDay } from '../utils/date';

type RangeKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';
let currentRange: RangeKey = '30d';
let customStart = '';
let customEnd = '';
let pickerOpen = false;
let selectedModel: string = '__all__';
let modelPickerOpen = false;

function getDoc() { return (window.parent as any)?.document ?? document; }

function getRangeDates(): { start: string; end: string } {
  const today = localDay(Date.now());
  const d = new Date(today + 'T00:00:00Z');
  const fmt = (x: Date) => x.toISOString().slice(0,10);
  switch (currentRange) {
    case 'today': return { start: today, end: today };
    case 'yesterday': { const y = new Date(d); y.setUTCDate(y.getUTCDate()-1); const s=fmt(y); return { start:s,end:s }; }
    case '7d': { const s=new Date(d); s.setUTCDate(s.getUTCDate()-6); return { start:fmt(s), end:today }; }
    case '30d': { const s=new Date(d); s.setUTCDate(s.getUTCDate()-29); return { start:fmt(s), end:today }; }
    case 'month': { const s=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),1)); return { start:fmt(s), end:today }; }
    case 'lastMonth': { const s=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()-1,1)); const e=new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(),0)); return { start:fmt(s), end:fmt(e) }; }
    case 'custom': return { start: customStart || today, end: customEnd || today };
  }
  return { start: today, end: today };
}

function filterByRange(entries: any[]): any[] {
  const { start, end } = getRangeDates();
  return entries.filter(e => {
    const k = localDay(e.timestamp);
    return k >= start && k <= end;
  });
}

function getRecordedModels(): string[] {
  const s: any = getSelectedSave();
  const set = new Set<string>();
  for (const h of s?.history || []) if (h?.model) set.add(h.model);
  return Array.from(set).sort();
}

function filterByModel(entries: any[]): any[] {
  if (selectedModel === '__all__') return entries;
  return entries.filter(e => e.model === selectedModel);
}

function renderCalendar() {
  const doc = getDoc();
  const cal = doc.getElementById('aus-date-calendar');
  if (!cal) return;
  // 显示两个月（上月+本月）
  const todayStr = localDay(Date.now());
  const today = new Date(todayStr + 'T00:00:00Z');
  const months: Date[] = [];
  // 显示前一个月的1号和本月1号
  months.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth()-1, 1)));
  months.push(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  let html = '<div style="display:flex;gap:16px;">';
  for (const m of months) {
    const y = m.getUTCFullYear(), mo = m.getUTCMonth();
    const first = new Date(Date.UTC(y, mo, 1));
    const daysInMonth = new Date(Date.UTC(y, mo+1, 0)).getUTCDate();
    const startDow = first.getUTCDay(); // 0 Sun
    // 调整为 周日 开始
    html += `<div style="min-width:220px;"><div style="text-align:center;font-weight:600;font-size:13px;margin-bottom:8px;">${y}年${mo+1}月</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:11px;">`;
    const week = ['日','一','二','三','四','五','六'];
    for (const w of week) html += `<div style="text-align:center;color:#9CA3AF;padding:4px;">${w}</div>`;
    for (let i=0;i<startDow;i++) html += `<div></div>`;
    for (let d=1; d<=daysInMonth; d++) {
      const date = new Date(Date.UTC(y, mo, d));
      const key = date.toISOString().slice(0,10);
      const { start, end } = getRangeDates();
      const inRange = key >= start && key <= end;
      const isToday = key === todayStr;
      const bg = inRange ? '#111827' : '#fff';
      const color = inRange ? '#fff' : '#111827';
      const ring = isToday && !inRange ? 'border:1px solid #111827;' : '';
      html += `<div data-date="${key}" style="text-align:center;padding:6px;border-radius:999px;background:${bg};color:${color};cursor:pointer;${ring}">${d}</div>`;
    }
    html += `</div></div>`;
  }
  html += '</div>';
  cal.innerHTML = html;
  cal.querySelectorAll('[data-date]').forEach((el: any) => {
    el.addEventListener('click', () => {
      if (currentRange !== 'custom') {
        currentRange = 'custom';
        customStart = el.getAttribute('data-date');
        customEnd = el.getAttribute('data-date');
      } else {
        // 第二次点击设为结束
        const clicked = el.getAttribute('data-date');
        if (!customStart) customStart = clicked;
        else if (clicked < customStart) { customEnd = customStart; customStart = clicked; }
        else customEnd = clicked;
      }
      updatePickerLabel();
      renderStatsView();
      renderCalendar();
    });
  });
}

function updatePickerLabel() {
  const doc = getDoc();
  const label = doc.getElementById('aus-range-label');
  if (!label) return;
  const map: any = { today:'今天', yesterday:'昨天', '7d':'近 7 天', '30d':'近 30 天', month:'本月', lastMonth:'上月', custom:'自定义' };
  if (currentRange === 'custom' && customStart && customEnd) {
    label.textContent = customStart === customEnd ? customStart : `${customStart} ~ ${customEnd}`;
  } else label.textContent = map[currentRange] || '近 30 天';
}

function renderModelPicker() {
  const doc = getDoc();
  const dropdown = doc.getElementById('aus-model-dropdown');
  const label = doc.getElementById('aus-model-label');
  if (!dropdown || !label) return;
  const models = getRecordedModels();
  label.textContent = selectedModel === '__all__' ? '全部' : selectedModel;
  let html = `<div data-model="__all__" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${selectedModel==='__all__'?'background:#F6F7F8;font-weight:600;':''}">全部</div>`;
  for (const m of models) {
    const active = m === selectedModel ? 'background:#F6F7F8;font-weight:600;' : '';
    html += `<div data-model="${m}" style="padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12px;${active}">${m}</div>`;
  }
  if (!models.length) html += '<div style="padding:8px 10px;color:#9CA3AF;font-size:12px;">暂无模型</div>';
  dropdown.innerHTML = html;
  dropdown.querySelectorAll('[data-model]').forEach((el: any) => {
    el.onclick = () => {
      selectedModel = el.getAttribute('data-model') || '__all__';
      modelPickerOpen = false;
      dropdown.style.display = 'none';
      renderModelPicker();
      renderStatsView();
    };
  });
}

function bindPicker() {
  const doc = getDoc();
  const btn = doc.getElementById('aus-range-btn');
  const dropdown = doc.getElementById('aus-range-dropdown');
  if (btn && dropdown) {
    btn.onclick = () => {
      pickerOpen = !pickerOpen;
      dropdown.style.display = pickerOpen ? 'flex' : 'none';
      // 关闭模型下拉
      const md = doc.getElementById('aus-model-dropdown');
      if (md) { md.style.display = 'none'; modelPickerOpen = false; }
      if (pickerOpen) renderCalendar();
    };
    doc.querySelectorAll('[data-range]').forEach((el: any) => {
      el.onclick = () => {
        const r = el.getAttribute('data-range') as RangeKey;
        currentRange = r;
        if (r !== 'custom') { customStart=''; customEnd=''; }
        pickerOpen = false;
        dropdown.style.display = 'none';
        updatePickerLabel();
        renderStatsView();
      };
    });
  }
  const mBtn = doc.getElementById('aus-model-btn');
  const mDropdown = doc.getElementById('aus-model-dropdown');
  if (mBtn && mDropdown) {
    mBtn.onclick = () => {
      modelPickerOpen = !modelPickerOpen;
      mDropdown.style.display = modelPickerOpen ? 'block' : 'none';
      const rDrop = doc.getElementById('aus-range-dropdown');
      if (rDrop) { rDrop.style.display = 'none'; pickerOpen = false; }
      if (modelPickerOpen) renderModelPicker();
    };
  }
  // 关闭
  doc.addEventListener('click', (e: any) => {
    const t = e.target as HTMLElement;
    if (pickerOpen && !t.closest('#aus-range-dropdown') && !t.closest('#aus-range-btn')) {
      pickerOpen = false;
      const d = doc.getElementById('aus-range-dropdown');
      if (d) d.style.display = 'none';
    }
    if (modelPickerOpen && !t.closest('#aus-model-dropdown') && !t.closest('#aus-model-btn')) {
      modelPickerOpen = false;
      const d = doc.getElementById('aus-model-dropdown');
      if (d) d.style.display = 'none';
    }
  });
}

// 堆叠柱状图（多模型）
let stackedChart: any = null;
async function renderStackedChart(filtered: any[]) {
  const doc = getDoc();
  const el = doc.getElementById('aus-stats-chart');
  if (!el) return;
  if (!filtered.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:#9CA3AF;font-size:12px;">该时间段无数据</div>'; return; }
  el.innerHTML = '';
  // 按日聚合，模型分色
  const dayMap: Record<string, Record<string, number>> = {};
  const models = new Set<string>();
  for (const e of filtered) {
    const k = localDay(e.timestamp);
    if (!dayMap[k]) dayMap[k] = {};
    const m = e.model || 'unknown';
    models.add(m);
    dayMap[k][m] = (dayMap[k][m] || 0) + (e.cost || 0);
  }
  const days = Object.keys(dayMap).sort();
  const modelList = Array.from(models);
  const colors = ['#FF6A00','#FF9A00','#FFB800','#0BA25E','#6366F1','#06B6D4','#8B5CF6','#EC4899'];
  const echarts: any = await import('echarts/core').then(async (ec: any) => {
    const { BarChart } = await import('echarts/charts');
    const { GridComponent, TooltipComponent, LegendComponent } = await import('echarts/components');
    const { CanvasRenderer } = await import('echarts/renderers');
    ec.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
    return ec;
  });
  if (!stackedChart) stackedChart = echarts.init(el);
  const series = modelList.map((m, i) => ({
    name: m,
    type: 'bar',
    stack: 'total',
    data: days.map(k => Number((dayMap[k][m] || 0).toFixed(4))),
    itemStyle: { color: colors[i % colors.length], borderRadius: [4,4,0,0] },
    barWidth: 12,
  }));
  stackedChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#111827', fontSize: 11 },
      formatter: (params: any) => {
        if (!params?.length) return '';
        const day = params[0].axisValue;
        const total = params.reduce((a: number, p: any) => a + (p.value || 0), 0);
        let html = `<div style="font-weight:600;margin-bottom:6px;">${day} <span style="float:right;">¥${total.toFixed(2)}</span></div>`;
        for (const p of params) {
          if (!p.value) continue;
          html += `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:10px;height:10px;background:${p.color};border-radius:2px;"></span>${p.seriesName}<span style="margin-left:auto;">¥${p.value.toFixed(2)}</span></div>`;
        }
        return `<div style="padding:4px 2px;">${html}</div>`;
      }
    },
    legend: { show: false },
    grid: { left: 40, right: 12, top: 8, bottom: 24 },
    xAxis: { type: 'category', data: days.map(k => k.slice(5).replace('-','/')), axisLine: { lineStyle: { color: '#E5E7EB' } }, axisLabel: { color: '#9CA3AF', fontSize: 11 } },
    yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#E5E7EB' } }, axisLabel: { color: '#9CA3AF', fontSize: 11 } },
    series,
  });
}

function renderModelSummary(filtered: any[]) {
  const doc = getDoc();
  const tbody = doc.getElementById('aus-summary-tbody');
  if (!tbody) return;
  if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:16px;color:#9CA3AF;">暂无数据</td></tr>'; return; }
  const map: Record<string, { count: number; hit: number; miss: number; out: number; total: number; cost: number; dur: number; rate: number; rateCnt: number }> = {};
  for (const h of filtered) {
    const m = h.model || 'unknown';
    if (!map[m]) map[m] = { count: 0, hit: 0, miss: 0, out: 0, total: 0, cost: 0, dur: 0, rate: 0, rateCnt: 0 };
    const e = map[m]; e.count++; e.hit += h.cache_hit_tokens || 0; e.miss += h.cache_miss_tokens || 0; e.out += h.completion_tokens || 0; e.total += h.total_tokens || 0; e.cost += h.cost || 0;
    if (h.duration) { e.dur += h.duration; }
    if (h.tokenRate) { e.rate += h.tokenRate; e.rateCnt++; }
  }
  const rows = Object.keys(map).sort().map(m => {
    const e = map[m];
    const avgCost = e.count ? e.cost / e.count : 0;
    const avgDur = e.count ? (e.dur / e.count / 1000).toFixed(1) + 's' : '—';
    const avgRate = e.rateCnt ? Math.round(e.rate / e.rateCnt) + ' t/s' : '—';
    return `<tr style="border-bottom:1px solid #F6F7F8;"><td style="padding:6px 8px;text-align:left;color:#111827;font-weight:500;max-width:140px;overflow:hidden;text-overflow:ellipsis;">${m}</td><td style="padding:6px 8px;text-align:right;">${e.count}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${e.hit.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#DC2626;">${e.miss.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#6366F1;">${e.out.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;font-weight:600;">${e.total.toLocaleString()}</td><td style="padding:6px 8px;text-align:right;color:#111827;">¥${e.cost.toFixed(4)}</td><td style="padding:6px 8px;text-align:right;">¥${avgCost.toFixed(4)}</td><td style="padding:6px 8px;text-align:right;color:#6B7280;">${avgDur}</td><td style="padding:6px 8px;text-align:right;color:#0BA25E;">${avgRate}</td></tr>`;
  }).join('');
  tbody.innerHTML = rows;
}

export function renderStatsView() {
  const doc = getDoc();
  const s: any = getSelectedSave();
  if (!s) return;
  const allHistory: any[] = s.history || [];
  // 时间维度仅影响 三块 + 汇总表
  const timeFiltered = filterByRange(allHistory);
  const summaryFiltered = filterByModel(timeFiltered);
  // 模型维度影响所有内容（图表也受模型过滤，但不受时间限制按新规，图表受模型影响但此处图表按 time+model 双重过滤以保持一致性）
  // 按用户要求：时间仅影响三块与汇总，模型影响所有；此处图表受模型影响，同时若需保持时间独立可改为 filterByModel(allHistory)
  const chartFiltered = filterByModel(timeFiltered);
  // 三块与汇总用 time+model
  let totalCost = 0, totalReq = summaryFiltered.length, totalTok = 0;
  for (const e of summaryFiltered) { totalCost += e.cost || 0; totalTok += e.total_tokens || 0; }
  const costEl = doc.getElementById('aus-stats-cost');
  if (costEl) costEl.textContent = '¥' + totalCost.toFixed(2) + ' CNY';
  const reqEl = doc.getElementById('aus-stats-req');
  if (reqEl) reqEl.textContent = String(totalReq);
  const tokEl = doc.getElementById('aus-stats-tok');
  if (tokEl) tokEl.textContent = totalTok.toLocaleString('zh-CN');
  renderModelSummary(summaryFiltered);
  renderStackedChart(chartFiltered);
  renderModelPicker();
}

export function initStatsView() {
  bindPicker();
  updatePickerLabel();
  renderStatsView();
}
