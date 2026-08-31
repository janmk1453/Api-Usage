// XOR+b64 保持与脚本 1:1（DeepSeek使用预测.js:1095-1119）
const XOR_KEY = 'ds-stats-v1-xor-key!@#$%^&*';

export function encryptKey(plaintext: string): string {
  if (!plaintext) return '';
  try {
    const utf8 = unescape(encodeURIComponent(plaintext));
    let result = '';
    for (let i = 0; i < utf8.length; i++) {
      result += String.fromCharCode(utf8.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return btoa(result);
  } catch {
    // 降级：原始逻辑（不应发生）
    let result = '';
    for (let i = 0; i < plaintext.length; i++) {
      result += String.fromCharCode(plaintext.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    try { return btoa(result); } catch { return ''; }
  }
}

export function decryptKey(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const decoded = atob(ciphertext);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    try { return decodeURIComponent(escape(result)); } catch { return result; }
  } catch {
    return ciphertext;
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return '****' + key.slice(-4);
}
