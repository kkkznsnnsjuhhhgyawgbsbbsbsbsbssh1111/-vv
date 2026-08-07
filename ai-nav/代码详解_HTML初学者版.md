# ai-nav 代码详解（HTML 初学者版）

这份文档是写给“只懂一点 HTML 基础”的读者看的。目标不是只告诉你每个文件叫什么，而是帮助你理解这个项目为什么这样写、浏览器如何把这些代码变成网页、用户点击按钮时发生了什么、JSON 数据又是怎么显示到页面上的。

## 1. 这个项目是什么

`ai-nav` 是一个 AI 前沿导航站。

它的网页里有 5 个主要页面区域：

1. 导航：展示大模型、Agent、AI 工具卡片。
2. 资讯：展示 AI 新闻资讯。
3. 术语：展示 AI 术语解释。
4. 时间线：展示 AI 发展大事件。
5. 对比：勾选多个模型，生成对比表。

它不是一个复杂的后端项目，也没有使用 Vue、React 之类的框架。它是一个“纯静态前端项目”。

也就是说，网页主要由这三类东西组成：

```text
HTML：负责页面结构
CSS：负责页面样式
JavaScript：负责加载数据、响应点击、动态生成内容
```

数据放在 JSON 文件里：

```text
data.json       模型 / Agent / 工具数据
news.json       资讯数据
glossary.json   术语数据
timeline.json   时间线数据
picks.json      本周精选数据
```

项目还有一个 `crawler` 文件夹，用来自动抓取 HuggingFace 模型和 RSS 新闻，然后更新 JSON 文件。

## 2. 项目目录结构

项目主要目录如下：

```text
ai-nav/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  ├─ data.json
│  ├─ news.json
│  ├─ glossary.json
│  ├─ timeline.json
│  └─ picks.json
├─ crawler/
│  ├─ package.json
│  └─ crawl.js
└─ README.md
```

你可以先把它理解成两个部分：

```text
public/   真正给浏览器打开的网站
crawler/  用 Node.js 自动更新数据的脚本
```

如果只是看网页效果，主要看 `public` 文件夹。

如果想理解数据怎么自动更新，再看 `crawler` 文件夹。

## 3. 浏览器打开网页时发生了什么

当你访问这个网站时，浏览器大概会按下面顺序工作：

1. 读取 `index.html`。
2. 根据 HTML 里的 `<link rel="stylesheet" href="styles.css">` 加载 CSS。
3. 根据 HTML 底部的 `<script src="app.js"></script>` 加载 JavaScript。
4. JavaScript 运行 `loadAll()`。
5. `loadAll()` 用 `fetch()` 读取多个 JSON 文件。
6. JSON 数据加载完成后，JavaScript 把数据拼成 HTML 字符串。
7. JavaScript 把这些字符串插入页面里的空容器。
8. 用户点击 Tab、筛选按钮、搜索框时，JavaScript 修改状态并重新渲染页面。

可以用一张流程图理解：

```text
index.html
   ↓
加载 styles.css
   ↓
加载 app.js
   ↓
fetch 读取 JSON
   ↓
保存到 DB 对象
   ↓
调用 renderNav / renderNews / renderGlossary / renderTimeline / renderCompare
   ↓
把数据变成页面内容
```

## 4. HTML 文件：index.html

`index.html` 是网页的骨架。

你可以把 HTML 想象成一个房子的结构图：哪里是顶部栏，哪里是导航按钮，哪里是主要内容，哪里是页脚。

这个项目的 HTML 文件并没有把所有卡片和资讯都提前写死，而是只写了一些“容器”。

例如：

```html
<div class="grid" id="grid"></div>
```

这个 `div` 一开始是空的。等 JavaScript 读取 `data.json` 后，会把模型卡片插入到这个 `div` 里面。

### 4.1 页面头部

HTML 开头是：

```html
<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
```

`<!DOCTYPE html>` 告诉浏览器：这是一个现代 HTML5 页面。

`lang="zh-CN"` 表示页面语言是简体中文。

`data-theme="light"` 是自定义属性，表示默认使用浅色主题。后面切换暗色模式时，JavaScript 会把它改成：

```html
<html lang="zh-CN" data-theme="dark">
```

CSS 会根据这个属性切换颜色。

### 4.2 head 区域

