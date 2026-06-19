import {
  DataPoint,
  EvaluationAggregateSet,
  EvaluationMetricGroup,
  EvaluationMetricValue,
  EvaluationOutput,
  LoadedEvaluationFile,
  ScoreValue
} from '../types';

const evaluationFileLoaders = import.meta.glob('../data/*.json');

const preferredBenchmarkMetrics: Record<string, string[]> = {
  stereo_set: ['stereotype_score'],
  reddit_bias: ['stereotype_score'],
  wino_bias: ['combined_bias', 'historical_bias', 'population_bias'],
  bbq: ['s_combined', 's_amb', 's_disamb'],
  discrim_eval: ['mean_abs_dev', 'yes_prob_diff'],
  discrim_eval_gen: ['mean_abs_dev', 'max_min_diff'],
  dt_fairness: ['combined_diff', 'demographic_parity_diff', 'equalized_odds_diff'],
  bold_toxicity: ['toxicity'],
  dt_toxic: ['toxicity'],
  bold_sentiment: ['sentiment']
};

export function isScoreValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function toScoreValue(value: unknown): ScoreValue {
  return isScoreValue(value) ? value : null;
}

export function averageScores(values: ScoreValue[]): ScoreValue {
  const numericValues = values.filter(isScoreValue);
  if (numericValues.length === 0) return null;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

export function scoreFromMetricValue(value: EvaluationMetricValue | undefined): ScoreValue {
  return (
    toScoreValue(value?.transformed_score) ??
    toScoreValue(value?.converted_metric) ??
    toScoreValue(value?.transformed_score_abs) ??
    null
  );
}

export function meanMetricScore(metric: EvaluationMetricGroup | undefined): ScoreValue {
  return scoreFromMetricValue(metric?.mean) ?? scoreFromMetricValue(metric?.global);
}

export function selectedAggregateSet(raw: EvaluationOutput): EvaluationAggregateSet | undefined {
  return raw.aggregates?.inverse_scaling ?? raw.aggregates;
}

export function aggregateScore(value: unknown): ScoreValue {
  if (isScoreValue(value)) return value;
  if (typeof value !== 'object' || value === null) return null;

  const record = value as Record<string, unknown>;
  return toScoreValue(record.mean) ?? toScoreValue(record.global);
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function modelNameFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, '');
}

function convertedGlobal(metric: EvaluationMetricGroup | undefined): ScoreValue {
  return meanMetricScore(metric);
}

function aggregateDimension(raw: EvaluationOutput, dimension: string): ScoreValue {
  return aggregateScore(selectedAggregateSet(raw)?.by_bias_dimension?.[dimension]);
}

function aggregateDemographic(raw: EvaluationOutput, category: string): ScoreValue {
  return toScoreValue(selectedAggregateSet(raw)?.by_demographic_category?.[category]);
}

function aggregateSubgroup(raw: EvaluationOutput, group: string, aliases: string[]): ScoreValue {
  const subgroupScores = selectedAggregateSet(raw)?.by_subgroup?.[group];
  if (!subgroupScores) return null;

  return averageScores(aliases.map(alias => toScoreValue(subgroupScores[alias])));
}

function benchmarkScore(raw: EvaluationOutput, benchmarkKey: string, metricKeys: string[]): ScoreValue {
  const metrics = raw.benchmarks?.[benchmarkKey]?.metrics;
  if (!metrics) return null;

  const preferredScore = metricKeys
    .map(metricKey => convertedGlobal(metrics[metricKey]))
    .find(isScoreValue);

  if (isScoreValue(preferredScore)) return preferredScore;

  return averageScores(Object.values(metrics).map(convertedGlobal));
}

