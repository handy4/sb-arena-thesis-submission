# LLM Social Bias Arena

> Supporting software and processed evaluation data for my master's thesis on social-bias evaluation in large language models titled "A Social Bias Evaluation Arena for Large Language Models". A live demo of the website is available [here](https://sb-arena-demo.hendrik-speh-95a.workers.dev/)

## What is included

- A React/Vite web application for browsing evaluated language models, comparing benchmark and aggregate scores, and exploring evaluation results.
- Processed JSON files in `data/`, with one file per evaluated model.
- `sbef-data-pipeline/`, a Python conversion pipeline that turns Social Bias Evaluation Framework (SBEF) result folders into the JSON format used by the web application.

## Repository structure

```text
.
├── components/                 Reusable React components, including Chart.js rendering
├── data/                       Processed evaluation output, one JSON file per model
├── pages/                      Model overview, visualization, the framework explanation, and leaderboard views
├── services/                   Runtime loading and score-extraction helpers
├── sbef-data-pipeline/         SBEF result conversion and code
├── App.tsx                     Application shell and routing
└── README.md                   This file
```

## Running the web application

### Prerequisites

Install a current Node.js LTS release and npm.

### Start a local development server

```bash
npm install
npm run dev
```

Vite serves the application at `http://localhost:3000` by default.

### Build and check the project

```bash
npm run lint
npx tsc --noEmit --noUnusedLocals --noUnusedParameters --pretty false
npm run build
```

The production build is written to `dist/`.

## Using the arena

The application exposes the thesis results through three principal views:

- **Models** provides a model-level summary, metadata, aggregate scores, benchmark details, and selected source examples.
- **Visualisation** compares models across aggregate dimensions, demographic categories, subgroups, and individual benchmarks.
- **Leaderboard** provides sortable score tables and an exploratory ranking interface.


## Evaluation data

Each file in `data/` represents one evaluated model. Files are discovered at build time with Vite's `import.meta.glob`, so a newly added JSON file becomes available to the application without changing a model registry.

At a high level, each file contains:

```json
{
  "model": {
    "name": "…",
    "metadata": {
      "creator": "…",
      "size_parameters": "…",
      "release_date": "…",
      "region": "…",
      "huggingface_model_id": "…"
    }
  },
  "benchmarks": {
    "<benchmark>": {
      "bias_dimension": "…",
      "metrics": {},
      "examples": {}
    }
  },
  "aggregates": {
    "standard": {},
    "inverse_scaling": {},
    "penalize": {}
  }
}
```

The web application primarily reads a benchmark metric's `mean.transformed_score`, with `global` and other score fields used as fallbacks when necessary. For aggregate results, the application prefers `aggregates.inverse_scaling` when that set is present. These choices implement the thesis-specific result representation; consult the thesis before comparing scores across benchmarks or drawing substantive conclusions from an aggregate value.

The processed data cover the following SBEF result folders when available:

- `stereo_set`
- `reddit_bias`
- `wino_bias`
- `bbq`
- `discrim_eval`
- `discrim_eval_gen`
- `dt_fairness`
- `bold`
- `dt_toxic`

## Regenerating data

The files in `data/` are produced by the conversion code in [`sbef-data-pipeline/`](sbef-data-pipeline/). That pipeline expects the original SBEF `final_result.json` files for a model and writes one structured output file that can be copied into `data/`.

See [`sbef-data-pipeline/README.md`](sbef-data-pipeline/README.md) for input layout, commands, aggregation behaviour, and handling of incomplete benchmark runs.

## Research-use notes and limitations

- The arena summarises benchmark outputs; it does not establish that a model is generally safe, unbiased, or suitable for a particular deployment.
- Aggregate scores are thesis-specific summaries of selected benchmark metrics. They should be interpreted together with the metric definitions and limitations discussed in the thesis.
- A missing or incomplete benchmark run can affect the available detail and the resulting aggregate values.
- Model metadata is derived from Hugging Face during conversion and is retained for identification and presentation; it is not itself an evaluation result.

