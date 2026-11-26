import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getHistoryForDisplay, pruneHistoryDetails, state } from './index';
import { DETAIL_KEEP } from '../constants/pricing';

/**
 * 这两条是「记录落盘前」的最后一道闸门，出错不会报错、只会慢慢变坏：
 * - 详情裁剪失效 → 每条记录都带着完整请求与响应进 extensionSettings，热存储被撑爆；
 * - 会话过滤失效 → 历史页把别的对话的记录混进来。
 */

function entry(timestamp: number, chatId = 'chat-a', text = 'answer'): any {
  return {
    timestamp,
    chatId,
    model: 'deepseek-flash',
    messages: [{ role: 'user', content: 'hi' }],
    fullRequest: {
      model: 'deepseek-flash',
      stream: true,
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ],
      extraDebug: 'should-be-dropped',
    },
    fullResponse: text,
  };
}

beforeEach(() => {
  state.history = [];
  state.settings = { ...state.settings, historyScope: 'all' };
});

afterEach(() => {
  state.history = [];
  state.settings = { ...state.settings, historyScope: 'all' };
});

describe('pruneHistoryDetails（详情只留最近几条）', () => {
  it('超出保留条数的旧记录丢掉请求、响应与消息', () => {
    state.history = Array.from({ length: DETAIL_KEEP + 2 }, (_, i) => entry(1000 + i));

    pruneHistoryDetails();

    const old = state.history[0] as any;
    expect(old.messages).toBeUndefined();
    expect(old.fullRequest).toBeUndefined();
    expect(old.fullResponse).toBeUndefined();
    // 统计字段不能被裁掉，否则聚合与详情对不上
    expect(old.model).toBe('deepseek-flash');
    expect(old.timestamp).toBe(1000);
  });

  it('最近几条保留消息，但完整请求压成元信息白名单', () => {
    state.history = Array.from({ length: 3 }, (_, i) => entry(1000 + i));

    pruneHistoryDetails();

    const fresh: any = state.history[0];
    expect(fresh.messages).toHaveLength(1);
    expect(fresh.fullResponse).toBe('answer');
    expect(fresh.fullRequest.model).toBe('deepseek-flash');
    expect(fresh.fullRequest.stream).toBe(true);
    expect(fresh.fullRequest.temperature).toBe(0.7);
    // 原样保留整个 messages 会把上下文再存一份
    expect(fresh.fullRequest.messages).toBeUndefined();
    expect(fresh.fullRequest.messages_length).toBe(2);
    expect(fresh.fullRequest.extraDebug).toBeUndefined();
  });

  it('按时间挑出要保留的几条，但不打乱历史自身的顺序', () => {
    // 故意乱序：最旧的两条夹在中间
    state.history = [entry(1006), entry(1000), entry(1005), entry(1001), entry(1004), entry(1002), entry(1003)];

    pruneHistoryDetails();

    expect(state.history.map((h: any) => h.timestamp)).toEqual([1006, 1000, 1005, 1001, 1004, 1002, 1003]);
    // 7 条里最旧的 1000 / 1001 被裁，其余 5 条（1002 起）保留详情
    expect((state.history[1] as any).fullResponse).toBeUndefined();
    expect((state.history[1] as any).fullRequest).toBeUndefined();
    expect((state.history[3] as any).fullResponse).toBeUndefined();
    expect((state.history[0] as any).fullResponse).toBe('answer');
    expect((state.history[6] as any).fullResponse).toBe('answer');
  });

  it('没有历史或字段残缺时不抛错', () => {
    expect(() => pruneHistoryDetails()).not.toThrow();
    state.history = [{ timestamp: 1 } as any];
    expect(() => pruneHistoryDetails()).not.toThrow();
  });
});

describe('getHistoryForDisplay（只看当前对话）', () => {
  it('默认展示全部历史', () => {
    state.history = [entry(1, 'chat-a'), entry(2, 'chat-b')];
    expect(getHistoryForDisplay()).toHaveLength(2);
  });

  it('限定当前对话时只留匹配的记录', () => {
    state.history = [entry(1, 'chat-a'), entry(2, 'chat-b'), entry(3, 'chat-a')];
    state.settings = { ...state.settings, historyScope: 'current' };
    (globalThis as any).SillyTavern = { getContext: () => ({ getCurrentChatId: () => 'chat-a' }) };

    expect(getHistoryForDisplay().map((h: any) => h.timestamp)).toEqual([1, 3]);

    delete (globalThis as any).SillyTavern;
  });

  it('拿不到当前对话时退化为全部，不能把列表清空', () => {
    state.history = [entry(1, 'chat-a'), entry(2, 'chat-b')];
    state.settings = { ...state.settings, historyScope: 'current' };
    (globalThis as any).SillyTavern = { getContext: () => ({}) };

    expect(getHistoryForDisplay()).toHaveLength(2);

    delete (globalThis as any).SillyTavern;
  });
});
