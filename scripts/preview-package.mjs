import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputArgument = process.argv[2];
const commitish = process.argv[3] ?? 'HEAD';
const archivePrefix = 'api-usage-stat';
const fixedFiles = ['manifest.json', 'README.md', 'LICENSE'];

if (!outputArgument) {
  console.error('用法：node scripts/preview-package.mjs <输出目录> [提交]');
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function readAtCommit(file) {
  return git('show', `${commit}:${file}`);
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

function readZipEntries(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 22) throw new Error('预览包长度不足以包含 ZIP 中央目录');
  const minimumEocdOffset = Math.max(0, buffer.length - 0xffff - 22);
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= minimumEocdOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error('预览包缺少 ZIP 中央目录结束记录');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
    throw new Error('预览包超出当前校验器支持的 ZIP64 范围');
  }

  const entries = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('预览包中央目录记录损坏');
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    entries.push(buffer.subarray(nameStart, nameStart + nameLength).toString('utf8'));
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return entries;
}

const commit = git('rev-parse', `${commitish}^{commit}`);
const shortCommit = commit.slice(0, 12);
const manifest = JSON.parse(readAtCommit('manifest.json'));
const version = manifest.version;

if (typeof version !== 'string' || !version.trim()) {
  throw new Error('manifest.json 缺少有效版本号');
}
if (typeof manifest.js !== 'string' || !manifest.js.trim()) {
  throw new Error('manifest.json 缺少有效入口文件');
}
if (typeof manifest.css !== 'string' || !manifest.css.trim()) {
  throw new Error('manifest.json 缺少有效样式文件');
}

const trackedFiles = new Set(git('ls-tree', '-r', '--name-only', commit).split('\n').filter(Boolean));
const reachableFiles = new Set();
const artifacts = new Set([manifest.js, manifest.css, ...fixedFiles]);
const pending = [manifest.js];

while (pending.length) {
  const file = pending.pop();
  if (!file || reachableFiles.has(file)) continue;
  reachableFiles.add(file);

  if (!trackedFiles.has(file)) throw new Error(`入口引用文件不存在于提交中：${file}`);
  for (const specifier of collectRelativeImports(readAtCommit(file))) {
    const target = posix.normalize(posix.join(posix.dirname(file), specifier));
    if (posix.isAbsolute(target) || target === '..' || target.startsWith('../')) {
      throw new Error(`${file} 引用了仓库外文件：${specifier}`);
    }
    if (!trackedFiles.has(target)) throw new Error(`${file} 引用的文件不存在于提交中：${specifier}`);
    if (target.endsWith('.js')) pending.push(target);
  }
}

for (const file of reachableFiles) artifacts.add(file);

for (const file of trackedFiles) {
  if (file.startsWith('i18n/') || file.startsWith('templates/')) artifacts.add(file);
}

const files = [...artifacts].sort();
for (const file of files) {
  if (!trackedFiles.has(file)) throw new Error(`待打包文件不存在于提交中：${file}`);
  const allowed =
    file === 'manifest.json' ||
    file === 'index.js' ||
    file === 'style.css' ||
    file === 'README.md' ||
    file === 'LICENSE' ||
    file.startsWith('i18n/') ||
    file.startsWith('templates/') ||
    /^[^/]+\.js$/.test(file);
  if (!allowed) throw new Error(`预览包包含非扩展运行文件：${file}`);
}

if (!files.includes(manifest.js) || !files.includes(manifest.css)) {
  throw new Error('预览包缺少清单声明的入口或样式文件');
}

const outputDirectory = resolve(outputArgument);
const archiveName = `api-usage-stat-preview-${version}-${shortCommit}.zip`;
const archivePath = resolve(outputDirectory, archiveName);
const checksumPath = `${archivePath}.sha256`;
mkdirSync(outputDirectory, { recursive: true });

execFileSync(
  'git',
  [
    'archive',
    '--format=zip',
    `--prefix=${archivePrefix}/`,
    `--output=${archivePath}`,
    commit,
    '--',
    ...files,
  ],
  { cwd: root, stdio: 'inherit' },
);

const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
writeFileSync(checksumPath, `${digest}  ${basename(archivePath)}\n`);

const expectedEntries = files.map((file) => `${archivePrefix}/${file}`).sort();
const allEntries = readZipEntries(archivePath).sort();
const actualFiles = allEntries.filter((entry) => !entry.endsWith('/'));
const directoryEntries = allEntries.filter((entry) => entry.endsWith('/'));

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedEntries)) {
  throw new Error(
    `预览包文件清单与 git archive 输入不一致：期望 ${expectedEntries.join('、')}；实际 ${actualFiles.join('、')}`,
  );
}
for (const directory of directoryEntries) {
  if (!expectedEntries.some((file) => file.startsWith(directory))) {
    throw new Error(`预览包包含无关目录：${directory}`);
  }
}

const recomputedDigest = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
if (recomputedDigest !== digest) throw new Error('预览包 SHA-256 复算结果不一致');
if (readFileSync(checksumPath, 'utf8') !== `${digest}  ${basename(archivePath)}\n`) {
  throw new Error('预览包校验文件内容不一致');
}

const outputs = {
  tag: `preview-${shortCommit}`,
  title: `API用量统计 预览版 v${version}（${shortCommit}）`,
  version,
  short_sha: shortCommit,
  archive: archivePath,
  checksum: checksumPath,
};

if (process.env.GITHUB_OUTPUT) {
  for (const [key, value] of Object.entries(outputs)) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

console.log('预览包生成并通过结构校验：');
console.log(`- 提交：${commit}`);
console.log(`- 版本：${version}`);
console.log(`- 标签：${outputs.tag}`);
console.log(`- 压缩包：${archivePath}`);
console.log(`- SHA-256：${digest}`);
console.log(`- 文件数：${files.length}`);
