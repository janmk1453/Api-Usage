import { decryptKey, encryptKey } from '../utils/crypto';
import { saveExtensionSettings, getExtensionSettings } from '../store/persistence';
import { DEEPSEEK_WALLET_ID } from '../types/wallet';

const SECRETS_KEY = 'walletSecrets';

function readMap(): Record<string, string> {
  try {
    const settings: any = getExtensionSettings() || {};
    const value = settings[SECRETS_KEY];
    return value && typeof value === 'object' ? { ...value } : {};
  } catch {
    return {};
  }
}

export function getWalletApiKey(walletId: string): string {
  if (!walletId) return '';
  try {
    const encrypted = readMap()[walletId];
    return encrypted ? decryptKey(encrypted) : '';
  } catch {
    return '';
  }
}

export function saveWalletApiKey(walletId: string, key: string): void {
  if (!walletId) return;
  const settings: any = getExtensionSettings() || {};
  const map = readMap();
  const value = String(key || '').trim();
  if (value) map[walletId] = encryptKey(value);
  else delete map[walletId];
  saveExtensionSettings({ ...settings, [SECRETS_KEY]: map, _updated: Date.now() });
}

export function deleteWalletApiKey(walletId: string): void {
  saveWalletApiKey(walletId, '');
}

export function migrateLegacyWalletApiKey(walletId = DEEPSEEK_WALLET_ID): void {
  if (!walletId || getWalletApiKey(walletId)) return;
  try {
    const settings: any = getExtensionSettings() || {};
    const encrypted = settings.apiKey;
    if (!encrypted) return;
    const plain = decryptKey(encrypted);
    if (plain) saveWalletApiKey(walletId, plain);
  } catch {}
}
