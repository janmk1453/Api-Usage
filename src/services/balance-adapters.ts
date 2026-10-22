/**
 * 余额 / 套餐额度适配器。
 *
 * 只收录**浏览器可直连（CORS 放行）且已验证存在**的端点：
 *   - 余额：DeepSeek、Moonshot/Kimi、硅基流动、OpenRouter、阶跃星辰、Novita、new-api 中转
 *   - 套餐：智谱 GLM Coding Plan、MiniMax Token Plan、new-api 订阅
 * 其余厂商（OpenAI/Anthropic/Google/Mistral/Cohere/Together/Groq/Fireworks/百炼/火山/混元…）
 * 没有个人余额接口；Claude Code / Codex / OpenCode Zen / Copilot / Cursor 的套餐额度也没有公开 API，
 * 浏览器侧还存在 CORS 与 OAuth 凭据限制，一律走「手工余额 + 本地估算套餐」。
 */
import type { PlanQuotaSnapshot, WalletConfig } from '../types/wallet';
import { extractHost, vendorById, type VendorId } from './provider-registry';

export type AuthStyle = 'bearer' | 'raw' | 'bearer+user-id' | 'api-key-header';

export type ProbeFailureReason =
  | 'cors' | 'auth' | 'http' | 'network' | 'parse' | 'missing-key' | 'no-endpoint';

export type BalanceProbe = {
  adapterId: string;
  ok: boolean;
  balance?: { amount: string; currency: 'CNY' | 'USD' };
  quotas?: PlanQuotaSnapshot[];
  reason?: ProbeFailureReason;
  message?: string;
};

export type ProbeContext = {
  wallet: WalletConfig;
  apiKey: string;
  /** new-api 需要用户 ID（New-Api-User 头） */
  userId?: string;
  /** 覆盖 base（默认取钱包接入地址的主机） */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type ProviderAdapter = {
  id: string;
  label: string;
  vendor: VendorId | null;
  defaultBase: string;
  authStyle: AuthStyle;
  supports: { balance: boolean; plan: boolean };
  experimental?: boolean;
  note?: string;
  run: (ctx: ProbeContext) => Promise<BalanceProbe>;
};

function ok(adapterId: string, patch: Partial<BalanceProbe>): BalanceProbe {
  return { adapterId, ok: true, ...patch };
}

function fail(adapterId: string, reason: ProbeFailureReason, message: string): BalanceProbe {
  return { adapterId, ok: false, reason, message };
}

/** 从钱包接入地址推导 base（协议 + 主机），失败回落到适配器默认域名 */
function resolveBase(ctx: ProbeContext, fallback: string): string {
  if (ctx.baseUrl) return ctx.baseUrl.replace(/\/+$/, '');
  const raw = String(ctx.wallet.endpointDisplay || ctx.wallet.endpointLabel || '').trim();
  const host = extractHost(raw);
  if (!host) return fallback;
  const protocol = /^http:\/\//i.test(raw) ? 'http' : 'https';
  return protocol + '://' + host;
}

function authHeaders(ctx: ProbeContext, style: AuthStyle): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (style === 'bearer' || style === 'bearer+user-id') headers.Authorization = 'Bearer ' + ctx.apiKey;
  else if (style === 'raw') headers.Authorization = ctx.apiKey;
  else if (style === 'api-key-header') headers['api-key'] = ctx.apiKey;
  if (style === 'bearer+user-id' && ctx.userId) headers['New-Api-User'] = ctx.userId;
  return headers;
}

async function getJson(url: string, headers: Record<string, string>, ctx: ProbeContext, adapterId: string): Promise<any> {
  const fetchImpl = ctx.fetchImpl || fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers });
  } catch (error: any) {
    const message = String(error?.message || error);
    // 浏览器跨域失败只会抛 TypeError: Failed to fetch
    return fail(adapterId, /failed to fetch|networkerror|load failed/i.test(message) ? 'cors' : 'network', message);
  }
  if (response.status === 401 || response.status === 403) {
    return fail(adapterId, 'auth', 'HTTP ' + response.status + '：密钥或令牌无效/类型不符');
  }
  if (!response.ok) return fail(adapterId, 'http', 'HTTP ' + response.status);
  try {
    return await response.json();
  } catch {
    return fail(adapterId, 'parse', '响应不是合法 JSON');
  }
}

function isFailure(value: any): value is BalanceProbe {
  return !!value && typeof value === 'object' && 'ok' in value && 'adapterId' in value;
}

