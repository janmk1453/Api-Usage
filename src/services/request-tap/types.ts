/**
 * 请求探针（技术验证版）—— 数据类型
 *
 * 定位：只做「旁路观察 + 事后对账」，不修改任何发送出去的请求，
 * 不参与 src/data 下的任何统计口径。记录保存在独立的 localStorage 键里，
 * 与 state.history / repository 完全隔离（验证页专用，可随时整体清空）。
 */

/** 探针识别出的后端端点类型 */
export type TapEndpointKind = 'chat' | 'text' | 'other';

/** 请求发起方判定等级：A=上下文+栈，B=仅栈，C=仅结构特征 */
export type TapAttribution = 'A' | 'B' | 'C';

/** 发起方 */
export type TapActorKind = 'plugin' | 'tavern' | 'unknown';

/** 从响应里解析出的用量 */
export interface TapUsage {
  prompt: number;
  completion: number;
  total: number;
  hit: number;
  miss: number;
}

/**
 * 对账状态：
 * - pending：已抓取，还没到对账时刻
 * - settled：现有逻辑已经记过账（说明它是常规对话请求，验证页默认不展示）
 * - orphan：现有逻辑没有记过账 —— 这才是「非常规对话请求」的候选
 */
export type TapState = 'pending' | 'settled' | 'orphan';

/** 一条探针记录（验证期结构，字段可以随时调整） */
export interface TapRecord {
  /** tap:<时间戳>:<序号>，同时作为幂等键 */
  id: string;
  /** 请求开始时刻 */
  at: number;
  /** 请求结束时刻（拿到响应或异常） */
  endedAt: number;
  url: string;
  endpoint: TapEndpointKind;
  actorKind: TapActorKind;
  /** iframe 的 src / 页面地址，用于人眼核对 */
  actorId: string;
  /** 插件名（由 iframe 路径或调用栈推得） */
  actorLabel: string;
  /** 调用栈里第一条有意义的帧 */
  stackTop: string;
  attribution: TapAttribution;
  model: string;
  /** 请求体里的 type（normal / quiet / ...），可能为空 */
  requestType: string;
  stream: boolean;
  messageCount: number;
  promptChars: number;
  /** 是否请求了结构化输出（json_schema / response_format） */
  structured: boolean;
  /** 用途聚类指纹 */
  purposeKey: string;
  /** 用途展示名（规则表命中或结构特征兜底） */
  purposeLabel: string;
  /** prompt 片段（截断，仅本地验证用） */
  promptHint: string;
  usage: TapUsage | null;
  /** 响应里没带 usage，token 不可知 */
  usageMissing: boolean;
  durationMs: number;
  ttftMs: number;
  status: number | null;
  error: string | null;
  state: TapState;
  /** 对账命中依据：requestId / tokens / total */
  settledBy: string | null;
  settledAt: number | null;
}
