/**
 * 消息费用 / 首字延迟 / 生成速度 / 缓存命中率：面板外的一层展示
 *
 * 数据全部取自 Api-Usage 自己的历史记录（state.history，热 50 + 冷库分页），
 * 这里只做「消息 ↔ 记录」配对与 DOM 绘制，不改采集链路，也不写聊天数据。
 */
import { state } from '../../store/index';
import { MESSAGE_META_CLASS, anchorOfMessage, buildMessageMetaParts, hasNativeGenerationInfo, paintMessageMeta } from './render';
import type { MessageMetaOptions } from './render';
import { installMessageCostRows, removeMessageCostRows, syncMessageCostRows } from './settings-row';
import { matchMessageUsage } from './match';

const REFRESH_DEBOUNCE_MS = 250;
/** 生成结束后记录可能还没入库，稍等再画一次 */
const SETTLE_DELAY_MS = 400;

let installed = false;
let observer: MutationObserver | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let painting = false;

function ctx(): any {
  try {
    return (globalThis as any).SillyTavern?.getContext?.() || null;
  } catch {
    return null;
  }
}

function optionsOf(): MessageMetaOptions {
  const s: any = state.settings || {};
  return {
    cost: s.messageCost === true,
    ttft: s.messageTtft === true,
    rate: s.messageRate === true,
    cache: s.messageCache === true,
  };
}

function isOwnNode(node: Node | null): boolean {
  if (!node) return false;
  if (node.nodeType === Node.TEXT_NODE) return isOwnNode(node.parentNode);
  if (node.nodeType !== Node.ELEMENT_NODE) return true;
  const el = node as Element;
  return el.classList.contains(MESSAGE_META_CLASS) || !!el.querySelector?.(`.${MESSAGE_META_CLASS}`);
}

function clearMeta(mesEl: Element): void {
  mesEl.querySelectorAll(`.${MESSAGE_META_CLASS}`).forEach(node => node.remove());
}

function paintAll(): void {
  const opts = optionsOf();
  const native = hasNativeGenerationInfo();
  const anyOn = opts.cost || (!native && (opts.ttft || opts.rate || opts.cache));
  const c = ctx();
  const chat: any[] = Array.isArray(c?.chat) ? c.chat : [];
  const chatId = (() => {
    try {
      const id = c?.getCurrentChatId?.();
      return id == null || id === '' ? null : String(id);
    } catch {
      return null;
    }
  })();
  const nodes = document.querySelectorAll('#chat .mes');
  painting = true;
  try {
    if (!anyOn) {
      nodes.forEach(node => clearMeta(node));
      return;
    }
    nodes.forEach(node => {
      const mesid = Number(node.getAttribute('mesid'));
      const message = Number.isInteger(mesid) ? chat[mesid] : null;
      if (!message || message.is_user || message.is_system) {
        clearMeta(node);
        return;
      }
      const usage = matchMessageUsage(anchorOfMessage(message, chatId), (state as any).history);
      paintMessageMeta(node, buildMessageMetaParts(usage, opts, native));
    });
  } finally {
    // 自己插入/删除的节点不必再触发一轮刷新
    setTimeout(() => { painting = false; }, 0);
  }
}

function schedule(delay = 0): void {
  if (!installed) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    try {
      paintAll();
    } catch (err) {
      console.warn('[Api-Usage] 消息费用渲染失败', err);
    }
  }, Math.max(0, delay));
}

/** 外部可调用：数据变化后重画（index.ts 的 ApiUsageStat 门面会暴露它） */
export function refreshMessageCost(delay = 0): void {
  schedule(delay);
}

export function installMessageCost(): void {
  if (installed) return;
  installed = true;
  installMessageCostRows(() => schedule(0));
  const es = ctx()?.eventSource;
  const et = ctx()?.event_types;
  if (es?.on && et) {
    const bind = (name: string, delay: number) => {
      const type = (et as any)[name];
      if (!type) return;
      try { es.on(type, () => schedule(delay)); } catch {}
    };
    bind('CHARACTER_MESSAGE_RENDERED', 0);
    bind('MESSAGE_UPDATED', 300);
    bind('MESSAGE_SWIPED', 0);
    bind('CHAT_CHANGED', 100);
    bind('GENERATION_ENDED', SETTLE_DELAY_MS);
    bind('MESSAGE_RECEIVED', SETTLE_DELAY_MS);
    // 入库可能晚于流式结束（要等 usage 解析与去重），补一次更晚的重画
    bind('GENERATION_ENDED', SETTLE_DELAY_MS * 3);
  }
  try {
    const chatEl = document.getElementById('chat');
    if (chatEl && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(records => {
        if (painting) return;
        const relevant = records.some(record => {
          if (record.type !== 'childList') return false;
          const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
          return nodes.some(node => !isOwnNode(node));
        });
        if (relevant) schedule(REFRESH_DEBOUNCE_MS);
      });
      observer.observe(chatEl, { childList: true, subtree: true });
    }
  } catch {}
  schedule(0);
}

export function uninstallMessageCost(): void {
  installed = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  observer?.disconnect();
  observer = null;
  removeMessageCostRows();
  try {
    document.querySelectorAll(`#chat .mes .${MESSAGE_META_CLASS}`).forEach(node => node.remove());
  } catch {}
}

/** 设置面板打开时把注入行的勾选状态与内存设置对齐（宿主可能重绘过设置页） */
export function syncMessageCostSettings(): void {
  try {
    installMessageCostRows(() => schedule(0));
    syncMessageCostRows();
  } catch {}
}
