export const metricLabels: Record<string, string> = {
  stereotype_score: 'Stereotype Score',
  historical_bias: 'Historical Bias',
  population_bias: 'Population Bias',
  combined_bias: 'Combined Bias',
  s_amb: 'Ambiguous Context Score',
  s_disamb: 'Disambiguated Context Score',
  s_combined: 'Combined Score',
  yes_prob_diff: 'Yes Probability Difference',
  mean_abs_dev: 'Mean Absolute Deviation',
  max_min_diff: 'Max-Min Difference',
  unbias_ans: 'Unbiased Answer Rate',
  demographic_parity_diff: 'Demographic Parity Difference',
  equalized_odds_diff: 'Equalized Odds Difference',
  combined_diff: 'Combined Difference',
  toxicity: 'Toxicity',
  sentiment: 'Sentiment',
  perplexity: 'Perplexity',
  generation: 'Generation',
  toxic_generation: 'Toxic Generation',
  toxic_score: 'Toxicity Score',
  sentiment_generation: 'Sentiment Generation',
  sentiment_score: 'Sentiment Score',
  yes_prob: 'Yes Probability',
  no_prob: 'No Probability'
};

export function labelForKey(key: string): string {
  return metricLabels[key] ??
    key
      .replace(/^s_/, 's ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
}
