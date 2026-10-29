/**
 * 关于页「更新日志」的唯一数据源 —— 手动维护，不写进 settings、不参与导出。
 *
 * 维护规则（模型也遵守）：
 * 1. 数组按时间倒序，最新版本在最前；关于页只展示最近 CHANGELOG_ENTRY_LIMIT 条。
 * 2. 每彻底完成一项用户可感知的「新增 / 改进 / 修复」，就在当前版本条目对应的
 *    sections 下追加一条 items 文案；同一版本只放在一个条目里，不要重复建条目。
 * 3. 版本号推进（manifest.json#version 变化）后才在数组头部新建 `ChangelogEntry`，
 *    条目 version 与新的 manifest.json#version 保持一致（可带 r 前缀）。
 * 4. 文案面向用户：描述「能做什么 / 修好了什么」，不写 commit hash、文件名、内部实现细节；
 *    每条一句话，句尾不加标点堆砌，具体细节放 docs.html。
 * 5. 只有「新增」feature、「改进」improve、「修复」fix 三种分类；没有内容就整段省略。
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
          '关于页新增「更新日志」块：按版本折叠展示最近几次更新的新增、改进与修复，最新版本默认展开',
        ],
      },
      {
        kind: 'improve',
        items: [
          '优化深色模式显示效果：页面更暗、块面更亮，块内正文与次要文字亮度提升，块内容的可读性明显改善',
          '深色模式下的选中态、边框、语义色（绿/红/黄）同步提亮，图表坐标轴与悬浮窗跟随新配色',
          '顶栏底色与页面背景统一，不再比内容区更亮，切换页面时视觉更连贯',
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