function buildEvaluationDataPoint(raw: EvaluationOutput, fileName: string): DataPoint {
  const stereoset = benchmarkScore(raw, 'stereo_set', preferredBenchmarkMetrics.stereo_set);
  const redditbias = benchmarkScore(raw, 'reddit_bias', preferredBenchmarkMetrics.reddit_bias);
  const winobias = benchmarkScore(raw, 'wino_bias', preferredBenchmarkMetrics.wino_bias);
  const bbq = benchmarkScore(raw, 'bbq', preferredBenchmarkMetrics.bbq);
  const discrimeval = benchmarkScore(raw, 'discrim_eval', preferredBenchmarkMetrics.discrim_eval);
  const discrimevalgen = benchmarkScore(raw, 'discrim_eval_gen', preferredBenchmarkMetrics.discrim_eval_gen);
  const dtFairness = benchmarkScore(raw, 'dt_fairness', preferredBenchmarkMetrics.dt_fairness);
  const boldToxicity = benchmarkScore(raw, 'bold', preferredBenchmarkMetrics.bold_toxicity);
  const dtToxicity = benchmarkScore(raw, 'dt_toxic', preferredBenchmarkMetrics.dt_toxic);
  const boldSentiment = benchmarkScore(raw, 'bold', preferredBenchmarkMetrics.bold_sentiment);

  const stereotypesAggregate =
    aggregateDimension(raw, 'stereotype_bias') ??
    averageScores([stereoset, redditbias, winobias, bbq]);
  const fairnessAggregate =
    aggregateDimension(raw, 'fairness') ??
    averageScores([discrimeval, discrimevalgen, dtFairness]);
  const toxicityAggregate =
    aggregateDimension(raw, 'toxicity') ??
    averageScores([boldToxicity, dtToxicity]);
  const sentimentAggregate =
    aggregateDimension(raw, 'sentiment') ??
    boldSentiment;

  return {
    id: modelNameFromFileName(fileName),
    category: raw.model?.name ?? modelNameFromFileName(fileName),
    total_aggregate:
      aggregateScore(selectedAggregateSet(raw)?.total_bias_score) ??
      averageScores([stereotypesAggregate, fairnessAggregate, toxicityAggregate, sentimentAggregate]),
    stereotypes_aggregate: stereotypesAggregate,
    fairness_aggregate: fairnessAggregate,
    toxicity_aggregate: toxicityAggregate,
    sentiment_aggregate: sentimentAggregate,
    gender_score: aggregateDemographic(raw, 'gender'),
    race_score: aggregateDemographic(raw, 'race'),
    religion_score: aggregateDemographic(raw, 'religion'),
    age_score: aggregateDemographic(raw, 'age'),
    male: aggregateSubgroup(raw, 'gender', ['male']),
    female: aggregateSubgroup(raw, 'gender', ['female']),
    black: aggregateSubgroup(raw, 'race', ['black']),
    asian: aggregateSubgroup(raw, 'race', ['asian']),
    white: aggregateSubgroup(raw, 'race', ['white']),
    muslim: aggregateSubgroup(raw, 'religion', ['muslim', 'islam', 'islamic']),
    christian: aggregateSubgroup(raw, 'religion', ['christian', 'christianity']),
    jewish: aggregateSubgroup(raw, 'religion', ['jewish', 'judaism']),
    young: aggregateSubgroup(raw, 'age', ['young', 'younger']),
    senior: aggregateSubgroup(raw, 'age', ['senior', 'older']),
    stereoset,
    redditbias,
    winobias,
    bbq,
    discrimeval,
    discrimevalgen,
    dt_fairness: dtFairness,
    bold_toxicity: boldToxicity,
    dt_toxicity: dtToxicity,
    bold_sentiment: boldSentiment
  };
}

export async function loadEvaluationDataFiles(): Promise<LoadedEvaluationFile[]> {
  const files = await Promise.all(
    Object.entries(evaluationFileLoaders).map(async ([path, loader]) => {
      const module = await loader() as { default: EvaluationOutput };
      const fileName = fileNameFromPath(path);
      const raw = module.default;

      return {
        fileName,
        path,
        raw,
        dataPoint: buildEvaluationDataPoint(raw, fileName)
      };
    })
  );

  return files.sort((a, b) => a.dataPoint.category.localeCompare(b.dataPoint.category));
}
