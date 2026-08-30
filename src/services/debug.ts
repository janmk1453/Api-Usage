import { state } from '../store/index';
import { repository } from '../data/repository';
import { calcCost, isDeepSeekOfficialModel } from './pricing';

export function generateDebugBatch() {
  const s: any = state;
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
      state.total_tokens += total; state.total_cost += c.total; state.input_tokens += h+m; state.output_tokens += o;
      state.cache_hit_tokens += h; state.cache_miss_tokens += m; state.input_cost += c.input; state.output_cost += c.output;
      if (isDeepSeekOfficialModel(model)) state.rounds += 1;
      state.history.unshift({ timestamp: ts.getTime(), model, prompt_tokens: h+m, cache_hit_tokens: h, cache_miss_tokens: m, completion_tokens: o, total_tokens: total, input_cost: c.input, output_cost: c.output, cost: c.total, cache_hit_rate: (h+m)>0?h/(h+m)*100:0, priceType: c.priceType, raw_usage: {prompt_cache_hit_tokens:h,prompt_cache_miss_tokens:m,completion_tokens:o,total_tokens:total}, messages: [], duration: dur, ttft, thinkTime: 300, thinkTokens: Math.floor(o*0.2), tokenRate: Math.round(o/(dur-ttft)*1000), fullRequest: null, fullResponse: null });
      generated++;
    }
  }
  state.history.sort((a: any, b: any) => b.timestamp - a.timestamp);
  repository.recalcAll();
  try { (globalThis as any).ApiUsageStat?.refreshUI?.(); } catch {}
  alert('已生成 ' + generated + ' 条模拟数据');
}
