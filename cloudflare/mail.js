/**
 * 邮件通知：问题反馈提醒与每日总结（Cloudflare Email Service）
 *
 * 约束：
 * - Workers 免费版只有 10ms CPU：模板全部是短字符串拼接，数字格式化手写，不依赖 Intl；
 * - 发信优先走 send_email 绑定（平台内部授权，不用 API token），没有绑定时才回退 REST；
 * - 发送失败只返回结果、绝不抛出，调用方用 ctx.waitUntil 包起来即可；
 * - 邮件里的所有外部字符串一律转义后再进 HTML，避免反馈内容里的尖括号破坏版面。
 */
import { BEIJING_OFFSET_MS } from './summary.js';

/** 邮件品牌前缀，主题里统一带上，便于邮箱过滤 */
export const MAIL_BRAND = 'API用量统计';

/** 默认收件人与发件人（可在 wrangler.toml 的 vars 里覆盖） */
export const MAIL_TO_DEFAULT = '2855564331@qq.com';
export const MAIL_FROM_DEFAULT = 'noreply@janmk.us.ci';
/** 看板默认地址（发送失败只影响邮件里的链接，不影响正文数字） */
export const PANEL_URL_DEFAULT = 'https://stat.janmk.us.ci/dashboard';
/** 邮件主题与正文的截断上限，防止异常输入撑大模板 */
const MAX_SUBJECT_CHARS = 120;
const MAX_NOTE_CHARS = 400;
const MAX_URL_CHARS = 120;
const MAX_VERSION_CHARS = 32;
const MAX_MODEL_CHARS = 60;

/** 反馈问题类型的中文文案（与客户端 ui/log-upload-dialog.ts 的按钮一致） */
export const PROBLEM_TEXT = {
  'not-recorded': '没有记录',
  'wrong-data': '数据不对',
  other: '其他问题',
};

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif";
const COLOR_TEXT = '#111827';
const COLOR_MUTED = '#6B7280';
const COLOR_LINE = '#E5E7EB';
const COLOR_UP = '#0BA25E';
const COLOR_DOWN = '#D97706';
const COLOR_FLAT = '#6B7280';

/** HTML 转义：邮件正文只接受纯文本，避免用户填的备注被当成标签 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 截断到指定长度（超长时补省略号，便于正文一眼看出被裁过） */
function clip(value, max) {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** 多行备注：保留换行、逐行截断，供纯文本正文使用 */
function clipMultiline(value, max) {
  const text = String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/** 千分位整数：手写循环避免 Intl 在 Workers 冷启动里的额外开销 */
export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const rounded = Math.round(num);
  const negative = rounded < 0;
  const digits = String(Math.abs(rounded));
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return negative ? '-' + out : out;
}

/** 一位小数（7 日均值这类非整数指标），整数不带 .0 */
export function formatAverage(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '0';
  const fixed = Math.round(num * 10) / 10;
  return Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(1);
}

/**
 * 日活对比前日的变化率。前日为 0 时无法计算（会除零），返回「—」。
 * 返回 { text, direction }：text 带正负号，direction 供 HTML 上色与箭头。
 */
export function formatRate(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) {
    return { text: '—', direction: 'flat' };
  }
  const ratio = Math.round(((cur - prev) / prev) * 1000) / 10;
  if (Object.is(ratio, -0) || ratio === 0) return { text: '0.0%', direction: 'flat' };
  const direction = ratio > 0 ? 'up' : 'down';
  return { text: (ratio > 0 ? '+' : '') + ratio.toFixed(1) + '%', direction };
}

/** 时长文案：秒 / 分钟 / 小时三档，够用且不用 Intl.RelativeTimeFormat */
export function formatDuration(ms) {
  const num = Number(ms);
  if (!Number.isFinite(num) || num <= 0) return '0 分钟';
  const minutes = num / 60000;
  if (minutes < 1) return Math.max(1, Math.round(num / 1000)) + ' 秒';
  if (minutes < 60) return Math.round(minutes) + ' 分钟';
  const hours = minutes / 60;
  return (hours >= 10 ? String(Math.round(hours)) : String(Math.round(hours * 10) / 10)) + ' 小时';
}

