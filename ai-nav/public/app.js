const REGION_LABEL = { global: "全球", china: "国内" };
const CATEGORY_LABEL = { model: "大模型", agent: "Agent", tool: "工具" };
const MAX_COMPARE = 6;

const DB = { models: [], updated: "", news: [], newsUpdated: "", terms: [], events: [], picks: null };
const state = {
  region: "all", category: "all", q: "", sort: "recent",
  glevel: "all", gq: "",
  cq: "", compare: new Set(),
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const debounce = (fn, ms = 160) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const avatarText = (it) => (it.vendor || it.name || "?").slice(0, 1);

function loadAll() {
  return Promise.all([
    fetch("data.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("news.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("glossary.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("timeline.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("picks.json", { cache: "no-store" }).then((r) => r.json()),
  ])
    .then(([data, news, glossary, timeline, picks]) => {
      DB.models = data.items || [];
      DB.updated = data.updated || "";
      DB.news = news.items || [];
      DB.newsUpdated = news.updated || "";
      DB.terms = glossary.terms || [];
      DB.events = timeline.events || [];
      DB.picks = picks || null;
      $("#statTotal").textContent = DB.models.length;
      $("#statUpdated").textContent = DB.updated || "—";
      renderNav();
      renderNews();
      renderGlossary();
      renderTimeline();
      renderCompare();
    })
    .catch((e) => {
      console.error(e);
      $("#grid").innerHTML = `<div class="empty">数据加载失败，请检查 JSON 文件。</div>`;
    });
}

/* ---------- 导航：卡片墙 + 本周精选 ---------- */
function filteredModels() {
  const q = state.q.trim().toLowerCase();
  let list = DB.models.filter((it) => {
    if (state.region !== "all" && it.region !== state.region) return false;
    if (state.category !== "all" && it.category !== state.category) return false;
    if (q) {
      const hay = [it.name, it.vendor, it.description, ...(it.tags || [])].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (state.sort === "recent") list.sort((a, b) => (b.released || "").localeCompare(a.released || ""));
  else if (state.sort === "hot") list.sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || (b.released || "").localeCompare(a.released || ""));
  else if (state.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return list;
}

function cardHTML(it) {
  const tags = (it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const date = (it.released || "").slice(0, 7);
  return `
  <article class="card">
    <div class="card-head">
      <div class="avatar c-${it.category}">${esc(avatarText(it))}</div>
      <div class="card-titles">
        <div class="card-name">${esc(it.name)}${it.hot ? ' <span class="hot">🔥</span>' : ""}</div>
        <div class="card-vendor">${esc(it.vendor)}</div>
      </div>
      <div class="card-ext"><a href="${esc(it.url)}" target="_blank" rel="noopener" title="访问官网">↗</a></div>
    </div>
    <div class="card-desc">${esc(it.description || "")}</div>
    <div class="card-tags">
      <span class="badge r-${it.region}">${REGION_LABEL[it.region] || it.region}</span>
      <span class="badge c-${it.category}">${CATEGORY_LABEL[it.category] || it.category}</span>
      ${tags}
    </div>
    <div class="card-foot">
      <span>${date ? "发布 " + date : "—"}</span>
      <a class="ext-link" href="${esc(it.url)}" target="_blank" rel="noopener">官网 ↗</a>
    </div>
  </article>`;
}

function renderPicks() {
  const box = $("#picks");
  if (!DB.picks || !DB.picks.items || !DB.picks.items.length) { box.classList.remove("show"); return; }
  const items = DB.picks.items.map((id) => DB.models.find((m) => m.id === id)).filter(Boolean);
  if (!items.length) { box.classList.remove("show"); return; }
  const cards = items.map((it) => `
    <a class="pick-card" href="${esc(it.url)}" target="_blank" rel="noopener">
      <span class="pa c-${it.category}" style="background:var(--${it.category})">${esc(avatarText(it))}</span>
      <span><span class="pn">${esc(it.name)}</span><br><span class="pv">${esc(it.vendor)}</span></span>
    </a>`).join("");
  box.innerHTML = `<div class="picks-label">本周精选<span class="note">${esc(DB.picks.note || "")}</span></div><div class="pick-row">${cards}</div>`;
  box.classList.add("show");
}

function renderNav() {
  renderPicks();
  const list = filteredModels();
  const grid = $("#grid");
  if (!list.length) { grid.innerHTML = ""; $("#empty").hidden = false; return; }
  $("#empty").hidden = true;
  grid.innerHTML = list.map(cardHTML).join("");
}

/* ---------- 资讯 ---------- */
function renderNews() {
  $("#newsMeta").textContent = DB.news.length ? `${DB.news.length} 条 · 更新于 ${DB.newsUpdated || "—"}` : "暂无资讯";
  const list = $("#newsList");
  if (!DB.news.length) { list.innerHTML = `<div class="empty">资讯将在爬虫运行后自动填充。</div>`; return; }
  list.innerHTML = DB.news.map((n) => `
    <article class="news-item">
      <div class="news-meta"><span class="news-source">${esc(n.source)}</span><span class="news-date">${esc(n.date || "")}</span></div>
      <a class="news-title" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      ${n.summary ? `<div class="news-summary">${esc(n.summary)}</div>` : ""}
    </article>`).join("");
}

/* ---------- 术语词典 ---------- */
function filteredTerms() {
  const q = state.gq.trim().toLowerCase();
  return DB.terms.filter((t) => {
    if (state.glevel !== "all" && t.level !== state.glevel) return false;
    if (q) {
      const hay = [t.term, t.en, t.explain].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderGlossary() {
  const list = filteredTerms();
  const box = $("#glossaryList");
  if (!list.length) { box.innerHTML = `<div class="empty">没有匹配的术语。</div>`; return; }
  box.innerHTML = list.map((t) => `
    <article class="glossary-item">
      <div class="g-term"><b>${esc(t.term)}</b><span class="g-en">${esc(t.en || "")}</span><span class="g-level" data-l="${esc(t.level)}">${esc(t.level)}</span></div>
      <div class="g-explain">${esc(t.explain)}</div>
    </article>`).join("");
}

/* ---------- 时间线 ---------- */
function renderTimeline() {
  const events = [...DB.events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const box = $("#timeline");
  if (!events.length) { box.innerHTML = `<div class="empty">暂无时间线数据。</div>`; return; }
  box.innerHTML = events.map((e) => `
    <div class="tl-item r-${e.region}">
      <div class="tl-date">${esc(e.date)}</div>
      <div class="tl-title">${esc(e.title)}</div>
      <div class="tl-desc">${esc(e.desc)}</div>
    </div>`).join("");
}

/* ---------- 模型对比 ---------- */
function compareModels() {
  const q = state.cq.trim().toLowerCase();
  let list = DB.models.slice();
  if (q) list = list.filter((it) => (it.name + " " + it.vendor).toLowerCase().includes(q));
  list.sort((a, b) => (b.released || "").localeCompare(a.released || ""));
  return list;
}

function openSource(it) {
  const tags = it.tags || [];
  if (tags.includes("开源")) return "开源";
  if (tags.includes("闭源")) return "闭源";
  return "—";
}

function renderCompare() {
  const list = compareModels();
  const box = $("#comparePick");
  box.innerHTML = list.map((it) => {
    const on = state.compare.has(it.id);
    return `
    <label class="pick-item ${on ? "on" : ""}" data-id="${esc(it.id)}">
      <input type="checkbox" ${on ? "checked" : ""} ${state.compare.size >= MAX_COMPARE && !on ? "disabled" : ""}>
      <span><span class="pi-name">${esc(it.name)}</span><br><span class="pi-vendor">${esc(it.vendor)}</span></span>
    </label>`;
  }).join("") || `<div class="c-hint">没有匹配的模型。</div>`;
  $("#compareCount").textContent = `已选 ${state.compare.size} / ${MAX_COMPARE}`;
  renderCompareTable();
}

function renderCompareTable() {
  const box = $("#compareTable");
  if (!state.compare.size) { box.innerHTML = `<div class="c-hint">勾选上方模型，开始横评对比。</div>`; return; }
  const selected = [...state.compare].map((id) => DB.models.find((m) => m.id === id)).filter(Boolean);
  const rows = [
    ["厂商", (it) => esc(it.vendor)],
    ["地区", (it) => REGION_LABEL[it.region] || it.region],
    ["类型", (it) => CATEGORY_LABEL[it.category] || it.category],
    ["发布", (it) => (it.released || "").slice(0, 7) || "—"],
    ["开源/闭源", (it) => openSource(it)],
    ["热门", (it) => (it.hot ? "🔥 是" : "—")],
    ["标签", (it) => esc((it.tags || []).join(" · "))],
  ];
  const head = `<tr><th>属性</th>${selected.map((it) => `<th>${esc(it.name)}</th>`).join("")}</tr>`;
  const body = rows.map(([label, val]) =>
    `<tr><td>${label}</td>${selected.map((it) => `<td>${val(it)}</td>`).join("")}</tr>`
  ).join("");
  box.innerHTML = `<table class="compare"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/* ---------- 事件绑定 ---------- */
// Tab 切换
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  const tab = btn.dataset.tab;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + tab).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// 导航筛选（地区/类型）
document.querySelectorAll("#view-nav .seg-group").forEach((group) => {
  const filter = group.dataset.filter;
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg");
    if (!btn) return;
    group.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state[filter] = btn.dataset.val;
    renderNav();
  });
});
$("#searchInput").addEventListener("input", debounce((e) => { state.q = e.target.value; renderNav(); }));
$("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderNav(); });

// 术语筛选
$("#view-glossary .seg-group").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  $("#view-glossary .seg-group").querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.glevel = btn.dataset.val;
  renderGlossary();
});
$("#glossarySearch").addEventListener("input", debounce((e) => { state.gq = e.target.value; renderGlossary(); }));

// 对比
$("#compareSearch").addEventListener("input", debounce((e) => { state.cq = e.target.value; renderCompare(); }));
$("#comparePick").addEventListener("click", (e) => {
  const item = e.target.closest(".pick-item");
  if (!item) return;
  const id = item.dataset.id;
  if (state.compare.has(id)) {
    state.compare.delete(id);
  } else if (state.compare.size < MAX_COMPARE) {
    state.compare.add(id);
  }
  renderCompare();
});

// 主题
const themeToggle = $("#themeToggle");
function applyTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem("ai-nav-theme", t); }
themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
const saved = localStorage.getItem("ai-nav-theme");
if (saved) applyTheme(saved);
else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");

loadAll();
