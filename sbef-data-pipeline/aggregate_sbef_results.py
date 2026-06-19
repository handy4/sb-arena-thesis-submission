#!/usr/bin/env python3
"""Aggregate SBEF benchmark results for a single model.

The converter reads each benchmark's SBEF ``final_result.json``, recomputes the
metrics used in the thesis output, attaches one or more source examples, rolls
the benchmark scores up to model-level aggregates, and writes one JSON file.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from numbers import Real
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from utils import (
    calculate_bbq_ambiguous_score,
    calculate_bbq_disambiguated_score,
    calculate_bold_sentiment,
    calculate_bold_toxicity,
    calculate_discrim_eval_gen_max_min_diff,
    calculate_discrim_eval_gen_mean_abs_dev,
    calculate_discrim_eval_max_min_diff,
    calculate_discrim_eval_mean_abs_dev,
    calculate_dt_fairness_demographic_parity_diff,
    calculate_dt_fairness_equalized_odds_diff,
    calculate_dt_toxic_toxicity,
    calculate_reddit_bias_stereotype_score,
    calculate_stereo_set_stereotype_score,
    calculate_wino_bias_historical_bias,
    calculate_wino_bias_population_bias,
    read_bbq_results,
    read_bold_results,
    read_discrim_eval_gen_results,
    read_discrim_eval_results,
    read_dt_fairness_results,
    read_dt_toxic_results,
    read_reddit_bias_results,
    read_stereo_set_results,
    read_wino_bias_results,
)


BENCHMARKS = [
    "stereo_set",
    "reddit_bias",
    "wino_bias",
    "bbq",
    "discrim_eval",
    "discrim_eval_gen",
    "dt_fairness",
    "bold",
    "dt_toxic",
]

HUGGING_FACE_API_BASE = "https://huggingface.co/api"

BIAS_DIMENSIONS = {
    "stereo_set": "stereotype_bias",
    "reddit_bias": "stereotype_bias",
    "wino_bias": "stereotype_bias",
    "bbq": "stereotype_bias",
    "discrim_eval": "fairness",
    "discrim_eval_gen": "fairness",
    "dt_fairness": "fairness",
    "bold": "sentiment_toxicity",
    "dt_toxic": "toxicity",
}

AGGREGATE_METRICS = [
    {"benchmark": "stereo_set", "metric": "stereotype_score", "bias_dimension": "stereotype_bias"},
    {"benchmark": "reddit_bias", "metric": "stereotype_score", "bias_dimension": "stereotype_bias"},
    {"benchmark": "wino_bias", "metric": "combined_bias", "bias_dimension": "stereotype_bias"},
    {"benchmark": "bbq", "metric": "s_combined", "bias_dimension": "stereotype_bias"},
    {"benchmark": "discrim_eval", "metric": "mean_abs_dev", "bias_dimension": "fairness"},
    {"benchmark": "discrim_eval_gen", "metric": "mean_abs_dev", "bias_dimension": "fairness"},
    {"benchmark": "dt_fairness", "metric": "combined_diff", "bias_dimension": "fairness"},
    {"benchmark": "bold", "metric": "toxicity", "bias_dimension": "toxicity"},
    {"benchmark": "dt_toxic", "metric": "toxicity", "bias_dimension": "toxicity"},
    {"benchmark": "bold", "metric": "sentiment", "bias_dimension": "sentiment"},
]

SUBGROUP_LABEL_ALIASES = {
    "african american": "black",
    "african americans": "black",
    "african_american": "black",
    "african_americans": "black",
    "asian american": "asian",
    "asian americans": "asian",
    "asian_american": "asian",
    "asian_americans": "asian",
}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def clean_number(value: Any) -> float | int | None:
    if isinstance(value, bool) or not isinstance(value, Real):
        return None
    numeric_value = float(value)
    if not math.isfinite(numeric_value):
        return None
    return numeric_value


def mean_numeric(values: list[Any]) -> float | None:
    numeric_values = [float(value) for value in values if clean_number(value) is not None]
    if not numeric_values:
        return None
    return sum(numeric_values) / len(numeric_values)


def sanitize_score(score: Any) -> dict[str, Any]:
    if not isinstance(score, dict):
        return {
            "original_score": None,
            "original_sign": "n_a",
            "transformed_score": None,
            "transformed_score_abs": None,
        }

    transformed_score = clean_number(score.get("transformed_score"))
    transformed_score_abs = clean_number(score.get("transformed_score_abs"))
    if transformed_score_abs is None and transformed_score is not None:
        transformed_score_abs = abs(float(transformed_score))

    original_sign = score.get("original_sign")
    if original_sign not in {"pos", "neg", "n_a"}:
        original_sign = "n_a"

    return {
        "original_score": clean_number(score.get("original_score")),
        "original_sign": original_sign,
        "transformed_score": transformed_score,
        "transformed_score_abs": transformed_score_abs,
    }


def mean_score(scores: list[Any]) -> dict[str, Any]:
    sanitized_scores = [sanitize_score(score) for score in scores]
    original_score = mean_numeric([score["original_score"] for score in sanitized_scores])
    transformed_score = mean_numeric([score["transformed_score"] for score in sanitized_scores])
    transformed_score_abs = None if transformed_score is None else abs(transformed_score)
    if transformed_score is None:
        original_sign = "n_a"
    else:
        original_sign = "pos" if transformed_score >= 0 else "neg"

    return {
        "original_score": original_score,
        "original_sign": original_sign,
        "transformed_score": transformed_score,
        "transformed_score_abs": transformed_score_abs,
    }


def normalize_category_scores(scores: dict[str, Any]) -> dict[str, Any]:
    grouped_scores: dict[str, list[Any]] = {}
    for category, score in scores.items():
        category_key = canonicalize_demographic_category(str(category))
        grouped_scores.setdefault(category_key, []).append(score)

    return {
        category: mean_score(category_scores)
        for category, category_scores in sorted(grouped_scores.items())
    }


def normalize_subgroup_score_labels(subgroups: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped_scores: dict[str, dict[str, list[Any]]] = {}
    for category, subgroup_scores in subgroups.items():
        category_key = canonicalize_demographic_category(str(category))
        grouped_scores.setdefault(category_key, {})
        for subgroup, score in subgroup_scores.items():
            subgroup_key = canonicalize_subgroup_label(str(subgroup))
            grouped_scores[category_key].setdefault(subgroup_key, []).append(score)

    return {
        category: {
            subgroup: mean_score(scores)
            for subgroup, scores in sorted(subgroup_scores.items())
        }
        for category, subgroup_scores in sorted(grouped_scores.items())
    }


def format_metric_result(result: dict[str, Any]) -> dict[str, Any]:
    by_category = normalize_category_scores(as_dict(result.get("by_category")))
    metric_output: dict[str, Any] = {
        "global": sanitize_score(result.get("global")),
    }

    if by_category:
        metric_output["mean"] = mean_score(list(by_category.values()))
        metric_output["by_demographic_category"] = by_category
    else:
        metric_output["mean"] = metric_output["global"]

    by_subgroup = normalize_subgroup_score_labels(as_dict(result.get("by_subgroup")))
    if by_subgroup:
        metric_output["by_subgroup"] = by_subgroup

    return metric_output


def average_metric_outputs(*metric_outputs: dict[str, Any]) -> dict[str, Any]:
    averaged: dict[str, Any] = {
        "global": mean_score([metric_output.get("global") for metric_output in metric_outputs]),
        "mean": mean_score([metric_output.get("mean") for metric_output in metric_outputs]),
    }

    categories: dict[str, list[Any]] = {}
    subgroups: dict[str, dict[str, list[Any]]] = {}
    for metric_output in metric_outputs:
        for category, score in as_dict(metric_output.get("by_demographic_category")).items():
            categories.setdefault(category, []).append(score)

        for category, subgroup_scores in as_dict(metric_output.get("by_subgroup")).items():
            subgroups.setdefault(category, {})
            for subgroup, score in as_dict(subgroup_scores).items():
                subgroups[category].setdefault(subgroup, []).append(score)

    if categories:
        averaged["by_demographic_category"] = {
            category: mean_score(scores)
            for category, scores in sorted(categories.items())
        }

    if subgroups:
        averaged["by_subgroup"] = {
            category: {
                subgroup: mean_score(scores)
                for subgroup, scores in sorted(subgroup_scores.items())
            }
            for category, subgroup_scores in sorted(subgroups.items())
        }

    return averaged


def canonicalize_subgroup_label(subgroup: str) -> str:
    normalized = subgroup.strip().lower()
    return SUBGROUP_LABEL_ALIASES.get(normalized, subgroup)


def canonicalize_demographic_category(category: str) -> str:
    normalized = category.strip().lower()
    if normalized in {"religion_jc", "religion_mc"}:
        return "religion"
    return normalized


def get_raw_results(result: dict[str, Any]) -> dict[str, Any]:
    final_result = result.get("FinalResult", {})
    raw_results = final_result.get("raw_results", {})
    if not isinstance(raw_results, dict):
        return {}
    return raw_results


def as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def build_benchmark_output(benchmark: str, final_result_path: Path) -> dict[str, Any]:
    result = load_json(final_result_path)
    benchmark_output = {
        "bias_dimension": BIAS_DIMENSIONS[benchmark],
        "metrics": extract_benchmark_metrics(benchmark, final_result_path),
    }
    examples = extract_benchmark_examples(benchmark, get_raw_results(result))
    if examples:
        benchmark_output["examples"] = examples
    return benchmark_output


def extract_stereo_set_metrics(final_result_path: Path) -> dict[str, Any]:
    category, result_array = read_stereo_set_results(final_result_path)
    return {
        "stereotype_score": format_metric_result(
            calculate_stereo_set_stereotype_score(category, result_array)
        )
    }


def extract_reddit_bias_metrics(final_result_path: Path) -> dict[str, Any]:
    category, result_array = read_reddit_bias_results(final_result_path)
    return {
        "stereotype_score": format_metric_result(
            calculate_reddit_bias_stereotype_score(category, result_array)
        )
    }


def extract_wino_bias_metrics(final_result_path: Path) -> dict[str, Any]:
    category, bias, group, correct_answer_array, _ = read_wino_bias_results(final_result_path)
    historical = format_metric_result(
        calculate_wino_bias_historical_bias(category, bias, group, correct_answer_array)
    )
    population = format_metric_result(
        calculate_wino_bias_population_bias(category, bias, group, correct_answer_array)
    )

    return {
        "historical_bias": historical,
        "population_bias": population,
        "combined_bias": average_metric_outputs(historical, population),
    }


def extract_bbq_metrics(final_result_path: Path) -> dict[str, Any]:
    category, context, _, result_array = read_bbq_results(final_result_path)
    ambiguous = format_metric_result(
        calculate_bbq_ambiguous_score(category, context, result_array)
    )
    disambiguated = format_metric_result(
        calculate_bbq_disambiguated_score(category, context, result_array)
    )

    return {
        "s_amb": ambiguous,
        "s_disamb": disambiguated,
        "s_combined": average_metric_outputs(ambiguous, disambiguated),
    }


def extract_discrim_eval_metrics(final_result_path: Path) -> dict[str, Any]:
    race, gender, scenario_id, yes_prob = read_discrim_eval_results(final_result_path)

    return {
        "max_min_diff": format_metric_result(
            calculate_discrim_eval_max_min_diff(race, gender, scenario_id, yes_prob)
        ),
        "mean_abs_dev": format_metric_result(
            calculate_discrim_eval_mean_abs_dev(race, gender, scenario_id, yes_prob)
        ),
    }


def extract_discrim_eval_gen_metrics(final_result_path: Path) -> dict[str, Any]:
    category, scenario_id, processed_answers = read_discrim_eval_gen_results(final_result_path)
    max_min_diff_result = calculate_discrim_eval_gen_max_min_diff(
        category,
        scenario_id,
        processed_answers,
    )
    mean_abs_dev_result = calculate_discrim_eval_gen_mean_abs_dev(
        category,
        scenario_id,
        processed_answers,
    )

    return {
        "max_min_diff": format_metric_result(max_min_diff_result),
        "mean_abs_dev": format_metric_result(mean_abs_dev_result),
        "unbiased_answer_rate": format_metric_result(
            as_dict(mean_abs_dev_result.get("unbiased_answer_rate"))
        ),
    }


def extract_dt_fairness_metrics(final_result_path: Path) -> dict[str, Any]:
    category, subgroup, answer_array, ground_truth_array, _ = read_dt_fairness_results(final_result_path)
    demographic_parity = format_metric_result(
        calculate_dt_fairness_demographic_parity_diff(category, subgroup, answer_array)
    )
    equalized_odds = format_metric_result(
        calculate_dt_fairness_equalized_odds_diff(
            category,
            subgroup,
            answer_array,
            ground_truth_array,
        )
    )

    return {
        "demographic_parity_diff": demographic_parity,
        "equalized_odds_diff": equalized_odds,
        "combined_diff": average_metric_outputs(demographic_parity, equalized_odds),
    }


def extract_bold_metrics(final_result_path: Path) -> dict[str, Any]:
    category, subgroup, toxic_scores, sent_scores = read_bold_results(final_result_path)
    return {
        "toxicity": format_metric_result(
            calculate_bold_toxicity(category, subgroup, toxic_scores)
        ),
        "sentiment": format_metric_result(
            calculate_bold_sentiment(category, subgroup, sent_scores)
        ),
    }


def extract_dt_toxic_metrics(final_result_path: Path) -> dict[str, Any]:
    category, subgroup, toxic_scores = read_dt_toxic_results(final_result_path)
    return {
        "toxicity": format_metric_result(
            calculate_dt_toxic_toxicity(category, subgroup, toxic_scores)
        )
    }


def raw_list(raw_results: dict[str, Any], key: str) -> list[Any]:
    value = raw_results.get(key)
    if isinstance(value, list):
        return value
    return []


def raw_value_at(raw_results: dict[str, Any], key: str, index: int) -> Any:
    values = raw_list(raw_results, key)
    if 0 <= index < len(values):
        value = values[index]
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
    return None


def prompt_text(prompt: Any) -> str | None:
    if isinstance(prompt, str):
        return prompt
    if isinstance(prompt, dict):
        content = prompt.get("content")
        if isinstance(content, str):
            return content
        return json.dumps(prompt, ensure_ascii=False)
    if isinstance(prompt, list):
        parts = []
        for item in prompt:
            text = prompt_text(item)
            if text:
                parts.append(text)
        return "\n".join(parts) if parts else None
    return None


def first_example_index_by_category(raw_results: dict[str, Any], max_categories: int) -> dict[str, int]:
    examples: dict[str, int] = {}
    for index, raw_category in enumerate(raw_list(raw_results, "group")):
        category_key = canonicalize_demographic_category(str(raw_category))
        if category_key not in examples:
            examples[category_key] = index
        if len(examples) >= max_categories:
            break
    return examples


def category_examples_block(examples: dict[str, Any]) -> dict[str, Any]:
    return {"by_demographic_category": dict(sorted(examples.items()))} if examples else {}


def extract_stereo_pair_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    examples = {}
    for category, index in first_example_index_by_category(raw_results, len(raw_list(raw_results, "group"))).items():
        examples[category] = {
            "more_stereo": {
                "prompt": raw_value_at(raw_results, "more_stereo_prompt", index),
                "perplexity": raw_value_at(raw_results, "more_stereo_ppl", index),
            },
            "less_stereo": {
                "prompt": raw_value_at(raw_results, "less_stereo_prompt", index),
                "perplexity": raw_value_at(raw_results, "less_stereo_ppl", index),
            },
        }
    return category_examples_block(examples)


def extract_wino_bias_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    if not raw_list(raw_results, "prompts"):
        return {}
    return category_examples_block(
        {
            "gender": {
                "prompt": raw_value_at(raw_results, "prompts", 0),
                "generation": raw_value_at(raw_results, "generation", 0),
            }
        }
    )


def extract_bbq_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    examples: dict[str, dict[str, Any]] = {}
    for index, raw_category in enumerate(raw_list(raw_results, "group")):
        category = canonicalize_demographic_category(str(raw_category))
        condition = raw_value_at(raw_results, "context_condition", index)
        if condition == "ambig":
            example_key = "ambiguous_context"
        elif condition == "disambig":
            example_key = "disambiguated_context"
        else:
            continue

        category_examples = examples.setdefault(category, {})
        if example_key in category_examples:
            continue

        category_examples[example_key] = {
            "prompt": raw_value_at(raw_results, "prompt", index),
            "generation": raw_value_at(raw_results, "generation", index),
        }

    return category_examples_block(examples)


def extract_discrim_eval_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    examples = {}
    if raw_list(raw_results, "prompts"):
        examples["gender"] = {
            "prompt": raw_value_at(raw_results, "prompts", 0),
            "yes_prob": raw_value_at(raw_results, "yes_prob", 0),
            "no_prob": raw_value_at(raw_results, "no_prob", 0),
        }

        race_index = 0
        races = raw_list(raw_results, "race")
        if races:
            first_race = races[0]
            for index, race in enumerate(races):
                if race != first_race:
                    race_index = index
                    break
        examples["race"] = {
            "prompt": raw_value_at(raw_results, "prompts", race_index),
            "yes_prob": raw_value_at(raw_results, "yes_prob", race_index),
            "no_prob": raw_value_at(raw_results, "no_prob", race_index),
        }

    return category_examples_block(examples)


def extract_generation_examples_by_group(raw_results: dict[str, Any], prompt_key: str) -> dict[str, Any]:
    examples = {}
    for category, index in first_example_index_by_category(raw_results, len(raw_list(raw_results, "group"))).items():
        examples[category] = {
            "prompt": raw_value_at(raw_results, prompt_key, index),
            "generation": raw_value_at(raw_results, "generation", index),
        }
    return category_examples_block(examples)


def extract_dt_fairness_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    if not raw_list(raw_results, "prompts"):
        return {}
    return category_examples_block(
        {
            "gender": {
                "prompt": raw_value_at(raw_results, "prompts", 0),
                "generation": raw_value_at(raw_results, "generation", 0),
            }
        }
    )


def extract_bold_metric_examples(raw_results: dict[str, Any], metric: str) -> dict[str, Any]:
    if metric == "toxicity":
        prompt_key = "final_toxic_prompt"
        generation_key = "toxic_gens"
        score_key = "toxic_scores"
        output_generation_key = "toxic_generation"
        output_score_key = "toxic_score"
    else:
        prompt_key = "final_sent_prompt"
        generation_key = "sent_gens"
        score_key = "sent_scores"
        output_generation_key = "sentiment_generation"
        output_score_key = "sentiment_score"

    examples = {}
    for category, index in first_example_index_by_category(raw_results, len(raw_list(raw_results, "group"))).items():
        examples[category] = {
            "prompt": prompt_text(raw_value_at(raw_results, prompt_key, index)),
            output_generation_key: raw_value_at(raw_results, generation_key, index),
            output_score_key: raw_value_at(raw_results, score_key, index),
        }
    return category_examples_block(examples)


def extract_dt_toxic_examples(raw_results: dict[str, Any]) -> dict[str, Any]:
    examples = {}
    for category, index in first_example_index_by_category(raw_results, len(raw_list(raw_results, "group"))).items():
        examples[category] = {
            "prompt": prompt_text(raw_value_at(raw_results, "final_toxic_prompt", index)),
            "toxic_generation": raw_value_at(raw_results, "toxic_gens", index),
            "toxic_score": raw_value_at(raw_results, "toxic_scores", index),
        }
    return category_examples_block(examples)


def extract_benchmark_examples(benchmark: str, raw_results: dict[str, Any]) -> dict[str, Any]:
    if benchmark in {"stereo_set", "reddit_bias"}:
        return extract_stereo_pair_examples(raw_results)
    if benchmark == "wino_bias":
        return extract_wino_bias_examples(raw_results)
    if benchmark == "bbq":
        return extract_bbq_examples(raw_results)
    if benchmark == "discrim_eval":
        return extract_discrim_eval_examples(raw_results)
    if benchmark == "discrim_eval_gen":
        return extract_generation_examples_by_group(raw_results, "final_prompt")
    if benchmark == "dt_fairness":
        return extract_dt_fairness_examples(raw_results)
    if benchmark == "bold":
        return {
            "toxicity": extract_bold_metric_examples(raw_results, "toxicity"),
            "sentiment": extract_bold_metric_examples(raw_results, "sentiment"),
        }
    if benchmark == "dt_toxic":
        return extract_dt_toxic_examples(raw_results)
    return {}


def extract_benchmark_metrics(benchmark: str, final_result_path: Path) -> dict[str, Any]:
    extractors = {
        "stereo_set": extract_stereo_set_metrics,
        "reddit_bias": extract_reddit_bias_metrics,
        "wino_bias": extract_wino_bias_metrics,
        "bbq": extract_bbq_metrics,
        "discrim_eval": extract_discrim_eval_metrics,
        "discrim_eval_gen": extract_discrim_eval_gen_metrics,
        "dt_fairness": extract_dt_fairness_metrics,
        "bold": extract_bold_metrics,
        "dt_toxic": extract_dt_toxic_metrics,
    }
    return extractors[benchmark](final_result_path)


def metric_converted_value(metric_value: Any) -> float | None:
    if not isinstance(metric_value, dict):
        return None
    return clean_number(metric_value.get("transformed_score_abs"))


def metric_original_value(metric_value: Any) -> float | None:
    if not isinstance(metric_value, dict):
        return None
    return clean_number(metric_value.get("original_score"))


def weighted_mean(values: list[tuple[Any, float]]) -> float | None:
    weighted_values = [
        (float(value), weight)
        for value, weight in values
        if clean_number(value) is not None and weight > 0
    ]
    total_weight = sum(weight for _, weight in weighted_values)
    if total_weight <= 0:
        return None
    return sum(value * weight for value, weight in weighted_values) / total_weight


def get_discrim_eval_gen_unbiased_rate(
    benchmarks: dict[str, Any],
    level: str,
    key_path: tuple[str, ...] = (),
) -> float:
    benchmark_output = as_dict(benchmarks.get("discrim_eval_gen"))
    metrics = as_dict(benchmark_output.get("metrics"))
    unbiased_answer_rate = as_dict(metrics.get("unbiased_answer_rate"))

    if level in {"global", "mean"}:
        rate = metric_original_value(unbiased_answer_rate.get(level))
    elif level == "category" and key_path:
        category_scores = as_dict(unbiased_answer_rate.get("by_demographic_category"))
        rate = metric_original_value(category_scores.get(key_path[0]))
    elif level == "subgroup" and key_path:
        subgroup_scores = as_dict(unbiased_answer_rate.get("by_subgroup"))
        category_scores = as_dict(subgroup_scores.get(key_path[0]))
        rate = metric_original_value(category_scores.get(key_path[1]))
    else:
        rate = None

    if rate is None:
        rate = metric_original_value(unbiased_answer_rate.get("global"))
    if rate is None:
        return 0.0
    return max(0.0, min(1.0, float(rate)))


def aggregate_value_and_weight(
    benchmarks: dict[str, Any],
    benchmark: str,
    metric_value: Any,
    mode: str,
    level: str,
    key_path: tuple[str, ...] = (),
) -> tuple[float | None, float]:
    value = metric_converted_value(metric_value)
    if value is None:
        return None, 0.0
    if benchmark != "discrim_eval_gen":
        return value, 1.0

    if mode == "standard":
        return value, 1.0

    unbiased_rate = get_discrim_eval_gen_unbiased_rate(benchmarks, level, key_path)
    if mode == "inverse_scaling":
        return value, 1.0 - unbiased_rate
    if mode == "penalize":
        return value * (1.0 - unbiased_rate) + 100.0 * unbiased_rate, 1.0

    raise ValueError(f"Unknown aggregate mode: {mode}")


def add_weighted_value(
    target: list[tuple[Any, float]],
    metric_value: Any,
    weight: float,
) -> bool:
    if clean_number(metric_value) is not None and weight > 0:
        target.append((metric_value, weight))
        return True
    return False


def calculate_aggregate_set(benchmarks: dict[str, Any], mode: str) -> dict[str, Any]:
    global_values: list[tuple[Any, float]] = []
    metric_mean_values: list[tuple[Any, float]] = []
    dimension_values: dict[str, list[tuple[Any, float]]] = {}
    dimension_mean_values: dict[str, list[tuple[Any, float]]] = {}
    category_values: dict[str, list[tuple[Any, float]]] = {}
    subgroup_values: dict[str, dict[str, list[tuple[Any, float]]]] = {}
    dimension_category_values: dict[str, dict[str, list[tuple[Any, float]]]] = {}

    for config in AGGREGATE_METRICS:
        benchmark = config["benchmark"]
        metric_name = config["metric"]
        bias_dimension = config["bias_dimension"]
        benchmark_output = as_dict(benchmarks.get(benchmark))
        metrics = as_dict(benchmark_output.get("metrics"))
        metric_output = as_dict(metrics.get(metric_name))

        global_metric = metric_output.get("global")
        global_value, global_weight = aggregate_value_and_weight(
            benchmarks,
            benchmark,
            global_metric,
            mode,
            "global",
        )
        if add_weighted_value(global_values, global_value, global_weight):
            dimension_values.setdefault(bias_dimension, [])
            add_weighted_value(
                dimension_values[bias_dimension],
                global_value,
                global_weight,
            )

        mean_metric = metric_output.get("mean")
        mean_value, mean_weight = aggregate_value_and_weight(
            benchmarks,
            benchmark,
            mean_metric,
            mode,
            "mean",
        )
        if add_weighted_value(metric_mean_values, mean_value, mean_weight):
            dimension_mean_values.setdefault(bias_dimension, [])
            add_weighted_value(
                dimension_mean_values[bias_dimension],
                mean_value,
                mean_weight,
            )

        category_metrics = as_dict(metric_output.get("by_demographic_category"))
        for category, metric_value in category_metrics.items():
            category_value, category_weight = aggregate_value_and_weight(
                benchmarks,
                benchmark,
                metric_value,
                mode,
                "category",
                (category,),
            )
            category_values.setdefault(category, [])
            if add_weighted_value(category_values[category], category_value, category_weight):
                dimension_category_values.setdefault(bias_dimension, {}).setdefault(category, [])
                add_weighted_value(
                    dimension_category_values[bias_dimension][category],
                    category_value,
                    category_weight,
                )

        subgroup_metrics = as_dict(metric_output.get("by_subgroup"))
        for category, subgroup_map in subgroup_metrics.items():
            for subgroup, metric_value in as_dict(subgroup_map).items():
                subgroup_value, subgroup_weight = aggregate_value_and_weight(
                    benchmarks,
                    benchmark,
                    metric_value,
                    mode,
                    "subgroup",
                    (category, subgroup),
                )
                subgroup_values.setdefault(category, {}).setdefault(subgroup, [])
                add_weighted_value(
                    subgroup_values[category][subgroup],
                    subgroup_value,
                    subgroup_weight,
                )

    by_bias_dimension = {}
    for dimension in sorted(set(dimension_values) | set(dimension_mean_values)):
        by_bias_dimension[dimension] = {
            "global": weighted_mean(dimension_values.get(dimension, [])),
            "mean": weighted_mean(dimension_mean_values.get(dimension, [])),
        }
        categories = dimension_category_values.get(dimension)
        if categories:
            by_bias_dimension[dimension]["by_demographic_category"] = {
                category: weighted_mean(category_metric_values)
                for category, category_metric_values in sorted(categories.items())
            }

    return {
        "total_bias_score": {
            "global": weighted_mean(global_values),
            "mean": weighted_mean([
                (dimension_scores["mean"], 1.0)
                for dimension_scores in by_bias_dimension.values()
            ]),
        },
        "by_bias_dimension": by_bias_dimension,
        "by_demographic_category": {
            category: weighted_mean(values)
            for category, values in sorted(category_values.items())
        },
        "by_subgroup": {
            category: {
                subgroup: weighted_mean(values)
                for subgroup, values in sorted(subgroups.items())
            }
            for category, subgroups in sorted(subgroup_values.items())
        },
    }


def calculate_aggregates(benchmarks: dict[str, Any]) -> dict[str, Any]:
    return {
        mode: calculate_aggregate_set(benchmarks, mode)
        for mode in ["standard", "inverse_scaling", "penalize"]
    }


def request_json(url: str, timeout: int = 30) -> Any:
    request = Request(url, headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"Hugging Face API request failed ({error.code}): {url}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach Hugging Face API: {error.reason}") from error


def get_hf_model_info(repo_id: str) -> dict[str, Any]:
    encoded_repo_id = quote(repo_id, safe="/")
    url = f"{HUGGING_FACE_API_BASE}/models/{encoded_repo_id}"
    data = request_json(url)
    if not isinstance(data, dict):
        raise RuntimeError(f"Unexpected Hugging Face model info response for {repo_id}")
    return data


def resolve_hf_model_id(model_name: str, hf_model_id: str | None = None) -> str:
    if hf_model_id:
        return hf_model_id

    if "/" in model_name:
        return model_name

    query = urlencode({"search": model_name, "limit": 20, "full": "true"})
    search_url = f"{HUGGING_FACE_API_BASE}/models?{query}"
    results = request_json(search_url)
    if not isinstance(results, list):
        raise RuntimeError(f"Unexpected Hugging Face model search response for {model_name}")

    exact_matches = [
        result
        for result in results
        if isinstance(result, dict)
        and str(result.get("modelId", "")).split("/")[-1].lower() == model_name.lower()
    ]
    candidates = exact_matches or [result for result in results if isinstance(result, dict)]

    if not candidates:
        raise RuntimeError(
            "Could not find a Hugging Face model for "
            f"{model_name!r}. Re-run with --hf-model-id <owner/repo>."
        )

    model_id = candidates[0].get("modelId") or candidates[0].get("id")
    if not model_id:
        raise RuntimeError(f"Hugging Face search result did not include a model id: {candidates[0]}")

    return str(model_id)


def format_parameter_count(parameter_count: int | float | None) -> str | None:
    if parameter_count is None:
        return None

    if parameter_count >= 1_000_000_000:
        value = parameter_count / 1_000_000_000
        suffix = "B"
    elif parameter_count >= 1_000_000:
        value = parameter_count / 1_000_000
        suffix = "M"
    else:
        return str(round(parameter_count))

    rounded = round(value, 1)
    if rounded.is_integer():
        return f"{int(rounded)}{suffix}"
    return f"{rounded}{suffix}"


def extract_safetensors_parameter_count(model_info: dict[str, Any]) -> int | float | None:
    safetensors = model_info.get("safetensors")
    if not isinstance(safetensors, dict):
        return None

    total = safetensors.get("total")
    if isinstance(total, (int, float)):
        return total

    parameters = safetensors.get("parameters")
    if isinstance(parameters, dict):
        numeric_values = [value for value in parameters.values() if isinstance(value, (int, float))]
        if numeric_values:
            return sum(numeric_values)

    return None


def infer_parameter_size_from_name(name: str) -> str | None:
    match = re.search(r"(?i)(\d+(?:\.\d+)?)\s*([bm])(?:\b|[-_])", name)
    if not match:
        return None

    value = match.group(1).rstrip("0").rstrip(".")
    suffix = match.group(2).upper()
    return f"{value}{suffix}"


def extract_release_date(model_info: dict[str, Any]) -> str | None:
    created_at = model_info.get("createdAt")
    if isinstance(created_at, str) and len(created_at) >= 10:
        return created_at[:10]
    return None


def get_model_metadata(
    model_name: str,
    region: str,
    hf_model_id: str | None = None,
) -> dict[str, Any]:
    resolved_model_id = resolve_hf_model_id(model_name, hf_model_id)
    model_info = get_hf_model_info(resolved_model_id)

    creator = model_info.get("author") or resolved_model_id.split("/", maxsplit=1)[0]
    parameter_count = extract_safetensors_parameter_count(model_info)
    size_parameters = (
        format_parameter_count(parameter_count)
        or infer_parameter_size_from_name(str(model_info.get("modelId") or resolved_model_id))
        or infer_parameter_size_from_name(model_name)
    )

    return {
        "creator": creator,
        "size_parameters": size_parameters,
        "release_date": extract_release_date(model_info),
        "region": region,
        "huggingface_model_id": resolved_model_id,
    }


def aggregate_model_results(
    model_name: str,
    region: str,
    results_dir: Path,
    output_dir: Path,
    incomplete: bool = False,
    hf_model_id: str | None = None,
    output_path: Path | None = None,
) -> Path:
    model_dir = results_dir / model_name
    if not model_dir.is_dir():
        raise FileNotFoundError(f"Model results folder not found: {model_dir}")

    output_suffix = "-incomplete" if incomplete else ""
    output_path = output_path or output_dir / f"{model_name}{output_suffix}.json"
    metadata = get_model_metadata(
        model_name=model_name,
        region=region,
        hf_model_id=hf_model_id,
    )
    aggregated: dict[str, Any] = {
        "model": {
            "name": model_name,
            "metadata": metadata,
        },
        "benchmarks": {},
        "aggregates": {},
    }

    missing_benchmarks = []
    for benchmark in BENCHMARKS:
        final_result_path = model_dir / benchmark / "final_result.json"
        if not final_result_path.is_file():
            missing_benchmarks.append(
                {
                    "benchmark": benchmark,
                    "expected_path": str(final_result_path),
                }
            )
            continue

        aggregated["benchmarks"][benchmark] = build_benchmark_output(
            benchmark,
            final_result_path,
        )

    if missing_benchmarks:
        if not incomplete:
            missing = "\n".join(
                f"- {item['benchmark']}: {item['expected_path']}"
                for item in missing_benchmarks
            )
            raise FileNotFoundError(
                "Missing benchmark results. Re-run with --incomplete to write an "
                f"output file using only available data.\n{missing}"
            )
        aggregated["missing_benchmarks"] = missing_benchmarks

    aggregated["aggregates"] = calculate_aggregates(aggregated["benchmarks"])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(aggregated, file, indent=2, ensure_ascii=False, allow_nan=False)
        file.write("\n")

    return output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate SBEF final_result.json files into one JSON file per model."
    )
    parser.add_argument("model_name", help="Model folder name inside sbef_results")
    parser.add_argument("region", help="Region to store in the output model metadata")
    parser.add_argument(
        "--results-dir",
        default="sbef_results",
        type=Path,
        help="Directory containing per-model SBEF result folders.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output JSON path. Defaults to <output-dir>/<model_name>.json.",
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        type=Path,
        help="Directory where per-model aggregate folders are written.",
    )
    parser.add_argument(
        "--hf-model-id",
        help="Hugging Face repo id to use for metadata, e.g. Qwen/Qwen3-4B-Instruct-2507.",
    )
    parser.add_argument(
        "--incomplete",
        action="store_true",
        help=(
            "Allow missing benchmark final_result.json files. Missing benchmarks are "
            "recorded in the output and excluded from aggregates."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = aggregate_model_results(
        model_name=args.model_name,
        region=args.region,
        results_dir=args.results_dir,
        output_dir=args.output_dir,
        incomplete=args.incomplete,
        hf_model_id=args.hf_model_id,
        output_path=args.output,
    )
    print(f"Wrote aggregated results to {output_path}")


if __name__ == "__main__":
    main()
