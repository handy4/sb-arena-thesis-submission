# SBEF Data Pipeline

> Conversion and aggregation code used to prepare the Social Bias Evaluation Framework (SBEF) results presented in my thesis.

## Thesis role

This directory contains the data-preparation stage for the accompanying thesis. It converts a model's raw SBEF benchmark-result folders into one structured JSON file that is consumed by the repository’s React application in `../data/`.

The pipeline does **not** implement a new benchmark suite. It reads SBEF outputs, recalculates the thesis-specific metric representations and aggregates, attaches selected source examples, and standardises the result schema for inspection in the LLM Social Bias Arena. The thesis remains the authoritative source for the evaluation design, the choice and interpretation of metrics, and the rationale for aggregation.

## Contents

```text
sbef-data-pipeline/
├── aggregate_sbef_results.py   Command-line converter and aggregation entry point
├── utils/                      Benchmark-specific readers and metric calculators
├── requirements.txt            Python dependencies
├── sbef_results/               Expected location of local raw SBEF result folders
└── output/                     Default location for converted per-model JSON files
```

The `sbef_results/` and `output/` directories are working directories. Create them locally when they are not already present.

## What the converter does

For a selected model, `aggregate_sbef_results.py`:

1. Reads the available SBEF `final_result.json` files.
2. Uses the benchmark-specific readers and calculators in `utils/` to recompute the metric values used by the thesis output.
3. Stores original and transformed score information at global, demographic-category, and subgroup levels when available.
4. Extracts selected source examples for display in the web application.
5. Calculates model-level results by bias dimension and across benchmarks using the `standard`, `inverse_scaling`, and `penalize` aggregate modes.
6. Retrieves model-identification metadata from the Hugging Face API, including the model identifier, creator, release date, and parameter-size information where available.
7. Writes one JSON document for the model.


## Requirements

- Python 3.10 or later
- `pip`
- Network access when Hugging Face model metadata is retrieved

Install the Python dependency:

```bash
cd sbef-data-pipeline
python -m pip install -r requirements.txt
```

An isolated virtual environment is recommended:

```bash
python -m venv .venv
```

Activate it with one of the following commands:

```bash
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

Then install dependencies:

```bash
python -m pip install -r requirements.txt
```

## Expected input layout

Run the converter from `sbef-data-pipeline/`. It expects raw SBEF results in the following structure:

```text
sbef_results/
└── <model_name>/
    ├── stereo_set/final_result.json
    ├── reddit_bias/final_result.json
    ├── wino_bias/final_result.json
    ├── bbq/final_result.json
    ├── discrim_eval/final_result.json
    ├── discrim_eval_gen/final_result.json
    ├── dt_fairness/final_result.json
    ├── bold/final_result.json
    └── dt_toxic/final_result.json
```

The pipeline recognises these benchmark folders:

| Folder | Thesis aggregation dimension |
|---|---|
| `stereo_set` | Stereotype bias |
| `reddit_bias` | Stereotype bias |
| `wino_bias` | Stereotype bias |
| `bbq` | Stereotype bias |
| `discrim_eval` | Fairness |
| `discrim_eval_gen` | Fairness |
| `dt_fairness` | Fairness |
| `bold` | Toxicity and sentiment |
| `dt_toxic` | Toxicity |

## Running the converter

### Complete result folder

```bash
python aggregate_sbef_results.py <model_name> <region>
```

Example:

```bash
python aggregate_sbef_results.py Qwen3.5-9B China --hf-model-id Qwen/Qwen3.5-9B
```

By default, the converter expects a complete set of benchmark folders and writes the converted file to `output/`.

### Incomplete result folder

Use `--incomplete` when one or more benchmark folders are unavailable:

```bash
python aggregate_sbef_results.py <model_name> <region> --incomplete
```

This preserves the available benchmark results while allowing the output to record that the model evaluation is incomplete. Any comparisons using such output should be interpreted with this missing coverage in mind.

### Resolving model metadata

The converter queries Hugging Face to enrich the output with model metadata. Supply `--hf-model-id <owner/repository>` whenever the local folder name is ambiguous or does not match the Hugging Face repository name:

```bash
python aggregate_sbef_results.py <model_name> <region> --hf-model-id <owner/repository>
```

## Output format

The converter creates one JSON file per model. Its main sections are:

```json
{
  "model": {
    "name": "…",
    "metadata": {}
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

Metric entries may include:

- `original_score` and `original_sign`: the score representation obtained from the benchmark calculation;
- `transformed_score`: the signed transformed representation used for the thesis output;
- `transformed_score_abs`: the corresponding absolute magnitude;
- `global`, `mean`, `by_demographic_category`, and `by_subgroup`: aggregation levels where the source benchmark supports them.

## Using converted files in the web application

Copy a completed model JSON file from `output/` to the top-level `../data/` directory. The React application discovers `data/*.json` files automatically, so the model will be available after the application is restarted or rebuilt.

For example:

```bash
# macOS / Linux
cp output/<model_name>.json ../data/

# Windows PowerShell
Copy-Item output\<model_name>.json ..\data\
```

## Troubleshooting

- **Missing benchmark results:** Check the expected input layout. Use `--incomplete` only when partial coverage is intentional and clearly documented in your analysis.
- **Hugging Face lookup fails or finds the wrong model:** Pass `--hf-model-id` explicitly.
- **No file appears in the web application:** Confirm that the converted file is valid JSON, is placed directly in `../data/`, and that the development server or production build has been restarted.

