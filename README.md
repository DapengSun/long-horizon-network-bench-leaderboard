# Long-Horizon-Network-Bench Leaderboard

Web frontend for the Long-Horizon-Network-Bench evaluation leaderboard. The site presents model rankings, benchmark comparisons, and per-evaluation drill-down views.

## Features

- **Ranking** — Sortable leaderboard with benchmark category filters, model search, and configurable columns.
- **Dashboard** — Radar chart comparing models across network task categories; search and legend stay in sync.
- **Evaluation details** — Case-level results for a selected model and category, with per-case optimization trend charts.
- **Localization** — English and Chinese UI.
- **External link** — Shortcut to run your own evaluation via NetEval-Pro.

## Project layout

```
leaderboard-mvp/
└── site/                 # React + Vite frontend
    └── src/
        ├── components/   # Ranking table, dashboard, detail views, site header
        ├── data/         # Static evaluation payloads
        ├── features/     # Ranking and chart data helpers
        └── i18n/         # EN / ZH UI strings
```

## Development

```bash
cd site
npm install
npm run dev
```

Open http://127.0.0.1:5173

### Tests

```bash
cd site
npm test
```

### Production build

```bash
cd site
npm run build
npm run preview -- --host 127.0.0.1
```

Open http://127.0.0.1:4173

## Deployment

This directory can be published as a standalone repository (e.g. `long-horizon-network-bench-leaderboard`).

### GitHub Pages

Workflow: `.github/workflows/deploy-pages.yml`

- Runs `npm ci`, `npm test`, and `npm run build` in `site/`
- Sets `VITE_BASE_PATH=/${{ github.event.repository.name }}/`
- Deploys `site/dist` to GitHub Pages

In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**. Pushes to `master` deploy automatically; you can also trigger **Deploy leaderboard to GitHub Pages** manually.

Example URL:

```text
https://<github-username>.github.io/long-horizon-network-bench-leaderboard/
```

### GitLab Pages

Workflow: `.gitlab-ci.yml`

- Runs `npm ci`, `npm test`, and `npm run build` in `site/`
- Sets `VITE_BASE_PATH=/${CI_PROJECT_NAME}/`
- Publishes `site/dist` as the Pages artifact

Pushes to the default branch trigger deployment automatically.

Example URL:

```text
https://<gitlab-username>.gitlab.io/long-horizon-network-bench-leaderboard/
```

For a user Pages site (`<gitlab-username>.gitlab.io`) or a custom domain, set `VITE_BASE_PATH` to `/` in `.gitlab-ci.yml`.
