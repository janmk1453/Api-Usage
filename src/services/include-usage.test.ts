import { describe, expect, it } from 'vitest';
import { INCLUDE_USAGE_YAML, isInjectableApiFormat, mergeIncludeUsage } from './include-usage';

describe('mergeIncludeUsage', () => {
  it('空值直接写入 stream_options', () => {
    const r = mergeIncludeUsage('');
    expect(r.changed).toBe(true);
    expect(r.value).toBe(`${INCLUDE_USAGE_YAML}\n`);
  });

  it('块状 YAML 映射保持原内容并追加', () => {
    const r = mergeIncludeUsage('thinking: disabled');
    expect(r.changed).toBe(true);
    expect(r.value).toContain('thinking: disabled\n');
    expect(r.value).toContain(INCLUDE_USAGE_YAML);
  });

  it('方法4 的 JSON 参数被解析合并而不是拼接', () => {
    const r = mergeIncludeUsage('{"thinking":{"type":"disabled"}}');
    expect(r.changed).toBe(true);
    expect(JSON.parse(r.value)).toEqual({
      thinking: { type: 'disabled' },
      stream_options: { include_usage: true },
    });
  });

  it('方法3 的嵌套 JSON 参数同样保持合法', () => {
    const raw = '{"providerOptions": {"gateway": {"only": ["deepseek"]}, "deepseek": {"thinking": {"type": "disabled"}}}}';
    const r = mergeIncludeUsage(raw);
    expect(r.changed).toBe(true);
    const parsed = JSON.parse(r.value);
    expect(parsed.providerOptions.deepseek.thinking.type).toBe('disabled');
    expect(parsed.stream_options).toEqual({ include_usage: true });
  });

  it('JSON 前有注释或文档起始标记时仍能合并', () => {
    const r = mergeIncludeUsage('# 关闭原生思考\n---\n{"thinking":{"type":"disabled"}}');
    expect(r.changed).toBe(true);
    expect(JSON.parse(r.value)).toEqual({
      thinking: { type: 'disabled' },
      stream_options: { include_usage: true },
    });
  });

  it('JSON 已有 stream_options 时不介入', () => {
    const raw = '{"thinking":{"type":"disabled"},"stream_options":{"include_usage":false}}';
    const r = mergeIncludeUsage(raw);
    expect(r.changed).toBe(false);
    expect(r.value).toBe(raw);
  });

  it('非 JSON 的 flow 写法不注入，保留原值', () => {
    const raw = '{ thinking: { type: disabled } }';
    const r = mergeIncludeUsage(raw);
    expect(r.changed).toBe(false);
    expect(r.value).toBe(raw);
  });

  it('数组或列表写法不注入', () => {
    for (const raw of ['[{"thinking": {"type": "disabled"}}]', '- thinking: disabled']) {
      const r = mergeIncludeUsage(raw);
      expect(r.changed).toBe(false);
      expect(r.value).toBe(raw);
    }
  });

  it('已有 stream_options 的块状 YAML 不重复注入', () => {
    const raw = 'thinking: disabled\nstream_options:\n  include_usage: false';
    const r = mergeIncludeUsage(raw);
    expect(r.changed).toBe(false);
    expect(r.value).toBe(raw);
  });

  it('存在 YAML 文档结束标记时不追加出第二个文档', () => {
    const raw = 'thinking: disabled\n...';
    const r = mergeIncludeUsage(raw);
    expect(r.changed).toBe(false);
    expect(r.value).toBe(raw);
  });

  it('非字符串的 custom_include_body 不介入，避免变成 [object Object]', () => {
    for (const raw of [{ thinking: { type: 'disabled' } }, 42, true]) {
      const r = mergeIncludeUsage(raw);
      expect(r.changed).toBe(false);
      expect(r.value).toBe('');
    }
    // 空的 null/undefined 仍按「没有参数」处理，可以写入
    expect(mergeIncludeUsage(null).changed).toBe(true);
    expect(mergeIncludeUsage(undefined).changed).toBe(true);
  });
});

describe('isInjectableApiFormat', () => {
  it('没有 custom_api_format（SillyTavern 的 custom 源）允许注入', () => {
    expect(isInjectableApiFormat(undefined)).toBe(true);
    expect(isInjectableApiFormat(null)).toBe(true);
    expect(isInjectableApiFormat('')).toBe(true);
    expect(isInjectableApiFormat('   ')).toBe(true);
  });

  it('OpenAI 兼容格式允许注入', () => {
    expect(isInjectableApiFormat('openai_compat')).toBe(true);
    expect(isInjectableApiFormat(' openai_compat ')).toBe(true);
  });

  it('原生协议格式一律不注入，避免被严格校验拒绝', () => {
    for (const format of [
      'gemini_generate_content',
      'gemini_interactions',
      'claude_messages',
      'openai_responses',
      'some_future_format',
    ]) {
      expect(isInjectableApiFormat(format)).toBe(false);
    }
  });

  it('格式字段不是字符串时不注入', () => {
    expect(isInjectableApiFormat(1)).toBe(false);
    expect(isInjectableApiFormat({})).toBe(false);
  });
});
