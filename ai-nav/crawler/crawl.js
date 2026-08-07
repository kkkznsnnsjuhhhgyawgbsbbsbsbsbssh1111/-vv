// AI 导航站爬虫
// 1) 以 public/data.json 为策展基线，抓 HuggingFace 热门开源模型合并回写
// 2) 接入 models.dev API，自动补全 pricing/context/license/modal 等精确字段
// 3) 抓取多家 AI 资讯 RSS/Atom，生成 public/news.json
// 全程无第三方依赖，使用 Node 18+ 内置 fetch。
// 运行：node crawl.js            （默认 limit 40）
// 用法：node crawl.js --limit 40

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, "..", "public");
const DATA_FILE = path.join(PUB, "data.json");
const NEWS_FILE = path.join(PUB, "news.json");

// 已知国内 org → 中国地区
const CHINA_ORGS = new Set([
  "deepseek-ai", "Qwen", "THUDM", "internlm", "01-ai", "minimax",
  "TencentARC", "Tencent-Hunyuan", "baichuan-inc", "internsail",
  "stepfun-ai", "inclusionAI",
]);

// AI 资讯 RSS 源（解析失败或 404 自动跳过）
const RSS_FEEDS = [
  { source: "机器之心", url: "https://www.jiqizhixin.com/rss" },
  { source: "量子位", url: "https://www.qbitai.com/feed" },
  { source: "Hacker News", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT" },
  { source: "OpenAI", url: "https://openai.com/blog/rss.xml" },
  { source: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { source: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { source: "Anthropic", url: "https://www.anthropic.com/news/rss.xml" },
];

function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---------- 名称规范化（用于模糊匹配） ----------
function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/^(openai|anthropic|google|meta|mistral|xai|cohere|deepseek|qwen|zhipu|zhipuai|moonshot|baidu|bytedance|minimax|tencent|01ai|baichuan|stepfun)/g, "")
    .replace(/[（）()]/g, "");
}

// ---------- 格式化上下文长度 ----------
function formatContext(n) {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000) + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(n);
}

// ---------- 格式化模态 ----------
function formatModalities(mods) {
  if (!mods) return "—";
  const map = { text: "文本", image: "图像", audio: "音频", video: "视频", pdf: "PDF" };
  const inputs = (mods.input || []).map((m) => map[m] || m);
  return inputs.length ? inputs.join("+") : "—";
}

// ---------- 格式化价格 ----------
function formatCost(cost) {
  if (!cost) return "—";
  if (cost.input === 0 && cost.output === 0) return "免费";
  return `输入 $${cost.input} / 输出 $${cost.output}`;
}

// ---------- models.dev API：补全策展数据 ----------
async function fetchModelsDev() {
  const url = "https://models.dev/api.json";
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`models.dev API ${res.status}`);
  return res.json();
}

function buildModelIndex(apiData) {
  const index = new Map();
  for (const [providerId, provider] of Object.entries(apiData || {})) {
    for (const [modelId, model] of Object.entries(provider?.models || {})) {
      const fullId = `${providerId}/${modelId}`;
      const normKey = normalizeName(model.name || modelId);
      index.set(normKey, { fullId, providerId, model });
    }
  }
  return index;
}

function matchModel(item, index) {
  const keys = [
    normalizeName(item.name),
    normalizeName(item.vendor + item.name),
    normalizeName(item.id),
  ].filter(Boolean);
  for (const key of keys) {
    if (index.has(key)) return index.get(key);
  }
  // 尝试子串匹配
  for (const [key, val] of index) {
    for (const k of keys) {
      if (k.length > 3 && (key.includes(k) || k.includes(key))) return val;
    }
  }
  return null;
}

async function enrichFromModelsDev() {
  const data = readJSON(DATA_FILE);
  const items = data.items || [];
  try {
    const apiData = await fetchModelsDev();
    const index = buildModelIndex(apiData);
    console.log(`[models.dev] 收到 ${index.size} 个模型`);
    let enriched = 0;
    for (const item of items) {
      const match = matchModel(item, index);
      if (!match) continue;
      const m = match.model;
      let changed = false;

      if ((!item.pricing || item.pricing === "—") && m.cost) {
        item.pricing = formatCost(m.cost);
        changed = true;
      }
      if ((!item.context || item.context === "—") && m.limit?.context) {
        item.context = formatContext(m.limit.context);
        changed = true;
      }
      if ((!item.license || item.license === "—") && m.license) {
        item.license = m.license;
        changed = true;
      } else if ((!item.license || item.license === "—") && m.open_weights !== undefined) {
        item.license = m.open_weights ? "开源" : "闭源";
        changed = true;
      }
      if ((!item.modal || item.modal === "—") && m.modalities) {
        item.modal = formatModalities(m.modalities);
        changed = true;
      }
      if (item.api === undefined && m.tool_call !== undefined) {
        item.api = !!m.tool_call;
        changed = true;
      }
      if (changed) enriched++;
    }
    if (enriched) {
      data.updated = today();
      writeJSON(DATA_FILE, data);
      console.log(`[models.dev] ✓ 补全 ${enriched} 条模型字段`);
    } else {
      console.log("[models.dev] 无需补全");
    }
  } catch (e) {
    console.warn(`[models.dev] ⚠ 抓取失败，跳过补全：${e.message}`);
  }
}

