/**
 * 请求探针（技术验证版）—— 纯逻辑单测
 *
 * 只覆盖不需要 DOM / 网络的部分：端点识别、usage 解析、发起方与用途归类、对账匹配。
 * 采集与页面渲染依赖宿主环境，交给真机验证。
 */
import { describe, it, expect } from 'vitest';
import { endpointOf, readUsageFromText } from './capture';
import {
  actorFromLocation,
  actorFromStack,
  classifyPurpose,
  fingerprint,
  pluginNameFromPath,
  promptHintOf,
  stackTopFrame,
  structuralLabel,
  PROMPT_HINT_LIMIT,
} from './classify';
import { findSettlement, MATCH_WINDOW_MS, normalizeModel, probeKeyOf, type Settlement } from './match';

describe('端点识别', () => {
  it('只认酒馆后端转发的 generate 端点', () => {
    expect(endpointOf('/api/backends/chat-completions/generate')).toBe('chat');
    expect(endpointOf('https://host/api/backends/text-completions/generate')).toBe('text');
    expect(endpointOf('/api/backends/foo/generate')).toBe('other');
  });

  it('不认识的请求一律不采集', () => {
    expect(endpointOf('/api/backends/chat-completions/status')).toBeNull();
    expect(endpointOf('/api/settings/get')).toBeNull();
    expect(endpointOf('https://api.deepseek.com/v1/chat/completions')).toBeNull();
    expect(endpointOf('')).toBeNull();
  });
});

describe('usage 解析', () => {
  it('读得懂非流式 JSON', () => {
    const body = JSON.stringify({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 } });
    expect(readUsageFromText(body)).toMatchObject({ prompt: 120, completion: 30, total: 150, hit: 0, miss: 120 });
  });

  it('读得懂命中明细', () => {
    const body = JSON.stringify({ usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, prompt_tokens_details: { cached_tokens: 60 } } });
    expect(readUsageFromText(body)).toMatchObject({ prompt: 100, hit: 60, miss: 40 });
  });

  it('读得懂 SSE：取最后一条带 usage 的分片', () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"a"}}]}',
      'data: {"usage":{"prompt_tokens":40,"completion_tokens":0}}',
      'data: {"usage":{"prompt_tokens":40,"completion_tokens":8,"total_tokens":48}}',
      'data: [DONE]',
    ].join('\n');
    expect(readUsageFromText(sse)).toMatchObject({ prompt: 40, completion: 8, total: 48 });
  });

  it('没有 usage 时返回 null（第三方直连常见）', () => {
    expect(readUsageFromText('data: {"choices":[]}')).toBeNull();
    expect(readUsageFromText('')).toBeNull();
    expect(readUsageFromText('不是 JSON')).toBeNull();
  });
});

describe('发起方判定', () => {
  it('从扩展路径取出插件名', () => {
    expect(pluginNameFromPath('http://h/scripts/extensions/third-party/MVU/index.html?v=2')).toBe('MVU');
    expect(pluginNameFromPath('/scripts/extensions/third-party/填表/table.js')).toBe('填表');
    expect(pluginNameFromPath('http://h/script.js')).toBeNull();
  });

  it('执行上下文优先：插件 iframe 直接归到插件', () => {
    const actor = actorFromLocation({ frameSrc: 'http://h/scripts/extensions/third-party/MVU/index.html', href: 'http://h/scripts/extensions/third-party/MVU/index.html', isTop: false });
    expect(actor).toMatchObject({ kind: 'plugin', label: 'MVU' });
  });

  it('主窗发起记为酒馆，空来源记为未知', () => {
    expect(actorFromLocation({ isTop: true }).kind).toBe('tavern');
    expect(actorFromLocation({ isTop: false, href: '' }).kind).toBe('unknown');
  });

  it('调用栈能定位到插件，并跳过探针自身帧', () => {
    const stack = [
      'Error',
      '    at begin (http://h/scripts/extensions/third-party/Api-Usage/request-tap/capture.js:1:1)',
      '    at go (http://h/scripts/extensions/third-party/MVU/index.js:20:5)',
      '    at fetch (http://h/app.js:3:3)',
    ].join('\n');
    expect(actorFromStack(stack)).toMatchObject({ kind: 'plugin', label: 'MVU' });
    expect(stackTopFrame(stack)).toContain('MVU/index.js');
  });

  it('没有扩展帧时返回 null，交给上下文兜底', () => {
    expect(actorFromStack('Error\n    at x (http://h/app.js:1:1)')).toBeNull();
    expect(actorFromStack('')).toBeNull();
  });
});

