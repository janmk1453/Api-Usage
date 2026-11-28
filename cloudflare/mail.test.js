import { describe, it, expect } from 'vitest';
import {
  buildDailyMail,
  buildErrorMail,
  formatDuration,
  formatNumber,
  formatRate,
  sendMail,
} from './mail.js';

describe('邮件文案格式化', () => {
  it('千分位不依赖 Intl', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(86)).toBe('86');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber('x')).toBe('0');
  });

  it('环比按前日算，前日为 0 时显示破折号', () => {
    expect(formatRate(86, 93)).toEqual({ text: '-7.5%', direction: 'down' });
    expect(formatRate(95, 93)).toEqual({ text: '+2.2%', direction: 'up' });
    expect(formatRate(93, 93)).toEqual({ text: '0.0%', direction: 'flat' });
    expect(formatRate(5, 0)).toEqual({ text: '—', direction: 'flat' });
  });

  it('时长分秒与小时三档', () => {
    expect(formatDuration(0)).toBe('0 分钟');
    expect(formatDuration(30000)).toBe('30 秒');
    expect(formatDuration(120000)).toBe('2 分钟');
    expect(formatDuration(5400000)).toBe('1.5 小时');
  });
});

describe('错误反馈提醒', () => {
  const input = {
    id: 42,
    receivedAt: 1794719000000,
    appVersion: '3.2.1',
    panelUrl: 'https://stat.example.com/dashboard',
    report: { problem: 'wrong-data', note: '费用算多了<script>alert(1)</script>' },
    record: {
      url: 'https://api.example.com/v1/chat/completions',
      response: { status: 502, model: 'deepseek-flash' },
    },
  };

  it('主题同时带编号与问题类型', () => {
    const mail = buildErrorMail(input);
    expect(mail.subject).toContain('新反馈 #42');
    expect(mail.subject).toContain('数据不对');
  });

  it('正文含补充说明、模型、上游状态与看板链接', () => {
    const mail = buildErrorMail(input);
    expect(mail.text).toContain('费用算多了');
    expect(mail.text).toContain('deepseek-flash');
    expect(mail.text).toContain('502');
    expect(mail.text).toContain('https://stat.example.com/dashboard');
  });

  it('用户输入进 HTML 前转义', () => {
    const mail = buildErrorMail(input);
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('缺字段时降级为占位文案而不抛错', () => {
    const mail = buildErrorMail({});
    expect(mail.subject).toContain('新反馈');
    expect(mail.text).toContain('未填写');
    expect(mail.text).toContain('未记录');
  });
});

describe('每日总结', () => {
  const metrics = {
    dau: 86,
    prevDau: 93,
    newDevices: 3,
    totalDevices: 439,
    sessions: 210,
    opens: 640,
    activeMs: 7200000,
    runMs: 5400000,
    feedbacks: 2,
    sevenDayAvgDau: 80.4,
    versions: [{ version: '3.2.1', count: 60 }],
  };

  it('主题带统计日与日活环比', () => {
    const mail = buildDailyMail({ day: '2026-11-27', prevDay: '2026-11-26', metrics });
    expect(mail.subject).toBe('[API用量统计] 11-27 日报 · 日活 86（-7.5%）');
  });

  it('正文含新增、累计、人均时长、7 日均与版本', () => {
    const mail = buildDailyMail({ day: '2026-11-27', prevDay: '2026-11-26', metrics });
    expect(mail.text).toContain('新增设备：3');
    expect(mail.text).toContain('累计设备：439');
    expect(mail.text).toContain('人均 1 分钟');
    expect(mail.text).toContain('7 日均日活：80.4');
    expect(mail.text).toContain('3.2.1  60 台');
  });

  it('没有活跃版本时不出现版本段', () => {
    const mail = buildDailyMail({ day: '2026-11-27', prevDay: '2026-11-26', metrics: { ...metrics, versions: [] } });
    expect(mail.text).not.toContain('活跃版本：');
  });
});

describe('发信适配', () => {
  const message = { subject: '主题', text: '纯文本', html: '<p>HTML</p>' };

  it('优先走 Workers send_email 绑定', async () => {
    const sent = [];
    const env = { EMAIL: { async send(payload) { sent.push(payload); return { messageId: 'm1' }; } }, MAIL_TO: '2855564331@qq.com' };
    const result = await sendMail(env, message);
    expect(result).toEqual({ ok: true, via: 'binding', messageId: 'm1' });
    expect(sent[0].to).toBe('2855564331@qq.com');
    expect(sent[0].subject).toBe('主题');
  });

  it('绑定抛错时返回失败而不向外抛', async () => {
    const env = { EMAIL: { async send() { throw new Error('E_RECIPIENT_NOT_ALLOWED'); } } };
    const result = await sendMail(env, message);
    expect(result.ok).toBe(false);
    expect(result.via).toBe('binding');
    expect(result.error).toContain('E_RECIPIENT_NOT_ALLOWED');
  });

  it('既无绑定也无 REST 凭据时标记 skipped', async () => {
    const result = await sendMail({}, message);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it('空邮件直接拒绝', async () => {
    const result = await sendMail({ EMAIL: { async send() {} } }, { subject: '', text: '' });
    expect(result).toEqual({ ok: false, via: 'none', error: 'mail_empty' });
  });
});