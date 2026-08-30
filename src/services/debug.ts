import { state } from '../store/index';
import { saveHot } from '../store/persistence';
import { calcCost, isDeepSeekOfficialModel } from './pricing';
import { recalcAllCosts } from './interception';

export function generateDebugBatch() {
  const saves: any = state.saves;
  const cur = state.currentSave as string;
  const s: any = saves[cur] && cur !== '__all__' ? saves[cur] : saves[Object.keys(saves)[0]];
  if (!s) return alert('请先选择存档');
  const startStr = (state.settings as any).debugDateStart;
  const endStr = (state.settings as any).debugDateEnd;
  if (!startStr || !endStr) return alert('请设置起始与结束日期');
  const startDate = new Date(startStr + 'T00:00:00Z');
  const endDate = new Date(endStr + 'T00:00:00Z');
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return alert('日期范围无效');
  const count = (state.settings as any).debugBatchCount || 30;
  const model = (state.settings as any).debugModel || 'deepseek-v4-flash';
  const hit = (state.settings as any).debugHit || 10000;
  const miss = (state.settings as any).debugMiss || 5000;
  const output = (state.settings as any).debugOutput || 2000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const perDay = Math.ceil(count / totalDays);
  let generated = 0;
  for (let d = 0; d < totalDays && generated < count; d++) {
    const curDate = new Date(startDate); curDate.setUTCDate(startDate.getUTCDate() + d);
    for (let i = 0; i < perDay && generated < count; i++) {
      const rv = (base: number) => Math.round(base * (0.3 + Math.random() * 1.4));
      const h = rv(hit), m = rv(miss), o = rv(output);
      const total = h + m + o;
      const ts = new Date(curDate); ts.setUTCHours(Math.floor(Math.random()*24), Math.floor(Math.random()*60), Math.floor(Math.random()*60), 0);
      const dur = Math.floor(Math.random()*5000)+500;
      const ttft = Math.floor(Math.random()*1000)+100;
      const c = calcCost({ timestamp: ts.getTime(), model, prompt_cache_hit_tokens: h, prompt_cache_miss_tokens: m, completion_tokens: o }, state.settings as any) as any;
      s.total_tokens += total; s.total_cost += c.total; s.input_tokens += h+m; s.output_tokens += o;
      s.cache_hit_tokens += h; s.cache_miss_tokens += m; s.input_cost += c.input; s.output_cost += c.output;
      if (isDeepSeekOfficialModel(model)) s.rounds += 1;
      s.history.unshift({ timestamp: ts.getTime(), model, prompt_tokens: h+m, cache_hit_tokens: h, cache_miss_tokens: m, completion_tokens: o, total_tokens: total, input_cost: c.input, output_cost: c.output, cost: c.total, cache_hit_rate: (h+m)>0?h/(h+m)*100:0, priceType: c.priceType, raw_usage: {prompt_cache_hit_tokens:h,prompt_cache_miss_tokens:m,completion_tokens:o,total_tokens:total}, messages: [], duration: dur, ttft, thinkTime: 300, thinkTokens: Math.floor(o*0.2), tokenRate: Math.round(o/(dur-ttft)*1000), fullRequest: null, fullResponse: null });
      generated++;
    }
  }
  s.history.sort((a: any, b: any) => b.timestamp - a.timestamp);
  try { recalcAllCosts(); } catch {}
  s._mtime = Date.now();
  saveHot({ saves: state.saves });
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  alert('已生成 ' + generated + ' 条模拟数据');
}
