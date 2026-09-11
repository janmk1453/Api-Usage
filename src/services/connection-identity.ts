import type { HistoryEntry } from '../types/save';

export type HistoryConnection = Pick<
  HistoryEntry,
  'sourceType' | 'endpointId' | 'endpointLabel' | 'credentialId' | 'credentialLabel'
>;

type SecretEntry = {
  id?: string;
  label?: string;
  value?: string;
  active?: boolean;
};

type SecretState = Record<string, SecretEntry[] | boolean | null | undefined>;
type SecretsModule = {
  secret_state?: SecretState;
  SECRET_KEYS?: Record<string, string>;
  readSecretState?: () => Promise<void>;
};

const FALLBACK_SECRET_KEYS: Record<string, string> = {
  OPENAI: 'api_key_openai',
  CLAUDE: 'api_key_claude',
  OPENROUTER: 'api_key_openrouter',
  AI21: 'api_key_ai21',
  MAKERSUITE: 'api_key_makersuite',
  VERTEXAI: 'api_key_vertexai',
  MISTRALAI: 'api_key_mistralai',
  CUSTOM: 'api_key_custom',
  COHERE: 'api_key_cohere',
  PERPLEXITY: 'api_key_perplexity',
  GROQ: 'api_key_groq',
  ELECTRONHUB: 'api_key_electronhub',
  NANOGPT: 'api_key_nanogpt',
  DEEPSEEK: 'api_key_deepseek',
  AIMLAPI: 'api_key_aimlapi',
  XAI: 'api_key_xai',
  MOONSHOT: 'api_key_moonshot',
  FIREWORKS: 'api_key_fireworks',
  COMETAPI: 'api_key_cometapi',
  AZURE_OPENAI: 'api_key_azure_openai',
  ZAI: 'api_key_zai',
  SILICONFLOW: 'api_key_siliconflow',
  CHUTES: 'api_key_chutes',
  POLLINATIONS: 'api_key_pollinations',
  WORKERS_AI: 'api_key_workers_ai',
  MINIMAX: 'api_key_minimax',
};

const SOURCE_SECRET_KEYS: Record<string, string> = {
  openai: 'OPENAI',
  claude: 'CLAUDE',
  openrouter: 'OPENROUTER',
  ai21: 'AI21',
  makersuite: 'MAKERSUITE',
  vertexai: 'VERTEXAI',
  mistralai: 'MISTRALAI',
  custom: 'CUSTOM',
  cohere: 'COHERE',
  perplexity: 'PERPLEXITY',
  groq: 'GROQ',
  electronhub: 'ELECTRONHUB',
  nanogpt: 'NANOGPT',
  deepseek: 'DEEPSEEK',
  aimlapi: 'AIMLAPI',
  xai: 'XAI',
  moonshot: 'MOONSHOT',
  fireworks: 'FIREWORKS',
  cometapi: 'COMETAPI',
  azure_openai: 'AZURE_OPENAI',
  zai: 'ZAI',
  siliconflow: 'SILICONFLOW',
  chutes: 'CHUTES',
  pollinations: 'POLLINATIONS',
  workers_ai: 'WORKERS_AI',
  minimax: 'MINIMAX',
};

const OFFICIAL_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek 官方',
  openai: 'OpenAI 官方',
  claude: 'Claude 官方',
  openrouter: 'OpenRouter 官方',
  groq: 'Groq 官方',
  mistralai: 'Mistral 官方',
  makersuite: 'Google AI Studio 官方',
  vertexai: 'Vertex AI 官方',
  cohere: 'Cohere 官方',
  siliconflow: 'SiliconFlow 官方',
  fireworks: 'Fireworks 官方',
  chutes: 'Chutes 官方',
  minimax: 'MiniMax 官方',
  xai: 'xAI 官方',
  zai: 'Z.AI 官方',
  moonshot: 'Moonshot 官方',
  custom: '自定义接口',
};

let secretsModulePromise: Promise<SecretsModule | null> | null = null;
let secretsModule: SecretsModule | null = null;

export function initConnectionIdentity(): Promise<void> {
  if (!secretsModulePromise) {
    const modulePath = '/scripts/secrets.js';
    secretsModulePromise = import(/* @vite-ignore */ modulePath)
      .then((mod: SecretsModule) => {
        secretsModule = mod;
        try {
          const task = mod.readSecretState?.();
          task?.catch?.(() => {});
        } catch {}
        return mod;
      })
      .catch(() => null);
  }
  return secretsModulePromise.then(() => undefined);
}