describe('用途归类', () => {
  it('命中关键词规则命名', () => {
    expect(classifyPurpose({ actorLabel: 'MVU', requestType: '', structured: false, messageCount: 4, promptHint: '请更新变量', endpoint: 'chat' }).label).toBe('变量更新');
    expect(classifyPurpose({ actorLabel: 'x', requestType: '', structured: false, messageCount: 4, promptHint: '整理成表格', endpoint: 'chat' }).label).toBe('填表 / 结构化');
  });

  it('没命中关键词时按结构特征兜底', () => {
    expect(structuralLabel({ structured: true, requestType: '', messageCount: 20, endpoint: 'chat' })).toBe('结构化输出');
    expect(structuralLabel({ structured: false, requestType: 'quiet', messageCount: 20, endpoint: 'chat' })).toBe('静默请求');
    expect(structuralLabel({ structured: false, requestType: '', messageCount: 1, endpoint: 'chat' })).toBe('短上下文请求');
    expect(structuralLabel({ structured: false, requestType: '', messageCount: 30, endpoint: 'chat' })).toBe('长上下文请求');
  });

  it('同一插件的同类调用聚成一簇，改词不裂簇', () => {
    const a = classifyPurpose({ actorLabel: 'MVU', requestType: '', structured: false, messageCount: 4, promptHint: '请更新变量', endpoint: 'chat' });
    const b = classifyPurpose({ actorLabel: 'MVU', requestType: '', structured: false, messageCount: 6, promptHint: '请更新状态栏', endpoint: 'chat' });
    const c = classifyPurpose({ actorLabel: 'MVU', requestType: '', structured: false, messageCount: 4, promptHint: '请更新变量', endpoint: 'chat' });
    expect(a.key).toBe(b.key);
    expect(a.key).toBe(c.key);
    expect(classifyPurpose({ actorLabel: 'Other', requestType: '', structured: false, messageCount: 4, promptHint: '请更新变量', endpoint: 'chat' }).key).not.toBe(a.key);
  });

  it('指纹稳定且定长', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'));
    expect(fingerprint('abc')).not.toBe(fingerprint('abd'));
    expect(fingerprint('')).toHaveLength(8);
  });
});

describe('prompt 片段', () => {
  it('只留开头并压平空白，不整段留存', () => {
    const long = 'a'.repeat(300);
    const hint = promptHintOf({ messages: [{ role: 'system', content: 'system' }, { role: 'user', content: long }] });
    expect(hint.length).toBeLessThanOrEqual(PROMPT_HINT_LIMIT);
    expect(promptHintOf({ prompt: '  多\n行   文本  ' })).toBe('多 行 文本');
    expect(promptHintOf({})).toBe('');
    expect(promptHintOf(null)).toBe('');
  });
});

describe('对账匹配', () => {
  const base = { model: 'deepseek-flash', at: 1_000_000, endedAt: 1_002_000 };
  const settlement = (patch: Partial<Settlement> = {}): Settlement => ({
    id: 's1', model: 'deepseek-flash', prompt: 100, completion: 20, total: 120, ts: 1_002_500, ...patch,
  });

  it('用量全等即命中', () => {
    const probe = probeKeyOf({ ...base, usage: { prompt: 100, completion: 20, total: 120 } });
    const hit = findSettlement(probe, [settlement()], new Set());
    expect(hit?.by).toBe('tokens');
    expect(hit?.settlement.id).toBe('s1');
  });

  it('只有总数相等时按 total 兜底', () => {
    const probe = probeKeyOf({ ...base, usage: { prompt: 0, completion: 0, total: 120 } });
    expect(findSettlement(probe, [settlement()], new Set())?.by).toBe('total');
  });

  it('时间窗外的入账不参与匹配', () => {
    const probe = probeKeyOf({ ...base, usage: { prompt: 100, completion: 20, total: 120 } });
    const far = settlement({ ts: base.endedAt + MATCH_WINDOW_MS + 1 });
    expect(findSettlement(probe, [far], new Set())).toBeNull();
  });

  it('模型不同不匹配', () => {
    const probe = probeKeyOf({ ...base, usage: { prompt: 100, completion: 20, total: 120 } });
    expect(findSettlement(probe, [settlement({ model: 'gpt-x' })], new Set())).toBeNull();
  });

  it('一对一消耗：同参入账不会被两条探针共用', () => {
    const probe = probeKeyOf({ ...base, usage: { prompt: 100, completion: 20, total: 120 } });
    const used = new Set<string>();
    const first = findSettlement(probe, [settlement()], used);
    expect(first).not.toBeNull();
    used.add(first!.settlement.id);
    expect(findSettlement(probe, [settlement()], used)).toBeNull();
  });

  it('没有用量时不会瞎配', () => {
    const probe = probeKeyOf({ ...base, usage: null });
    expect(findSettlement(probe, [settlement({ prompt: 0, completion: 0, total: 0 })], new Set())).toBeNull();
  });

  it('模型名比较忽略大小写与空白', () => {
    expect(normalizeModel('  DeepSeek-Flash ')).toBe('deepseek-flash');
    const probe = probeKeyOf({ ...base, usage: { prompt: 100, completion: 20, total: 120 } });
    expect(findSettlement(probe, [settlement({ model: ' DeepSeek-Flash ' })], new Set())).not.toBeNull();
  });
});
