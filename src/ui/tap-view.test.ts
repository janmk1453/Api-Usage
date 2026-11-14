/**
 * 其他请求验证页 —— 渲染纯函数单测
 *
 * 只验证「页面把哪些数据摆出来了、筛选有没有生效、隔离声明在不在」，
 * 不涉及真实探针采集（那部分依赖宿主环境，交给真机验证）。
 */
import { describe, it, expect } from 'vitest';
import { tapViewHTML } from './tap-view';
import type { TapRecord } from '../services/request-tap/types';

function rec(patch: Partial<TapRecord>): TapRecord {
  return {
    id: 'tap:1',
    at: 1_760_000_000_000,
    endedAt: 1_760_000_001_500,
    url: '/api/backends/chat-completions/generate',
    endpoint: 'chat',
    actorKind: 'plugin',
    actorId: 'http://h/scripts/extensions/third-party/MVU/index.html',
    actorLabel: 'MVU',
    stackTop: 'at go (MVU/index.js:20:5)',
    attribution: 'A',
    model: 'deepseek-flash',
    requestType: '',
    stream: true,
    messageCount: 4,
    promptChars: 800,
    structured: false,
    purposeKey: 'k1',
    purposeLabel: '变量更新',
    promptHint: '请更新变量',
    usage: { prompt: 1000, completion: 200, total: 1200, hit: 0, miss: 1000 },
    usageMissing: false,
    durationMs: 1500,
    ttftMs: 300,
    status: 200,
    error: null,
    state: 'orphan',
    settledBy: null,
    settledAt: null,
    ...patch,
  };
}

const diag = { settlements: 7, consumed: 5 };

describe('其他请求页渲染', () => {
  it('声明数据隔离、给出账本规模', () => {
    const html = tapViewHTML({ records: [], filter: 'orphan', pendingClear: false, diag });
    expect(html).toContain('aus_tap_log_v1');
    expect(html).toContain('完全不进入概览、统计、历史、趋势的任何计算');
    expect(html).toContain('账本 7 条');
  });

  it('四块汇总分别统计入账/未入账/待对账/无用量', () => {
    const html = tapViewHTML({
      records: [
        rec({ id: 'a', state: 'orphan' }),
        rec({ id: 'b', state: 'orphan', usageMissing: true, usage: null }),
        rec({ id: 'c', state: 'settled' }),
        rec({ id: 'd', state: 'pending' }),
      ],
      filter: 'all',
      pendingClear: false,
      diag,
    });
    expect(html).toContain('未入账（疑似非常规）');
    expect(html).toContain('>2<');
    expect(html).toContain('已入账（常规对话）');
    expect(html).toContain('待对账 / 无用量');
    expect(html).toContain('1 / 1');
  });

  it('筛选生效：只看未入账时不出现已入账记录', () => {
    const records = [
      rec({ id: 'a', state: 'orphan', purposeLabel: '变量更新', purposeKey: 'k1' }),
      rec({ id: 'b', state: 'settled', purposeLabel: '长上下文请求', purposeKey: 'k2', actorLabel: '酒馆主窗', actorKind: 'tavern' }),
    ];
    const orphanOnly = tapViewHTML({ records, filter: 'orphan', pendingClear: false, diag });
    expect(orphanOnly).toContain('变量更新');
    expect(orphanOnly).not.toContain('长上下文请求');

    const settledOnly = tapViewHTML({ records, filter: 'settled', pendingClear: false, diag });
    expect(settledOnly).toContain('长上下文请求');
    expect(settledOnly).not.toContain('变量更新');
  });

  it('当前筛选按钮带选中标记', () => {
    const html = tapViewHTML({ records: [rec({})], filter: 'all', pendingClear: false, diag });
    expect(html).toContain('data-tap-filter="all" data-on="1"');
    expect(html).toContain('data-tap-filter="orphan">');
  });

  it('没有 usage 的请求写明原因而不是显示 0', () => {
    const html = tapViewHTML({
      records: [rec({ usage: null, usageMissing: true })],
      filter: 'orphan',
      pendingClear: false,
      diag,
    });
    expect(html).toContain('无 usage');
  });

  it('清空需要二次确认', () => {
    const first = tapViewHTML({ records: [rec({})], filter: 'all', pendingClear: false, diag });
    const second = tapViewHTML({ records: [rec({})], filter: 'all', pendingClear: true, diag });
    expect(first).toContain('>清空<');
    expect(second).toContain('确认清空？');
    expect(second).toContain('data-danger="1"');
  });

  it('分组超过 8 条时折叠多余记录', () => {
    const many = Array.from({ length: 11 }, (_, i) => rec({ id: 'x' + i }));
    const html = tapViewHTML({ records: many, filter: 'orphan', pendingClear: false, diag });
    expect(html).toContain('其余 3 条已省略');
  });

  it('空状态给出下一步该做什么', () => {
    const html = tapViewHTML({ records: [], filter: 'orphan', pendingClear: false, diag });
    expect(html).toContain('还没有符合条件的记录');
  });
});