`head` 里面是网页的元信息：

```html
<meta charset="UTF-8">
```

这行非常重要，表示页面使用 UTF-8 编码。中文页面一般都需要它，否则中文可能乱码。

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

这行是为了移动端适配。没有它，手机浏览器可能会把网页当成宽屏页面缩小显示。

```html
<title>AI 前沿导航 · 大模型 · Agent · 工具</title>
```

这是浏览器标签页标题。

```html
<link rel="stylesheet" href="styles.css">
```

这行加载 CSS 样式文件。

### 4.3 顶部栏 header

页面顶部是：

```html
<header class="topbar">
```

`header` 是语义化标签，表示页面头部。

里面有品牌区域、GitHub 链接、主题切换按钮和 Tab 导航。

品牌区域大概是：

```html
<a class="brand" href="#">
  <span class="brand-mark">AI</span>
  <span class="brand-text">前沿导航<em>模型 · Agent · 工具</em></span>
</a>
```

这里用了：

`a`：链接。

`span`：行内容器，常用来包一小段文字。

`em`：强调文本，这里不是为了斜体含义，而是方便单独设置副标题样式。

### 4.4 Tab 导航

Tab 区域是：

```html
<nav class="tabs wrap" id="tabs">
  <button class="tab active" data-tab="nav">导航</button>
  <button class="tab" data-tab="news">资讯</button>
  <button class="tab" data-tab="glossary">术语</button>
  <button class="tab" data-tab="timeline">时间线</button>
  <button class="tab" data-tab="compare">对比</button>
</nav>
```

这里最重要的是 `data-tab`。

例如：

```html
<button data-tab="news">资讯</button>
```

当用户点击这个按钮时，JavaScript 会读取它的 `data-tab` 值，也就是 `news`，然后显示：

```html
<section id="view-news">
```

所以这里的命名是配套的：

```text
data-tab="nav"        对应 id="view-nav"
data-tab="news"       对应 id="view-news"
data-tab="glossary"   对应 id="view-glossary"
data-tab="timeline"   对应 id="view-timeline"
data-tab="compare"    对应 id="view-compare"
```

这是一种很常见的前端写法。

### 4.5 main 主内容

主内容写在：

```html
<main class="wrap">
```

`main` 表示页面主要内容。

里面有五个 `section`：

```html
<section class="view active" id="view-nav">
<section class="view" id="view-news">
<section class="view" id="view-glossary">
<section class="view" id="view-timeline">
<section class="view" id="view-compare">
```

每个 `section` 是一个 Tab 页面。

默认第一个有 `active`：

```html
<section class="view active" id="view-nav">
```

CSS 里规定：

```css
.view { display: none; }
.view.active { display: block; }
```

意思是：

没有 `active` 的页面隐藏。

有 `active` 的页面显示。

用户点击不同 Tab 时，JavaScript 只是移动 `active` 这个 class。

### 4.6 导航页结构

导航页有几个重要容器：

```html
<b id="statTotal">0</b>
<b id="statUpdated">—</b>
```

这两个地方显示总条目数量和更新时间。JavaScript 加载数据后会改它们的文字。

```html
<div class="seg-group" data-filter="region">
```

这是地区筛选按钮组。

```html
<div class="seg-group" data-filter="category">
```

这是类型筛选按钮组。

`data-filter` 告诉 JavaScript：这个按钮组控制哪种筛选条件。

搜索框是：

```html
<input id="searchInput" type="search" placeholder="搜索名称 / 厂商 / 标签…">
```

排序框是：

```html
<select class="select" id="sortSelect">
```

卡片容器是：

```html
<div class="grid" id="grid"></div>
```

如果没有匹配数据，会显示：

```html
<div class="empty" id="empty" hidden>没有匹配的条目</div>
```

`hidden` 表示默认隐藏。

### 4.7 script 标签

HTML 最后是：

```html
<script src="app.js"></script>
```

这行放在 `body` 底部是有好处的。

因为浏览器会先把上面的 HTML 元素解析出来，再运行 JavaScript。这样 `app.js` 里使用 `document.querySelector()` 查找元素时，这些元素已经存在了。

如果 script 放在 head 里，而没有加特殊处理，可能会出现 JavaScript 找不到 DOM 元素的问题。

## 5. CSS 文件：styles.css

CSS 负责视觉效果。

