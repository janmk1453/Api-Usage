/**
 * 可折叠 JSON 树查看器（历史详情专用）。
 *
 * 为什么不用 <pre> 直接塞 JSON.stringify：完整请求体动辄几百 KB、几万个键，
 * 一次性生成整棵 DOM 会把面板卡死。这里按「一个节点 = 一行」渲染，
 * 子节点只在第一次展开时创建，单次最多创建 chunk 行，剩下的用「继续显示」续上。
 *
 * 纯函数（jsonKindOf / jsonPreviewText / jsonNodeCount / jsonParseSafe）与 DOM 渲染分开导出，
 * 前者可在 node 环境直接测，后者只依赖传入的 document。
 */

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

/** 字符串预览长度：超过就折叠成「前 N 字…（共 M 字）」 */
export const JSON_STRING_PREVIEW = 400;
/** 单次渲染行数上限：展开大数组时先渲染这么多，其余点「继续显示」 */
export const JSON_CHUNK = 2000;
/** 整棵树的行数硬上限，防止极端响应把内存吃光 */
export const JSON_MAX_ROWS = 200000;
/** 递归深度硬上限（JSON.parse 的产物不会循环，但活对象可能） */
export const JSON_MAX_DEPTH = 64;

export function jsonKindOf(v: unknown): JsonKind {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'object') return 'object';
  if (t === 'boolean') return 'boolean';
  if (t === 'number') return 'number';
  if (t === 'string') return 'string';
  // bigint / symbol / function 一律按文本兜底
  return 'string';
}

export function jsonEntryCount(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v as Record<string, unknown>).length;
  return 0;
}

export function jsonStringPreview(text: string, max: number = JSON_STRING_PREVIEW): string {
  const s = typeof text === 'string' ? text : String(text ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

/** 行内展示用的单行文本：容器给概览，原始值给文本 */
export function jsonPreviewText(v: unknown, max: number = JSON_STRING_PREVIEW): string {
  const kind = jsonKindOf(v);
  if (kind === 'array') return '[ ' + jsonEntryCount(v) + ' 项 ]';
  if (kind === 'object') return '{ ' + jsonEntryCount(v) + ' 项 }';
  if (v === undefined) return 'undefined';
  if (kind === 'string') {
    const full = String(v);
    const shown = jsonStringPreview(full, max);
    return shown.length === full.length ? '"' + full + '"' : '"' + shown + '"（共 ' + full.length + ' 字）';
  }
  return String(v);
}

/** 递归节点总数（含自身），到 limit 即停，避免在超大对象上白跑 */
export function jsonNodeCount(v: unknown, limit: number = JSON_MAX_ROWS): number {
  let n = 0;
  const walk = (node: unknown, depth: number): void => {
    if (n >= limit) return;
    n += 1;
    if (depth >= JSON_MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (const item of node) { if (n >= limit) return; walk(item, depth + 1); }
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const key of Object.keys(obj)) { if (n >= limit) return; walk(obj[key], depth + 1); }
    }
  };
  walk(v, 0);
  return n;
}

export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

/** 安全解析：失败时把原因交回去，调用方负责退回原文展示 */
export function jsonParseSafe(text: string): JsonParseResult {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { ok: false, error: '空内容' };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: String((e as any)?.message || e) };
  }
}

interface TreeFrame {
  row: HTMLElement;
  kids: HTMLElement | null;
  caret: HTMLElement | null;
  value: unknown;
  keys: string[] | null;
  parent: TreeFrame | null;
  depth: number;
  index: number;
  expanded: boolean;
  built: number;
  total: number;
  more: HTMLElement | null;
}

export interface JsonTreeOptions {
  /** 初始展开深度：0 = 全收起，1 = 只展开根，2 = 再展开第一层（默认 1） */
  expandDepth?: number;
  /** 单次渲染行数 */
  chunk?: number;
  /** 字符串预览长度 */
  stringPreview?: number;
  /** 整棵树行数上限 */
  maxRows?: number;
}

export interface JsonTreeHandle {
  readonly element: HTMLElement;
  /** 已渲染的行数（懒加载，会随展开增长） */
  readonly rowCount: number;
  expandAll(): void;
  collapseAll(): void;
  setExpandDepth(depth: number): void;
  /** 值的 JSON 文本（缩进 2），供复制 / 下载 */
  rawText(): string;
  destroy(): void;
}

