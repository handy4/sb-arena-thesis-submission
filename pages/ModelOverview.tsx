import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronDown,
  ExternalLink,
  Factory,
  Globe2,
  MessageSquareText,
  Scale,
  Server,
  Users
} from 'lucide-react';
import { useEvaluationData } from '../services/EvaluationDataContext';
import { findModelByRouteId, modelPath } from '../services/modelRoutes';
import {
  aggregateScore,
  isScoreValue,
  scoreFromMetricValue,
  selectedAggregateSet
} from '../services/evaluationData';
import { labelForKey } from '../services/labels';
import { benchmarkColors, biasDimensionColors, demographicCategoryColors, subgroupColors } from '../services/scoreColors';
import { isForcedUnsignedBenchmarkMetric, isSignedMetricValue } from '../services/scoreSignedness';
import { EvaluationMetricGroup, EvaluationMetricValue, EvaluationOutput } from '../types';

interface ScoreRow {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface DisplayScore {
  value: number | null;
  signed: boolean;
}

interface BenchmarkDisplayConfig {
  id: string;
  label: string;
  benchmarkKey: string;
  mainMetricKey: string;
  mainMetricLabel: string;
  colorKey?: string;
  forceUnsigned?: boolean;
  includedMetricKeys?: string[];
}

const dimensionLabels: Record<string, string> = {
  fairness: 'Fairness',
  sentiment: 'Sentiment',
  stereotype_bias: 'Stereotype Bias',
  toxicity: 'Toxicity'
};

const dimensionOrder = ['stereotype_bias', 'fairness', 'toxicity', 'sentiment'];

const demographicLabels: Record<string, string> = {
  gender: 'Gender',
  race: 'Race',
  religion: 'Religion',
  age: 'Age'
};

const benchmarkDisplayConfigs: BenchmarkDisplayConfig[] = [
  {
    id: 'stereoset',
    label: 'StereoSet',
    benchmarkKey: 'stereo_set',
    mainMetricKey: 'stereotype_score',
    mainMetricLabel: 'Stereotype Score'
  },
  {
    id: 'redditbias',
    label: 'RedditBias',
    benchmarkKey: 'reddit_bias',
    mainMetricKey: 'stereotype_score',
    mainMetricLabel: 'Stereotype Score'
  },
  {
    id: 'winobias',
    label: 'WinoBias',
    benchmarkKey: 'wino_bias',
    mainMetricKey: 'combined_bias',
    mainMetricLabel: 'Combined Bias'
  },
  {
    id: 'bbq',
    label: 'BBQ',
    benchmarkKey: 'bbq',
    mainMetricKey: 's_combined',
    mainMetricLabel: 'Combined Score'
  },
  {
    id: 'discrimeval',
    label: 'DiscrimEval',
    benchmarkKey: 'discrim_eval',
    mainMetricKey: 'mean_abs_dev',
    mainMetricLabel: 'Mean Absolute Deviation',
    forceUnsigned: isForcedUnsignedBenchmarkMetric('discrim_eval'),
    includedMetricKeys: ['mean_abs_dev', 'yes_prob_diff']
  },
  {
    id: 'discrimevalgen',
    label: 'DiscrimEvalGen',
    benchmarkKey: 'discrim_eval_gen',
    mainMetricKey: 'mean_abs_dev',
    mainMetricLabel: 'Mean Absolute Deviation',
    forceUnsigned: isForcedUnsignedBenchmarkMetric('discrim_eval_gen'),
    includedMetricKeys: ['mean_abs_dev', 'unbiased_answer_rate', 'unbias_ans']
  },
  {
    id: 'dt-fairness',
    label: 'DT-Fairness',
    benchmarkKey: 'dt_fairness',
    mainMetricKey: 'combined_diff',
    mainMetricLabel: 'Combined Difference',
    forceUnsigned: isForcedUnsignedBenchmarkMetric('dt_fairness')
  },
  {
    id: 'bold-toxicity',
    label: 'BOLD (Toxicity)',
    benchmarkKey: 'bold',
    mainMetricKey: 'toxicity',
    mainMetricLabel: 'Toxicity',
    colorKey: 'bold_toxicity',
    forceUnsigned: isForcedUnsignedBenchmarkMetric('bold', 'toxicity'),
    includedMetricKeys: ['toxicity']
  },
  {
    id: 'bold-sentiment',
    label: 'BOLD (Sentiment)',
    benchmarkKey: 'bold',
    mainMetricKey: 'sentiment',
    mainMetricLabel: 'Sentiment',
    colorKey: 'bold_sentiment',
    includedMetricKeys: ['sentiment']
  },
  {
    id: 'dt-toxicity',
    label: 'DT-Toxicity',
    benchmarkKey: 'dt_toxic',
    mainMetricKey: 'toxicity',
    mainMetricLabel: 'Toxicity',
    forceUnsigned: isForcedUnsignedBenchmarkMetric('dt_toxic')
  }
];

function formatScore(value: unknown, signed = false): string {
  if (!isScoreValue(value)) return 'N/A';
  const formattedValue = value.toFixed(1);
  return signed && value > 0 ? `+${formattedValue}` : formattedValue;
}

function formatMetadata(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'N/A';
}

function humanizeKey(key: string): string {
  return labelForKey(key);
}

function displayScoreFromMetricValue(metric: EvaluationMetricValue | undefined, forceUnsigned = false): DisplayScore {
  const value = scoreFromMetricValue(metric);

  return {
    value: forceUnsigned && isScoreValue(value) ? Math.abs(value) : value,
    signed: !forceUnsigned && isSignedMetricValue(metric)
  };
}

function displayScoreFromMetricGroup(metric: EvaluationMetricGroup | undefined, forceUnsigned = false): DisplayScore {
  if (scoreFromMetricValue(metric?.mean) !== null) return displayScoreFromMetricValue(metric?.mean, forceUnsigned);
  return displayScoreFromMetricValue(metric?.global, forceUnsigned);
}

function benchmarkMainScore(raw: EvaluationOutput, config: BenchmarkDisplayConfig): DisplayScore {
  return displayScoreFromMetricGroup(
    raw.benchmarks?.[config.benchmarkKey]?.metrics?.[config.mainMetricKey],
    config.forceUnsigned
  );
}

function benchmarkColor(config: BenchmarkDisplayConfig): string {
  return benchmarkColors[config.colorKey ?? config.benchmarkKey] ?? 'rgba(79, 70, 229, 1)';
}

function benchmarkMetricEntries(raw: EvaluationOutput, config: BenchmarkDisplayConfig): Array<[string, EvaluationMetricGroup]> {
  const metrics = raw.benchmarks?.[config.benchmarkKey]?.metrics;
  if (!metrics) return [];

  const allowedKeys = config.includedMetricKeys ?? Object.keys(metrics);
  return allowedKeys
    .filter(key => metrics[key])
    .map((key): [string, EvaluationMetricGroup] => [key, metrics[key]])
    .sort(([a], [b]) => {
      if (a === config.mainMetricKey) return -1;
      if (b === config.mainMetricKey) return 1;
      return a.localeCompare(b);
    });
}

function scoreRows(
  values: Record<string, number> | undefined,
  labels: Record<string, string>,
  colors: Record<string, string> = {}
): ScoreRow[] {
  if (!values) return [];
  return Object.entries(values)
    .filter((entry): entry is [string, number] => isScoreValue(entry[1]))
    .map(([key, value]) => ({ key, label: labels[key] ?? key.replace(/_/g, ' '), value, color: colors[key] }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function orderedScoreRows(
  values: Record<string, number> | undefined,
  labels: Record<string, string>,
  order: string[],
  colors: Record<string, string> = {}
): ScoreRow[] {
  if (!values) return [];
  return Object.entries(values)
    .filter((entry): entry is [string, number] => isScoreValue(entry[1]))
    .map(([key, value]) => ({ key, label: labels[key] ?? key.replace(/_/g, ' '), value, color: colors[key] }))
    .sort((a, b) => {
      const aIndex = order.indexOf(a.key);
      const bIndex = order.indexOf(b.key);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.label.localeCompare(b.label);
    });
}

const ScorePill: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => {
  const accentColor = color ?? 'rgba(79, 70, 229, 1)';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="text-xs font-black text-gray-700 uppercase tracking-widest">{label}</span>
        <span className="text-lg font-black" style={{ color: accentColor }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            backgroundColor: accentColor
          }}
        />
      </div>
    </div>
  );
};

interface SubgroupScoreEntry {
  key: string;
  label: string;
  value: number | null;
  signed: boolean;
  color: string;
}

interface DemographicScoreEntry {
  key: string;
  label: string;
  value: number | null;
  signed: boolean;
  color: string;
  subgroups: SubgroupScoreEntry[];
}

interface ExampleField {
  key: string;
  label: string;
  value: string;
}

interface ExampleItem {
  key: string;
  label: string;
  prompt: string | null;
  responses: ExampleField[];
  values: ExampleField[];
}

interface ExampleGroup {
  key: string;
  label: string;
  examples: ExampleItem[];
}

interface AnimatedDisclosureProps {
  className: string;
  summaryClassName: string;
  contentClassName: string;
  summary: (open: boolean) => React.ReactNode;
  children: React.ReactNode;
}

const disclosureTransition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number]
};