/** 北京时间（UTC+8）时间文案：YYYY-MM-DD HH:mm */
export function formatBeijingTime(ts) {
  const num = Number(ts);
  if (!Number.isFinite(num) || num <= 0) return '';
  return new Date(num + BEIJING_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
}

/** 把 YYYY-MM-DD 变成主题里的 11-27 */
function shortDay(day) {
  const text = String(day || '');
  return text.length === 10 ? text.slice(5) : text;
}

function rateColor(direction) {
  if (direction === 'up') return COLOR_UP;
  if (direction === 'down') return COLOR_DOWN;
  return COLOR_FLAT;
}

function rateArrow(direction) {
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  return '·';
}

/** 一列表格行（左侧标签、右侧数值），日报与反馈共用 */
function rowHtml(label, valueHtml) {
  return (
    '<tr>' +
    '<td style="padding:7px 0;color:' + COLOR_MUTED + ';font-size:13px;white-space:nowrap">' + label + '</td>' +
    '<td style="padding:7px 0;text-align:right;color:' + COLOR_TEXT + ';font-size:13px;font-weight:600">' + valueHtml + '</td>' +
    '</tr>'
  );
}

function tableHtml(rows) {
  return '<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">' + rows.join('') + '</table>';
}

/** 邮件外壳：白色底、单列、最大 560px，避免在窄屏邮件客户端里被拉宽 */
function shellHtml(title, subtitle, bodyHtml) {
  return (
    '<div style="' + FONT_STACK + ';max-width:560px;margin:0 auto;padding:20px 18px;color:' + COLOR_TEXT + '">' +
    '<h2 style="margin:0 0 4px;font-size:18px;line-height:1.4">' + title + '</h2>' +
    '<p style="margin:0 0 16px;color:' + COLOR_MUTED + ';font-size:12px">' + subtitle + '</p>' +
    bodyHtml +
    '</div>'
  );
}

/** 结尾的操作链接与说明 */
function footerHtml(panelUrl) {
  const link = clip(panelUrl, MAX_URL_CHARS);
  const safe = escapeHtml(link);
  return (
    '<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid ' + COLOR_LINE + ';font-size:12px;color:' + COLOR_MUTED + '">' +
    (link ? '<a href="' + safe + '" style="color:' + COLOR_UP + ';text-decoration:none">打开统计看板</a><br>' : '') +
    '本邮件由「API用量统计」接收端自动发送，回复无效。' +
    '</p>'
  );
}

/**
 * 问题反馈提醒。
 * @param {{ id?: number|string, receivedAt?: number, report?: any, record?: any, appVersion?: string, panelUrl?: string }} input
 * @returns {{ subject: string, text: string, html: string }}
 */
export function buildErrorMail(input) {
  const data = input || {};
  const report = data.report && typeof data.report === 'object' ? data.report : {};
  const record = data.record && typeof data.record === 'object' ? data.record : {};
  const problemKey = PROBLEM_TEXT[report.problem] ? report.problem : 'other';
  const problemText = PROBLEM_TEXT[problemKey];
  const note = clipMultiline(report.note, MAX_NOTE_CHARS);
  const appVersion = clip(data.appVersion, MAX_VERSION_CHARS) || '未知';
  const model = clip(record.response && record.response.model, MAX_MODEL_CHARS) || '未知';
  const status = Number(record.response && record.response.status);
  const statusText = Number.isFinite(status) && status > 0 ? String(status) : '未记录';
  const url = clip(record.url, MAX_URL_CHARS);
  const idText = data.id == null || data.id === '' ? '' : '#' + data.id;
  const whenText = formatBeijingTime(data.receivedAt) || '未知';

  const subject = clip('[' + MAIL_BRAND + '] 新反馈 ' + (idText || '') + ' · ' + problemText, MAX_SUBJECT_CHARS);
  const lines = [
    '收到一条新的问题反馈。',
    '',
    '反馈编号：' + (idText || '未知'),
    '问题类型：' + problemText,
    '补充说明：' + (note || '未填写'),
    '上报版本：' + appVersion,
    '请求模型：' + model,
    '上游状态：' + statusText,
  ];
  if (url) lines.push('请求地址：' + url);
  lines.push('提交时间：' + whenText + '（北京时间）');
  const panelUrl = clip(data.panelUrl, MAX_URL_CHARS);
  if (panelUrl) lines.push('', '看板：' + panelUrl);

  const rows = [
    rowHtml('问题类型', escapeHtml(problemText)),
    rowHtml('补充说明', escapeHtml(note || '未填写')),
    rowHtml('上报版本', escapeHtml(appVersion)),
    rowHtml('请求模型', escapeHtml(model)),
    rowHtml('上游状态', escapeHtml(statusText)),
  ];
  if (url) rows.push(rowHtml('请求地址', escapeHtml(url)));
  rows.push(rowHtml('提交时间', escapeHtml(whenText)));
  const title = '新问题反馈' + (idText ? ' ' + idText : '');
  const html = shellHtml(title, problemText + ' · ' + whenText + '（北京时间）', tableHtml(rows) + footerHtml(panelUrl));
  return { subject, text: lines.join('\n'), html };
}

/**
 * 每日总结。metrics 由 worker 的 SQL 聚合提供，缺字段一律按 0 展示，不让模板抛错。
 * @param {{ day: string, prevDay?: string, metrics?: any, panelUrl?: string }} input
 */
export function buildDailyMail(input) {
  const data = input || {};
  const metrics = data.metrics && typeof data.metrics === 'object' ? data.metrics : {};
  const day = clip(data.day, 10);
  const dau = Number(metrics.dau) || 0;
  const prevDau = Number(metrics.prevDau) || 0;
  const rate = formatRate(dau, prevDau);
  const newDevices = Number(metrics.newDevices) || 0;
  const totalDevices = Number(metrics.totalDevices) || 0;
  const sessions = Number(metrics.sessions) || 0;
  const opens = Number(metrics.opens) || 0;
  const activeMs = Number(metrics.activeMs) || 0;
  const runMs = Number(metrics.runMs) || 0;
  const feedbacks = Number(metrics.feedbacks) || 0;
  const avgDau = Number(metrics.sevenDayAvgDau) || 0;
  const perDeviceMs = dau > 0 ? activeMs / dau : 0;
  const versions = Array.isArray(metrics.versions) ? metrics.versions.slice(0, 6) : [];
  const rateText = rate.direction === 'flat' ? rate.text : rateArrow(rate.direction) + ' ' + rate.text;

  const subject = clip(
    '[' + MAIL_BRAND + '] ' + shortDay(day) + ' 日报 · 日活 ' + formatNumber(dau) + '（' + rate.text + '）',
    MAX_SUBJECT_CHARS,
  );
  const lines = [
    day + ' 每日总结（北京时间）',
    '',
    '日活设备：' + formatNumber(dau) + '（前日 ' + formatNumber(prevDau) + '，' + rate.text + '）',
    '新增设备：' + formatNumber(newDevices),
    '累计设备：' + formatNumber(totalDevices),
    '会话次数：' + formatNumber(sessions),
    '打开次数：' + formatNumber(opens),
    '使用时长：' + formatDuration(activeMs) + (dau > 0 ? '（人均 ' + formatDuration(perDeviceMs) + '）' : ''),
    '运行时长：' + formatDuration(runMs),
    '问题反馈：' + formatNumber(feedbacks) + ' 条',
    '7 日均日活：' + formatAverage(avgDau),
  ];
  if (versions.length) {
    lines.push('', '活跃版本：');
    for (const item of versions) {
      lines.push('  ' + clip(item && item.version, MAX_VERSION_CHARS) + '  ' + formatNumber(item && item.count) + ' 台');
    }
  }
  const panelUrl = clip(data.panelUrl, MAX_URL_CHARS);
  if (panelUrl) lines.push('', '看板：' + panelUrl);

  const rateHtml = '<span style="color:' + rateColor(rate.direction) + '">' + escapeHtml(rateText) + '</span>';
  const rows = [
    rowHtml('日活设备', formatNumber(dau) + ' <span style="color:' + COLOR_MUTED + ';font-weight:400">/ 前日 ' + formatNumber(prevDau) + ' · ' + rateHtml + '</span>'),
    rowHtml('新增设备', formatNumber(newDevices)),
    rowHtml('累计设备', formatNumber(totalDevices)),
    rowHtml('会话次数', formatNumber(sessions)),
    rowHtml('打开次数', formatNumber(opens)),
    rowHtml('使用时长', escapeHtml(formatDuration(activeMs)) + (dau > 0 ? ' <span style="color:' + COLOR_MUTED + ';font-weight:400">人均 ' + escapeHtml(formatDuration(perDeviceMs)) + '</span>' : '')),
    rowHtml('运行时长', escapeHtml(formatDuration(runMs))),
    rowHtml('问题反馈', formatNumber(feedbacks) + ' 条'),
    rowHtml('7 日均日活', formatAverage(avgDau)),
  ];
  let versionHtml = '';
  if (versions.length) {
    const items = versions.map((item) => {
      return (
        '<li style="margin:2px 0;color:' + COLOR_TEXT + ';font-size:12px">' +
        escapeHtml(clip(item && item.version, MAX_VERSION_CHARS) || '未知') +
        ' <span style="color:' + COLOR_MUTED + '">· ' + formatNumber(item && item.count) + ' 台</span></li>'
      );
    });
    versionHtml =
      '<p style="margin:18px 0 4px;color:' + COLOR_MUTED + ';font-size:12px">当日活跃版本</p>' +
      '<ul style="margin:0;padding-left:18px">' + items.join('') + '</ul>';
  }
  const html = shellHtml(
    escapeHtml(day) + ' 每日总结',
    '北京时间 00:00 自动发送' + (data.prevDay ? ' · 对比 ' + escapeHtml(clip(data.prevDay, 10)) : ''),
    tableHtml(rows) + versionHtml + footerHtml(panelUrl),
  );
  return { subject, text: lines.join('\n'), html };
}

function envText(env, key) {
  const value = env && env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function errorText(error) {
  if (!error) return 'unknown';
  const code = typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code) : '';
  const message = typeof error.message === 'string' ? error.message : String(error);
  const text = clip(code ? code + ' ' + message : message, 200);
  return text || 'unknown';
}

/**
 * 发信适配：优先 Workers send_email 绑定，其次 REST（需同时配置 MAIL_API_TOKEN 与 MAIL_ACCOUNT_ID）。
 * 任何失败都只返回 { ok: false }，调用方不用 try/catch。
 * @param {{ EMAIL?: any, MAIL_TO?: string, MAIL_FROM?: string, MAIL_API_TOKEN?: string, MAIL_ACCOUNT_ID?: string }} env
 * @param {{ subject: string, text: string, html: string }} message
 * @returns {Promise<{ ok: boolean, via: string, messageId?: string, error?: string, skipped?: boolean }>}
 */
export async function sendMail(env, message) {
  const subject = clip(message && message.subject, MAX_SUBJECT_CHARS);
  const text = message && typeof message.text === 'string' ? message.text : '';
  const html = message && typeof message.html === 'string' ? message.html : '';
  if (!subject || (!text && !html)) return { ok: false, via: 'none', error: 'mail_empty' };
  const to = envText(env, 'MAIL_TO') || MAIL_TO_DEFAULT;
  const from = envText(env, 'MAIL_FROM') || MAIL_FROM_DEFAULT;
  const binding = env && env.EMAIL;
  if (binding && typeof binding.send === 'function') {
    try {
      const result = await binding.send({ to, from, subject, html, text });
      return { ok: true, via: 'binding', messageId: result && result.messageId ? String(result.messageId) : '' };
    } catch (error) {
      return { ok: false, via: 'binding', error: errorText(error) };
    }
  }
  const token = envText(env, 'MAIL_API_TOKEN');
  const accountId = envText(env, 'MAIL_ACCOUNT_ID');
  if (!token || !accountId) return { ok: false, via: 'none', skipped: true, error: 'mail_binding_missing' };
  try {
    const response = await fetch(
      'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/email/sending/send',
      {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
        body: JSON.stringify({ to, from, subject, html, text }),
      },
    );
    let body = null;
    try {
      body = await response.json();
    } catch {}
    if (!response.ok || !body || body.success === false) {
      const first = body && Array.isArray(body.errors) && body.errors.length ? body.errors[0] : null;
      const detail = first ? String(first.code || '') + ' ' + String(first.message || '') : 'http_' + response.status;
      return { ok: false, via: 'rest', error: clip(detail, 200) };
    }
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    return { ok: true, via: 'rest', messageId: result.message_id ? String(result.message_id) : '' };
  } catch (error) {
    return { ok: false, via: 'rest', error: errorText(error) };
  }
}

