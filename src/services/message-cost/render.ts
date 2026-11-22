/**
 * 消息头元信息渲染（DOM 侧）
 *
 * 只在消息头部插入 <small class="aus-mes-meta">，**绝不写 message.extra / chat 数据**——
 * 那会随聊天落盘、进导出与 WebDAV，用户换个扩展就脏了。
 *
 * 环境分叉：
 *  - TauriTavern 内核已自带「首字延迟 / 生成速度 / 缓存命中率」三块（.mes_generation_ttft 等），
 *    扩展只补一个价格，避免两份数字并排；
 *  - SillyTavern 内核只有 token 计数、没有这几项，扩展把四项全画出来。
 */
import { cnyToDisplay, getDisplayCurrency } from '../currency';
import { pricingSourceLabel } from '../pricing';
import type { MessageAnchor, MessageUsage } from './match';

/** 注入节点类名：刷新时先按它删旧节点再重画，避免重复堆叠 */
export const MESSAGE_META_CLASS = 'aus-mes-meta';

export type MessageMetaOptions = {
  cost: boolean;
  ttft: boolean;
  rate: boolean;
  cache: boolean;
};

export type MessageMetaKind = 'ttft' | 'rate' | 'cache' | 'cost';
export type MessageMetaPart = { kind: MessageMetaKind; text: string; title: string };

/** 内核是否已自带这三块（TauriTavern 的开关就挂在设置页上，是最稳的探针） */
export function hasNativeGenerationInfo(): boolean {
  try {
    return !!document.getElementById('messageFirstTokenEnabled');
  } catch {
    return false;
  }
}

/** 价格文本：与面板同口径（4 位小数），但不带币种码，免得消息头太长 */
export function moneyText(cny: number): string {
  const cur = getDisplayCurrency();
  const v = cnyToDisplay(Number.isFinite(cny) ? cny : 0);
  return `${cur.symbol}${v.toFixed(4)}`;
}

function tokenText(n: number): string {
  return Math.round(Number.isFinite(n) ? n : 0).toLocaleString('zh-CN');
}

/**
 * 从酒馆消息里取配对锚点。swipe_info[swipe_id] 是那一条分支自己的起止与 extra，
 * 切 swipe 后必须用它，否则会拿主字段（最后一次生成）错配。
 */
export function anchorOfMessage(message: any, chatId: string | null): MessageAnchor {
  const msg = message || {};
  const swipeId = Number(msg.swipe_id);
  const swipes: any[] = Array.isArray(msg.swipe_info) ? msg.swipe_info : [];
  const swipe = Number.isInteger(swipeId) && swipeId >= 0 ? swipes[swipeId] : null;
  const genStarted = swipe?.gen_started ?? msg.gen_started;
  const genFinished = swipe?.gen_finished ?? msg.gen_finished;
  const extra = swipe?.extra && typeof swipe.extra === 'object' ? swipe.extra : msg.extra;
  const cache = extra && typeof extra === 'object' ? extra.prompt_cache : null;
  return {
    chatId,
    genStarted,
    genFinished,
    promptCache: cache && typeof cache === 'object'
      ? { input_tokens: cache.input_tokens, cached_tokens: cache.cached_tokens }
      : null,
    model: extra && typeof extra === 'object' ? extra.model : null,
  };
}

/** 组装消息头要显示的片段；返回空数组表示无需插入任何节点 */
export function buildMessageMetaParts(usage: MessageUsage | null, options: MessageMetaOptions, native: boolean): MessageMetaPart[] {
  if (!usage) return [];
  const parts: MessageMetaPart[] = [];
  const title = [
    usage.model || '未知模型',
    `命中 ${tokenText(usage.cacheHitTokens)} · 未命中 ${tokenText(usage.cacheMissTokens)} · 输出 ${tokenText(usage.completionTokens)}`,
    pricingSourceLabel(usage.pricingSource),
  ].filter(Boolean).join('｜');

  // 内核已画的三项不再重复（TauriTavern 自带），只补价格
  if (!native && options.ttft && usage.ttft > 0) {
    parts.push({ kind: 'ttft', text: `TTFT ${(usage.ttft / 1000).toFixed(1)}s`, title: `首字延迟 ${Math.round(usage.ttft)}ms｜${title}` });
  }
  if (!native && options.rate && usage.tokenRate > 0) {
    parts.push({ kind: 'rate', text: `${usage.tokenRate.toFixed(1)} token/s`, title: `生成速度（输出 Token ÷ 生成耗时）｜${title}` });
  }
  if (!native && options.cache && usage.promptTokens > 0) {
    parts.push({ kind: 'cache', text: `Cache hit ${usage.cacheHitRate.toFixed(0)}%`, title: `缓存命中率 ${usage.cacheHitRate.toFixed(1)}%｜${title}` });
  }
  if (options.cost) {
    const text = usage.pricingSource === 'unpriced'
      ? '待定价'
      : `${usage.costEstimated ? '≈' : ''}${moneyText(usage.cost)}`;
    parts.push({ kind: 'cost', text, title: `本条对话费用｜${title}` });
  }
  return parts;
}

/** 把片段画进消息头；没有片段就把旧节点清掉 */
export function paintMessageMeta(mesEl: Element | null, parts: MessageMetaPart[]): void {
  if (!mesEl) return;
  const host = mesEl.querySelector('.mes_header_info .alignItemsBaseline')
    || mesEl.querySelector('.ch_name .alignItemsBaseline')
    || mesEl.querySelector('.ch_name')
    || mesEl;
  host.querySelectorAll(`.${MESSAGE_META_CLASS}`).forEach(node => node.remove());
  if (!parts.length) return;
  for (const part of parts) {
    const el = document.createElement('small');
    el.className = `mes_generation_info ${MESSAGE_META_CLASS}`;
    el.dataset.kind = part.kind;
    el.textContent = part.text;
    if (part.title) el.title = part.title;
    host.appendChild(el);
  }
}
