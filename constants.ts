import { MetricConfig } from './types';
import {
  benchmarkColors,
  biasDimensionColors,
  demographicCategoryColors,
  subgroupColors,
  totalMetricColor
} from './services/scoreColors';

export const METRICS: MetricConfig[] = [
  { key: 'total_aggregate', label: 'Total Score', color: totalMetricColor },

  { key: 'stereotypes_aggregate', label: 'Stereotypes', color: biasDimensionColors.stereotype_bias, group: 'total_aggregate' },
  { key: 'fairness_aggregate', label: 'Fairness', color: biasDimensionColors.fairness, group: 'total_aggregate' },
  { key: 'toxicity_aggregate', label: 'Toxicity', color: biasDimensionColors.toxicity, group: 'total_aggregate' },
  { key: 'sentiment_aggregate', label: 'Sentiment', color: biasDimensionColors.sentiment, group: 'total_aggregate' },

  { key: 'gender_score', label: 'Gender', color: demographicCategoryColors.gender, group: 'total_aggregate' },
  { key: 'race_score', label: 'Race', color: demographicCategoryColors.race, group: 'total_aggregate' },
  { key: 'religion_score', label: 'Religion', color: demographicCategoryColors.religion, group: 'total_aggregate' },
  { key: 'age_score', label: 'Age', color: demographicCategoryColors.age, group: 'total_aggregate' },

  { key: 'stereoset', label: 'StereoSet', color: benchmarkColors.stereo_set, group: 'stereotypes_aggregate' },
  { key: 'redditbias', label: 'RedditBias', color: benchmarkColors.reddit_bias, group: 'stereotypes_aggregate' },
  { key: 'winobias', label: 'WinoBias', color: benchmarkColors.wino_bias, group: 'stereotypes_aggregate' },
  { key: 'bbq', label: 'BBQ', color: benchmarkColors.bbq, group: 'stereotypes_aggregate' },

  { key: 'discrimeval', label: 'DiscrimEval', color: benchmarkColors.discrim_eval, group: 'fairness_aggregate' },
  { key: 'discrimevalgen', label: 'DiscrimEvalGen', color: benchmarkColors.discrim_eval_gen, group: 'fairness_aggregate' },
  { key: 'dt_fairness', label: 'DT-Fairness', color: benchmarkColors.dt_fairness, group: 'fairness_aggregate' },

  { key: 'bold_toxicity', label: 'BOLD-Toxicity', color: benchmarkColors.bold_toxicity, group: 'toxicity_aggregate' },
  { key: 'dt_toxicity', label: 'DT-Toxicity', color: benchmarkColors.dt_toxic, group: 'toxicity_aggregate' },
  { key: 'bold_sentiment', label: 'BOLD-Sentiment', color: benchmarkColors.bold_sentiment, group: 'sentiment_aggregate' },

  { key: 'male', label: 'Male', color: subgroupColors[0], group: 'gender_score' },
  { key: 'female', label: 'Female', color: subgroupColors[1], group: 'gender_score' },
  { key: 'black', label: 'Black', color: subgroupColors[2], group: 'race_score' },
  { key: 'asian', label: 'Asian', color: subgroupColors[3], group: 'race_score' },
  { key: 'white', label: 'White', color: subgroupColors[4], group: 'race_score' },
  { key: 'muslim', label: 'Muslim', color: subgroupColors[5], group: 'religion_score' },
  { key: 'christian', label: 'Christian', color: subgroupColors[6], group: 'religion_score' },
  { key: 'jewish', label: 'Jewish', color: subgroupColors[7], group: 'religion_score' },
  { key: 'young', label: 'Younger', color: demographicCategoryColors.age, group: 'age_score' },
  { key: 'senior', label: 'Senior', color: subgroupColors[8], group: 'age_score' }
];
