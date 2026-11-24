import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DETAIL_KEEP_SLACK,
  DETAIL_MAX_CHARS,
  clearDetailStore,
  closeDetailDB,
  deleteDetail,
  detailKeyOf,
  detailStorageStats,
  getDetail,
  listDetailIndex,
  pruneDetailStore,
  putDetailRequest,
  putDetailResponse,
  sanitizeDetailHeaders,
  sanitizeDetailRequestText,
} from './detail-store';
import { DETAIL_KEEP } from '../constants/pricing';

const BODY = JSON.stringify({ model: 'deepseek-v4-flash', stream: true, messages: [{ role: 'user', content: '你好' }] });

async function reset(): Promise<void> {
  await closeDetailDB();
  await clearDetailStore();
}

describe('详情原文库', () => {
  beforeEach(async () => {
    await reset();
  });

  it('请求与响应写到同一个 key 上', async () => {
    const key = await putDetailRequest({ requestId: 'req:1', timestamp: 1000, model: 'm', body: BODY });
    expect(key).toBe('req:1');
    const merged = await putDetailResponse({ requestId: 'req:1', timestamp: 1000, body: 'data: {"usage":{}}', usage: { prompt_tokens: 3 } });
    expect(merged).toBe('req:1');
    const blob = await getDetail('req:1');
    expect(blob?.request?.body).toBe(BODY);
    expect(blob?.request?.truncated).toBe(false);
    expect(blob?.response?.body).toContain('data:');
    expect(blob?.usage).toEqual({ prompt_tokens: 3 });
    expect(blob?.model).toBe('m');
  });

  it('没有 requestId 时按时间戳造 key', async () => {
    expect(detailKeyOf(null, 1234)).toBe('ts:1234');
    const key = await putDetailRequest({ requestId: null, timestamp: 1234, body: BODY });
    expect(key).toBe('ts:1234');
    expect((await getDetail('ts:1234'))?.request?.body).toBe(BODY);
  });

  it('写入时按「保留条数 + 缓冲」粗筛，超缓冲才从最旧淘汰', async () => {
    const cap = DETAIL_KEEP + DETAIL_KEEP_SLACK;
    for (let i = 1; i <= cap; i++) {
      await putDetailRequest({ requestId: 'req:' + i, timestamp: i * 1000, body: BODY });
    }
    // 缓冲内的都留着：原文库按请求开始时刻排序，记录按写入时刻排序，一次长流式请求会让两边错开，
    // 严格按 5 条淘汰会把仍属于最近 5 条记录的原文删掉
    expect(await listDetailIndex()).toHaveLength(cap);
    for (let i = cap + 1; i <= cap + 3; i++) {
      await putDetailRequest({ requestId: 'req:' + i, timestamp: i * 1000, body: BODY });
    }
    const index = await listDetailIndex();
    expect(index).toHaveLength(cap);
    expect(index[0].key).toBe('req:' + (cap + 3));
    expect(await getDetail('req:1')).toBeNull();
    // 掉出窗口的记录由记录层按 key 精确删除后，库内严格收敛到窗口条数
    const tight = await pruneDetailStore();
    expect(tight.kept).toBe(DETAIL_KEEP);
    expect(await listDetailIndex()).toHaveLength(DETAIL_KEEP);
  });

  it('pruneDetailStore 支持显式条数并返回结果', async () => {
    await putDetailRequest({ requestId: 'req:1', timestamp: 1000, body: BODY });
    await putDetailRequest({ requestId: 'req:2', timestamp: 2000, body: BODY });
    const result = await pruneDetailStore(1);
    expect(result.kept).toBe(1);
    expect(await listDetailIndex()).toHaveLength(1);
  });

  it('删除单条与清空', async () => {
    await putDetailRequest({ requestId: 'req:1', timestamp: 1000, body: BODY });
    await putDetailRequest({ requestId: 'req:2', timestamp: 2000, body: BODY });
    await deleteDetail('req:1');
    expect(await getDetail('req:1')).toBeNull();
    const cleared = await clearDetailStore();
    expect(cleared.removed).toBe(1);
    expect(await listDetailIndex()).toHaveLength(0);
  });

  it('统计给出条数与字符量', async () => {
    await putDetailRequest({ requestId: 'req:1', timestamp: 1000, body: BODY });
    const stats = await detailStorageStats();
    expect(stats.count).toBe(1);
    expect(stats.chars).toBeGreaterThan(BODY.length - 1);
    expect(stats.newestAt).toBe(1000);
  });

  it('超长原文按上限截断并打标记', async () => {
    const huge = 'a'.repeat(DETAIL_MAX_CHARS + 10);
    await putDetailRequest({ requestId: 'req:huge', timestamp: 1000, body: huge });
    const blob = await getDetail('req:huge');
    expect(blob?.request?.truncated).toBe(true);
    expect(blob?.request?.chars).toBe(DETAIL_MAX_CHARS + 10);
    expect(blob?.request?.body).toHaveLength(DETAIL_MAX_CHARS);
  });

  it('读取不存在的 key 返回 null', async () => {
    expect(await getDetail('req:missing')).toBeNull();
    expect(await getDetail(null)).toBeNull();
  });
});

describe('详情原文脱敏', () => {
  it('请求体里的凭据字段被掩码，其余内容原样保留', () => {
    const body = JSON.stringify({
      model: 'm',
      api_key: 'sk-1234567890abcdef',
      messages: [{ role: 'user', content: '我自己的密钥 sk-1234567890abcdef 也要保留吗' }],
    });
    const masked = sanitizeDetailRequestText(body);
    expect(masked).toContain('sk-1****cdef');
    expect(masked).toContain('我自己的密钥 sk-1234567890abcdef 也要保留吗');
    expect(masked).not.toContain('"api_key":"sk-1234567890abcdef"');
  });

  it('不含凭据字段的请求体原样返回（不做二次序列化）', () => {
    const body = '{ "model": "m",   "stream": true }';
    expect(sanitizeDetailRequestText(body)).toBe(body);
  });

  it('非 JSON 请求体原样返回', () => {
    const body = '------boundary\r\nContent-Disposition: form-data\r\n';
    expect(sanitizeDetailRequestText(body)).toBe(body);
  });

  it('请求头归一化成 JSON 并掩码敏感头', () => {
    const text = sanitizeDetailHeaders({
      'Content-Type': 'application/json',
      Authorization: 'Bearer sk-abcdefghijklmn',
      'X-API-Key': 'abcdefghijklmnop',
    });
    const parsed = JSON.parse(String(text));
    expect(parsed['Content-Type']).toBe('application/json');
    expect(parsed.Authorization).toBe('Bear****klmn');
    expect(parsed['X-API-Key']).toBe('abcd****mnop');
  });

  it('Headers 实例（forEach 形状）也能归一化', () => {
    const headers = {
      forEach(cb: (value: string, key: string) => void) {
        cb('application/json', 'Content-Type');
        cb('Bearer xyz1234567890', 'authorization');
      },
    };
    const parsed = JSON.parse(String(sanitizeDetailHeaders(headers)));
    expect(parsed['Content-Type']).toBe('application/json');
    expect(parsed.authorization).toBe('Bear****7890');
  });

  it('没有请求头时返回 null', () => {
    expect(sanitizeDetailHeaders(null)).toBeNull();
    expect(sanitizeDetailHeaders({})).toBeNull();
  });
});