这个项目的 CSS 写得比较清楚，主要用了 CSS 变量、flex、grid、响应式媒体查询。

### 5.1 CSS 变量

文件开头是：

```css
:root {
  --bg: #f6f7f9;
  --card: #fff;
  --text: #1a1d23;
  --brand: #6366f1;
}
```

`--bg`、`--card`、`--text` 这些就是 CSS 变量。

使用时这样写：

```css
body {
  background: var(--bg);
  color: var(--text);
}
```

好处是：颜色统一管理。以后想改主题色，只需要改变量，不需要到处找颜色值。

### 5.2 暗色模式

暗色模式是这样写的：

```css
[data-theme="dark"] {
  --bg: #0d0f13;
  --card: #161a21;
  --text: #e8eaed;
}
```

当 HTML 变成：

```html
<html data-theme="dark">
```

这些变量就会覆盖浅色变量。

所以页面不用改每个元素的样式，只要改 `data-theme`，整个页面颜色就变了。

### 5.3 wrap 容器

```css
.wrap {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px;
}
```

这个 class 很常见。

`max-width: 1180px` 表示内容最大宽度。

`margin: 0 auto` 表示水平居中。

`padding: 0 24px` 表示左右留白。

很多地方都用了 `wrap`，所以页面内容不会贴着浏览器边缘。

### 5.4 顶部栏 sticky

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
}
```

`position: sticky` 表示滚动时顶部栏可以吸在顶部。

`top: 0` 表示吸附到浏览器顶部。

`z-index: 50` 表示它盖在普通内容上方。

### 5.5 Flex 布局

顶部栏内部用了：

```css
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

`display: flex` 是一维布局。

`align-items: center` 让内容垂直居中。

`justify-content: space-between` 让左边品牌和右边按钮分散到两侧。

筛选按钮区域也用了 flex：

```css
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
}
```

`flex-wrap: wrap` 表示屏幕变窄时可以换行。

### 5.6 Grid 卡片网格