function hash32(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function shortHash(text: string): string {
  const h1 = hash32(text, 0x811c9dc5).toString(16).padStart(8, '0');
  const h2 = hash32(text, 0x9e3779b9).toString(16).padStart(8, '0');
  return h1 + h2;
}

export function officialEndpointId(sourceType: string): string {
  return shortHash(`${sourceType}|official:${sourceType}`);
}

export function normalizeEndpoint(raw: string): { canonical: string; label: string } | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : 'https://' + value;
  try {
    const url = new URL(candidate);
    const path = url.pathname.replace(/\/+$/, '');
    const host = url.hostname + (url.port ? ':' + url.port : '');
    const queryPairs: Array<[string, string]> = [];
    url.searchParams.forEach((value, key) => queryPairs.push([key, value]));
    const query = queryPairs
      .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv))
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    const base = `${url.protocol}//${host}${path}`;
    return {
      canonical: base + (query ? '?' + query : ''),
      label: host + path,
    };
  } catch {
    const fallback = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
    return fallback ? { canonical: fallback, label: fallback } : null;
  }
}

function resolveSecretKey(sourceType: string | null | undefined, secretKeys?: Record<string, string>): string | null {
  if (!sourceType) return null;
  const keyName = SOURCE_SECRET_KEYS[sourceType];
  if (!keyName) return null;
  return secretKeys?.[keyName] || FALLBACK_SECRET_KEYS[keyName] || null;
}

function findSecret(
  state: SecretState | null | undefined,
  preferredKey: string | null,
  id: string | null,
): { ownerKey: string; entry: SecretEntry } | null {
  if (!state || typeof state !== 'object') return null;
  const search = (key: string): { ownerKey: string; entry: SecretEntry } | null => {
    const list = state[key];
    if (!Array.isArray(list)) return null;
    const entry = id ? list.find((item) => item?.id === id) : list.find((item) => item?.active);
    return entry?.id ? { ownerKey: key, entry } : null;
  };
  if (preferredKey) {
    const found = search(preferredKey);
    if (found) return found;
  }
  if (id) {
    for (const key of Object.keys(state)) {
      const found = search(key);
      if (found) return found;
    }
  }
  return null;
}

function credentialLabel(entry: SecretEntry): string {
  const id = String(entry.id || '');
  const base = String(entry.label || '').trim() || `密钥 ${id.slice(0, 6).toUpperCase()}`;
  const tail = String(entry.value || '').replace(/[^a-zA-Z0-9]/g, '').slice(-3);
  return tail ? `${base} •••${tail}` : base;
}

export function buildEndpointContext(body: any): Pick<HistoryConnection, 'sourceType' | 'endpointId' | 'endpointLabel'> {
  const sourceType = typeof body?.chat_completion_source === 'string' && body.chat_completion_source.trim()
    ? body.chat_completion_source.trim()
    : null;
  const rawEndpoint = typeof body?.custom_url === 'string' && body.custom_url.trim()
    ? body.custom_url.trim()
    : (typeof body?.reverse_proxy === 'string' ? body.reverse_proxy.trim() : '');
  const endpoint = rawEndpoint ? normalizeEndpoint(rawEndpoint) : null;
  const endpointId = (sourceType || endpoint)
    ? shortHash(`${sourceType || 'unknown'}|${endpoint?.canonical || 'official:' + (sourceType || 'unknown')}`)
    : null;
  const endpointLabel = endpoint?.label || (sourceType ? OFFICIAL_LABELS[sourceType] || `${sourceType} 接口` : null);
  return { sourceType, endpointId, endpointLabel };
}

export function buildConnectionContext(
  body: any,
  secretState?: SecretState | null,
  secretKeys?: Record<string, string>,
): HistoryConnection {
  const endpoint = buildEndpointContext(body);
  const reverseProxy = typeof body?.reverse_proxy === 'string' ? body.reverse_proxy.trim() : '';
  if (reverseProxy) {
    return { ...endpoint, credentialId: null, credentialLabel: null };
  }
  const secretId = typeof body?.secret_id === 'string' && body.secret_id.trim() ? body.secret_id.trim() : null;
  const preferredKey = resolveSecretKey(endpoint.sourceType, secretKeys);
  const found = findSecret(secretState || {}, preferredKey, secretId);
  if (!found) {
    return { ...endpoint, credentialId: null, credentialLabel: null };
  }
  return {
    ...endpoint,
    credentialId: `secret:${found.ownerKey}:${found.entry.id}`,
    credentialLabel: credentialLabel(found.entry),
  };
}

export function resolveRuntimeConnectionContext(body: any): HistoryConnection {
  initConnectionIdentity();
  return buildConnectionContext(
    body,
    secretsModule?.secret_state || null,
    secretsModule?.SECRET_KEYS,
  );
}
