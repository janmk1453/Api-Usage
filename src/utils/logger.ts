const PREFIX = '[DS]';
const warned = new Set<string>();
let debugOn = false;
try {
  debugOn = localStorage.getItem('ds_debug_log') === '1';
} catch {}

export const log = {
  debug(...args: unknown[]) {
    if (debugOn) console.log(PREFIX, ...args);
  },
  warn(msg: string, ...rest: unknown[]) {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn(PREFIX, msg, ...rest);
  },
  error(...args: unknown[]) {
    console.error(PREFIX, ...args);
  },
};

export function toast(type: 'success' | 'error' | 'warning' | 'info', msg: string) {
  try {
    const t: any = (window.parent as any)?.toastr ?? (window as any).toastr;
    if (t?.[type]) {
      t[type](msg);
      return;
    }
  } catch {
    log.debug('toastr 不可用: ' + msg);
  }
}
