/**
 * 关于页「更新日志」的唯一数据源 —— 手动维护，不写进 settings、不参与导出。
 *
 * 维护规则（模型也遵守）：
 * 1. 数组按时间倒序，最新版本在最前；关于页只展示最近 CHANGELOG_ENTRY_LIMIT 条。
 * 2. 每彻底完成一项用户可感知的「新增 / 改进 / 修复」，就在当前版本条目对应的
 *    sections 下追加一条 items 文案；同一版本只放在一个条目里，不要重复建条目。
 * 3. 版本号推进（manifest.json#version 变化）后才在数组头部新建 `ChangelogEntry`，
 *    条目 version 与新的 manifest.json#version 保持一致（可带 r 前缀）。
 * 4. 文案风格照 r3.1.7 的样子：口语、极简、一句话说完一件事，动词或名词短语开头，
 *    不加句号、不堆形容词、不自夸效果（「明显改善」「更清爽」「更跟手」一律删掉），
 *    不写文件名 / 色值 / 控件 id / commit hash，细节留给 docs.html。
 * 5. 合并同类项：同一主题的若干处改动写成一条（如深浅色模式的多处调色只写一条），
 *    一个版本每个分类通常 1～3 条、整版合计不超过 8 条 —— 宁少不多，别把提交清单搬进来。
 * 6. 只有「新增」feature、「改进」improve、「修复」fix 三种分类；没有内容就整段省略。
 */

export type ChangelogSectionKind = 'feature' | 'improve' | 'fix';

export interface ChangelogSection {
  kind: ChangelogSectionKind;
  /** 该分类下的条目文案，按重要性从高到低排列 */
  items: string[];
}

export interface ChangelogEntry {
  /** 版本号，例如 'r3.1.7'（与 manifest.json#version 对应，可带 r 前缀） */
  version: string;
  /** 更新日期，YYYY-MM-DD（北京时间） */
  date: string;
  sections: ChangelogSection[];
}

/** 关于页展示的版本条数上限 */
export const CHANGELOG_ENTRY_LIMIT = 3;

/** 更新日志（最新在前） */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'r3.1.8',
    date: '2026-10-29',
    sections: [
      {
        kind: 'feature',
        items: [
          '关于页新增更新日志',
          '新增一些动画和模糊效果',
          '新增重置筛选',
        ],
      },
      {
        kind: 'improve',
        items: [
          '移除了一些旧有设置',
          '优化深浅色模式显示效果，提高可读性',
          '图表/历史记录的输入输出和部分 UI 配色与样式对齐 DeepSeek 官网',
          '部分选项的选择现在会在刷新网页后留存',
          '调整移动端 UI',
        ],
      },
      {
        kind: 'fix',
        items: [
          '鼠标滚轮无法在图表上滚动',
          '调整细节',
          '模型占比图在大量模型时挤成一团',
        ],
      },
    ],
  },
  {
    version: 'r3.1.7',
    date: '2026-10-23',
    sections: [
      {
        kind: 'feature',
        items: [
          '重做钱包价格自动识别填充，现在可以通过选择价格来源并点击更新实现自动识别填充价格',
          '余额自动校准支持多家供应商：DeepSeek、Moonshot/Kimi、硅基流动、OpenRouter、阶跃星辰、Novita；套餐额度支持智谱 GLM、MiniMax',
          '钱包卡新增自动识别厂商官方图标',
          '钱包页新增工具栏',
          '所有统计图表底部新增视窗滑块：拖中间平移、拖两端缩放',
        ],
      },
      {
        kind: 'improve',
        items: [
          '改进钱包和统计页的部分 UI',
          '优化滚动条视觉效果',
          '在 tooltip 中显示时间和更多信息',
          '部分图表现在支持排序',
          '设置 - 储存 中现在支持清理缓存',
          '改进了很多 UI 效果，验证性的加入了少量过渡动画',
        ],
      },
      {
        kind: 'fix',
        items: [
          '修复移动端钱包页文字与按钮错位',
          '修复潜在的图表不可用问题',
          '修复无法统计思维链耗时',
        ],
      },
    ],
  },
];

/** 取最近若干个版本（默认 CHANGELOG_ENTRY_LIMIT 条） */
export function getRecentChangelog(limit: number = CHANGELOG_ENTRY_LIMIT): ChangelogEntry[] {
  const n = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : CHANGELOG_ENTRY_LIMIT;
  return CHANGELOG.slice(0, n);
}
