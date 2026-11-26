import { describe, it, expect } from 'vitest';
import {
  createJsonTree,
  jsonEntryCount,
  jsonKindOf,
  jsonNodeCount,
  jsonParseSafe,
  jsonPreviewText,
  jsonStringPreview,
} from './json-tree';

/** 极简 DOM 替身：json-tree 只用到 createElement / appendChild / 属性 / classList / 事件委托 */
class FakeNode {
  tagName: string;
  className = '';
  textContent = '';
  type = '';
  attrs = new Map<string, string>();
  children: FakeNode[] = [];
  parentNode: FakeNode | null = null;
  private listeners: Array<(ev: any) => void> = [];

  constructor(tagName: string) { this.tagName = tagName; }

  classList = {
    contains: (name: string) => this.className.split(/\s+/).filter(Boolean).includes(name),
    add: (name: string) => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean));
      set.add(name);
      this.className = Array.from(set).join(' ');
    },
    remove: (name: string) => {
      const set = new Set(this.className.split(/\s+/).filter(Boolean));
      set.delete(name);
      this.className = Array.from(set).join(' ');
    },
  };

  appendChild(child: FakeNode): FakeNode {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: FakeNode): FakeNode {
    const i = this.children.indexOf(child);
    if (i >= 0) { this.children.splice(i, 1); child.parentNode = null; }
    return child;
  }

  remove(): void { this.parentNode?.removeChild(this); }
  setAttribute(key: string, value: string): void { this.attrs.set(key, String(value)); }
  getAttribute(key: string): string | null { return this.attrs.has(key) ? this.attrs.get(key)! : null; }
  hasAttribute(key: string): boolean { return this.attrs.has(key); }
  removeAttribute(key: string): void { this.attrs.delete(key); }
  get firstChild(): FakeNode | null { return this.children[0] ?? null; }
  get lastElementChild(): FakeNode | null { return this.children.length ? this.children[this.children.length - 1] : null; }
  addEventListener(_type: string, fn: (ev: any) => void): void { this.listeners.push(fn); }
  removeEventListener(_type: string, fn: (ev: any) => void): void { this.listeners = this.listeners.filter((f) => f !== fn); }

  matches(sel: string): boolean {
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('[')) return this.hasAttribute(sel.slice(1).replace(/\]$/, '').split('=')[0]);
    return this.tagName === sel;
  }

  closest(sel: string): FakeNode | null {
    let node: FakeNode | null = this;
    while (node) { if (node.matches(sel)) return node; node = node.parentNode; }
    return null;
  }

  dispatch(ev: any): void { for (const fn of this.listeners) fn(ev); }
}

function makeDoc(): { doc: any; bodyOf: (root: HTMLElement) => FakeNode } {
  const doc: any = { createElement: (tag: string) => new FakeNode(tag) };
  return { doc, bodyOf: (root: any) => root.children[0] as FakeNode };
}

function walk(node: FakeNode, out: FakeNode[] = []): FakeNode[] {
  out.push(node);
  for (const child of node.children) walk(child, out);
  return out;
}

function rowsOf(root: any): FakeNode[] {
  return walk(root as FakeNode).filter((n) => n.classList.contains('aus-json-row'));
}

function click(body: FakeNode, target: FakeNode): void {
  body.dispatch({ type: 'click', target, preventDefault() {} });
}

describe('json-tree 纯函数', () => {
  it('识别 JSON 类型并统计条目数', () => {
    expect(jsonKindOf(null)).toBe('null');
    expect(jsonKindOf(undefined)).toBe('null');
    expect(jsonKindOf([1, 2])).toBe('array');
    expect(jsonKindOf({ a: 1 })).toBe('object');
    expect(jsonKindOf('x')).toBe('string');
    expect(jsonKindOf(1)).toBe('number');
    expect(jsonKindOf(false)).toBe('boolean');
    expect(jsonEntryCount({ a: 1, b: 2 })).toBe(2);
    expect(jsonEntryCount([1, 2, 3])).toBe(3);
    expect(jsonEntryCount('abc')).toBe(0);
  });

  it('长字符串预览带总字数，短字符串原样', () => {
    expect(jsonStringPreview('abcdef', 3)).toBe('abc…');
    expect(jsonStringPreview('ab', 3)).toBe('ab');
    expect(jsonPreviewText('a'.repeat(10), 4)).toBe('"aaaa…"（共 10 字）');
    expect(jsonPreviewText('ab', 4)).toBe('"ab"');
    expect(jsonPreviewText([1, 2])).toBe('[ 2 项 ]');
    expect(jsonPreviewText({ a: 1 })).toBe('{ 1 项 }');
    expect(jsonPreviewText(undefined)).toBe('undefined');
    expect(jsonPreviewText(12)).toBe('12');
  });

  it('递归节点数含自身，limit 生效', () => {
    expect(jsonNodeCount({ a: [1, 2], b: 'x' })).toBe(5);
    expect(jsonNodeCount({ a: [1, 2], b: 'x' }, 3)).toBe(3);
    expect(jsonNodeCount(1)).toBe(1);
  });

  it('安全解析：成功给值，失败给原因', () => {
    const ok = jsonParseSafe('{"a":1}');
    expect(ok.ok && (ok as any).value.a).toBe(1);
    const bad = jsonParseSafe('<html>');
    expect(bad.ok).toBe(false);
    expect(jsonParseSafe('   ').ok).toBe(false);
  });
});

