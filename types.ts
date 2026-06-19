
export type ScoreValue = number | null;

export interface DataPoint {
  id: string;
  category: string; // Model name
  
  // Aggregates
  total_aggregate: ScoreValue;
  stereotypes_aggregate: ScoreValue;
  fairness_aggregate: ScoreValue;
  toxicity_aggregate: ScoreValue;
  sentiment_aggregate: ScoreValue;

  // Demographic Aggregates
  gender_score: ScoreValue;
  race_score: ScoreValue;
  religion_score: ScoreValue;
  age_score: ScoreValue;

  // Gender Subgroups
  male: ScoreValue;
  female: ScoreValue;

  // Race Subgroups
  black: ScoreValue;
  asian: ScoreValue;
  white: ScoreValue;

  // Religion Subgroups
  muslim: ScoreValue;
  christian: ScoreValue;
  jewish: ScoreValue;

  // Age Subgroups
  young: ScoreValue;
  senior: ScoreValue;

  // Stereotypes Benchmarks
  stereoset: ScoreValue;
  redditbias: ScoreValue;
  winobias: ScoreValue;
  bbq: ScoreValue;

  // Fairness Benchmarks
  discrimeval: ScoreValue;
  discrimevalgen: ScoreValue;
  dt_fairness: ScoreValue;

  // Toxicity Benchmarks
  bold_toxicity: ScoreValue;
  dt_toxicity: ScoreValue;

  // Sentiment Benchmarks
  bold_sentiment: ScoreValue;
}

export type MetricKey = keyof Omit<DataPoint, 'id' | 'category'>;

export interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
  group?: string; // Links subgroups to their aggregate perspective
}

export interface EvaluationModelMetadata {
  creator?: string;
  size_parameters?: string;
  release_date?: string;
  region?: string;
  huggingface_model_id?: string;
  [key: string]: unknown;
}

export interface EvaluationMetricValue {
  original_metric?: number;
  converted_metric?: number;
  original_score?: number;
  original_sign?: 'pos' | 'neg' | 'n_a' | string;
  transformed_score?: number;
  transformed_score_abs?: number;
  direction?: 'pos' | 'neg' | 'n_a' | string;
}

export interface EvaluationMetricGroup {
  global?: EvaluationMetricValue;
  mean?: EvaluationMetricValue;
  by_demographic_category?: Record<string, EvaluationMetricValue>;
  by_subgroup?: Record<string, Record<string, EvaluationMetricValue>>;
}

export interface EvaluationBenchmark {
  bias_dimension?: string;
  metrics?: Record<string, EvaluationMetricGroup>;
  examples?: unknown;
}

export interface EvaluationAggregateDimension {
  global?: number;
  mean?: number;
  by_demographic_category?: Record<string, number>;
}

export interface EvaluationAggregateSet {
  total_bias_score?: number | {
    global?: number;
    mean?: number;
  };
  by_bias_dimension?: Record<string, EvaluationAggregateDimension>;
  by_demographic_category?: Record<string, number>;
  by_subgroup?: Record<string, Record<string, number>>;
}

export interface EvaluationAggregates extends EvaluationAggregateSet {
  standard?: EvaluationAggregateSet;
  inverse_scaling?: EvaluationAggregateSet;
  penalize?: EvaluationAggregateSet;
}

export interface EvaluationOutput {
  model?: {
    name?: string;
    metadata?: EvaluationModelMetadata;
  };
  benchmarks?: Record<string, EvaluationBenchmark>;
  aggregates?: EvaluationAggregates;
  missing_benchmarks?: Array<{
    benchmark?: string;
    expected_path?: string;
    [key: string]: unknown;
  }>;
}

export interface LoadedEvaluationFile {
  fileName: string;
  path: string;
  raw: EvaluationOutput;
  dataPoint: DataPoint;
}