function numberFrom(value: any): number | null {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function quota(
  id: string,
  label: string,
  unit: PlanQuotaSnapshot['unit'],
  used: number | null,
  limit: number | null,
  resetAt: number | null,
  now = Date.now(),
): PlanQuotaSnapshot {
  const remaining = used != null && limit != null ? Math.max(0, limit - used) : null;
  return { id, label, unit, used, limit, remaining, resetAt, source: 'remote', checkedAt: now };
}

const deepseek: ProviderAdapter = {
  id: 'deepseek',
  label: 'DeepSeek 官方余额',
  vendor: 'deepseek',
  defaultBase: 'https://api.deepseek.com',
  authStyle: 'bearer',
  supports: { balance: true, plan: false },
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, deepseek.defaultBase) + '/user/balance', authHeaders(ctx, 'bearer'), ctx, deepseek.id);
    if (isFailure(data)) return data;
    const info = Array.isArray(data?.balance_infos) ? data.balance_infos[0] : null;
    const amount = info ? String(info.total_balance ?? '') : '';
    if (!amount) return fail(deepseek.id, 'parse', '未返回余额字段');
    const currency = String(info?.currency || '').toUpperCase() === 'USD' ? 'USD' : 'CNY';
    return ok(deepseek.id, { balance: { amount, currency } });
  },
};

const moonshot: ProviderAdapter = {
  id: 'moonshot',
  label: 'Moonshot / Kimi 余额',
  vendor: 'moonshot',
  defaultBase: 'https://api.moonshot.cn',
  authStyle: 'bearer',
  supports: { balance: true, plan: false },
  note: 'Kimi For Coding 套餐额度接口未开放跨域，只能用本地估算',
  run: async (ctx) => {
    const base = resolveBase(ctx, moonshot.defaultBase);
    const data = await getJson(base + '/v1/users/me/balance', authHeaders(ctx, 'bearer'), ctx, moonshot.id);
    if (isFailure(data)) return data;
    const body = data?.data ?? data;
    const amount = body?.available_balance ?? body?.balance;
    if (amount == null) return fail(moonshot.id, 'parse', '未返回余额字段');
    const currency = /moonshot\.ai$/.test(base) ? 'USD' : 'CNY';
    return ok(moonshot.id, { balance: { amount: String(amount), currency } });
  },
};

const siliconflow: ProviderAdapter = {
  id: 'siliconflow',
  label: '硅基流动余额',
  vendor: 'siliconflow',
  defaultBase: 'https://api.siliconflow.cn',
  authStyle: 'bearer',
  supports: { balance: true, plan: false },
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, siliconflow.defaultBase) + '/v1/user/info', authHeaders(ctx, 'bearer'), ctx, siliconflow.id);
    if (isFailure(data)) return data;
    const body = data?.data ?? data;
    const amount = body?.totalBalance ?? body?.balance ?? body?.chargeBalance;
    if (amount == null) return fail(siliconflow.id, 'parse', '未返回余额字段');
    return ok(siliconflow.id, { balance: { amount: String(amount), currency: 'CNY' } });
  },
};

const openrouter: ProviderAdapter = {
  id: 'openrouter',
  label: 'OpenRouter 额度',
  vendor: 'openrouter',
  defaultBase: 'https://openrouter.ai',
  authStyle: 'bearer',
  supports: { balance: true, plan: false },
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, openrouter.defaultBase) + '/api/v1/credits', authHeaders(ctx, 'bearer'), ctx, openrouter.id);
    if (isFailure(data)) return data;
    const body = data?.data ?? data;
    const total = numberFrom(body?.total_credits);
    const usage = numberFrom(body?.total_usage);
    if (total == null || usage == null) return fail(openrouter.id, 'parse', '未返回 credits 字段');
    const amount = Math.max(0, total - usage);
    return ok(openrouter.id, { balance: { amount: amount.toFixed(4), currency: 'USD' } });
  },
};

const stepfun: ProviderAdapter = {
  id: 'stepfun',
  label: '阶跃星辰余额',
  vendor: 'stepfun',
  defaultBase: 'https://api.stepfun.com',
  authStyle: 'bearer',
  supports: { balance: true, plan: false },
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, stepfun.defaultBase) + '/v1/accounts', authHeaders(ctx, 'bearer'), ctx, stepfun.id);
    if (isFailure(data)) return data;
    const body = data?.data ?? data;
    const amount = body?.balance ?? body?.available_balance ?? body?.total_balance;
    if (amount == null) return fail(stepfun.id, 'parse', '未返回余额字段');
    return ok(stepfun.id, { balance: { amount: String(amount), currency: 'CNY' } });
  },
};

