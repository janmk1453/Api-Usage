import { describe, expect, it } from 'vitest';
import { HELP_DOC_URL, HELP_PRIVACY_URL, helpViewHTML } from './help-view';

const html = helpViewHTML();

describe('使用说明页', () => {
  it('完整使用文档入口排在最前，其次是隐私与免责声明', () => {
    const hero = html.indexOf('aus-help-hero');
    const legal = html.indexOf('id="aus-help-legal"');
    const guides = html.indexOf('id="aus-help-guides"');
    const foot = html.indexOf('id="aus-help-foot"');
    expect(hero).toBeGreaterThan(-1);
    expect(legal).toBeGreaterThan(hero);
    expect(guides).toBeGreaterThan(legal);
    expect(foot).toBeGreaterThan(guides);
    expect(html.indexOf('隐私声明')).toBeLessThan(html.indexOf('免责声明'));
    expect(html.indexOf('免责声明')).toBeLessThan(guides);
  });

  it('文档入口与隐私完整版链接指向线上文档站', () => {
    expect(html).toContain('href="' + HELP_DOC_URL + '"');
    expect(html).toContain('href="' + HELP_PRIVACY_URL + '"');
    expect(HELP_PRIVACY_URL.endsWith('#privacy')).toBe(true);
  });

  it('说明卡按页面分门别类，共 8 张且每张都有编号步骤', () => {
    const titles = [...html.matchAll(/<span class="aus-help-card-title">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(titles).toEqual([
      '开始使用',
      '用量概览',
      '用量统计',
      '历史记录',
      '趋势预测',
      '钱包',
      '设置与数据',
      '对话展示管理',
    ]);
    const cards = html.split('class="ds-card aus-help-card"').slice(1);
    expect(cards.length).toBe(8);
    for (const card of cards) {
      const steps = [...card.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim());
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps.length).toBeLessThanOrEqual(4);
      for (const step of steps) {
        expect(step.length).toBeGreaterThan(0);
        expect(step.includes('<li>')).toBe(false);
      }
    }
  });

  it('隐私与免责改成要点列表，且不再使用旧的 emoji 标题', () => {
    expect(html.match(/aus-help-legal-list/g)!.length).toBeGreaterThanOrEqual(2);
    for (const emoji of ['📊', '💡', '🔄', '📈', '💾', '🧡', '✨']) {
      expect(html.includes(emoji)).toBe(false);
    }
  });

  it('保留钱包、免责与模型兼容三块必要内容', () => {
    expect(html).toContain('钱包');
    expect(html).toContain('models.dev');
    expect(html).toContain('模型兼容');
    expect(html).toContain('simple-icons');
    expect(html).toContain('XOR');
  });
});