const AnimatedDisclosure: React.FC<AnimatedDisclosureProps> = ({
  className,
  summaryClassName,
  contentClassName,
  summary,
  children
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className={summaryClassName}
      >
        {summary(open)}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={disclosureTransition}
            className="overflow-hidden"
          >
            <div className={contentClassName}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyExampleValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isScoreValue(value)) return Number.isInteger(value) ? String(value) : value.toFixed(4);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) || isRecord(value)) return JSON.stringify(value, null, 2);
  return String(value);
}

function isResponseField(key: string): boolean {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.includes('generation') ||
    normalizedKey.includes('response') ||
    normalizedKey.includes('answer') ||
    normalizedKey.includes('completion');
}

function hasDirectPromptExample(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && typeof value.prompt === 'string';
}

function normalizeExampleItem(key: string, value: unknown): ExampleItem | null {
  if (!isRecord(value)) return null;

  const prompt = typeof value.prompt === 'string' ? value.prompt : null;
  const responses: ExampleField[] = [];
  const values: ExampleField[] = [];

  Object.entries(value).forEach(([fieldKey, fieldValue]) => {
    if (fieldKey === 'prompt') return;
    const renderedValue = stringifyExampleValue(fieldValue);
    if (!renderedValue) return;

    const field = {
      key: fieldKey,
      label: humanizeKey(fieldKey),
      value: renderedValue
    };

    if (isResponseField(fieldKey)) {
      responses.push(field);
    } else {
      values.push(field);
    }
  });

  if (!prompt && responses.length === 0 && values.length === 0) return null;

  return {
    key,
    label: humanizeKey(key),
    prompt,
    responses,
    values
  };
}

