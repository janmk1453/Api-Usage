/**
 * 控制台环形缓冲：只留最近若干条 error / warn 与未捕获异常，供「反馈诊断包」取证。
 *
 * 为什么需要：用户反馈「这轮对话没被记录」时，最需要的线索往往是当时控制台里的报错
 * （比如上游 401、CORS、usage 解析失败）。但这些信息在用户手机上取不到，
 * 于是扩展自己留一份很小的缓冲，用户点上传时随诊断包一起带走。
 *
 * 边界：
 * - 只在内存里，最多 CONSOLE_RING_MAX 条，不写 localStorage、不进导出；
 * - 只包 console.error / console.warn，其余级别不管，避免拖慢日志密集场景；
 * - 原 console 行为完全保留（先原文输出，再记账）；
 * - 每条文本截断到 CONSOLE_TEXT_LIMIT 字符，超长尾巴丢掉。
 */

export const CONSOLE_RING_MAX = 80;
export const CONSOLE_TEXT_LIMIT = 600;

export type ConsoleLevel = 'error' | 'warn' | 'uncaught';

export interface ConsoleEntry {
  at: number;
  level: ConsoleLevel;
  text: string;
}

let ring: ConsoleEntry[] = [];
let installed = false;

/** 把任意参数安全地转成一行文本 */
export function stringifyConsoleArgs(args: unknown[]): string {
  const parts: string[] = [];
  for (const arg of args) {
    if (arg instanceof Error) {
      parts.push(String(arg.stack || arg.message || arg));
      continue;
    }
    if (typeof arg === 'string') {
      parts.push(arg);
      continue;
    }
    try {
      parts.push(JSON.stringify(arg));
    } catch {
      parts.push(String(arg));
    }
  }
  const text = parts.join(' ');
  return text.length <= CONSOLE_TEXT_LIMIT ? text : text.slice(0, CONSOLE_TEXT_LIMIT) + '…';
}

export function noteConsole(level: ConsoleLevel, args: unknown[], at: number = Date.now()): void {
  try {
    ring.push({ at, level, text: stringifyConsoleArgs(args) });
    if (ring.length > CONSOLE_RING_MAX) ring = ring.slice(-CONSOLE_RING_MAX);
  } catch {}
}

/** 最近若干条（按时间升序，方便按发生顺序读） */
export function listConsoleEntries(limit: number = CONSOLE_RING_MAX): ConsoleEntry[] {
  if (!(limit > 0)) return [];
  return ring.slice(-limit);
}

export function clearConsoleRing(): void {
  ring = [];
}

/** 幂等安装：包一层 console.error / warn，并监听未捕获错误 */
export function installConsoleRing(): void {
  if (installed) return;
  installed = true;
  try {
    const con: any = (globalThis as any).console;
    if (con) {
      for (const level of ['error', 'warn'] as const) {
        const original = con[level];
        if (typeof original !== 'function') continue;
        con[level] = function patchedConsole(...args: unknown[]) {
          try {
            original.apply(con, args);
          } catch {}
          noteConsole(level, args);
        };
      }
    }
  } catch {}
  try {
    const win: any = (globalThis as any).window;
    win?.addEventListener?.('error', (event: any) => {
      noteConsole('uncaught', [
        event?.message || 'error',
        event?.filename ? String(event.filename).slice(-120) + ':' + event?.lineno : '',
      ]);
    });
    win?.addEventListener?.('unhandledrejection', (event: any) => {
      const reason = event?.reason;
      noteConsole('uncaught', ['unhandledrejection', reason instanceof Error ? reason.stack || reason.message : reason]);
    });
  } catch {}
}
