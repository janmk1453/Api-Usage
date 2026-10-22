/**
 * 供应商注册表（单一数据源）：厂商识别（图标）、价格目录映射、余额/套餐适配器提示共用。
 * 纯数据 + 纯函数，不依赖 DOM，可直接单测。
 */

export type VendorId =
  | 'deepseek' | 'openai' | 'anthropic' | 'google' | 'xai' | 'moonshot'
  | 'zhipu' | 'minimax' | 'mistral' | 'cohere' | 'openrouter' | 'siliconflow'
  | 'stepfun' | 'novita' | 'groq' | 'together' | 'fireworks' | 'dashscope'
  | 'volcengine' | 'baidu' | 'tencent' | 'xfyun' | 'github' | 'cursor'
  | 'openai-compatible';

export type VendorMeta = {
  id: VendorId;
  label: string;
  /** 图标底色（品牌近似色，深色主题下同样可读） */
  color: string;
  /** 单/双字符字标 */
  mark: string;
  /** 主域（子域自动匹配，如 api.deepseek.com 命中 deepseek.com） */
  hosts: string[];
  /** models.dev 目录中的 provider id（仅第一方厂商参与价格同步） */
  catalog: string | null;
  /** 模型名前缀（用于无法从地址识别时兜底） */
  modelPrefixes: string[];
};

export const VENDORS: VendorMeta[] = [
  { id: 'deepseek', label: 'DeepSeek', color: '#4D6BFE', mark: 'DS', hosts: ['deepseek.com'], catalog: 'deepseek', modelPrefixes: ['deepseek-'] },
  { id: 'openai', label: 'OpenAI', color: '#10A37F', mark: 'OA', hosts: ['openai.com', 'openai.azure.com'], catalog: 'openai', modelPrefixes: ['gpt-', 'o1', 'o3', 'o4', 'chatgpt-', 'codex-'] },
  { id: 'anthropic', label: 'Anthropic', color: '#D97757', mark: 'A', hosts: ['anthropic.com', 'claude.ai'], catalog: 'anthropic', modelPrefixes: ['claude-'] },
  { id: 'google', label: 'Google Gemini', color: '#4285F4', mark: 'G', hosts: ['googleapis.com', 'generativelanguage.googleapis.com', 'google.com'], catalog: 'google', modelPrefixes: ['gemini-', 'gemma-', 'learnlm-'] },
  { id: 'xai', label: 'xAI', color: '#111827', mark: 'X', hosts: ['x.ai'], catalog: 'xai', modelPrefixes: ['grok-'] },
  { id: 'moonshot', label: 'Moonshot / Kimi', color: '#1F1F1F', mark: 'K', hosts: ['moonshot.cn', 'moonshot.ai', 'kimi.com', 'kimi.ai'], catalog: 'moonshotai', modelPrefixes: ['kimi-', 'moonshot-'] },
  { id: 'zhipu', label: 'Z.ai / 智谱 GLM', color: '#3859FF', mark: '智', hosts: ['bigmodel.cn', 'z.ai', 'zhipuai.cn'], catalog: 'zai', modelPrefixes: ['glm-', 'zai-'] },
  { id: 'minimax', label: 'MiniMax', color: '#F23F5D', mark: 'MM', hosts: ['minimaxi.com', 'minimaxi.io', 'minimax.chat', 'minimax.io'], catalog: 'minimax', modelPrefixes: ['minimax-', 'abab', 'm2', 'hailuo'] },
  { id: 'mistral', label: 'Mistral', color: '#FF7000', mark: 'MI', hosts: ['mistral.ai'], catalog: 'mistral', modelPrefixes: ['mistral-', 'codestral-', 'pixtral-', 'magistral-', 'devstral-', 'ministral-'] },
  { id: 'cohere', label: 'Cohere', color: '#39594D', mark: 'C', hosts: ['cohere.ai', 'cohere.com'], catalog: 'cohere', modelPrefixes: ['command-', 'c4ai-', 'embed-'] },
  { id: 'openrouter', label: 'OpenRouter', color: '#6467F2', mark: 'OR', hosts: ['openrouter.ai'], catalog: null, modelPrefixes: [] },
  { id: 'siliconflow', label: '硅基流动', color: '#7C3AED', mark: '硅', hosts: ['siliconflow.cn', 'siliconflow.com'], catalog: null, modelPrefixes: [] },
  { id: 'stepfun', label: '阶跃星辰', color: '#0E7490', mark: '阶', hosts: ['stepfun.com', 'stepfun.ai'], catalog: null, modelPrefixes: ['step-'] },
  { id: 'novita', label: 'Novita', color: '#0EA5E9', mark: 'N', hosts: ['novita.ai'], catalog: null, modelPrefixes: [] },
  { id: 'groq', label: 'Groq', color: '#F55036', mark: 'GQ', hosts: ['groq.com'], catalog: null, modelPrefixes: [] },
  { id: 'together', label: 'Together', color: '#0F6FFF', mark: 'T', hosts: ['together.xyz', 'together.ai'], catalog: null, modelPrefixes: [] },
  { id: 'fireworks', label: 'Fireworks', color: '#F97316', mark: 'FW', hosts: ['fireworks.ai'], catalog: null, modelPrefixes: [] },
  { id: 'dashscope', label: '阿里云百炼 / 通义', color: '#FF6A00', mark: '通', hosts: ['aliyuncs.com', 'dashscope.aliyuncs.com', 'aliyun.com'], catalog: null, modelPrefixes: ['qwen', 'qwq-', 'qvq-'] },
  { id: 'volcengine', label: '火山方舟 / 豆包', color: '#1664FF', mark: '火', hosts: ['volces.com', 'volcengine.com', 'bytepluses.com'], catalog: null, modelPrefixes: ['doubao-', 'ep-'] },
  { id: 'baidu', label: '百度千帆 / 文心', color: '#2932E1', mark: '百', hosts: ['baidubce.com', 'baidu.com'], catalog: null, modelPrefixes: ['ernie-'] },
  { id: 'tencent', label: '腾讯混元', color: '#0052D9', mark: '混', hosts: ['tencentcloudapi.com', 'tencent.com'], catalog: null, modelPrefixes: ['hunyuan-'] },
  { id: 'xfyun', label: '讯飞星火', color: '#1F7AFF', mark: '讯', hosts: ['xf-yun.com', 'xfyun.cn'], catalog: null, modelPrefixes: ['spark-', 'generalv'] },
  { id: 'github', label: 'GitHub Models', color: '#24292F', mark: 'GH', hosts: ['githubcopilot.com', 'models.github.ai', 'github.com'], catalog: null, modelPrefixes: [] },
  { id: 'cursor', label: 'Cursor', color: '#111827', mark: 'CU', hosts: ['cursor.com', 'cursor.sh'], catalog: null, modelPrefixes: [] },
];

