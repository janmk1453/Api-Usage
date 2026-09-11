import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputArgument = process.argv[2];
const commitish = process.argv[3] ?? 'HEAD';

if (!outputArgument) {
  console.error('用法：node scripts/preview-notes.mjs <输出文件> [提交]');
  process.exit(2);
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function tryGit(...args) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveRepository() {
  const environmentRepository = process.env.GITHUB_REPOSITORY?.trim();
  if (environmentRepository) return environmentRepository;

  const remote = tryGit('remote', 'get-url', 'origin');
  const normalized = remote
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '');
  if (/^[^/]+\/[^/]+$/.test(normalized)) return normalized;

  throw new Error('无法确定 GitHub 仓库，请设置 GITHUB_REPOSITORY 或配置 origin');
}

function describeTag(pattern, revision) {
  return tryGit(
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    pattern,
    revision,
  );
}

const commit = git('rev-parse', `${commitish}^{commit}`);
const shortCommit = commit.slice(0, 12);
const manifest = JSON.parse(git('show', `${commit}:manifest.json`));
const version = manifest.version;
if (typeof version !== 'string' || !version.trim()) {
  throw new Error('manifest.json 缺少有效版本号');
}

const repository = resolveRepository();
const serverUrl = (process.env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/$/, '');
const branch = process.env.GITHUB_REF_NAME?.trim() || tryGit('branch', '--show-current') || 'main';
const runId = process.env.GITHUB_RUN_ID?.trim() || '';
const previousPreviewTag = describeTag('preview-*', `${commit}^`);
const previousReleaseTag = previousPreviewTag ? '' : describeTag('v[0-9]*', `${commit}^`);

let commitRange;
let rangeLabel;
if (previousPreviewTag) {
  commitRange = `${previousPreviewTag}..${commit}`;
  rangeLabel = `自上次预览 \`${previousPreviewTag}\``;
} else if (previousReleaseTag) {
  commitRange = `${previousReleaseTag}..${commit}`;
  rangeLabel = `自上个正式版本 \`${previousReleaseTag}\``;
} else {
  commitRange = `${commit}^!`;
  rangeLabel = '首个预览构建';
}

const commits = git('log', '--reverse', '--format=%H%x09%s', commitRange)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const separator = line.indexOf('\t');
    const hash = separator === -1 ? line : line.slice(0, separator);
    const subject = separator === -1 ? '' : line.slice(separator + 1);
    return {
      hash,
      shortHash: hash.slice(0, 12),
      subject: subject || '（无提交说明）',
    };
  });

if (!commits.length) throw new Error(`提交区间没有可记录的提交：${commitRange}`);

const lines = [
  '## 预览构建',
  '',
  `- 提交：\`${commit}\``,
  `- 分支：\`${branch}\``,
  `- 清单版本：\`${version}\``,
];

if (runId) {
  lines.push(`- 工作流：[查看 Actions 运行](${serverUrl}/${repository}/actions/runs/${runId})`);
} else {
  lines.push('- 工作流：本地生成');
}

lines.push(
  `- 变更范围：${rangeLabel}`,
  `- 提交数：\`${commits.length}\``,
  '',
  '### 更新日志',
  '',
);

for (const commitEntry of commits) {
  lines.push(
    `- [\`${commitEntry.shortHash}\`](${serverUrl}/${repository}/commit/${commitEntry.hash}) ${commitEntry.subject}`,
  );
}

const outputPath = resolve(outputArgument);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${lines.join('\n')}\n`);

console.log('预览更新日志生成完成：');
console.log(`- 提交：${commit}`);
console.log(`- 范围：${rangeLabel}`);
console.log(`- 提交数：${commits.length}`);
console.log(`- 文件：${outputPath}`);