const novita: ProviderAdapter = {
  id: 'novita',
  label: 'Novita 余额',
  vendor: 'novita',
  defaultBase: 'https://api.novita.ai',
  authStyle: 'api-key-header',
  supports: { balance: true, plan: false },
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, novita.defaultBase) + '/v3/user/balance', authHeaders(ctx, 'api-key-header'), ctx, novita.id);
    if (isFailure(data)) return data;
    const amount = data?.availableBalance ?? data?.balance ?? data?.data?.balance;
    if (amount == null) return fail(novita.id, 'parse', '未返回余额字段');
    return ok(novita.id, { balance: { amount: String(amount), currency: 'USD' } });
  },
};

/** 智谱 GLM Coding Plan：返回 5 小时 + 每周两个 TOKENS_LIMIT（按重置时间升序） */
const zhipu: ProviderAdapter = {
  id: 'zhipu',
  label: '智谱 GLM 套餐额度',
  vendor: 'zhipu',
  defaultBase: 'https://open.bigmodel.cn',
  authStyle: 'raw',
  supports: { balance: false, plan: true },
  note: '鉴权用裸 API Key（不加 Bearer 前缀）',
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, zhipu.defaultBase) + '/api/monitor/usage/quota/limit', authHeaders(ctx, 'raw'), ctx, zhipu.id);
    if (isFailure(data)) return data;
    if (data?.success === false) return fail(zhipu.id, 'auth', String(data?.msg || '查询失败'));
    const limits = Array.isArray(data?.data?.limits) ? data.data.limits : [];
    const tokens = limits
      .filter((item: any) => item && item.type === 'TOKENS_LIMIT')
      .sort((a: any, b: any) => Number(a.nextResetTime || 0) - Number(b.nextResetTime || 0));
    const quotas: PlanQuotaSnapshot[] = [];
    tokens.forEach((item: any, index: number) => {
      const used = numberFrom(item.percentage);
      const resetAt = numberFrom(item.nextResetTime);
      quotas.push(quota(index === 0 ? '5h' : index === 1 ? '7d' : 'w' + (index + 1),
        index === 0 ? '5 小时额度' : index === 1 ? '每周额度' : '额度 ' + (index + 1),
        'percent', used, 100, resetAt));
    });
    if (!quotas.length) return fail(zhipu.id, 'parse', '未返回额度窗口');
    return ok(zhipu.id, { quotas });
  },
};

/** MiniMax Token Plan：注意 current_interval_usage_count 语义是**剩余** */
const minimax: ProviderAdapter = {
  id: 'minimax',
  label: 'MiniMax 套餐额度',
  vendor: 'minimax',
  defaultBase: 'https://api.minimaxi.com',
  authStyle: 'bearer',
  supports: { balance: false, plan: true },
  experimental: true,
  note: '返回字段为「剩余次数」，已按剩余语义换算',
  run: async (ctx) => {
    const data = await getJson(resolveBase(ctx, minimax.defaultBase) + '/v1/api/openplatform/coding_plan/remains', authHeaders(ctx, 'bearer'), ctx, minimax.id);
    if (isFailure(data)) return data;
    const body = data?.data ?? data;
    const quotas: PlanQuotaSnapshot[] = [];
    const push = (id: string, label: string, usedCount: any, totalCount: any, resetAt: any, remainingCount?: any) => {
      const total = numberFrom(totalCount);
      const remainingRaw = numberFrom(remainingCount);
      const used = numberFrom(usedCount);
      if (total == null && remainingRaw == null) return;
      const remaining = remainingRaw != null ? remainingRaw : (total != null && used != null ? total - used : null);
      quotas.push({
        id, label, unit: 'count',
        used: total != null && remaining != null ? Math.max(0, total - remaining) : used,
        limit: total,
        remaining,
        resetAt: numberFrom(resetAt),
        source: 'remote',
        checkedAt: Date.now(),
      });
    };
    const entry = Array.isArray(body?.model_remains) ? body.model_remains[0] : body;
    push('5h', '5 小时额度',
      entry?.current_interval_total_count, entry?.current_interval_total_count,
      entry?.current_interval_reset_at ?? entry?.current_interval_end_time,
      entry?.current_interval_usage_count);
    push('7d', '每周额度',
      entry?.current_weekly_total_count, entry?.current_weekly_total_count,
      entry?.current_weekly_reset_at ?? entry?.current_weekly_end_time,
      entry?.current_weekly_usage_count);
    if (!quotas.length) return fail(minimax.id, 'parse', '未返回额度字段');
    return ok(minimax.id, { quotas });
  },
};

