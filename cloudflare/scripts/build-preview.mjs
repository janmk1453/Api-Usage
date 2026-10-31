#!/usr/bin/env node
/**
 * 生成离线可双击预览的遥测看板单文件。
 *
 * 用 D1 REST shim 复刻 Worker 的 env.DB 接口，直接复用 cloudflare/api.js 的
 * buildBootPayload 与 cloudflare/boot.js 的 renderDashboard，
 * 因此预览文件的首屏数据与线上 /dashboard 完全同源。
 *
 * 用法：node cloudflare/scripts/build-preview.mjs [输出路径]
 * 凭据：环境变量 CLOUDFLARE_API_TOKEN（或 CLOUDFLARE_TOKEN_FILE 指向的文件）
 * 账号：环境变量 CLOUDFLARE_ACCOUNT_ID
 * 库 ID：环境变量 CLOUDFLARE_DATABASE_ID，缺省从 cloudflare/wrangler.local.toml 的 database_id 读取
 * 三者都不写进仓库：wrangler.local.toml 已被 .gitignore 忽略。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBootPayload } from "../api.js";
import { renderDashboard } from "../boot.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLOUDFLARE_DIR = path.resolve(HERE, "..");

const TOKEN_FILE = process.env.CLOUDFLARE_TOKEN_FILE || "C:/Windows/Temp/aus_cf_token.txt";

/** 从 wrangler.local.toml 里取真实的 D1 database_id（该文件不入库） */
async function readLocalDatabaseId() {
  try {
    const toml = await fs.readFile(path.join(CLOUDFLARE_DIR, "wrangler.local.toml"), "utf8");
    const matched = /database_id\s*=\s*"([^"]+)"/.exec(toml);
    if (matched && matched[1] && matched[1] !== "REPLACE_WITH_D1_DATABASE_ID") return matched[1];
  } catch (error) { /* 没有本地配置时走环境变量 */ }
  return "";
}

async function readToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN.trim();
  try {
    return (await fs.readFile(TOKEN_FILE, "utf8")).trim();
  } catch (error) {
    throw new Error("缺少 Cloudflare API Token：设置 CLOUDFLARE_API_TOKEN 或写入 " + TOKEN_FILE);
  }
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DATABASE_ID = process.env.CLOUDFLARE_DATABASE_ID || await readLocalDatabaseId();
if (!ACCOUNT_ID || !DATABASE_ID) {
  throw new Error("缺少 CLOUDFLARE_ACCOUNT_ID 或 D1 database_id（可用环境变量或 wrangler.local.toml 提供）");
}

function createD1Shim(token) {
  const endpoint = "https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT_ID
    + "/d1/database/" + DATABASE_ID + "/query";
  const calls = [];
  async function query(sql, params) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const detail = payload && payload.errors && payload.errors[0] ? payload.errors[0].message : "HTTP " + res.status;
      throw new Error("D1 查询失败：" + detail);
    }
    calls.push(sql.replace(/\s+/g, " ").slice(0, 90));
    const first = Array.isArray(payload.result) ? payload.result[0] : payload.result;
    return { results: (first && first.results) || [] };
  }
  return {
    calls,
    prepare(sql) {
      return {
        bind(...params) {
          return { all: () => query(sql, params) };
        },
        all: () => query(sql, []),
      };
    },
  };
}

const token = await readToken();
const db = createD1Shim(token);
const env = { DB: db, DASHBOARD_TOKEN: "preview" };

const started = Date.now();
const boot = await buildBootPayload(env);
const template = await fs.readFile(path.join(CLOUDFLARE_DIR, "dashboard.html"), "utf8");
const html = renderDashboard(template, boot, "preview/" + boot.today);

const output = process.argv[2] || "D:/Desktop/DeepSeek/演示素材/telemetry-dashboard-live.html";
await fs.writeFile(output, html, "utf8");

const summary = {
  output,
  bytes: html.length,
  d1Queries: db.calls.length,
  elapsedMs: Date.now() - started,
  today: boot.today,
  startDay: boot.startDay,
  dailyRows: boot.daily.length,
  hourlyRows: boot.hourly.length,
  renderRows: boot.render.length,
  devices: boot.summary.totals.users,
  opens: boot.summary.totals.opens,
  versions: boot.summary.versions.slice(0, 4),
  pages: boot.summary.pages,
  render: boot.render.map((r) => ({ v: r.version, samples: r.samples, avgMs: r.avgMs })),
};
console.log(JSON.stringify(summary, null, 2));
