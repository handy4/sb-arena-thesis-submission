# SBEF JSON Converter

This folder converts original Social Bias Evaluation Framework (SBEF) benchmark
result folders into one streamlined JSON file per model.

## Contents

- `aggregate_sbef_results.py`: converter CLI
- `utils/`: benchmark readers and metric calculators
- `sbef_results/`: original SBEF result folders

Expected input layout:

```text
sbef_results/
  <model_name>/
    stereo_set/final_result.json
    reddit_bias/final_result.json
    ...
```

## Setup

```powershell
pip install -r requirements.txt
```

## Usage

Run the converter from this folder:

```powershell
python aggregate_sbef_results.py <model_name> <region>
```

Example:

```powershell
python aggregate_sbef_results.py Qwen3.5-9B China --hf-model-id Qwen/Qwen3.5-9B
```

For incomplete benchmark folders:

```powershell
python aggregate_sbef_results.py <model_name> <region> --incomplete
```

By default, converted files are written to `output/`.
The converter fetches model metadata from Hugging Face. Use `--hf-model-id` when
the local model folder name is not enough to identify the repository.