/** 酒馆接入类型 → 供应商 */
const SOURCE_TYPE_MAP: Record<string, VendorId> = {
  deepseek: 'deepseek',
  openai: 'openai',
  claude: 'anthropic',
  makersuite: 'google',
  vertexai: 'google',
  mistralai: 'mistral',
  xai: 'xai',
  moonshot: 'moonshot',
  zai: 'zhipu',
  minimax: 'minimax',
  cohere: 'cohere',
  groq: 'groq',
  together: 'together',
  fireworks: 'fireworks',
  dashscope: 'dashscope',
  volcengine: 'volcengine',
  baidu: 'baidu',
  hunyuan: 'tencent',
  xfyun: 'xfyun',
  openrouter: 'openrouter',
};

export function vendorById(id: string | null | undefined): VendorMeta | null {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  return VENDORS.find((vendor) => vendor.id === key) || null;
}

/** 从任意地址/标签文本中提取主机名（无协议亦可） */
export function extractHost(raw: unknown): string {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return '';
  const cleaned = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  const host = cleaned.split(':')[0].replace(/^www\./, '');
  return host.includes('.') ? host : '';
}

/** 主机名 → 供应商：要求主域精确或子域后缀匹配，避免仿冒域名误判 */
export function vendorFromHost(host: string): VendorMeta | null {
  const target = extractHost(host);
  if (!target) return null;
  let best: VendorMeta | null = null;
  let bestLength = 0;
  for (const vendor of VENDORS) {
    for (const domain of vendor.hosts) {
      if (target === domain || target.endsWith('.' + domain)) {
        if (domain.length > bestLength) {
          best = vendor;
          bestLength = domain.length;
        }
      }
    }
  }
  return best;
}

export type VendorResolveInput = {
  sourceType?: string | null;
  endpointDisplay?: string | null;
  endpointLabel?: string | null;
  endpointId?: string | null;
  models?: string[];
};

/**
 * 供应商识别四级回退：接入地址 → 接入类型 → 模型名前缀。
 * 全部失败返回 null（UI 退回单字符标识）。
 */
export function resolveVendor(input: VendorResolveInput): VendorMeta | null {
  for (const raw of [input.endpointDisplay, input.endpointLabel, input.endpointId]) {
    const vendor = vendorFromHost(String(raw ?? ''));
    if (vendor) return vendor;
  }
  const bySource = SOURCE_TYPE_MAP[String(input.sourceType || '').trim().toLowerCase()];
  if (bySource) return vendorById(bySource) || null;
  const models = (input.models || []).map((item) => String(item || '').trim().toLowerCase()).filter(Boolean);
  if (models.length) {
    const counts = new Map<VendorId, number>();
    for (const model of models) {
      for (const vendor of VENDORS) {
        if (!vendor.modelPrefixes.length) continue;
        if (vendor.modelPrefixes.some((prefix) => model.startsWith(prefix))) {
          counts.set(vendor.id, (counts.get(vendor.id) || 0) + 1);
        }
      }
    }
    let winner: VendorId | null = null;
    let winnerCount = 0;
    for (const [id, count] of counts) {
      if (count > winnerCount) {
        winner = id;
        winnerCount = count;
      }
    }
    // 至少一半模型命中同一前缀，才认为该钱包属于该厂商
    if (winner && winnerCount * 2 >= models.length) return vendorById(winner);
  }
  return null;
}

/** 未识别时的兜底字标：取名称首个有意义字符（剥离协议与 api./www. 前缀） */
export function vendorInitialFallback(name: string): string {
  const cleaned = String(name || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^api\./i, '')
    .replace(/^[^0-9a-zA-Z\u4e00-\u9fa5]+/, '');
  const first = cleaned.charAt(0);
  return first ? first.toUpperCase() : '?';
}
