import { icon } from './icons';
import type { IconName } from './icons';

/** 完整使用文档（线上文档站）与隐私条款锚点，全站单一定义。 */
export const HELP_DOC_URL = 'https://janmk1453.github.io/Api-Usage/';
export const HELP_PRIVACY_URL = 'https://janmk1453.github.io/Api-Usage/#privacy';

function guideCard(iconName: IconName, title: string, steps: string[]): string {
  return `<section class="ds-card aus-help-card">
      <div class="aus-help-card-head"><span class="aus-help-card-icon">${icon(iconName, 16)}</span><span class="aus-help-card-title">${title}</span></div>
      <ol class="aus-help-steps">${steps.map((text) => `<li>${text}</li>`).join('')}</ol>
    </section>`;
}

function legalList(items: string[]): string {
  return `<ul class="aus-help-legal-list">${items.map((text) => `<li>${text}</li>`).join('')}</ul>`;
}

const PRIVACY_ITEMS = [
  '扩展在酒馆里只能读到密钥条目的<strong>编号、备注与掩码末三位</strong>，仅用于区分请求来源，不会读取、保存或上传完整密钥。',
  '你保存在酒馆里的密钥是安全的，扩展无法获取真实密钥。',
  '你主动填入扩展的<strong>校准密钥</strong>是真实可用的密钥，只用于查询该钱包对应厂商的余额或套餐额度（DeepSeek、Moonshot/Kimi、硅基流动、OpenRouter、阶跃星辰、Novita、智谱 GLM、MiniMax，以及你自填的 new-api 中转），不会额外扣费或消耗。',
  '校准密钥经 XOR 混淆后存放在 SillyTavern，<strong>不进入历史记录、统计、日志、导入导出与 WebDAV</strong>。',
  '查询由浏览器直连厂商接口，不经过第三方代理；未开放跨域（CORS）的厂商会直接失败并提示，扩展不会绕过该限制。',
  'XOR 不是安全加密，请使用权限受限的密钥并自行评估风险。',
  '本扩展完整代码开源，可自行审查。',
];

const DISCLAIMER_ITEMS = [
  '「价格来源」「自动同步」用到 <a href="https://models.dev" target="_blank" rel="noreferrer">models.dev</a> 的数据，其中若出现商业化中转站，扩展不负责也不推荐；数据量太大难以完全筛净，与 models.dev 及任何中转站都没有商业往来，坚定反对商业化。',
  '「套餐额度」中的本地估算基于本扩展记录推算，不含其他设备或其他客户端的消耗，可能与实际有偏差，<strong>仅供展示参考，不参与计费、导出与云同步，不能作为账单依据</strong>；对没有公开接口或未开放跨域的厂商（Claude Code、Codex、OpenCode、GitHub Copilot、Cursor、讯飞星辰等）不提供自动查询，也不会绕过限制。',
  '界面中的厂商图标与名称商标归各自所有者，仅用于标识接入来源，不构成任何关联、合作或背书；图标数据内联自 simple-icons（CC0 发布）。',
  '会尽可能维护扩展的安全与隐私性，但不对因酒馆或本扩展的安全漏洞及间接原因导致的密钥泄露与损失负责。',
];

