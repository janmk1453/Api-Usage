import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteMigrationBackups, isMigrationBackupKey, listMigrationBackupKeys } from './persistence';

const DB_NAME = 'api_usage_stat_db';
const STORE_NAME = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: any): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function get(key: string): Promise<any> {
  const db = await openDb();
  const value = await new Promise<any>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

async function clearAll(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function installLocalStorage(entries: Record<string, string>) {
  const store = new Map(Object.entries(entries));
  const ls = {
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  return store;
}

beforeEach(async () => {
  await clearAll();
  // 每个用例都换一份干净的 localStorage（部分用例不装，验证无 localStorage 时不抛错）
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
});

describe('旧版迁移备份键名白名单', () => {
  it('只认 migration_backup_<数字时间戳>', () => {
    expect(isMigrationBackupKey('migration_backup_1792590000000')).toBe(true);
    expect(isMigrationBackupKey('migration_backup_1')).toBe(true);
  });

  it('冷历史、冷存档、畸形键名一律不认', () => {
    for (const key of [
      'cold_history',
      'cold_save-1',
      'migration_backup_',
      'migration_backup_abc',
      'migration_backup_12_x',
      'aus_migration_backup_1',
      'MIGRATION_BACKUP_1',
      'migration_backup_1 ',
      '',
    ]) {
      expect(isMigrationBackupKey(key)).toBe(false);
    }
    expect(isMigrationBackupKey(null)).toBe(false);
    expect(isMigrationBackupKey(123 as any)).toBe(false);
  });
});

describe('清理旧版迁移备份', () => {
  it('只删备份，冷历史与其它键原样保留', async () => {
    await put('cold_history', JSON.stringify([{ timestamp: 1, model: 'm' }]));
    await put('cold_old-save', JSON.stringify([{ timestamp: 2 }]));
    await put('migration_backup_1792590000000', JSON.stringify({ ds_saves: '{}' }));
    await put('migration_backup_1792590000001', JSON.stringify({ ds_settings: '{}' }));

    const result = await deleteMigrationBackups();
    expect(result.deleted).toBe(2);
    expect(result.remaining).toBe(0);
    expect(result.skipped).toEqual([]);

    // 冷历史与冷存档必须一字不动
    expect(JSON.parse(await get('cold_history'))).toEqual([{ timestamp: 1, model: 'm' }]);
    expect(await get('cold_old-save')).toBe(JSON.stringify([{ timestamp: 2 }]));
    expect(await listMigrationBackupKeys()).toEqual([]);
  });

  it('值不是字符串的备份条目视为异常数据，不删也不计数', async () => {
    await put('migration_backup_1792590000000', { weird: true } as any);
    const result = await deleteMigrationBackups();
    expect(result.deleted).toBe(0);
    expect(result.remaining).toBe(0);
    // 原始异常数据仍在库里，留给人工处理
    expect(await get('migration_backup_1792590000000')).toEqual({ weird: true });
  });

  it('没有备份时是安全的空操作', async () => {
    await put('cold_history', '[]');
    const result = await deleteMigrationBackups();
    expect(result).toMatchObject({ deleted: 0, remaining: 0 });
    expect(await get('cold_history')).toBe('[]');
  });

  it('同时清掉 localStorage 降级副本，但不动 aus_cold* 冷历史副本', async () => {
    const ls = installLocalStorage({
      aus_migration_backup_1792590000000: '{}',
      aus_cold_history: '[{"timestamp":3}]',
    });
    await put('migration_backup_1792590000000', '{}');

    await deleteMigrationBackups();
    expect(ls.has('aus_migration_backup_1792590000000')).toBe(false);
    expect(ls.get('aus_cold_history')).toBe('[{"timestamp":3}]');
  });

  it('localStorage 不可用时不影响删除', async () => {
    await put('migration_backup_1792590000000', '{}');
    const result = await deleteMigrationBackups();
    expect(result.deleted).toBe(1);
    expect(result.remaining).toBe(0);
  });
});
