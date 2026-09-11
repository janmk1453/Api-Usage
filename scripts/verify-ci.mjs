import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  } catch (error) {
    errors.push(`${file} 无法读取或解析：${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function checkVersion(label, actual, expected) {
  if (actual !== expected) errors.push(`${label} 版本不一致：期望 ${expected}，实际 ${actual ?? '缺失'}`);
}

function checkAsset(label, value) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${label} 未配置有效文件路径`);
    return null;
  }
  const fullPath = resolve(root, value);
  if (fullPath !== root && !fullPath.startsWith(root + sep)) {
    errors.push(`${label} 路径越出仓库：${value}`);
    return null;
  }
  try {
    if (!statSync(fullPath).isFile()) {
      errors.push(`${label} 不是文件：${value}`);
      return null;
    }
  } catch {
    errors.push(`${label} 文件不存在：${value}`);
    return null;
  }
  return value;
}

function collectRelativeImports(source) {
  const patterns = [
    /\bfrom\s+["'](\.\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.\/[^"']+)["']\s*\)/g,
    /\bimport\s+["'](\.\/[^"']+)["']/g,
  ];
  const result = new Set();
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) result.add(match[1]);
  }
  return result;
}

const manifest = readJson('manifest.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const expectedVersion = manifest.version;

if (!expectedVersion) errors.push('manifest.json 缺少 version');
checkVersion('package.json', pkg.version, expectedVersion);
checkVersion('package-lock.json#version', lock.version, expectedVersion);
checkVersion('package-lock.json#packages[""]', lock.packages?.['']?.version, expectedVersion);

const entry = checkAsset('manifest.json#js', manifest.js);
checkAsset('manifest.json#css', manifest.css);

if (entry) {
  const reachable = new Set();
  const pending = [entry];

  while (pending.length) {
    const file = pending.pop();
    if (!file || reachable.has(file)) continue;
    reachable.add(file);

    const fullPath = resolve(root, file);
    let source = '';
    try {
      source = readFileSync(fullPath, 'utf8');
    } catch (error) {
      errors.push(`产物无法读取：${file}（${error instanceof Error ? error.message : String(error)}）`);
      continue;
    }

    for (const specifier of collectRelativeImports(source)) {
      const target = resolve(dirname(fullPath), specifier);
      if (target !== root && !target.startsWith(root + sep)) {
        errors.push(`${file} 引用了仓库外文件：${specifier}`);
        continue;
      }
      const relativeTarget = relative(root, target).split(sep).join('/');
      try {
        if (!statSync(target).isFile()) {
          errors.push(`${file} 引用的文件不是普通文件：${specifier}`);
          continue;
        }
      } catch {
        errors.push(`${file} 引用的文件不存在：${specifier}`);
        continue;
      }
      if (extname(target) === '.js') pending.push(relativeTarget);
    }
  }

  const rootJsFiles = readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.endsWith('.js'))
    .map((item) => item.name)
    .sort();
  const orphanFiles = rootJsFiles.filter((file) => !reachable.has(file));
  if (orphanFiles.length) errors.push(`发现未被入口引用的根目录 JS 产物：${orphanFiles.join('、')}`);
}

if (errors.length) {
  console.error('CI 完整性校验失败：');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`CI 完整性校验通过：版本 ${expectedVersion}，入口与全部分包引用完整。`);
