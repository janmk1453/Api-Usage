// XOR+b64 保持与脚本 1:1（DeepSeek使用预测.js:1095-1119）
const XOR_KEY = 'ds-stats-v1-xor-key!@#$%^&*';

export function encryptKey(plaintext: string): string {
  if (!plaintext) return '';
  let result = '';
  for (let i = 0; i < plaintext.length; i++) {
    result += String.fromCharCode(plaintext.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
  }
  return btoa(result);
}

export function decryptKey(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const decoded = atob(ciphertext);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return result;
  } catch {
    return ciphertext;
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return '****' + key.slice(-4);
}
