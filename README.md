# Leaderboard MVP

本地可运行的 Long-Horizon-Network-Bench 排行榜 MVP，基于 [设计文档](../docs/leaderboard_design_document.md) 实现。
当前版本对齐 Hugging Face Open LLM Leaderboard 的单列排名表风格，并提供网络任务雷达图仪表盘和 LTCO case 级评测详情页。

## 目录结构

```
leaderboard-mvp/
└── site/                 # React + Vite 前端
    └── src/
        ├── components/   # 排名表、雷达图、详情页和站点头部
        ├── data/         # 当前页面使用的 mock 数据
        ├── features/     # 排名表/雷达图数据整理逻辑
        └── i18n/         # EN/ZH UI 文案
```

## 快速开始

### 1. 启动前端开发服务器

```bash
cd site
npm install
npm run dev
```

浏览器访问 http://127.0.0.1:5173

### 2. 运行前端测试

```bash
cd site
npm test
```

### 3. 生产构建与预览

```bash
cd site
npm run build
npm run preview -- --host 127.0.0.1
```

浏览器访问 http://127.0.0.1:4173

## GitHub Pages 部署

这个目录可以作为独立仓库 `long-horizon-network-bench-leaderboard` 的根目录提交。已内置 GitHub Actions workflow：

- `.github/workflows/deploy-pages.yml`
- 从 `site/` 子目录执行 `npm ci`、`npm test`、`npm run build`
- 自动设置 `VITE_BASE_PATH=/${{ github.event.repository.name }}/`
- 上传 `site/dist` 并部署到 GitHub Pages

首次使用时，在 GitHub 仓库设置中进入 `Settings -> Pages`，将 `Source` 选择为 `GitHub Actions`。之后推送到 `master` 分支会自动部署，也可以在 Actions 页面手动触发 `Deploy leaderboard to GitHub Pages`。

如果仓库名就是 `long-horizon-network-bench-leaderboard`，最终访问地址通常是：

```text
https://<github-username>.github.io/long-horizon-network-bench-leaderboard/
```

## GitLab Pages 部署

也可以将本目录作为独立 GitLab public 仓库推送。已内置 GitLab CI 配置：

- `.gitlab-ci.yml`
- 在 `site/` 子目录执行 `npm ci`、`npm test`、`npm run build`
- 自动设置 `VITE_BASE_PATH=/${CI_PROJECT_NAME}/`
- 将 `site/dist` 复制到 GitLab Pages 需要的 `public/` artifact

推送到 GitLab 默认分支后，`pages` job 会自动发布。如果项目名是 `long-horizon-network-bench-leaderboard`，访问地址通常是：

```text
https://<gitlab-username>.gitlab.io/long-horizon-network-bench-leaderboard/
```

如果使用自定义域名或仓库名为 `<gitlab-username>.gitlab.io` 的用户主页仓库，需要将 `.gitlab-ci.yml` 中的 `VITE_BASE_PATH` 改为 `/`。

## 当前数据入口

- `site/src/data/networkDashboardMock.json`：排名表和雷达图使用的网络任务分类、模型和分数。
- `site/src/data/evaluation-details/<category>/<model>.json`：详情页 case 级评测结果，按分类分目录存放，文件名对应模型名（如 `LTCO/DeepSeek-V4-Pro.json`）。页面通过 `evaluationDetailsLoader.ts` 聚合加载。

新增模型数据时，在对应分类目录下新增 JSON 文件即可，无需改动其他模型数据。

详情 JSON 建议包含顶层 `metric` 字段，说明 `detail[].score` 的语义与单位；折线图统一绘制“相对 baseline 的优化百分比”，原始 `score` 仅在 tooltip 中展示：

```json
{
  "model": "DeepSeek-V4-Pro",
  "category": "LTCO",
  "submittedAt": "2026-06-15 10:21",
  "metric": {
    "name": "latency",
    "label": "Latency",
    "unit": "us",
    "direction": "lower_is_better",
    "baseline": "first_round"
  },
  "cases": [
    {
      "case": "ltco-a100-ag-16-128m",
      "detail": [{ "round": "round1", "score": 40874.4 }]
    }
  ]
}
```