function normalizeExampleItems(value: unknown): ExampleItem[] {
  if (hasDirectPromptExample(value)) {
    const item = normalizeExampleItem('example', value);
    return item ? [item] : [];
  }

  if (!isRecord(value)) return [];

  return Object.entries(value)
    .map(([key, nestedValue]) => normalizeExampleItem(key, nestedValue))
    .filter((item): item is ExampleItem => item !== null);
}

function benchmarkExampleRoot(raw: EvaluationOutput, config: BenchmarkDisplayConfig): unknown {
  const examples = raw.benchmarks?.[config.benchmarkKey]?.examples;
  if (!isRecord(examples)) return null;
  if (config.includedMetricKeys?.length === 1 && isRecord(examples[config.mainMetricKey])) {
    return examples[config.mainMetricKey];
  }
  return examples;
}

function benchmarkExampleGroups(raw: EvaluationOutput, config: BenchmarkDisplayConfig): ExampleGroup[] {
  const root = benchmarkExampleRoot(raw, config);
  if (!isRecord(root)) return [];

  const byDemographicCategory = root.by_demographic_category;
  if (!isRecord(byDemographicCategory)) return [];

  return Object.entries(byDemographicCategory)
    .map(([key, value]) => ({
      key,
      label: demographicLabels[key] ?? humanizeKey(key),
      examples: normalizeExampleItems(value)
    }))
    .filter(group => group.examples.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function colorWithAlpha(color: string, alpha: number): string {
  const match = color.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return color;

  const [red, green, blue] = match[1].split(',').map(part => part.trim());
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function scoreFillStyle(value: number | null, color: string): React.CSSProperties {
  const width = isScoreValue(value) ? Math.max(0, Math.min(100, value)) : 0;
  const fillColor = colorWithAlpha(color, 0.16);

  return {
    background: `linear-gradient(90deg, ${fillColor} 0%, ${fillColor} ${width}%, rgb(249 250 251) ${width}%, rgb(249 250 251) 100%)`
  };
}

const CompactScoreRow: React.FC<{ label: string; value: number | null; signed: boolean; color: string }> = ({
  label,
  value,
  signed,
  color
}) => (
  <div
    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 transition-colors"
    style={scoreFillStyle(value, color)}
  >
    <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest truncate">{label}</span>
    <span className="text-sm font-black text-gray-900 flex-shrink-0">{formatScore(value, signed)}</span>
  </div>
);

const DemographicScoreRow: React.FC<{ entry: DemographicScoreEntry }> = ({ entry }) => {
  if (entry.subgroups.length === 0) {
    return <CompactScoreRow label={entry.label} value={entry.value} signed={entry.signed} color={entry.color} />;
  }

  return (
    <AnimatedDisclosure
      className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden"
      summaryClassName="w-full text-left px-3 py-2 transition-colors"
      contentClassName="px-3 pb-3 pt-1 bg-white/70 border-t border-gray-100"
      summary={(open) => (
        <div
          className="flex items-center justify-between gap-3 -mx-3 -my-2 px-3 py-2"
          style={scoreFillStyle(entry.value, entry.color)}
        >
          <div className="min-w-0">
            <span className="block text-[11px] font-black text-gray-500 uppercase tracking-widest truncate">{entry.label}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-black text-gray-900">{formatScore(entry.value, entry.signed)}</span>
            <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
      )}
    >
        <div className="space-y-2">
          {entry.subgroups.map(subgroup => (
            <CompactScoreRow
              key={subgroup.key}
              label={subgroup.label}
              value={subgroup.value}
              signed={subgroup.signed}
              color={subgroup.color}
            />
          ))}
        </div>
    </AnimatedDisclosure>
  );
};

const MetricBreakdown: React.FC<{
  metricKey: string;
  metric: EvaluationMetricGroup;
  mainMetricKey: string;
  forceUnsigned?: boolean;
}> = ({
  metricKey,
  metric,
  mainMetricKey,
  forceUnsigned = false
}) => {
  const demographicScores = metric.by_demographic_category ?? {};
  const subgroupScores = metric.by_subgroup ?? {};
  const demographicKeys = Array.from(new Set([
    ...Object.keys(demographicScores),
    ...Object.keys(subgroupScores)
  ]));
  const demographicEntries: DemographicScoreEntry[] = demographicKeys
    .map(key => {
      const sortedSubgroups = Object.entries(subgroupScores[key] ?? {})
        .map(([subgroupKey, value]) => {
          const score = displayScoreFromMetricValue(value, forceUnsigned);
          return {
            key: `${key}-${subgroupKey}`,
            label: humanizeKey(subgroupKey),
            value: score.value,
            signed: score.signed
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      const demographicScore = displayScoreFromMetricValue(demographicScores[key], forceUnsigned);

      return {
        key,
        label: demographicLabels[key] ?? humanizeKey(key),
        value: demographicScore.value,
        signed: demographicScore.signed,
        color: demographicCategoryColors[key] ?? subgroupColors[0],
        subgroups: sortedSubgroups.map((subgroup, index) => ({
          ...subgroup,
          color: subgroupColors[index % subgroupColors.length]
        }))
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-black text-gray-900">{humanizeKey(metricKey)}</h4>
          {metricKey === mainMetricKey && (
            <p className="text-[10px] uppercase tracking-widest font-black text-indigo-500 mt-1">Main Score</p>
          )}
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-black">
          {(() => {
            const score = displayScoreFromMetricGroup(metric, forceUnsigned);
            return formatScore(score.value, score.signed);
          })()}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2">By Demographic Category</p>
        <div className="space-y-2">
          {demographicEntries.length > 0
            ? demographicEntries.map(entry => <DemographicScoreRow key={entry.key} entry={entry} />)
            : <p className="text-xs font-bold text-gray-300 py-2">No demographic breakdown</p>}
        </div>
      </div>
    </div>
  );
};

const ExampleTextPanel: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2">{label}</p>
    <div className="max-h-64 overflow-y-auto rounded-xl bg-gray-50 border border-gray-100 p-3">
      <p className="text-xs leading-relaxed text-gray-700 whitespace-pre-wrap break-words">{value}</p>
    </div>
  </div>
);

const ExampleValueField: React.FC<{ field: ExampleField }> = ({ field }) => (
  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
    <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-1">{field.label}</p>
    <p className="text-xs font-black text-gray-900 whitespace-pre-wrap break-words">{field.value}</p>
  </div>
);

const ExampleItemCard: React.FC<{ example: ExampleItem }> = ({ example }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4">
    <div className="flex items-center justify-between gap-3 mb-4">
      <h5 className="text-sm font-black text-gray-900">{example.label}</h5>
    </div>

    <div className="space-y-4">
      {example.prompt && <ExampleTextPanel label="Prompt" value={example.prompt} />}

      {example.responses.map(response => (
        <ExampleTextPanel key={response.key} label={response.label} value={response.value} />
      ))}

      {example.values.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2">Values</p>
          <div className="space-y-2">
            {example.values.map(field => (
              <ExampleValueField key={field.key} field={field} />
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const ExampleGroupDetails: React.FC<{ group: ExampleGroup }> = ({ group }) => (
  <AnimatedDisclosure
    className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
    summaryClassName="w-full text-left px-4 py-3 hover:bg-indigo-50/50 transition-colors"
    contentClassName="px-4 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100"
    summary={(open) => (
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black text-gray-700 uppercase tracking-widest">{group.label}</span>
        <div className="flex items-center gap-3">
          <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
    )}
  >
      <div className="space-y-3">
        {group.examples.map(example => (
          <ExampleItemCard key={example.key} example={example} />
        ))}
      </div>
  </AnimatedDisclosure>
);

const BenchmarkExamples: React.FC<{ groups: ExampleGroup[] }> = ({ groups }) => {
  if (groups.length === 0) return null;

  return (
    <AnimatedDisclosure
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      summaryClassName="w-full text-left p-4 hover:bg-indigo-50/50 transition-colors"
      contentClassName="px-4 pb-4 pt-1 bg-gray-50/50 border-t border-gray-100"
      summary={(open) => (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
              <MessageSquareText size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900">Prompt Examples</p>
            </div>
          </div>
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      )}
    >
        <div className="space-y-3">
          {groups.map(group => (
            <ExampleGroupDetails key={group.key} group={group} />
          ))}
        </div>
    </AnimatedDisclosure>
  );
};

const BenchmarkCard: React.FC<{ raw: EvaluationOutput; config: BenchmarkDisplayConfig }> = ({ raw, config }) => {
  const mainScore = benchmarkMainScore(raw, config);
  const metricEntries = benchmarkMetricEntries(raw, config);
  const exampleGroups = benchmarkExampleGroups(raw, config);
  const accentColor = benchmarkColor(config);
  const scoreWidth = isScoreValue(mainScore.value) ? Math.max(0, Math.min(100, mainScore.value)) : 0;

  return (
    <AnimatedDisclosure
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      summaryClassName="w-full text-left p-5 hover:bg-indigo-50/30 transition-colors"
      contentClassName="px-5 pb-5 pt-1 border-t border-gray-50 bg-gray-50/50"
      summary={(open) => (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-2">{config.mainMetricLabel}</p>
            <h3 className="text-lg font-black text-gray-900 truncate">{config.label}</h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right min-w-[140px]">
              <p className="text-3xl font-black" style={{ color: accentColor }}>
                {formatScore(mainScore.value, mainScore.signed)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${scoreWidth}%`,
                    backgroundColor: accentColor
                  }}
                />
              </div>
            </div>
            <div className={`w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
              <ChevronDown size={18} />
            </div>
          </div>
        </div>
      )}
    >
        {metricEntries.length > 0 ? (
          <div className="space-y-4 pt-4">
            {metricEntries.map(([metricKey, metric]) => (
              <MetricBreakdown
                key={metricKey}
                metricKey={metricKey}
                metric={metric}
                mainMetricKey={config.mainMetricKey}
                forceUnsigned={config.forceUnsigned}
              />
            ))}
            <BenchmarkExamples groups={exampleGroups} />
          </div>
        ) : (
          <div className="pt-4">
            <EmptyState title="Benchmark data unavailable" />
          </div>
        )}
    </AnimatedDisclosure>
  );
};

const MetadataItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 min-w-0">
    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-indigo-500 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">{label}</p>
      <p className="text-sm font-black text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400">
    <p className="text-xs font-black uppercase tracking-widest">{title}</p>
  </div>
);

const ModelOverview: React.FC = () => {
  const { modelId } = useParams();
  const { modelFiles, isLoading, error } = useEvaluationData();
  const selectedModel = useMemo(() => findModelByRouteId(modelFiles, modelId), [modelFiles, modelId]);

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 h-[420px] flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase text-gray-400 font-black tracking-widest mb-3">Loading Model</p>
          <p className="font-black text-gray-900 text-xl">Reading model evaluation data</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-rose-100 h-[420px] flex flex-col items-center justify-center text-center px-8">
          <p className="text-[10px] uppercase text-rose-400 font-black tracking-widest mb-3">Data Load Failed</p>
          <p className="font-black text-gray-900 text-xl mb-2">Unable to read model data</p>
          <p className="text-sm text-gray-500 max-w-xl">{error}</p>
        </div>
      </motion.div>
    );
  }

  if (!modelId && modelFiles[0]) {
    return <Navigate to={modelPath(modelFiles[0])} replace />;
  }

  if (!selectedModel) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 h-[420px] flex flex-col items-center justify-center text-center px-8">
          <p className="text-[10px] uppercase text-gray-400 font-black tracking-widest mb-3">Model Not Found</p>
          <p className="font-black text-gray-900 text-xl mb-5">This evaluation is not available.</p>
          <Link to="/models" className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-200">
            View Available Models
          </Link>
        </div>
      </motion.div>
    );
  }

  const { raw, dataPoint } = selectedModel;
  const metadata = raw.model?.metadata ?? {};
  const aggregates = selectedAggregateSet(raw);
  const dimensionScores: Record<string, number> = {};
  const dimensionAggregates = aggregates?.by_bias_dimension;
  if (dimensionAggregates) {
    Object.entries(dimensionAggregates).forEach(([key, value]) => {
      const score = aggregateScore(value);
      if (isScoreValue(score)) {
        dimensionScores[key] = score;
      }
    });
  }
  const dimensionRows = orderedScoreRows(dimensionScores, dimensionLabels, dimensionOrder, biasDimensionColors);
  const demographicRows = scoreRows(aggregates?.by_demographic_category, demographicLabels, demographicCategoryColors);
  const benchmarkColumns = benchmarkDisplayConfigs.reduce<[BenchmarkDisplayConfig[], BenchmarkDisplayConfig[]]>(
    (columns, config, index) => {
      columns[index % 2].push(config);
      return columns;
    },
    [[], []]
  );
  const description = '';
  const huggingFaceModelId = typeof metadata.huggingface_model_id === 'string' && metadata.huggingface_model_id.trim().length > 0
    ? metadata.huggingface_model_id.trim()
    : dataPoint.category;
  const huggingFaceUrl = `https://huggingface.co/${huggingFaceModelId}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
    >
      <div className="mb-8">
        <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm font-black text-gray-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={16} />
          Leaderboard
        </Link>
      </div>

      <section className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="bg-indigo-600 p-8 text-white flex flex-col justify-between min-h-[300px]">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-indigo-100 mb-4">Total Aggregate</p>
              <div className="text-7xl font-black tracking-tight">{formatScore(dataPoint.total_aggregate)}</div>
            </div>
            <div className="mt-8">
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${isScoreValue(dataPoint.total_aggregate) ? Math.max(0, Math.min(100, dataPoint.total_aggregate)) : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-8 lg:p-10 flex flex-col min-h-[300px]">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 mb-8">
              <div className="min-w-0">
                {/* <p className="text-[10px] uppercase tracking-widest font-black text-indigo-500 mb-3">Model Card</p> */}
                <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight break-words">{dataPoint.category}</h1>
                {description ? (
                  <p className="text-gray-500 text-sm leading-relaxed mt-4 max-w-3xl">{description}</p>
                ) : null}
              </div>

              <a
                href={huggingFaceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-black hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                Hugging Face
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-auto">
              <MetadataItem icon={<Factory size={17} />} label="Creator" value={formatMetadata(metadata.creator)} />
              <MetadataItem icon={<Server size={17} />} label="Model Size" value={formatMetadata(metadata.size_parameters)} />
              <MetadataItem icon={<Calendar size={17} />} label="Release Date" value={formatMetadata(metadata.release_date)} />
              <MetadataItem icon={<Globe2 size={17} />} label="Region" value={formatMetadata(metadata.region)} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Scale size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Bias Dimensions</h2>
              {/*<p className="text-xs text-gray-500 font-medium">Aggregate scores grouped by evaluation dimension.</p>*/}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dimensionRows.length > 0
              ? dimensionRows.map(row => <ScorePill key={row.key} label={row.label} value={row.value} color={row.color} />)
              : <EmptyState title="No dimension aggregates" />}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Demographic Categories</h2>
              {/*<p className="text-xs text-gray-500 font-medium">Aggregate scores by demographic group.</p>*/}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {demographicRows.length > 0
              ? demographicRows.map(row => <ScorePill key={row.key} label={row.label} value={row.value} color={row.color} />)
              : <EmptyState title="No demographic aggregates" />}
          </div>
        </section>
      </div>

      <section className="mt-12">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Benchmark Scores</h2>
          </div>
        </div>

        <div className="space-y-4 xl:hidden">
          {benchmarkDisplayConfigs.map(config => (
            <BenchmarkCard key={config.id} raw={raw} config={config} />
          ))}
        </div>

        <div className="hidden xl:grid xl:grid-cols-2 xl:gap-4 xl:items-start">
          {benchmarkColumns.map((column, index) => (
            <div key={index} className="space-y-4">
              {column.map(config => (
                <BenchmarkCard key={config.id} raw={raw} config={config} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

export default ModelOverview;