/** new-api / one-api 中转：订阅额度 − 已用 */
const newApi: ProviderAdapter = {
  id: 'new-api',
  label: 'new-api / one-api 中转额度',
  vendor: null,
  defaultBase: '',
  authStyle: 'bearer+user-id',
  supports: { balance: true, plan: true },
  experimental: true,
  note: '需填系统访问令牌（不是 sk- API Key）与用户 ID',
  run: async (ctx) => {
    const base = resolveBase(ctx, '');
    if (!base) return fail(newApi.id, 'no-endpoint', '钱包没有可用接入地址');
    const headers = authHeaders(ctx, 'bearer+user-id');
    const subscription = await getJson(base + '/dashboard/billing/subscription', headers, ctx, newApi.id);
    if (isFailure(subscription)) return subscription;
    const hard = numberFrom(subscription?.hard_limit_usd ?? subscription?.system_hard_limit_usd ?? subscription?.soft_limit_usd);
    const usage = await getJson(base + '/dashboard/billing/usage', headers, ctx, newApi.id);
    const totalUsage = isFailure(usage) ? null : numberFrom(usage?.total_usage);
    if (hard == null && totalUsage == null) return fail(newApi.id, 'parse', '未返回额度字段');
    const usedUsd = totalUsage != null ? totalUsage / 100 : 0;
    const amount = hard != null ? Math.max(0, hard - usedUsd) : null;
    const quotas: PlanQuotaSnapshot[] = hard != null
      ? [quota('1m', '订阅额度（累计）', 'cost', usedUsd, hard, Number(subscription?.access_until) || null)]
      : [];
    return ok(newApi.id, {
      balance: amount != null ? { amount: amount.toFixed(4), currency: 'USD' } : undefined,
      quotas,
    });
  },
};

export const BALANCE_ADAPTERS: ProviderAdapter[] = [
  deepseek, moonshot, siliconflow, openrouter, stepfun, novita, zhipu, minimax, newApi,
];

export function adapterById(id: string | null | undefined): ProviderAdapter | null {
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  return BALANCE_ADAPTERS.find((adapter) => adapter.id === key) || null;
}

const VENDOR_ADAPTER: Partial<Record<VendorId, string>> = {
  deepseek: 'deepseek',
  moonshot: 'moonshot',
  siliconflow: 'siliconflow',
  openrouter: 'openrouter',
  stepfun: 'stepfun',
  novita: 'novita',
  zhipu: 'zhipu',
  minimax: 'minimax',
};

/**
 * 钱包 → 适配器：显式指定优先；否则只对**已知官方域名**自动识别，
 * 未知中转站不猜（避免向用户站点发莫名其妙的请求），需在 UI 手动选 new-api。
 */
export function resolveBalanceAdapter(wallet: WalletConfig | null | undefined): ProviderAdapter | null {
  if (!wallet) return null;
  const explicit = adapterById(wallet.balance?.adapter || '');
  if (explicit) return explicit;
  const host = extractHost(wallet.endpointDisplay || wallet.endpointLabel || '');
  const byHost = host ? BALANCE_ADAPTERS.find((adapter) => adapter.vendor && adapter.vendor === vendorById(adapter.vendor)?.id
    && (vendorById(adapter.vendor)?.hosts || []).some((domain) => host === domain || host.endsWith('.' + domain))) : null;
  if (byHost) return byHost;
  const byVendor = VENDOR_ADAPTER[(wallet.catalogProvider || '') as VendorId];
  if (byVendor && wallet.kind === 'official') return adapterById(byVendor);
  return null;
}

/** 支持自动查询的钱包（余额或套餐任一） */
export function walletSupportsAutoQuery(wallet: WalletConfig): boolean {
  const adapter = resolveBalanceAdapter(wallet);
  if (!adapter) return false;
  return adapter.supports.balance || adapter.supports.plan;
}

export async function probeWallet(wallet: WalletConfig, apiKey: string, opts: { userId?: string; fetchImpl?: typeof fetch } = {}): Promise<BalanceProbe | null> {
  const adapter = resolveBalanceAdapter(wallet);
  if (!adapter) return null;
  if (!apiKey) return fail(adapter.id, 'missing-key', '请先填写该钱包的查询密钥');
  try {
    return await adapter.run({ wallet, apiKey, userId: opts.userId, fetchImpl: opts.fetchImpl });
  } catch (error: any) {
    return fail(adapter.id, 'network', String(error?.message || error));
  }
}
