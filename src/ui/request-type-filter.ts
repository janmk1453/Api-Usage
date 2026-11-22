/**
 * 「请求类型」筛选选项（统计页与历史页共用一份文案）
 *
 * 值域由 data/sample-quality.ts#requestTypeKeysOf 定义：
 * 来源轴（对话 / 扩展 / 脚本）与状态轴（中断 / 估算 / Agent）并存，
 * 一条记录可能同时属于多个类型，筛选按「包含」判定。
 */

export type RequestTypeOption = { id: string; label: string; title: string };

export const REQUEST_TYPE_OPTIONS: RequestTypeOption[] = [
  { id: 'conversation', label: '对话', title: '酒馆主流程或未识别来源发起的请求（含其中的中断与估算）' },
  { id: 'extension', label: '扩展', title: '第三方扩展自己直连生成的请求' },
  { id: 'script', label: '脚本', title: '酒馆助手等 iframe 脚本发起的请求' },
  { id: 'interrupted', label: '中断', title: '生成被中断（用户停止或上游断开）的记录' },
  { id: 'estimated', label: '估算', title: '用量由本地估算补记的记录' },
  { id: 'agent', label: 'Agent', title: 'TauriTavern 的 Agent 运行发起的记录' },
];

const BY_ID = new Map(REQUEST_TYPE_OPTIONS.map((option) => [option.id, option]));

export function requestTypeLabel(id: string | null | undefined): string {
  if (!id || id === '__all__') return '全部';
  return BY_ID.get(id)?.label || '全部';
}

export function requestTypeTitle(id: string | null | undefined): string {
  if (!id || id === '__all__') return '按请求类型筛选';
  return BY_ID.get(id)?.title || '按请求类型筛选';
}
