import { describe, it, expect } from 'vitest';
import panelSrc from './panel.ts?raw';
import statsSrc from './stats-view.ts?raw';
import settingsSrc from './settings.ts?raw';
import forecastSrc from './forecast-view.ts?raw';
import navSrc from './nav-model.ts?raw';
import manageSrc from './model-manage.ts?raw';
import cssSrc from '../../style.css?raw';
import { modelUsageRows } from './model-manage';

/** 去掉注释再断言：注释里提到旧写法不算违规 */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('model-manage：模型用量聚合（管理页列表数据源）', () => {
  it('按模型累加轮次、总 tokens 与费用', () => {
    const rows = modelUsageRows([
      { model: 'a', total_tokens: 100, cost: 0.1 },
      { model: 'b', total_tokens: 50, cost: 0.05 },
      { model: 'a', total_tokens: 200, cost: 0.2 },
    ]);
    expect(rows.map((r) => r.model)).toEqual(['a', 'b']);
    expect(rows[0].count).toBe(2);
    expect(rows[0].total).toBe(300);
    expect(rows[0].cost).toBeCloseTo(0.3, 10);
    expect(rows[1].count).toBe(1);
  });

  it('空模型名归到 unknown（与统计页汇总的 model || unknown 同组）', () => {
    const rows = modelUsageRows([{ model: '', total_tokens: 10 }, { total_tokens: 5 }, { model: '  ', total_tokens: 1 }]);
    expect(rows.length).toBe(1);
    expect(rows[0].model).toBe('unknown');
    expect(rows[0].count).toBe(3);
    expect(rows[0].total).toBe(16);
  });

  it('按轮次倒序、同轮次按名称排序；脏字段按 0 处理且不抛错', () => {
    const rows = modelUsageRows([
      { model: 'zeta' },
      { model: 'alpha' },
      { model: 'beta', total_tokens: 'not-a-number', cost: null },
      { model: 'alpha' },
    ]);
    expect(rows.map((r) => r.model)).toEqual(['alpha', 'beta', 'zeta']);
    expect(rows[1].total).toBe(0);
    expect(rows[1].cost).toBe(0);
    expect(modelUsageRows([])).toEqual([]);
  });
});

describe('model-manage：入口、过滤落点与导航登记', () => {
  const panel = stripComments(panelSrc);
  const stats = stripComments(statsSrc);
  const forecast = stripComments(forecastSrc);
  const nav = stripComments(navSrc);
  const manage = stripComments(manageSrc);

  it('统计页「模型汇总」标题右侧提供「管理模型」按钮与隐藏计数', () => {
    expect(panel).toContain('id="aus-model-manage-btn"');
    expect(panel).toContain('管理模型');
    expect(panel).toContain('id="aus-model-manage-count"');
    // 按钮紧跟在「模型汇总」卡内，且与「管理对话」同款胶囊类
    expect(panel).toContain('class="aus-manage-chat-btn"');
    expect(panel).toContain("doc.getElementById('aus-model-manage-btn')?.addEventListener('click', () => openModelManage('stats'));");
  });

  it('设置页也有一处入口，页面模板与来源页回退都在面板里', () => {
    // 设置页入口卡由 settings.ts#renderSettings 生成，面板里只有委托绑定
    expect(settingsSrc).toContain('id="aus-settings-model-manage"');
    expect(settingsSrc).toContain('模型展示');
    expect(panel).toContain("if (target?.closest?.('#aus-settings-model-manage')) openModelManage('settings');");
    expect(panel).toContain('<div data-view="model-manage"');
    expect(panel).toContain('id="aus-model-manage-body"');
    expect(panel).toContain("else if (view === 'model-manage') Promise.resolve(renderModelManageView()).catch(() => {});");
    expect(panel).toContain('let modelManageOrigin: AppView = \'stats\';');
    expect(panel).toContain("if (view === 'model-manage') return modelManageOrigin;");
    expect(panel).toContain("if (currentView === 'model-manage') return modelManageOrigin;");
    expect(panel).toContain('initModelManageView({ go: () => switchView(modelManageOrigin) });');
  });

  it('统计页的模型汇总表与「模型」下拉都按隐藏集合过滤，且各有空态文案', () => {
    expect(stats).toContain('filterVisibleModelRows(list, (row) => row.m)');
    expect(stats).toContain('filterModelPickerRows(models)');
    expect(stats).toContain('全部模型都已隐藏 · 点击右上角「管理模型」恢复显示');
    expect(stats).toContain('模型已全部隐藏（可在「模型展示管理」中恢复）');
  });

  it('历史记录页的「模型」下拉也过滤，全隐藏时说明去管理页恢复', () => {
    expect(panel).toContain('filterModelPickerRows(models, (option) => option.id)');
    expect(panel).toContain('模型已全部隐藏（可在「模型展示管理」中恢复）');
    // 选中值校验仍用全量模型列表
    expect(panel).toContain('!models.some((option) => option.id === historyFilters.model)');
  });

  it('趋势预测页的模型下拉过滤后若全隐藏则回退全量（功能选择器不能为空）', () => {
    expect(forecast).toContain('filterModelPickerRows(options, (item) => item.model)');
    expect(forecast).toContain('const shown = visible.length ? visible : options;');
    expect(forecast).toContain('个模型已隐藏（可在「模型展示管理」中恢复）');
  });

  it('导航模型登记为二级页，父级 tab 为统计', () => {
    expect(nav).toContain("'model-manage': 'stats',");
    expect(nav).toContain("'model-manage': '模型展示管理',");
    expect(nav).toContain('| \'model-manage\'');
    expect(nav).toContain("'chat-manage', 'model-manage'");
  });

  it('管理页本身：切换开关写的是当前模式的隐藏集合，行内点击不重复处理开关', () => {
    expect(manage).toContain('setModelHiddenFor(mode, key, !input.checked)');
    expect(manage).toContain('setAllModelsHiddenFor(mode, rows.map((row) => modelVisibilityKey(row.model)), true)');
    expect(manage).toContain('clearHiddenModelsFor(mode)');
    expect(manage).toContain("if (!target || target.closest('label.aus-switch')) return;");
    // 模式按钮只在本次页面的分段控件里认领，避免命中对话展示管理页的同名属性
    expect(manage).not.toContain("doc.querySelectorAll('[data-manage-mode]')");
  });

  it('样式：行布局可收缩、两套窄屏断点同步、模式滑块有独立样式', () => {
    expect(cssSrc).toContain('#aus-panel .aus-model-manage-row {');
    expect(cssSrc).toContain('grid-template-columns: minmax(0, 1fr) auto auto;');
    expect(cssSrc).toContain('#aus-panel #aus-model-manage-head { flex-direction: column; align-items: stretch; gap: 10px; }');
    // 媒体与容器两套断点各出现一次
    const narrow = cssSrc.match(/#aus-panel #aus-model-manage-head \{ flex-direction: column; align-items: stretch; gap: 10px; \}/g) || [];
    expect(narrow.length).toBe(2);
    expect(cssSrc).toContain('#aus-panel .aus-model-manage-mode-thumb {');
  });
});