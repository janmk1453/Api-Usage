import { describe, it, expect } from 'vitest';
import manifestSrc from '../../manifest.json?raw';
import indexSrc from '../index.ts?raw';
import wipeSrc from './wipe-data.ts?raw';

const manifest = JSON.parse(manifestSrc);

function onDeleteBody(): string {
  const start = indexSrc.indexOf('export async function onDelete()');
  const end = indexSrc.indexOf('export async function onClean()');
  return indexSrc.slice(start, end);
}

describe('卸载清理钩子接线', () => {
  it('清单里 clean 钩子指向 onClean，其余钩子保持不变', () => {
    expect(manifest.hooks.clean).toBe('onClean');
    expect(manifest.hooks.delete).toBe('onDelete');
    expect(manifest.hooks.disable).toBe('onDisable');
    expect(manifest.hooks.activate).toBe('onActivate');
  });

  it('入口导出 onClean，并且先收运行时再清数据', () => {
    expect(indexSrc).toContain('export async function onClean()');
    const start = indexSrc.indexOf('export async function onClean()');
    const body = indexSrc.slice(start, start + 700);
    expect(body).toContain('await teardownRuntime();');
    expect(body.indexOf('await teardownRuntime();')).toBeLessThan(body.indexOf('wipeAllExtensionData'));
    expect(body).toContain("await import('./services/wipe-data')");
  });

  it('默认卸载只清运行时，不删设置与本地数据', () => {
    const body = onDeleteBody();
    expect(body).toContain('await teardownRuntime();');
    expect(body).not.toContain('extensionSettings');
    expect(body).not.toContain('removeItem');
    expect(body).not.toContain('wipeAllExtensionData');
  });

  it('清理面覆盖设置块、数据库与本地键', () => {
    expect(wipeSrc).toContain("from '../store/persistence'");
    expect(wipeSrc).toContain('flushSaveHot()');
    expect(wipeSrc).toContain('blockPersistentWrites()');
    expect(wipeSrc).toContain('await closeDB()');
    expect(wipeSrc).toContain('deleteDatabase(DB_NAME');
    expect(wipeSrc).toContain('delete bag[MODULE_NAME]');
    expect(wipeSrc).toContain("WIPE_LOCAL_PREFIXES: readonly string[] = ['aus_']");
    // 只允许按白名单/前缀逐键删除，禁止整库清空
    expect(wipeSrc).not.toContain('localStorage.clear();');
    expect(wipeSrc).not.toContain('ls.clear(');
    expect(wipeSrc).toContain('ls.removeItem(key)');
  });
});