const GUIDES: Array<[IconName, string, string[]]> = [
  ['brand', '开始使用', [
    '在酒馆左下角打开魔法棒菜单，点「API用量统计」进入扩展面板。',
    '之后正常对话即可，扩展会自动记录每次请求。',
    '桌面用左侧栏切换页面，手机用底部标签栏切换。',
  ]],
  ['overview', '用量概览', [
    '顶部两张卡是充值余额与累计消费，余额旁的下拉可切换其它钱包。',
    '8 个数据块、Token 热力图与按对话统计都按全部历史汇总。',
    '「按对话统计」点表头可排序，右上角「管理对话」可隐藏不常看的对话。',
  ]],
  ['stats', '用量统计', [
    '用时间、模型、对话、接入类型、API 密钥五个胶囊筛选，模型可多选。',
    '三块总量、四个小块、模型汇总表与全部图表都跟随筛选。',
    '图表里可自选 Y 指标与 X 维度，Y 下拉底部可切自动 / 柱状 / 曲线 / 面积。',
    '筛选结果会记住，点「重置筛选」可回到默认范围。',
  ]],
  ['history', '历史记录', [
    '列表按时间倒序，每页 30 条，可按模型、对话、接入类型与 API 密钥筛选。',
    '点「详情」查看单条数据：请求参数、完整响应、Raw 用量与消息内容。',
    '先对较早一条点「旧」、再对较晚一条点「新」，可对比两条消息的差异。',
    '详情窗口在电脑端从右侧打开，手机端从屏幕下方弹出。',
  ]],
  ['forecast', '趋势预测', [
    '选好对话、计价模型与视界（预测未来几轮），页面给出下一轮预测、余额可撑轮数与三张趋势图。',
    '对话内出现上下文压缩时，打开「压缩情景」可看压缩后的锯齿预测。',
    '页面下方是模型效率表与对话健康评分。',
    '工具栏「管理对话」可决定本页对话胶囊里显示哪些对话。',
  ]],
  ['wallet', '钱包', [
    '扩展按接入链接自动创建钱包，DeepSeek 官方钱包始终保留。',
    '展开钱包可改名称、余额、模型价格、峰谷规则与价格来源。',
    '勾选「自动校准」并填好该钱包的校准密钥后，会按设置里的间隔自动查余额。',
    '点忽略后钱包进入「已忽略接入」，不参与合计，可在页面底部恢复显示。',
  ]],
  ['settings', '设置与数据', [
    '颜色模式、移动端兼容 UI、历史显示范围与匿名统计都在设置页顶部。',
    '「对话展示」管理对话显示，「按范围删除记录」可按日期、模型、对话删除。',
    'WebDAV 云同步可跨设备同步记录与钱包；「存储占用」里能清理旧版迁移备份。',
    '峰谷规则与「额外空闲日期」决定费用计算，默认按 DeepSeek 官方规则。',
  ]],
  ['menu', '对话展示管理', [
    '从概览「按对话统计」右上角、趋势预测工具栏或设置页「对话展示」进入，返回时回到进入前的页面。',
    '「表格展示」模式管概览统计表里显示哪些对话。',
    '「下拉选项」模式管统计页、历史页、趋势预测页「对话」下拉里的选项。',
    '支持搜索、全部显示、全部隐藏；只影响显示，不删除任何数据。',
  ]],
];

/** 使用说明页整页 HTML（内容全部静态，交互由 style.css 与原生链接承担）。 */
export function helpViewHTML(): string {
  const guides = GUIDES.map(([iconName, title, steps]) => guideCard(iconName, title, steps)).join('');
  return `
    <div id="aus-help-body">
      <a class="aus-help-hero" href="${HELP_DOC_URL}" target="_blank" rel="noreferrer">
        <span class="aus-help-hero-icon">${icon('help', 20)}</span>
        <span class="aus-help-hero-main">
          <span class="aus-help-hero-title">完整使用文档</span>
          <span class="aus-help-hero-desc">逐页说明筛选、钱包与定价、云同步和常见问题</span>
        </span>
        <span class="aus-help-hero-arrow">${icon('chevron-right', 16)}</span>
      </a>

      <div class="ds-card" id="aus-help-legal">
        <p class="aus-help-legal-notice">安装、启用或使用本扩展，即视为您已阅读、理解并同意本声明的全部内容。如不同意，请立即停止使用并卸载本扩展。</p>
        <section class="aus-help-legal-block" data-kind="privacy">
          <div class="aus-help-legal-head">
            <span class="aus-help-legal-dot"></span>
            <span class="aus-help-legal-title">隐私声明</span>
            <a class="aus-help-legal-link" href="${HELP_PRIVACY_URL}" target="_blank" rel="noreferrer">完整版${icon('chevron-right', 12)}</a>
          </div>
          ${legalList(PRIVACY_ITEMS)}
        </section>
        <section class="aus-help-legal-block" data-kind="disclaimer">
          <div class="aus-help-legal-head">
            <span class="aus-help-legal-dot"></span>
            <span class="aus-help-legal-title">免责声明</span>
            <a class="aus-help-legal-link" href="${HELP_PRIVACY_URL}" target="_blank" rel="noreferrer">完整版${icon('chevron-right', 12)}</a>
          </div>
          ${legalList(DISCLAIMER_ITEMS)}
        </section>
      </div>

      <div id="aus-help-guides">${guides}</div>

      <div class="ds-card" id="aus-help-foot">
        <div class="aus-help-foot-sec">
          <div class="aus-help-foot-title">模型兼容</div>
          <div class="aus-help-foot-text">完全兼容 DeepSeek 官方 API；其它厂商与渠道尽量兼容，部分模型可能没有缓存命中。数据异常时请携带完整请求与响应反馈。</div>
        </div>
        <div class="aus-help-foot-sec">
          <div class="aus-help-foot-title">关于</div>
          <div class="aus-help-foot-text">由原脚本 <a href="https://github.com/janmk1453/deepseek-tavern-script" target="_blank" rel="noreferrer">deepseek-tavern-script</a> 迁移重构 · <span style="color:var(--ds-text);">@janmk</span> · 仓库 <a href="https://github.com/janmk1453/Api-Usage" target="_blank" rel="noreferrer">janmk1453/Api-Usage</a></div>
        </div>
      </div>
    </div>`;
}
