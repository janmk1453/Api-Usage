import { describe, expect, it } from 'vitest';
import { REQUEST_TYPE_KEYS } from '../data/sample-quality';
import { REQUEST_TYPE_OPTIONS, requestTypeLabel, requestTypeTitle } from './request-type-filter';

/**
 * 筛选选项与数据层值域必须逐项对齐：选项多一个会筛出空列表，
 * 少一个则某些记录永远筛不到。这里用顺序断言把两边钉在一起。
 */

describe('REQUEST_TYPE_OPTIONS', () => {
  it('与数据层值域一一对应且顺序一致', () => {
    expect(REQUEST_TYPE_OPTIONS.map(o => o.id)).toEqual([...REQUEST_TYPE_KEYS]);
    expect(REQUEST_TYPE_OPTIONS.map(o => o.label)).toEqual(['对话', '扩展', '脚本', '中断', '估算', 'Agent']);
  });

  it('id 唯一，每项都有非空标题说明', () => {
    const ids = REQUEST_TYPE_OPTIONS.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const option of REQUEST_TYPE_OPTIONS) {
      expect(option.title.length).toBeGreaterThan(4);
    }
  });
});

describe('文案回显', () => {
  it('已知类型取自己的标签，空值与「全部」显示全部', () => {
    expect(requestTypeLabel('extension')).toBe('扩展');
    expect(requestTypeLabel('agent')).toBe('Agent');
    expect(requestTypeLabel('')).toBe('全部');
    expect(requestTypeLabel(null)).toBe('全部');
    expect(requestTypeLabel('__all__')).toBe('全部');
  });

  it('脏值（已下线的类型）也退回「全部」，不显示空白胶囊', () => {
    expect(requestTypeLabel('legacy-type')).toBe('全部');
    expect(requestTypeTitle('legacy-type')).toBe('按请求类型筛选');
  });

  it('标题跟着类型走，全部时给筛选说明', () => {
    expect(requestTypeTitle('interrupted')).toContain('中断');
    expect(requestTypeTitle(null)).toBe('按请求类型筛选');
  });
});
