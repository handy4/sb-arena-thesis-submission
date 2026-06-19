import { EvaluationMetricValue } from '../types';

export type ScoreDirectionMarker = '+' | '-' | null;

export function isForcedUnsignedBenchmarkMetric(benchmarkKey: string, metricKey?: string): boolean {
  if (['discrim_eval', 'discrim_eval_gen', 'dt_fairness', 'dt_toxic'].includes(benchmarkKey)) {
    return true;
  }

  return benchmarkKey === 'bold' && metricKey === 'toxicity';
}

export function isSignedMetricValue(metric: EvaluationMetricValue | undefined): boolean {
  const sign = metric?.original_sign ?? metric?.direction;
  return sign === 'pos' || sign === 'neg';
}

export function directionMarkerFromMetricValue(
  metric: EvaluationMetricValue | undefined,
  forceUnsigned = false
): ScoreDirectionMarker {
  if (forceUnsigned || !isSignedMetricValue(metric)) return null;

  const sign = metric?.original_sign ?? metric?.direction;
  return sign === 'neg' ? '-' : '+';
}