模型卡片容器是：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
```

这是一段非常实用的响应式网格。

意思是：

每张卡片最小 300px。

如果一行放得下多张，就自动放多张。

如果屏幕变窄，就自动减少列数。

`1fr` 表示剩余空间平均分配。

### 5.7 卡片样式

卡片是：

```css
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 18px;
  box-shadow: var(--shadow);
}
```

也就是白底、边框、圆角、内边距、阴影。

悬浮效果：

```css
.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}
```

鼠标放上去时，卡片向上移动 3px，看起来更有交互感。

### 5.8 移动端适配

文件底部有：

```css
@media (max-width: 640px) {
  .wrap { padding: 0 16px; }
  .glossary-list { grid-template-columns: 1fr; }
}
```

这表示当屏幕宽度小于等于 640px 时，使用里面的样式。

例如术语列表从多列变成一列，更适合手机阅读。

## 6. JavaScript 文件：app.js

`app.js` 是前端最核心的文件。

它负责：

1. 加载 JSON 数据。
2. 保存页面状态。
3. 根据数据生成 HTML。
4. 绑定点击、输入、筛选、主题切换等事件。

### 6.1 标签映射

文件开头：

```js
const REGION_LABEL = { global: "全球", china: "国内" };
const CATEGORY_LABEL = { model: "大模型", agent: "Agent", tool: "工具" };
const MAX_COMPARE = 6;
```

这些是固定配置。

例如 JSON 里写的是：

```json
"region": "global"
```

页面上显示成：

```text
全球
```

`MAX_COMPARE = 6` 表示对比页最多选 6 个模型。

### 6.2 DB：保存所有数据

```js
const DB = {
  models: [],
  updated: "",
  news: [],
  newsUpdated: "",
  terms: [],
  events: [],
  picks: null
};
```

`DB` 可以理解成前端临时数据库。

网页打开时，数据还没加载，所以这些都是空的。

等 `loadAll()` 加载 JSON 后，会把数据放进去。

### 6.3 state：保存用户当前操作状态

```js
const state = {
  region: "all",
  category: "all",
  q: "",
  sort: "recent",
  glevel: "all",
  gq: "",
  cq: "",
  compare: new Set(),
};
```

`state` 保存的是“用户当前选择了什么”。

例如：

用户点击“国内”，`state.region` 就变成 `"china"`。

用户搜索“GPT”，`state.q` 就变成 `"GPT"`。

用户在对比页勾选模型，模型 ID 就进入 `state.compare`。

页面每次重新渲染，都是根据 `DB + state` 来决定显示什么。

### 6.4 $ 函数

```js
const $ = (s) => document.querySelector(s);
```

这是一个简写。

原本要写：

```js
document.querySelector("#grid")
```

现在可以写：

```js
$("#grid")
```

它的作用就是按 CSS 选择器查找页面元素。

### 6.5 esc 函数

```js
const esc = (s) => String(s).replace(/[&<>"]/g, ...);
```

这个函数用来转义 HTML 特殊字符。

为什么需要它？

因为项目会这样拼 HTML：

```js
`<div>${esc(it.name)}</div>`
```

如果不转义，假设某条数据里有：

```html
<script>alert(1)</script>
```

浏览器可能会把它当成真正的脚本执行。

`esc()` 会把 `<` 变成 `&lt;`，这样浏览器只会把它显示成普通文字。

### 6.6 debounce 防抖

```js
const debounce = (fn, ms = 160) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
```

防抖常用于搜索框。

用户输入文字时，如果每按一个键都立即重新渲染，可能会太频繁。

防抖的意思是：

用户停止输入 160 毫秒后，才真正执行搜索。

这样体验更平滑。

### 6.7 loadAll：加载所有 JSON

```js
function loadAll() {
  return Promise.all([
    fetch("data.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("news.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("glossary.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("timeline.json", { cache: "no-store" }).then((r) => r.json()),
    fetch("picks.json", { cache: "no-store" }).then((r) => r.json()),
  ])
}
```

`fetch()` 是浏览器提供的网络请求函数。

这里虽然请求的是本地 JSON 文件，但浏览器仍然用类似网络请求的方式读取。

`Promise.all()` 表示这几个请求一起发出，全部完成后再继续。

加载成功后：

```js
DB.models = data.items || [];
DB.updated = data.updated || "";
DB.news = news.items || [];
DB.newsUpdated = news.updated || "";
DB.terms = glossary.terms || [];
DB.events = timeline.events || [];
DB.picks = picks || null;
```

然后更新统计数字：

```js
$("#statTotal").textContent = DB.models.length;
$("#statUpdated").textContent = DB.updated || "—";
```

最后调用所有渲染函数。

### 6.8 filteredModels：筛选模型

```js
function filteredModels() {
  const q = state.q.trim().toLowerCase();
  let list = DB.models.filter((it) => {
    ...
  });
}
```

这个函数根据当前 `state` 筛选模型。

它主要做三层判断：

第一层：地区。

```js
if (state.region !== "all" && it.region !== state.region) return false;
```

如果当前不是“全部”，并且条目的地区不等于当前选中地区，就过滤掉。

第二层：类型。

```js
if (state.category !== "all" && it.category !== state.category) return false;
```

第三层：关键词搜索。

```js
const hay = [it.name, it.vendor, it.description, ...(it.tags || [])].join(" ").toLowerCase();
if (!hay.includes(q)) return false;
```

这里把名称、厂商、描述、标签合成一个大字符串，然后判断是否包含搜索词。

最后排序：

```js
if (state.sort === "recent") ...
else if (state.sort === "hot") ...
else if (state.sort === "name") ...
```

### 6.9 cardHTML：生成卡片 HTML

```js
function cardHTML(it) {
  return `
  <article class="card">
    ...
  </article>`;
}
```

这个函数接收一个条目对象 `it`，返回一段 HTML 字符串。

例如 `it.name` 是 `GPT-4o`，就会生成：

```html
<div class="card-name">GPT-4o</div>
```

这里用的是模板字符串，也就是反引号：

```js
`你好 ${name}`
```

`${}` 里面可以放变量或表达式。

### 6.10 renderNav：渲染导航页

```js
function renderNav() {
  renderPicks();
  const list = filteredModels();
  const grid = $("#grid");
  if (!list.length) {
    grid.innerHTML = "";
    $("#empty").hidden = false;
    return;
  }
  $("#empty").hidden = true;
  grid.innerHTML = list.map(cardHTML).join("");
}
```

这段是典型的前端渲染逻辑。

先拿到筛选后的数据。

如果没有数据，清空卡片区域并显示空状态。

如果有数据，就把每一条数据交给 `cardHTML()`，生成很多 HTML 字符串，再用 `join("")` 拼起来，最后写入：

```js
grid.innerHTML
```

`innerHTML` 的意思是：把某个元素里面的 HTML 内容替换掉。

### 6.11 renderNews：渲染资讯

```js
function renderNews() {
  $("#newsMeta").textContent = DB.news.length
    ? `${DB.news.length} 条 · 更新于 ${DB.newsUpdated || "—"}`
    : "暂无资讯";
}
```

它先更新资讯数量和更新时间。

然后把 `DB.news` 里的每条资讯渲染成：

```html
<article class="news-item">
  <div class="news-meta">...</div>
  <a class="news-title" href="...">...</a>
  <div class="news-summary">...</div>
</article>
```

这里的 `article` 是语义化标签，表示一条独立内容。

### 6.12 renderGlossary：渲染术语

术语筛选逻辑和模型筛选很像。

`filteredTerms()` 按等级和关键词筛选。

`renderGlossary()` 把术语变成卡片。

术语数据一般长这样：

```json
{
  "term": "大语言模型",
  "en": "LLM",
  "level": "入门",
  "explain": "用海量文本训练、能理解和生成人类语言的神经网络。"
}
```

页面显示中文名、英文缩写、等级和解释。

### 6.13 renderTimeline：渲染时间线

```js
const events = [...DB.events].sort((a, b) =>
  (a.date || "").localeCompare(b.date || "")
);
```

`[...DB.events]` 是复制数组。

为什么要复制？

因为 `sort()` 会修改原数组。复制一份再排序，可以避免直接改变 `DB.events`。

排序后，每个事件变成：

```html
<div class="tl-item r-global">
  <div class="tl-date">2017-06</div>
  <div class="tl-title">Transformer 架构提出</div>
  <div class="tl-desc">...</div>
</div>
```

CSS 根据 `r-global` 或 `r-china` 改变节点颜色。

### 6.14 模型对比

对比页有两个主要函数：

```js
renderCompare()
renderCompareTable()
```

`renderCompare()` 渲染上方可勾选列表。

`renderCompareTable()` 渲染下方表格。

用户点击某个模型时：

```js
if (state.compare.has(id)) {
  state.compare.delete(id);
} else if (state.compare.size < MAX_COMPARE) {
  state.compare.add(id);
}
```

意思是：

如果已经选中，就取消。

如果没选中，并且还没超过 6 个，就加入选择。

选完后重新调用：

```js
renderCompare();
```

页面就更新了。

### 6.15 Tab 切换

Tab 切换代码：

```js
$("#tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  ...
});
```

这里用了事件委托。

不是给每个按钮单独绑定点击事件，而是给父元素 `#tabs` 绑定一次。

用户点击按钮时，通过：

```js
e.target.closest(".tab")
```

找到被点击的 Tab 按钮。

然后移除所有按钮的 `active`：

```js
document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
```

给当前按钮加上 `active`：

```js
btn.classList.add("active");
```

再隐藏所有页面，显示目标页面：

```js
document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
$("#view-" + tab).classList.add("active");
```

这就是 Tab 页切换的本质：修改 class。

### 6.16 主题切换

```js
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("ai-nav-theme", t);
}
```

`document.documentElement` 指的是 `<html>` 元素。

这行：

```js
document.documentElement.dataset.theme = t;
```

会把 HTML 改成：

```html
<html data-theme="dark">
```

或者：

```html
<html data-theme="light">
```

`localStorage` 是浏览器本地存储。

把主题保存进去后，下次打开页面还能记住用户选择。

## 7. JSON 数据文件

这个项目的一个重点是：页面内容不是写死在 HTML 里的，而是写在 JSON 里。

这对维护很友好。

如果你想新增一个模型，不需要改 HTML，只需要往 `data.json` 加一条数据。

### 7.1 data.json

`data.json` 存模型、Agent、工具。

主要字段：

```text
id           唯一标识
name         名称
vendor       厂商
region       地区：global 或 china
category     类型：model / agent / tool
released     发布日期
description  简介
url          官网链接
tags         标签数组
hot          是否热门
auto         是否由爬虫自动加入
```

前端导航页和对比页都依赖这个文件。

### 7.2 news.json

`news.json` 存资讯。

主要字段：

```text
updated      更新时间
items        资讯数组
```

每条资讯有：

```text
title        标题
source       来源
url          链接
date         日期
summary      摘要
```

### 7.3 glossary.json

`glossary.json` 存术语。

每条术语有：

```text
term         中文术语
en           英文缩写或英文名
level        入门 / 进阶 / 前沿
explain      一句话解释
related      相关条目
```

### 7.4 timeline.json

`timeline.json` 存发展时间线。

每条事件有：

```text
date         日期
title        标题
desc         描述
region       global / china
```

### 7.5 picks.json

`picks.json` 存本周精选。

它通常不存完整模型信息，只存 ID。

前端会根据这些 ID 去 `data.json` 中查找完整条目。

好处是：精选列表维护很简单。

## 8. 爬虫：crawler/crawl.js

`crawler/crawl.js` 是 Node.js 脚本，不是在浏览器里运行的。

它的职责是自动更新数据。

### 8.1 Node.js 和浏览器 JavaScript 的区别

`app.js` 运行在浏览器里。

`crawl.js` 运行在 Node.js 里。

浏览器 JavaScript 擅长操作页面，比如：

```js
document.querySelector()
addEventListener()
localStorage
```

Node.js JavaScript 擅长操作文件和网络，比如：

```js
fs.readFileSync()
fs.writeFileSync()
path.join()
```

所以你会看到 `crawl.js` 开头：

```js
import fs from "node:fs";
import path from "node:path";
```

这些在普通浏览器 JS 里是不能直接用的。

### 8.2 路径定位

```js
const PUB = path.join(__dirname, "..", "public");
const DATA_FILE = path.join(PUB, "data.json");
const NEWS_FILE = path.join(PUB, "news.json");
```

这里的意思是：

从 `crawler` 文件夹出发，往上一级，再进入 `public` 文件夹。

也就是找到：

```text
ai-nav/public/data.json
ai-nav/public/news.json
```

### 8.3 today 函数

```js
function today() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}
```

这个函数返回今天日期，格式是：

```text
YYYY-MM-DD
```

例如：

```text
2026-07-30
```

它用于写入 JSON 的 `updated` 字段。

### 8.4 读写 JSON

```js
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
```

这段做两件事：

1. 用 `fs.readFileSync()` 读取文件文本。
2. 用 `JSON.parse()` 把文本转成 JavaScript 对象。

写 JSON：

```js
function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
```

`JSON.stringify(data, null, 2)` 表示把对象转成格式化 JSON，并缩进 2 个空格。

### 8.5 抓 HuggingFace 模型

```js
async function fetchHF(limit) {
  const url = `https://huggingface.co/api/models?...`;
  const res = await fetch(url, ...);
  if (!res.ok) throw new Error(...);
  return res.json();
}
```

`async / await` 是异步写法。

请求网络需要等待，所以用 `await fetch(url)`。

如果请求失败，就抛出错误。

### 8.6 把 HuggingFace 数据转成站内格式

```js
function hfToItem(m) {
  ...
  return {
    id,
    name,
    vendor,
    region,
    category: "model",
    released,
    description,
    url,
    tags,
    auto: true,
  };
}
```

HuggingFace 返回的数据结构和本站需要的数据结构不完全一样。

所以需要转换。

比如 HuggingFace 的模型 ID 可能是：

```text
Qwen/Qwen2.5-7B-Instruct
```

脚本会拆成：

```text
vendor: Qwen
name: Qwen2.5-7B-Instruct
```

如果组织名在 `CHINA_ORGS` 里，就标记为国内。

### 8.7 crawlModels 主流程

`crawlModels()` 做这些事：

1. 读取现有 `data.json`。
2. 建立一个 `seen` 集合，用来去重。
3. 调用 HuggingFace API。
4. 跳过下载量太低的模型。
5. 转换成站内格式。
6. 如果不存在，就追加到 `data.items`。
7. 如果新增了内容，就更新 `data.updated` 并写回文件。

它的去重逻辑主要看两个东西：

```text
模型名称
模型 URL
```

这样可以减少重复添加。

### 8.8 抓 RSS 资讯

RSS 源列表写在：

```js
const RSS_FEEDS = [
  { source: "机器之心", url: "https://www.jiqizhixin.com/rss" },
  ...
];
```

`crawlNews()` 会并发抓取这些 RSS。

它用了：

```js
Promise.allSettled(...)
```

这个方法的特点是：即使某个源失败，也不会影响其他源。

这对爬虫很重要，因为 RSS 源经常会临时不可用。

### 8.9 parseFeed 解析 RSS / Atom

`parseFeed(xml, source)` 负责把 XML 文本解析成资讯数组。

它先判断格式：

```js
const isAtom = /<feed\b/i.test(xml) && !/<rss\b/i.test(xml);
```

如果是 Atom，就找 `<entry>`。

如果是 RSS，就找 `<item>`。

然后提取：

```text
title
link
date
description / summary / content
```

### 8.10 strip 清理文本

RSS 摘要里经常有 HTML 标签，比如：

```html
<p>这是一段摘要</p>
```

`strip()` 会把标签去掉，变成普通文字。

它还会处理一些 HTML 实体：

```text
&amp;  变成 &
&lt;   变成 <
&gt;   变成 >
&quot; 变成 "
```

### 8.11 main 入口

```js
async function main() {
  const limit = parseInt(...);
  await crawlModels(limit);
  await crawlNews();
  console.log("爬虫完成。");
}
```

这里是整个爬虫的入口。

如果运行：

```bash
node crawl.js --limit 40
```

`limit` 就是 40。

如果不写，默认也是 40。

## 9. 最重要的理解：HTML 只是容器，JS 负责填内容

对于这个项目，你最应该先理解这一点：

`index.html` 里没有写死所有模型卡片。

它只写了：

```html
<div class="grid" id="grid"></div>
```

真正的卡片来自：

```js
grid.innerHTML = list.map(cardHTML).join("");
```

所以页面内容来自 JSON。

JavaScript 的工作就是：

```text
读取 JSON
筛选数据
拼 HTML
插入页面
```

这类项目可以叫“数据驱动的静态页面”。

## 10. 如果你想修改这个项目

### 10.1 修改页面文字

如果是固定文字，比如标题、按钮、说明，通常改：

```text
public/index.html
```

例如改首页标题：

```html
<h1>看清 AI 前沿，一页掌握</h1>
```

### 10.2 修改颜色、间距、卡片样式

改：

```text
public/styles.css
```

比如改品牌色：

```css
--brand: #6366f1;
```

### 10.3 修改模型、工具、Agent 数据

改：

```text
public/data.json
```

新增条目时，注意字段要完整，尤其是：

```text
id
name
vendor
region
category
released
description
url
tags
```

### 10.4 修改资讯来源

改：

```text
crawler/crawl.js
```

找到：

```js
const RSS_FEEDS = [...]
```

往里面加新的 RSS 源。

### 10.5 修改 Tab 逻辑

如果要新增一个 Tab，需要同时改三个地方：

1. `index.html` 里新增一个按钮。
2. `index.html` 里新增一个 `section`。
3. `app.js` 里新增对应的渲染函数和数据加载逻辑。

例如新增 `排行榜`：

```html
<button class="tab" data-tab="rank">排行榜</button>
```

对应：

```html
<section class="view" id="view-rank"></section>
```

因为 JavaScript 用的是：

```js
$("#view-" + tab)
```

所以 `data-tab="rank"` 会自动对应 `id="view-rank"`。

## 11. 初学者建议阅读顺序

建议按这个顺序看：

1. 先看 `index.html`，只关注页面分成哪几块。
2. 再看 `styles.css`，理解 class 是怎么让页面变好看的。
3. 然后看 `data.json`，理解页面内容从哪里来。
4. 最后看 `app.js`，重点看 `loadAll()`、`renderNav()`、`cardHTML()`。
5. 等前端理解后，再看 `crawler/crawl.js`。

如果你刚开始学 HTML，不需要一上来就完全理解爬虫。先理解这个核心链路：

```text
HTML 提供容器
CSS 美化容器
JSON 提供数据
JS 把数据放进容器
```

理解了这句话，这个项目的大半逻辑就通了。

## 12. 一句话总结

`ai-nav` 的本质是一个纯静态数据展示站：HTML 搭架子，CSS 做样式，JavaScript 读取 JSON 并动态渲染内容，Node 爬虫定期更新 JSON 数据。