describe('json-tree 渲染交互', () => {
  it('默认只展开根，第一层收起并可点开', () => {
    const { doc, bodyOf } = makeDoc();
    const tree = createJsonTree(doc, { a: { b: 1 }, c: 2 });
    const body = bodyOf(tree.element);
    const rows = rowsOf(tree.element);
    expect(rows.length).toBe(3);
    const rootRow = rows[0];
    expect(rootRow.parentNode).toBe(body);
    const rootKids = body.children[1] as FakeNode;
    const childRows = rows.filter((r) => r !== rootRow);
    for (const row of childRows) expect(row.parentNode).toBe(rootKids);
    expect(rootKids.hasAttribute('hidden')).toBe(false);
    const caret = rootRow.children[0] as FakeNode;
    expect(caret.textContent).toBe('▾');
    const firstChildCaret = rows[1].children[0] as FakeNode;
    expect(firstChildCaret.textContent).toBe('▸');
  });

  it('点击 caret 收起再展开，子容器同步 hidden', () => {
    const { doc, bodyOf } = makeDoc();
    const tree = createJsonTree(doc, { a: { b: 1 } }, { expandDepth: 2 });
    const body = bodyOf(tree.element);
    const rows = rowsOf(tree.element);
    const rootRow = rows[0];
    const rootCaret = rootRow.children[0] as FakeNode;
    const rootKids = rootRow.parentNode!.children[rootRow.parentNode!.children.indexOf(rootRow) + 1] as FakeNode;
    expect(rootKids.hasAttribute('hidden')).toBe(false);
    click(body, rootCaret);
    expect(rootKids.hasAttribute('hidden')).toBe(true);
    click(body, rootCaret);
    expect(rootKids.hasAttribute('hidden')).toBe(false);
  });

  it('长字符串点击后展开为全文', () => {
    const { doc, bodyOf } = makeDoc();
    const long = 'z'.repeat(500);
    const tree = createJsonTree(doc, { text: long }, { expandDepth: 2 });
    const body = bodyOf(tree.element);
    const valEl = walk(tree.element as any as FakeNode).filter((n) => n.classList.contains('aus-json-val'))
      .filter((n) => n.textContent.indexOf('共 500 字') !== -1)[0];
    expect(valEl.getAttribute('data-json-act')).toBe('expand-string');
    expect(valEl.textContent).toContain('共 500 字');
    click(body, valEl);
    expect(valEl.textContent).toBe('"' + long + '"');
    expect(valEl.getAttribute('data-json-act')).toBe(null);
  });

  it('分片渲染：先给 chunk 行，点「继续显示」补齐', () => {
    const { doc, bodyOf } = makeDoc();
    const tree = createJsonTree(doc, [1, 2, 3, 4, 5], { chunk: 2, expandDepth: 1 });
    const body = bodyOf(tree.element);
    expect(rowsOf(tree.element).length).toBe(3);
    const findMore = () => walk(tree.element as any as FakeNode).filter((n) => n.classList.contains('aus-json-more'))[0];
    expect(findMore().textContent).toBe('还有 3 项，继续显示');
    click(body, findMore());
    expect(rowsOf(tree.element).length).toBe(5);
    expect(findMore().textContent).toBe('还有 1 项，继续显示');
    click(body, findMore());
    expect(rowsOf(tree.element).length).toBe(6);
    expect(findMore()).toBe(undefined);
  });

  it('全部收起后每个容器都 hidden，rawText 给缩进 JSON', () => {
    const { doc } = makeDoc();
    const tree = createJsonTree(doc, { a: { b: 1 } }, { expandDepth: 2 });
    tree.collapseAll();
    const kids = walk(tree.element as any as FakeNode).filter((n) => n.classList.contains('aus-json-children'));
    expect(kids.length).toBe(2);
    for (const k of kids) expect(k.hasAttribute('hidden')).toBe(true);
    expect(tree.rawText()).toBe(JSON.stringify({ a: { b: 1 } }, null, 2));
    expect(tree.rowCount).toBe(3);
  });

  it('空容器显示 {} 与 []，且不可展开', () => {
    const { doc } = makeDoc();
    const tree = createJsonTree(doc, { o: {}, a: [] }, { expandDepth: 2 });
    const vals = walk(tree.element as any as FakeNode).filter((n) => n.classList.contains('aus-json-val'));
    expect(vals.map((v) => v.textContent)).toContain('{}');
    expect(vals.map((v) => v.textContent)).toContain('[]');
  });

  it('destroy 后清空节点', () => {
    const { doc } = makeDoc();
    const tree = createJsonTree(doc, [1], { expandDepth: 1 });
    tree.destroy();
    expect((tree.element as any as FakeNode).children.length).toBe(0);
    expect(tree.rowCount).toBe(0);
  });
});
