const REGION_LABEL = { global: "全球", china: "国内" };
const CATEGORY_LABEL = { model: "大模型", agent: "Agent", tool: "工具" };
const MAX_COMPARE = 6;
const TABS = ["nav", "news", "glossary", "timeline", "compare"];

const DB = { models: [], updated: "", news: [], newsUpdated: "", terms: [], events: [], picks: null };
const state = {
  region: "all", category: "all", q: "", sort: "recent",
  glevel: "all", gq: "",
  cq: "", compare: new Set(),
  tab: "nav",
};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const debounce = (fn, ms = 160) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
const avatarText = (it) => (it.vendor || it.name || "?").slice(0, 1);

/* ---------- 数据加载 + 骨架屏 ---------- */
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
      // 隐藏骨架屏，显示内容
      $("#skeletonGrid").hidden = true;
      $("#grid").hidden = false;
      renderNav();
      renderNews();
      renderGlossary();
      renderTimeline();
      renderCompare();
    })
    .catch((e) => {
      console.error(e);
      $("#skeletonGrid").hidden = true;
      $("#grid").hidden = false;
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
  <article class="card" data-id="${esc(it.id)}" tabindex="0">
    <div class="card-head">
      <div class="avatar c-${it.category}">${esc(avatarText(it))}</div>
      <div class="card-titles">
        <div class="card-name">${esc(it.name)}${it.hot ? ' <span class="hot">🔥</span>' : ""}</div>
        <div class="card-vendor">${esc(it.vendor)}</div>
      </div>
      <div class="card-ext"><a href="${esc(it.url)}" target="_blank" rel="noopener" title="访问官网" onclick="event.stopPropagation()">↗</a></div>
    </div>
    <div class="card-desc">${esc(it.description || "")}</div>
    <div class="card-tags">
      <span class="badge r-${it.region}">${REGION_LABEL[it.region] || it.region}</span>
      <span class="badge c-${it.category}">${CATEGORY_LABEL[it.category] || it.category}</span>
      ${tags}
    </div>
    <div class="card-foot">
      <span>${date ? "发布 " + date : "—"}</span>
      <span class="card-foot-info">${it.context && it.context !== "—" ? "· " + esc(it.context) + " 上下文" : ""} ${it.pricing && it.pricing !== "—" ? "· " + esc(it.pricing) : ""}</span>
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

/* ---------- 详情弹窗 ---------- */
function findRelatedTerms(it) {
  return DB.terms.filter((t) => (t.related || []).includes(it.id));
}

function findRelatedModels(it) {
  return DB.models.filter((m) => {
    if (m.id === it.id) return false;
    if (m.vendor === it.vendor) return true;
    const shared = (m.tags || []).filter((t) => (it.tags || []).includes(t));
    return shared.length >= 1;
  }).slice(0, 4);
}

function openModal(id) {
  const it = DB.models.find((m) => m.id === id);
  if (!it) return;
  const tags = (it.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const date = (it.released || "").slice(0, 10);
  const terms = findRelatedTerms(it);
  const related = findRelatedModels(it);

  const field = (label, val) => {
    if (!val || val === "—") return "";
    return `<div class="modal-field"><span class="modal-field-label">${label}</span><span class="modal-field-val">${esc(val)}</span></div>`;
  };
  const boolField = (label, val) => {
    return `<div class="modal-field"><span class="modal-field-label">${label}</span><span class="modal-field-val ${val ? "yes" : "no"}">${val ? "✓ 支持" : "— 不支持"}</span></div>`;
  };

  const termsHTML = terms.length
    ? `<div class="modal-section"> <div class="modal-section-title">关联术语</div><div class="modal-related">${terms.map((t) => `<span class="modal-chip term" onclick="switchTab('glossary');setTimeout(()=>{document.getElementById('glossarySearch').value='${esc(t.term)}';document.getElementById('glossarySearch').dispatchEvent(new Event('input'))},100)">${esc(t.term)}</span>`).join("")}</div></div>`
    : "";

  const relatedHTML = related.length
    ? `<div class="modal-section"> <div class="modal-section-title">相关模型</div><div class="modal-related">${related.map((m) => `<span class="modal-chip" onclick="openModal('${esc(m.id)}')">${esc(m.name)}</span>`).join("")}</div></div>`
    : "";

  $("#modalBody").innerHTML = `
    <div class="modal-head">
      <div class="avatar c-${it.category}">${esc(avatarText(it))}</div>
      <div>
        <div class="modal-name">${esc(it.name)}${it.hot ? ' <span class="hot">🔥</span>' : ""}</div>
        <div class="modal-vendor">${esc(it.vendor)} · ${REGION_LABEL[it.region] || it.region} · ${CATEGORY_LABEL[it.category] || it.category}</div>
      </div>
    </div>
    <div class="modal-desc">${esc(it.description || "")}</div>
    <div class="modal-tags">${tags}</div>
    <div class="modal-fields">
      ${field("发布日期", date)}
      ${field("价格", it.pricing)}
      ${field("上下文长度", it.context)}
      ${field("许可证", it.license)}
      ${field("多模态", it.modal)}
      ${boolField("API 可用", it.api)}
    </div>
    ${termsHTML}
    ${relatedHTML}
    <div class="modal-cta">
      <a class="modal-btn primary" href="${esc(it.url)}" target="_blank" rel="noopener">访问官网 ↗</a>
      <button class="modal-btn ghost" onclick="closeModal()">关闭</button>
    </div>
  `;
  $("#modalOverlay").classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modalOverlay").classList.remove("show");
  document.body.style.overflow = "";
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
  return it.license || "—";
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
    ["价格", (it) => esc(it.pricing || "—")],
    ["上下文", (it) => esc(it.context || "—")],
    ["许可证", (it) => esc(it.license || "—")],
    ["多模态", (it) => esc(it.modal || "—")],
    ["API", (it) => it.api ? "✓" : "—"],
    ["热门", (it) => (it.hot ? "🔥 是" : "—")],
    ["标签", (it) => esc((it.tags || []).join(" · "))],
  ];
  const head = `<tr><th>属性</th>${selected.map((it) => `<th>${esc(it.name)}</th>`).join("")}</tr>`;
  const body = rows.map(([label, val]) =>
    `<tr><td>${label}</td>${selected.map((it) => `<td>${val(it)}</td>`).join("")}</tr>`
  ).join("");
  box.innerHTML = `<table class="compare"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

/* ---------- Tab 路由（hash） ---------- */
function switchTab(tab) {
  if (!TABS.includes(tab)) tab = "nav";
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab));
  if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 事件绑定 ---------- */
// Tab 切换
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

// hash 变化
window.addEventListener("hashchange", () => {
  const tab = (location.hash || "#nav").slice(1);
  switchTab(tab);
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

// 卡片点击 → 弹窗
$("#grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  openModal(card.dataset.id);
});
$("#grid").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const card = e.target.closest(".card");
  if (card) openModal(card.dataset.id);
});

// 弹窗关闭
$("#modalClose").addEventListener("click", closeModal);
$("#modalOverlay").addEventListener("click", (e) => { if (e.target === $("#modalOverlay")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

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

// 回到顶部
const backTop = $("#backTop");
window.addEventListener("scroll", () => {
  backTop.classList.toggle("show", window.scrollY > 400);
});
backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// 主题
const themeToggle = $("#themeToggle");
function applyTheme(t) { document.documentElement.dataset.theme = t; localStorage.setItem("ai-nav-theme", t); }
themeToggle.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
const saved = localStorage.getItem("ai-nav-theme");
if (saved) applyTheme(saved);
else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");

// 暴露给弹窗内联调用
window.openModal = openModal;
window.closeModal = closeModal;
window.switchTab = switchTab;

// 初始化：根据 hash 切 Tab
const initTab = (location.hash || "#nav").slice(1);
if (TABS.includes(initTab) && initTab !== "nav") switchTab(initTab);

loadAll();
