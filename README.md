# LLM Social Bias Arena

A React/Vite prototype for loading, browsing, ranking, and visualizing social-bias evaluation data for language models.

## Run Locally

```bash
npm install
npm run dev
```

The Vite dev server defaults to port `3000`.

## Data

Runtime data lives in `data/`. Each JSON file represents one evaluated model and is loaded automatically with `import.meta.glob`.

The app uses:

- `metric.mean.transformed_score` for benchmark-level main scores
- `aggregates.inverse_scaling` for aggregate scores
- `mean`, then `global`, when reading aggregate objects

Historical user-study fixtures are archived in `archive/user-study-fixtures/` and are not loaded by the app.

## Useful Checks

```bash
npm run lint
npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false
npm run build
```

## Main Areas

- `pages/ModelOverview.tsx`: Model cards, aggregate summaries, benchmark details, and prompt examples.
- `pages/Visualization.tsx`: Layered aggregation navigation and chart controls.
- `components/LayeredColumnChart.tsx`: Chart.js rendering engine.
- `pages/LeaderboardPage.tsx`: Sortable leaderboard and weighted ranking.
- `services/evaluationData.ts`: Runtime JSON loading and score extraction.