// ---------- HuggingFace 开源模型 ----------
async function fetchHF(limit) {
  const url = `https://huggingface.co/api/models?sort=downloads&direction=-1&limit=${limit}&filter=text-generation&full=true`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HuggingFace API ${res.status}`);
  return res.json();
}

function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function hfToItem(m) {
  const org = m.author || (m.id.includes("/") ? m.id.split("/")[0] : "");
  const name = m.id.includes("/") ? m.id.split("/").slice(1).join("/") : m.id;
  return {
    id: "hf-" + m.id.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase(),
    name,
    vendor: org || name,
    region: CHINA_ORGS.has(org) ? "china" : "global",
    category: "model",
    released: (m.lastModified || "").slice(0, 10) || today(),
    description: `开源模型 · ${formatNum(m.downloads || 0)} 下载 · ${m.likes || 0} 喜欢`,
    url: "https://huggingface.co/" + m.id,
    tags: ["开源", m.pipeline_tag || "text-generation"].filter(Boolean),
    pricing: "—",
    context: "—",
    license: m.tags?.find((t) => t.startsWith("license:"))?.replace("license:", "") || "开源",
    api: false,
    modal: "文本",
    auto: true,
  };
}

async function crawlModels(limit) {
  const data = readJSON(DATA_FILE);
  const existing = data.items || [];
  const seen = new Set();
  for (const it of existing) {
    seen.add((it.name || "").toLowerCase());
    if (it.url) seen.add(it.url);
  }
  let added = 0;
  try {
    const models = await fetchHF(limit);
    console.log(`[模型] HuggingFace 返回 ${models.length} 个`);
    for (const m of models) {
      if ((m.downloads || 0) < 5000) continue;
      const item = hfToItem(m);
      const key = (item.name || "").toLowerCase();
      if (seen.has(key) || seen.has(item.url)) continue;
      existing.push(item);
      seen.add(key);
      seen.add(item.url);
      added++;
    }
    if (added) {
      data.items = existing;
      data.updated = today();
      writeJSON(DATA_FILE, data);
      console.log(`[模型] ✓ 新增 ${added} 个，共 ${data.items.length} 条`);
    } else {
      console.log("[模型] 无新条目");
    }
  } catch (e) {
    console.warn(`[模型] ⚠ 抓取失败，保持基线：${e.message}`);
  }
}

// ---------- RSS / Atom 资讯 ----------
function pick(block, re) {
  const m = block.match(re);
  return m ? m[1].trim() : "";
}
function strip(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeDate(s) {
  if (!s) return "";
  const d = new Date(strip(s));
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

function parseFeed(xml, source) {
  const items = [];
  const isAtom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
  const re = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const blocks = [...xml.matchAll(re)].map((m) => m[1]);
  for (const b of blocks) {
    const title = strip(pick(b, /<title[^>]*>([\s\S]*?)<\/title>/i));
    let link = isAtom
      ? (b.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || ""
      : pick(b, /<link[^>]*>([\s\S]*?)<\/link>/i) || (b.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || "";
    link = strip(link);
    const date = normalizeDate(pick(b, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || pick(b, /<(published|updated)[^>]*>([\s\S]*?)<\/\1>/i));
    const desc = strip(pick(b, /<description[^>]*>([\s\S]*?)<\/description>/i) || pick(b, /<summary[^>]*>([\s\S]*?)<\/summary>/i) || pick(b, /<content[^>]*>([\s\S]*?)<\/content>/i)).slice(0, 180);
    if (title && link) items.push({ title, source, url: link, date, summary: desc });
  }
  return items;
}

async function crawlNews() {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (f) => {
      const res = await fetch(f.url, { headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" }, redirect: "follow" });
      if (!res.ok) throw new Error(`${f.source} ${res.status}`);
      const xml = await res.text();
      const items = parseFeed(xml, f.source);
      console.log(`[资讯] ${f.source}: ${items.length} 条`);
      return items;
    })
  );
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.warn(`[资讯] ⚠ 源失败：${r.reason.message}`);
  }
  if (!all.length) {
    console.warn("[资讯] 无可用资讯，保留现有 news.json");
    return;
  }
  // 去重 + 按日期倒序
  const seen = new Set();
  const dedup = [];
  for (const it of all) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    dedup.push(it);
  }
  dedup.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  writeJSON(NEWS_FILE, { updated: today(), items: dedup.slice(0, 60) });
  console.log(`[资讯] ✓ 写入 ${Math.min(dedup.length, 60)} 条资讯`);
}

async function main() {
  const limit = parseInt(
    process.argv.includes("--limit") ? process.argv[process.argv.indexOf("--limit") + 1] : "40",
    10
  );
  // 1) 先用 models.dev 补全策展数据字段
  await enrichFromModelsDev();
  // 2) 抓 HuggingFace 新模型
  await crawlModels(limit);
  // 3) 抓资讯
  await crawlNews();
  console.log("爬虫完成。");
}

main().catch((e) => {
  console.error("爬虫异常：", e);
  process.exit(1);
});