export function createJsonTree(doc: Document, value: unknown, options: JsonTreeOptions = {}): JsonTreeHandle {
  const chunk = Math.max(1, Math.floor(options.chunk ?? JSON_CHUNK));
  const strMax = Math.max(20, Math.floor(options.stringPreview ?? JSON_STRING_PREVIEW));
  const maxRows = Math.max(chunk, Math.floor(options.maxRows ?? JSON_MAX_ROWS));
  let expandDepth = Math.max(0, Math.floor(options.expandDepth ?? 1));

  const root = doc.createElement('div');
  root.className = 'aus-json';
  const body = doc.createElement('div');
  body.className = 'aus-json-body';
  body.setAttribute('role', 'tree');
  root.appendChild(body);

  const frames: TreeFrame[] = [];
  let disposed = false;

  const isContainer = (v: unknown): boolean => {
    const k = jsonKindOf(v);
    return k === 'object' || k === 'array';
  };
  const keysOf = (v: unknown): string[] | null => (Array.isArray(v) ? null : Object.keys(v as Record<string, unknown>));
  const childAt = (f: TreeFrame, i: number): unknown => (Array.isArray(f.value) ? (f.value as unknown[])[i] : (f.value as Record<string, unknown>)[f.keys![i]]);

  function makeNode(label: string | null, v: unknown, parent: TreeFrame | null, expandNow: boolean): TreeFrame | null {
    if (disposed || frames.length >= maxRows) return null;
    const depth = parent ? parent.depth + 1 : 0;
    const kind = jsonKindOf(v);
    const container = isContainer(v);
    const row = doc.createElement('div');
    row.className = 'aus-json-row';
    row.setAttribute('data-kind', kind);
    const idx = frames.length;
    row.setAttribute('data-frame', String(idx));

    let caret: HTMLElement | null = null;
    if (container) {
      const caretBtn = doc.createElement('button');
      caretBtn.type = 'button';
      caretBtn.className = 'aus-json-caret';
      caretBtn.setAttribute('data-json-act', 'toggle');
      caretBtn.setAttribute('data-frame', String(idx));
      caretBtn.setAttribute('aria-expanded', 'false');
      caretBtn.setAttribute('aria-label', '展开或收起');
      caretBtn.textContent = '\u25B8';
      caret = caretBtn;
      row.appendChild(caretBtn);
    } else {
      const pad = doc.createElement('span');
      pad.className = 'aus-json-caret aus-json-pad';
      row.appendChild(pad);
    }

    if (label !== null) {
      const keyEl = doc.createElement('span');
      keyEl.className = 'aus-json-key';
      keyEl.textContent = label;
      row.appendChild(keyEl);
      const sep = doc.createElement('span');
      sep.className = 'aus-json-sep';
      sep.textContent = ':';
      row.appendChild(sep);
    }

    const valEl = doc.createElement('span');
    valEl.className = 'aus-json-val';
    const fullText = kind === 'string' ? String(v) : '';
    const longStr = kind === 'string' && fullText.length > strMax;
    valEl.textContent = kind === 'string'
      ? jsonPreviewText(v, strMax)
      : (container ? (kind === 'array' ? '[' : '{') : jsonPreviewText(v, strMax));
    if (longStr) {
      valEl.setAttribute('data-json-act', 'expand-string');
      valEl.setAttribute('data-frame', String(idx));
      valEl.setAttribute('title', '点击查看完整字符串');
    }
    row.appendChild(valEl);

    const host = parent && parent.kids ? parent.kids : body;
    host.appendChild(row);

    const frame: TreeFrame = {
      row, kids: null, caret, value: v, keys: null, parent, depth, index: idx,
      expanded: false, built: 0, total: 0, more: null,
    };
    frames.push(frame);

    if (container) {
      frame.keys = keysOf(v);
      frame.total = jsonEntryCount(v);
      const kids = doc.createElement('div');
      kids.className = 'aus-json-children';
      kids.setAttribute('hidden', '');
      host.appendChild(kids);
      frame.kids = kids;
      if (frame.total === 0) {
        valEl.textContent = kind === 'array' ? '[]' : '{}';
        if (caret) { caret.setAttribute('disabled', ''); caret.textContent = '\u00B7'; }
      } else if (expandNow) {
        setExpanded(frame, true);
      } else {
        valEl.textContent = jsonPreviewText(v, strMax);
      }
    }
    return frame;
  }

  function updateMore(f: TreeFrame): void {
    if (!f.kids) return;
    const rest = f.total - f.built;
    if (rest <= 0) {
      if (f.more) { f.more.remove(); f.more = null; }
      return;
    }
    if (!f.more) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'aus-json-more';
      btn.setAttribute('data-json-act', 'more');
      btn.setAttribute('data-frame', String(f.index));
      f.kids.appendChild(btn);
      f.more = btn;
    }
    f.more.textContent = '还有 ' + rest + ' 项，继续显示';
  }

  function fillMore(f: TreeFrame): void {
    if (!f.kids || f.built >= f.total) { updateMore(f); return; }
    const limit = Math.min(f.total, f.built + chunk);
    while (f.built < limit && frames.length < maxRows) {
      const i = f.built;
      const label = f.keys ? f.keys[i] : String(i);
      const child = makeNode(label, childAt(f, i), f, f.depth + 1 < expandDepth);
      if (!child) break;
      f.built += 1;
    }
    updateMore(f);
  }

  function setExpanded(f: TreeFrame, on: boolean): void {
    if (!f.kids || f.total === 0) return;
    const valEl = f.row.lastElementChild as HTMLElement | null;
    if (on) {
      if (f.expanded) { fillMore(f); return; }
      f.expanded = true;
      f.kids.removeAttribute('hidden');
      if (f.caret) { f.caret.textContent = '\u25BE'; f.caret.setAttribute('aria-expanded', 'true'); }
      if (valEl && valEl.classList.contains('aus-json-val')) {
        valEl.textContent = jsonKindOf(f.value) === 'array' ? '[' : '{';
      }
      fillMore(f);
    } else {
      f.expanded = false;
      f.kids.setAttribute('hidden', '');
      if (f.caret) { f.caret.textContent = '\u25B8'; f.caret.setAttribute('aria-expanded', 'false'); }
      if (valEl && valEl.classList.contains('aus-json-val')) {
        valEl.textContent = jsonPreviewText(f.value, strMax);
      }
    }
  }

  const onClick = (ev: Event): void => {
    if (disposed) return;
    const target = ev.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const actEl = target.closest('[data-json-act]') as HTMLElement | null;
    if (!actEl) return;
    const idx = Number(actEl.getAttribute('data-frame'));
    const frame = Number.isFinite(idx) ? frames[idx] : null;
    if (!frame) return;
    const act = actEl.getAttribute('data-json-act');
    if (act === 'toggle' || act === 'more') {
      ev.preventDefault();
      if (act === 'more') fillMore(frame);
      else setExpanded(frame, !frame.expanded);
      return;
    }
    if (act === 'expand-string') {
      ev.preventDefault();
      actEl.textContent = '"' + String(frame.value) + '"';
      actEl.removeAttribute('data-json-act');
      actEl.removeAttribute('title');
      actEl.classList.add('aus-json-str-full');
    }
  };
  body.addEventListener('click', onClick);

  makeNode(null, value, null, expandDepth >= 1);

  const handle: JsonTreeHandle = {
    element: root,
    get rowCount() { return frames.length; },
    expandAll() {
      let budget = maxRows;
      const stack: TreeFrame[] = [frames[0]].filter(Boolean) as TreeFrame[];
      while (stack.length && budget > 0) {
        const f = stack.pop() as TreeFrame;
        if (!f.kids || f.total === 0) continue;
        setExpanded(f, true);
        while (f.built < f.total && budget > 0) {
          const before = frames.length;
          fillMore(f);
          budget -= Math.max(1, frames.length - before);
        }
        for (let i = frames.length - 1; i >= 0; i -= 1) {
          const child = frames[i];
          if (child.parent === f && child.kids && child.total > 0 && !child.expanded) stack.push(child);
        }
      }
    },
    collapseAll() {
      for (let i = frames.length - 1; i >= 0; i -= 1) setExpanded(frames[i], false);
    },
    setExpandDepth(depth: number) {
      expandDepth = Math.max(0, Math.floor(depth));
      for (let i = frames.length - 1; i >= 0; i -= 1) {
        const f = frames[i];
        if (f.kids && f.total > 0) setExpanded(f, f.depth < expandDepth);
      }
    },
    rawText() {
      try { return JSON.stringify(value, null, 2) ?? String(value); } catch { return String(value); }
    },
    destroy() {
      disposed = true;
      try { body.removeEventListener('click', onClick); } catch {}
      frames.length = 0;
      try { while (root.firstChild) root.removeChild(root.firstChild); } catch {}
    },
  };
  return handle;
}
