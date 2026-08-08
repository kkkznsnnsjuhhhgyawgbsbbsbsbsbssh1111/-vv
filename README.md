[Uploading README.md…]()
# AI 前沿导航

面向学习与教学的 AI 前沿聚合站：聚合全球与国内最新**大模型、AI Agent、热门工具**，并内置**资讯流、术语词典、发展时间线、模型对比**。纯静态前端 + 定时爬虫自动更新，全栈部署于 Cloudflare（免费）。

## 功能（五个 Tab）

| Tab | 内容 | 数据文件 |
|-----|------|---------|
| 导航 | 卡片墙 + 地区/类型筛选 + 搜索 + 排序 + 本周精选 | `data.json` `picks.json` |
| 资讯 | 每日抓取 AI RSS 资讯流（机器之心/量子位/HN/OpenAI 等） | `news.json` |
| 术语 | 30+ AI 术语一句话解读，按入门/进阶/前沿分级 | `glossary.json` |
| 时间线 | 2017→2026 AI 大事记可视化 | `timeline.json` |
| 对比 | 勾选 2–6 个模型横评（厂商/地区/类型/发布/开源/热门） | `data.json` |

## 目录结构

```
ai-nav/
├── public/            # 静态站点（Cloudflare Pages 部署目录）
│   ├── index.html     # 多 Tab 页面
│   ├── styles.css     # 样式（含深色模式）
│   ├── app.js         # Tab 路由 + 各视图渲染逻辑
│   ├── data.json      # 模型/Agent/工具（策展基线 + 爬虫追加）
│   ├── news.json      # 资讯（爬虫抓 RSS 生成）
│   ├── glossary.json  # 术语词典（策展）
│   ├── timeline.json  # 发展时间线（策展）
│   └── picks.json     # 本周精选（策展）
├── crawler/           # 爬虫
│   ├── package.json
│   └── crawl.js       # 抓 HuggingFace 模型 + 抓 RSS 资讯，回写 data/news.json
└── README.md
.github/workflows/crawl.yml   # 每日定时跑爬虫并提交数据
```

## 数据来源

- **策展基线**：`data.json` 手动维护 40+ 条精选条目；`glossary.json`/`timeline.json`/`picks.json` 手动策展。
- **自动爬取**：`crawl.js` 抓取 HuggingFace API 热门开源模型（去重追加，标 `auto:true`，国内 org 归入「国内」）+ 抓取多家 RSS 生成 `news.json`。
- **半人工策展**：新工具（如 WorkBuddy、Manus）无统一数据源，直接编辑对应 JSON 即可。

每条模型字段：`id / name / vendor / region(global|china) / category(model|agent|tool) / released / description / url / tags / hot`

## 本地预览

```bash
cd ai-nav/public
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 手动跑一次爬虫

```bash
cd ai-nav/crawler
node crawl.js --limit 40
```

> 需 Node 18+（内置 fetch，无第三方依赖）。网络失败时爬虫保留现有数据，不丢内容。

## 部署到 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git
2. 选中本 GitHub 仓库
3. 构建设置：
   - **Framework preset**: None
   - **Build command**: 留空（纯静态，无需构建）
   - **Build output directory**: `ai-nav/public`
   - **Root directory**: `/`
4. 保存并部署。推送代码即自动发布；GitHub Actions 每日提交新数据也会触发重新部署。

## 后续可扩展

- 给模型补「价格/上下文长度」字段，让对比更实用
- 加详情页、热度趋势图
- 迁移到 Cloudflare Workers + D1（带搜索后端、用户收藏）
- 增加贡献入口（学生/访客提交新条目 → PR）
