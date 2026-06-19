import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, Filter, GripVertical, Info, MousePointer2, Sparkles, Tags, UserCircle, Users } from 'lucide-react';
import LayeredColumnChart, { ChartMetric, ChartScoreRow } from '../components/LayeredColumnChart';
import { useEvaluationData } from '../services/EvaluationDataContext';
import {
  aggregateScore,
  isScoreValue,
  meanMetricScore,
  scoreFromMetricValue,
  selectedAggregateSet
} from '../services/evaluationData';
import { labelForKey } from '../services/labels';
import { benchmarkColors, biasDimensionColors, demographicCategoryColors, subgroupColors, totalMetricColor } from '../services/scoreColors';
import { directionMarkerFromMetricValue, isForcedUnsignedBenchmarkMetric } from '../services/scoreSignedness';
import { EvaluationMetricGroup, EvaluationMetricValue, LoadedEvaluationFile } from '../types';

type BiasDimensionId = 'stereotype_bias' | 'fairness' | 'toxicity' | 'sentiment';
type TotalView = 'bias-dimensions' | 'demographics';
type DimensionView = 'benchmarks' | 'dimension-demographics';

type LayerState =
  | { kind: 'total'; view: TotalView }
  | { kind: 'dimension'; dimension: BiasDimensionId; view: DimensionView }
  | { kind: 'demographic'; demographic: string }
  | { kind: 'benchmark'; benchmarkId: string }
  | { kind: 'benchmark-demographic'; benchmarkId: string; demographic: string };

interface VisualizationMetric extends ChartMetric {
  getValue: (file: LoadedEvaluationFile) => number | null;
  getSign?: (file: LoadedEvaluationFile) => '+' | '-' | null;
  drill?: LayerState;
}

interface AutoSelectMetric {
  key: string;
  label: string;
  getValue: (file: LoadedEvaluationFile) => number | null;
}

interface BiasDimensionDefinition {
  id: BiasDimensionId;
  label: string;
  color: string;
}

interface BenchmarkDefinition {
  id: string;
  benchmarkKey: string;
  metricKey: string;
  dimension: BiasDimensionId;
  label: string;
  color: string;
}

const BIAS_DIMENSIONS: BiasDimensionDefinition[] = [
  { id: 'stereotype_bias', label: 'Stereotypes', color: biasDimensionColors.stereotype_bias },
  { id: 'fairness', label: 'Fairness', color: biasDimensionColors.fairness },
  { id: 'toxicity', label: 'Toxicity', color: biasDimensionColors.toxicity },
  { id: 'sentiment', label: 'Sentiment', color: biasDimensionColors.sentiment }
];

const BENCHMARKS: BenchmarkDefinition[] = [
  { id: 'stereo_set', benchmarkKey: 'stereo_set', metricKey: 'stereotype_score', dimension: 'stereotype_bias', label: 'StereoSet', color: benchmarkColors.stereo_set },
  { id: 'reddit_bias', benchmarkKey: 'reddit_bias', metricKey: 'stereotype_score', dimension: 'stereotype_bias', label: 'RedditBias', color: benchmarkColors.reddit_bias },
  { id: 'wino_bias', benchmarkKey: 'wino_bias', metricKey: 'combined_bias', dimension: 'stereotype_bias', label: 'WinoBias', color: benchmarkColors.wino_bias },
  { id: 'bbq', benchmarkKey: 'bbq', metricKey: 's_combined', dimension: 'stereotype_bias', label: 'BBQ', color: benchmarkColors.bbq },
  { id: 'discrim_eval', benchmarkKey: 'discrim_eval', metricKey: 'mean_abs_dev', dimension: 'fairness', label: 'DiscrimEval', color: benchmarkColors.discrim_eval },
  { id: 'discrim_eval_gen', benchmarkKey: 'discrim_eval_gen', metricKey: 'mean_abs_dev', dimension: 'fairness', label: 'DiscrimEvalGen', color: benchmarkColors.discrim_eval_gen },
  { id: 'dt_fairness', benchmarkKey: 'dt_fairness', metricKey: 'combined_diff', dimension: 'fairness', label: 'DT-Fairness', color: benchmarkColors.dt_fairness },
  { id: 'bold_toxicity', benchmarkKey: 'bold', metricKey: 'toxicity', dimension: 'toxicity', label: 'BOLD-Toxicity', color: benchmarkColors.bold_toxicity },
  { id: 'dt_toxic', benchmarkKey: 'dt_toxic', metricKey: 'toxicity', dimension: 'toxicity', label: 'DT-Toxicity', color: benchmarkColors.dt_toxic },
  { id: 'bold_sentiment', benchmarkKey: 'bold', metricKey: 'sentiment', dimension: 'sentiment', label: 'BOLD-Sentiment', color: benchmarkColors.bold_sentiment }
];

const DEMOGRAPHIC_ORDER = ['gender', 'race', 'religion', 'age'];

const toScore = (value: unknown): number | null => isScoreValue(value) ? value : null;

const signKeyForMetric = (metricKey: string) => `${metricKey}__sign`;

const orderedUnique = (values: string[], preferredOrder: string[] = []): string[] => {
  const unique = Array.from(new Set(values));
  return unique.sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a);
    const bIndex = preferredOrder.indexOf(b);
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return labelForKey(a).localeCompare(labelForKey(b));
  });
};

const hasAnyValue = (files: LoadedEvaluationFile[], getValue: (file: LoadedEvaluationFile) => number | null): boolean => (
  files.some(file => isScoreValue(getValue(file)))
);

const benchmarkById = (benchmarkId: string): BenchmarkDefinition | undefined => (
  BENCHMARKS.find(benchmark => benchmark.id === benchmarkId)
);

const benchmarkMetric = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition) => (
  file.raw.benchmarks?.[benchmark.benchmarkKey]?.metrics?.[benchmark.metricKey]
);

const selectedMetricValue = (metric: EvaluationMetricGroup | undefined): EvaluationMetricValue | undefined => {
  if (scoreFromMetricValue(metric?.mean) !== null) return metric?.mean;
  return metric?.global;
};

const benchmarkDirectionMarker = (
  benchmark: BenchmarkDefinition,
  metric: EvaluationMetricValue | undefined
) => directionMarkerFromMetricValue(
  metric,
  isForcedUnsignedBenchmarkMetric(benchmark.benchmarkKey, benchmark.metricKey)
);

const aggregateDimension = (file: LoadedEvaluationFile, dimension: BiasDimensionId) => (
  aggregateScore(selectedAggregateSet(file.raw)?.by_bias_dimension?.[dimension])
);

const aggregateDimensionDemographic = (file: LoadedEvaluationFile, dimension: BiasDimensionId, demographic: string) => (
  toScore(selectedAggregateSet(file.raw)?.by_bias_dimension?.[dimension]?.by_demographic_category?.[demographic])
);

const aggregateDemographic = (file: LoadedEvaluationFile, demographic: string) => (
  toScore(selectedAggregateSet(file.raw)?.by_demographic_category?.[demographic])
);

const aggregateSubgroup = (file: LoadedEvaluationFile, demographic: string, subgroup: string) => (
  toScore(selectedAggregateSet(file.raw)?.by_subgroup?.[demographic]?.[subgroup])
);

const benchmarkGlobal = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition) => (
  meanMetricScore(benchmarkMetric(file, benchmark))
);

const benchmarkGlobalSign = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition) => (
  benchmarkDirectionMarker(benchmark, selectedMetricValue(benchmarkMetric(file, benchmark)))
);

const benchmarkDemographic = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition, demographic: string) => (
  scoreFromMetricValue(benchmarkMetric(file, benchmark)?.by_demographic_category?.[demographic])
);

const benchmarkDemographicSign = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition, demographic: string) => (
  benchmarkDirectionMarker(benchmark, benchmarkMetric(file, benchmark)?.by_demographic_category?.[demographic])
);

const benchmarkSubgroup = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition, demographic: string, subgroup: string) => (
  scoreFromMetricValue(benchmarkMetric(file, benchmark)?.by_subgroup?.[demographic]?.[subgroup])
);

const benchmarkSubgroupSign = (file: LoadedEvaluationFile, benchmark: BenchmarkDefinition, demographic: string, subgroup: string) => (
  benchmarkDirectionMarker(benchmark, benchmarkMetric(file, benchmark)?.by_subgroup?.[demographic]?.[subgroup])
);

const metricFrom = (
  key: string,
  label: string,
  color: string,
  getValue: (file: LoadedEvaluationFile) => number | null,
  drill?: LayerState,
  getSign?: (file: LoadedEvaluationFile) => '+' | '-' | null
): VisualizationMetric => ({ key, label, color, getValue, drill, getSign });

const Visualization: React.FC = () => {
  const { modelFiles, isLoading, error } = useEvaluationData();
  const modelCategories = useMemo(() => modelFiles.map(file => file.dataPoint.category), [modelFiles]);
  const [layer, setLayer] = useState<LayerState>({ kind: 'total', view: 'bias-dimensions' });
  const [visibleCategories, setVisibleCategories] = useState<string[]>([]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isReorderMenuOpen, setIsReorderMenuOpen] = useState(false);
  const [isAutoSelectMenuOpen, setIsAutoSelectMenuOpen] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [isolatedMetricKey, setIsolatedMetricKey] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  // const [autoSelectSearchQuery, setAutoSelectSearchQuery] = useState('');
  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [helperLineEnabled, setHelperLineEnabled] = useState(true);
  const [dynamicRecalculationEnabled, setDynamicRecalculationEnabled] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const reorderRef = useRef<HTMLDivElement>(null);
  const autoSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCategories(modelCategories);
    setCategoryOrder(modelCategories);
  }, [modelCategories]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsCategoryMenuOpen(false);
      if (reorderRef.current && !reorderRef.current.contains(event.target as Node)) setIsReorderMenuOpen(false);
      if (autoSelectRef.current && !autoSelectRef.current.contains(event.target as Node)) setIsAutoSelectMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableDemographics = useMemo(() => {
    const keys = modelFiles.flatMap(file => Object.keys(selectedAggregateSet(file.raw)?.by_demographic_category ?? {}));
    return orderedUnique(keys, DEMOGRAPHIC_ORDER);
  }, [modelFiles]);

  const availableDimensions = useMemo(() => (
    BIAS_DIMENSIONS.filter(dimension => hasAnyValue(modelFiles, file => aggregateDimension(file, dimension.id)))
  ), [modelFiles]);

  const activeCategoriesInSequence = useMemo(() => (
    categoryOrder.filter(category => visibleCategories.includes(category))
  ), [categoryOrder, visibleCategories]);

  const orderedModelFiles = useMemo(() => {
    const visibleFiles = modelFiles.filter(file => visibleCategories.includes(file.dataPoint.category));
    return [...visibleFiles].sort((a, b) => (
      categoryOrder.indexOf(a.dataPoint.category) - categoryOrder.indexOf(b.dataPoint.category)
    ));
  }, [modelFiles, visibleCategories, categoryOrder]);

  const filteredModels = useMemo(() => (
    modelFiles.filter(file =>
      file.dataPoint.category.toLowerCase().includes(modelSearchQuery.toLowerCase())
    )
  ), [modelFiles, modelSearchQuery]);

  const dimensionBenchmarks = (dimension: BiasDimensionId) => (
    BENCHMARKS.filter(benchmark =>
      benchmark.dimension === dimension &&
      hasAnyValue(modelFiles, file => benchmarkGlobal(file, benchmark))
    )
  );

  const dimensionDemographics = (dimension: BiasDimensionId) => {
    const keys = modelFiles.flatMap(file => (
      Object.keys(selectedAggregateSet(file.raw)?.by_bias_dimension?.[dimension]?.by_demographic_category ?? {})
    ));
    return orderedUnique(keys, DEMOGRAPHIC_ORDER);
  };

  const demographicSubgroups = (demographic: string) => {
    const keys = modelFiles.flatMap(file => Object.keys(selectedAggregateSet(file.raw)?.by_subgroup?.[demographic] ?? {}));
    return orderedUnique(keys);
  };

  const benchmarkDemographics = (benchmark: BenchmarkDefinition) => {
    const keys = modelFiles.flatMap(file => (
      Object.keys(benchmarkMetric(file, benchmark)?.by_demographic_category ?? {})
    ));
    return orderedUnique(keys, DEMOGRAPHIC_ORDER);
  };

  const benchmarkSubgroups = (benchmark: BenchmarkDefinition, demographic: string) => {
    const keys = modelFiles.flatMap(file => (
      Object.keys(benchmarkMetric(file, benchmark)?.by_subgroup?.[demographic] ?? {})
    ));
    return orderedUnique(keys);
  };

  const layerMetrics = useMemo((): { backgroundMetric: VisualizationMetric; breakdownMetrics: VisualizationMetric[] } => {
    if (layer.kind === 'total') {
      const backgroundMetric = metricFrom(
        'total-score',
        'Total Score',
        totalMetricColor,
        file => aggregateScore(selectedAggregateSet(file.raw)?.total_bias_score)
      );

      const breakdownMetrics = layer.view === 'bias-dimensions'
        ? availableDimensions.map(dimension => metricFrom(
          `dimension:${dimension.id}`,
          dimension.label,
          dimension.color,
          file => aggregateDimension(file, dimension.id),
          { kind: 'dimension', dimension: dimension.id, view: 'benchmarks' }
        ))
        : availableDemographics.map((demographic, index) => metricFrom(
          `demographic:${demographic}`,
          labelForKey(demographic),
          demographicCategoryColors[demographic] ?? subgroupColors[index % subgroupColors.length],
          file => aggregateDemographic(file, demographic),
          { kind: 'demographic', demographic }
        ));

      return { backgroundMetric, breakdownMetrics };
    }

    if (layer.kind === 'dimension') {
      const dimension = BIAS_DIMENSIONS.find(item => item.id === layer.dimension)!;
      const backgroundMetric = metricFrom(
        `dimension:${dimension.id}`,
        dimension.label,
        dimension.color,
        file => aggregateDimension(file, dimension.id)
      );

      const breakdownMetrics = layer.view === 'benchmarks'
        ? dimensionBenchmarks(dimension.id).map(benchmark => metricFrom(
          `benchmark:${benchmark.id}`,
          benchmark.label,
          benchmark.color,
          file => benchmarkGlobal(file, benchmark),
          { kind: 'benchmark', benchmarkId: benchmark.id },
          file => benchmarkGlobalSign(file, benchmark)
        ))
        : dimensionDemographics(dimension.id).map((demographic, index) => metricFrom(
          `dimension:${dimension.id}:demographic:${demographic}`,
          labelForKey(demographic),
          demographicCategoryColors[demographic] ?? subgroupColors[index % subgroupColors.length],
          file => aggregateDimensionDemographic(file, dimension.id, demographic)
        ));

      return { backgroundMetric, breakdownMetrics };
    }

    if (layer.kind === 'demographic') {
      const backgroundMetric = metricFrom(
        `demographic:${layer.demographic}`,
        labelForKey(layer.demographic),
        demographicCategoryColors[layer.demographic] ?? totalMetricColor,
        file => aggregateDemographic(file, layer.demographic)
      );

      const breakdownMetrics = demographicSubgroups(layer.demographic).map((subgroup, index) => metricFrom(
        `demographic:${layer.demographic}:subgroup:${subgroup}`,
        labelForKey(subgroup),
        subgroupColors[index % subgroupColors.length],
        file => aggregateSubgroup(file, layer.demographic, subgroup)
      ));

      return { backgroundMetric, breakdownMetrics };
    }

    if (layer.kind === 'benchmark') {
      const benchmark = benchmarkById(layer.benchmarkId)!;
      const backgroundMetric = metricFrom(
        `benchmark:${benchmark.id}`,
        benchmark.label,
        benchmark.color,
        file => benchmarkGlobal(file, benchmark),
        undefined,
        file => benchmarkGlobalSign(file, benchmark)
      );

      const breakdownMetrics = benchmarkDemographics(benchmark).map((demographic, index) => {
        const subgroups = benchmarkSubgroups(benchmark, demographic);
        return metricFrom(
          `benchmark:${benchmark.id}:demographic:${demographic}`,
          labelForKey(demographic),
          demographicCategoryColors[demographic] ?? subgroupColors[index % subgroupColors.length],
          file => benchmarkDemographic(file, benchmark, demographic),
          subgroups.length > 0 ? { kind: 'benchmark-demographic', benchmarkId: benchmark.id, demographic } : undefined,
          file => benchmarkDemographicSign(file, benchmark, demographic)
        );
      });

      return { backgroundMetric, breakdownMetrics };
    }

    const benchmark = benchmarkById(layer.benchmarkId)!;
    const backgroundMetric = metricFrom(
      `benchmark:${benchmark.id}:demographic:${layer.demographic}`,
      `${benchmark.label}: ${labelForKey(layer.demographic)}`,
      demographicCategoryColors[layer.demographic] ?? benchmark.color,
      file => benchmarkDemographic(file, benchmark, layer.demographic),
      undefined,
      file => benchmarkDemographicSign(file, benchmark, layer.demographic)
    );

    const breakdownMetrics = benchmarkSubgroups(benchmark, layer.demographic).map((subgroup, index) => metricFrom(
      `benchmark:${benchmark.id}:subgroup:${layer.demographic}:${subgroup}`,
      labelForKey(subgroup),
      subgroupColors[index % subgroupColors.length],
      file => benchmarkSubgroup(file, benchmark, layer.demographic, subgroup),
      undefined,
      file => benchmarkSubgroupSign(file, benchmark, layer.demographic, subgroup)
    ));

    return { backgroundMetric, breakdownMetrics };
  }, [availableDemographics, availableDimensions, layer, modelFiles]);

  const chartData = useMemo<ChartScoreRow[]>(() => {
    const metrics = [layerMetrics.backgroundMetric, ...layerMetrics.breakdownMetrics];
    return orderedModelFiles.map(file => {
      const row: ChartScoreRow = {
        id: file.dataPoint.id,
        category: file.dataPoint.category
      };

      metrics.forEach(metric => {
        row[metric.key] = metric.getValue(file);
        const sign = metric.getSign?.(file);
        if (sign) row[signKeyForMetric(metric.key)] = sign;
      });

      return row;
    });
  }, [layerMetrics, orderedModelFiles]);

  const chartBreakdownMetrics = useMemo(() => {
    if (!isolatedMetricKey) return layerMetrics.breakdownMetrics;
    const isolatedMetric = layerMetrics.breakdownMetrics.find(metric => metric.key === isolatedMetricKey);
    return isolatedMetric ? [isolatedMetric] : layerMetrics.breakdownMetrics;
  }, [isolatedMetricKey, layerMetrics.breakdownMetrics]);

  const visibleAutoSelectMetrics = useMemo<AutoSelectMetric[]>(() => {
    const visibleMetrics = isolatedMetricKey
      ? chartBreakdownMetrics
      : [layerMetrics.backgroundMetric, ...chartBreakdownMetrics];

    return visibleMetrics
      .filter(metric => hasAnyValue(modelFiles, metric.getValue))
      .map(metric => ({
        key: metric.key,
        label: metric.label,
        getValue: metric.getValue
      }));
  }, [chartBreakdownMetrics, isolatedMetricKey, layerMetrics.backgroundMetric, modelFiles]);

  const canGoBack = layer.kind !== 'total';

  const navigateToLayer = (nextLayer: LayerState) => {
    setLayer(nextLayer);
    setIsolatedMetricKey(null);
  };

  const goBack = () => {
    setIsolatedMetricKey(null);

    if (layer.kind === 'dimension') setLayer({ kind: 'total', view: 'bias-dimensions' });
    else if (layer.kind === 'demographic') setLayer({ kind: 'total', view: 'demographics' });
    else if (layer.kind === 'benchmark') {
      const benchmark = benchmarkById(layer.benchmarkId);
      if (benchmark) setLayer({ kind: 'dimension', dimension: benchmark.dimension, view: 'benchmarks' });
    } else if (layer.kind === 'benchmark-demographic') {
      setLayer({ kind: 'benchmark', benchmarkId: layer.benchmarkId });
    }
  };

  const handleChartClick = (metricKey: string | null) => {
    if (!metricKey || metricKey === layerMetrics.backgroundMetric.key) {
      if (isolatedMetricKey) {
        setIsolatedMetricKey(null);
      } else if (canGoBack) {
        goBack();
      }
      return;
    }

    const metric = layerMetrics.breakdownMetrics.find(item => item.key === metricKey);
    if (!metric) return;

    if (isolatedMetricKey === metric.key) {
      if (metric.drill) navigateToLayer(metric.drill);
      return;
    }

    setIsolatedMetricKey(metric.key);
  };

  const toggleCategory = (category: string) => {
    setVisibleCategories(prev => prev.includes(category) ? prev.filter(item => item !== category) : [...prev, category]);
  };

  const onDragStart = (event: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;
    const itemToMove = activeCategoriesInSequence[draggedItemIndex];
    const targetItem = activeCategoriesInSequence[targetIndex];
    const newGlobalOrder = [...categoryOrder];
    newGlobalOrder.splice(newGlobalOrder.indexOf(itemToMove), 1);
    newGlobalOrder.splice(newGlobalOrder.indexOf(targetItem), 0, itemToMove);
    setCategoryOrder(newGlobalOrder);
    setDraggedItemIndex(null);
  };

  const toggleAllCategories = (event: React.MouseEvent) => {
    event.stopPropagation();
    setVisibleCategories(visibleCategories.length === modelFiles.length ? [] : modelCategories);
  };

  const applyAutoSelect = (metric: AutoSelectMetric) => {
    const selectedModels = modelFiles
      .map(file => ({ file, score: metric.getValue(file) }))
      .filter((entry): entry is { file: LoadedEvaluationFile; score: number } => isScoreValue(entry.score))
      .sort((a, b) => a.score - b.score || a.file.dataPoint.category.localeCompare(b.file.dataPoint.category))
      .slice(0, 5)
      .map(entry => entry.file.dataPoint.category);

    if (selectedModels.length === 0) return;

    const existingRemainder = categoryOrder.filter(category => !selectedModels.includes(category));
    const missingRemainder = modelCategories.filter(category => !selectedModels.includes(category) && !existingRemainder.includes(category));

    setVisibleCategories(selectedModels);
    setCategoryOrder([...selectedModels, ...existingRemainder, ...missingRemainder]);
    setIsolatedMetricKey(null);
    setIsAutoSelectMenuOpen(false);
  };

  const renderGranularControls = () => {
    if (layer.kind === 'total') {
      return (
        <>
          <button
            onClick={() => navigateToLayer({ kind: 'total', view: 'bias-dimensions' })}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${layer.view === 'bias-dimensions'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
            }`}
          >
            <Tags size={14} />
            Bias Dimensions
          </button>
          <button
            onClick={() => navigateToLayer({ kind: 'total', view: 'demographics' })}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${layer.view === 'demographics'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
            }`}
          >
            <Users size={14} />
            Demographic Categories
          </button>
        </>
      );
    }

    if (layer.kind === 'dimension') {
      return (
        <>
          <button
            onClick={() => navigateToLayer({ ...layer, view: 'benchmarks' })}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${layer.view === 'benchmarks'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
            }`}
          >
            <Tags size={14} />
            Main Benchmark Scores
          </button>
          <button
            onClick={() => navigateToLayer({ ...layer, view: 'dimension-demographics' })}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${layer.view === 'dimension-demographics'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
              : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
            }`}
          >
            <Users size={14} />
            Demographic Categories
          </button>
        </>
      );
    }

    if (layer.kind === 'demographic') {
      return (
        <button className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 border-indigo-600 text-white shadow-lg border flex items-center gap-2">
          <UserCircle size={14} />
          Subgroup Scores
        </button>
      );
    }

    if (layer.kind === 'benchmark') {
      return (
        <button className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 border-indigo-600 text-white shadow-lg border flex items-center gap-2">
          <Users size={14} />
          Benchmark by Demographic Category
        </button>
      );
    }

    return (
      <button className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 border-indigo-600 text-white shadow-lg border flex items-center gap-2">
        <UserCircle size={14} />
        Benchmark by Subgroup
      </button>
    );
  };

  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="w-full h-[600px] bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase text-gray-400 font-black tracking-widest mb-3">Loading Data</p>
          <p className="font-black text-gray-900 text-xl">Reading evaluation files from the data folder</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="w-full h-[420px] bg-white rounded-3xl border border-rose-100 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center px-8">
          <p className="text-[10px] uppercase text-rose-400 font-black tracking-widest mb-3">Data Load Failed</p>
          <p className="font-black text-gray-900 text-xl mb-2">Unable to read evaluation data</p>
          <p className="text-sm text-gray-500 max-w-xl">{error}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-6">
        <div className="flex-1">
          <h2 className="text-4xl font-black text-gray-900 leading-none mb-4">
            Granular Social Bias Visualization
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
        <div className="flex items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
              className={`flex items-center space-x-3 px-5 py-3 rounded-2xl border transition-all shadow-sm font-bold text-sm h-[42px] ${isCategoryMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-100' : 'bg-white border-gray-100 text-gray-700 hover:border-gray-300'}`}
            >
              <Filter size={18} className="text-indigo-500" />
              <span>Models ({visibleCategories.length})</span>
            </button>
            {isCategoryMenuOpen && (
              <div className="absolute left-0 mt-3 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                    <span className="text-[10px] uppercase text-gray-400 font-black tracking-widest">Select Visible Models</span>
                    <button onClick={toggleAllCategories} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase px-2 py-1 bg-indigo-50 rounded">Toggle All</button>
                  </div>

                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search models..."
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                      value={modelSearchQuery}
                      onChange={(event) => setModelSearchQuery(event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {filteredModels.map(file => {
                      const isVisible = visibleCategories.includes(file.dataPoint.category);
                      return (
                        <button key={file.dataPoint.category} onClick={() => toggleCategory(file.dataPoint.category)} className={`flex items-center px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${isVisible ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}>
                          <span className="truncate">{file.dataPoint.category}</span>
                        </button>
                      );
                    })}
                    {filteredModels.length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                        No models found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={reorderRef}>
            <button
              onClick={() => setIsReorderMenuOpen(!isReorderMenuOpen)}
              className={`flex items-center space-x-3 px-5 py-3 rounded-2xl border transition-all shadow-sm font-bold text-sm h-[42px] ${isReorderMenuOpen ? 'bg-amber-50 border-amber-200 text-amber-700 ring-2 ring-amber-100' : 'bg-white border-gray-100 text-gray-700 hover:border-gray-300'}`}
            >
              <GripVertical size={18} className="text-amber-500" />
              <span>Sequence</span>
            </button>
            {isReorderMenuOpen && (
              <div className="absolute left-0 mt-3 w-[280px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                  <span className="text-[10px] uppercase text-gray-400 font-black tracking-widest">Reorder Models</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-2">
                  {activeCategoriesInSequence.map((category, index) => (
                    <div
                      key={category}
                      draggable
                      onDragStart={(event) => onDragStart(event, index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDrop(event, index)}
                      className={`flex items-center p-3 hover:bg-indigo-50/50 rounded-xl group transition-all cursor-grab active:cursor-grabbing border ${draggedItemIndex === index ? 'opacity-40 border-indigo-200 bg-indigo-50' : 'border-transparent'}`}
                    >
                      <GripVertical size={14} className="text-gray-300 mr-3 group-hover:text-indigo-400 transition-colors" />
                      <span className="text-[11px] font-bold truncate flex-1 text-gray-800">{category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={autoSelectRef}>
            <button
              onClick={() => setIsAutoSelectMenuOpen(!isAutoSelectMenuOpen)}
              className={`flex items-center space-x-3 px-5 py-3 rounded-2xl border transition-all shadow-sm font-bold text-sm h-[42px] ${isAutoSelectMenuOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-100' : 'bg-white border-gray-100 text-gray-700 hover:border-gray-300'}`}
            >
              <Sparkles size={18} className="text-emerald-500" />
              <span>Auto-Rank</span>
            </button>
            {isAutoSelectMenuOpen && (
              <div className="absolute left-0 mt-3 w-[360px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                  <span className="text-[10px] uppercase text-gray-400 font-black tracking-widest">Lowest 5 Models By Score</span>
                </div>
                {/*
                <div className="p-3 border-b border-gray-50">
                  <input
                    type="text"
                    placeholder="Search score dimensions..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 transition-all"
                    value={autoSelectSearchQuery}
                    onChange={(event) => setAutoSelectSearchQuery(event.target.value)}
                  />
                </div>
                */}
                <div className="max-h-[420px] overflow-y-auto p-2">
                  {visibleAutoSelectMetrics.map(metric => (
                    <button
                      key={metric.key}
                      onClick={() => applyAutoSelect(metric)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      {metric.label}
                    </button>
                  ))}
                  {visibleAutoSelectMetrics.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                      No score dimensions found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 ml-2">
            <button
              onClick={() => setTooltipEnabled(!tooltipEnabled)}
              title="Toggle Tooltips"
              className={`p-2 rounded-xl transition-all ${tooltipEnabled ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Info size={18} />
            </button>
            <button
              onClick={() => setHelperLineEnabled(!helperLineEnabled)}
              title="Toggle Helper Line"
              className={`p-2 rounded-xl transition-all ${helperLineEnabled ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setDynamicRecalculationEnabled(!dynamicRecalculationEnabled)}
              title="Toggle Dynamic Recalculation"
              className={`p-2 rounded-xl transition-all ${dynamicRecalculationEnabled ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Calculator size={18} />
            </button>
          </div>

          <div className="flex flex-col ml-2">
            <span className="text-[10px] uppercase text-gray-400 font-extrabold mb-1 ml-1">General Layer</span>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 rounded-xl text-sm font-black bg-gray-100 text-gray-800 border border-transparent">
                {layerMetrics.backgroundMetric.label}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-gray-400 font-extrabold mb-1 ml-1">Granular Layer</span>
            <div className="flex flex-wrap gap-2">
              {renderGranularControls()}
            </div>
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <LayeredColumnChart
          data={chartData}
          totalMetric={layerMetrics.backgroundMetric}
          breakdownMetrics={chartBreakdownMetrics}
          showTotal={!isolatedMetricKey}
          onBarClick={handleChartClick}
          tooltipEnabled={tooltipEnabled}
          helperLineEnabled={helperLineEnabled}
          dynamicRecalculationEnabled={dynamicRecalculationEnabled}
        />
      ) : (
        <div className="w-full h-[600px] bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-400">
          <p className="font-black text-gray-600">No models selected</p>
        </div>
      )}

      <div className="mt-12">
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-900 mb-1">How to Use This Visualization</h2>
          <p className="text-sm text-gray-500">Use the chart to move from aggregate scores into the next available breakdown layer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Filter size={15} className="text-indigo-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Model Filter</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click <strong className="text-gray-700">Models</strong> to choose which models appear in the chart. Use <strong className="text-gray-700">Toggle All</strong> or the search box to manage larger lists.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <GripVertical size={15} className="text-amber-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Model Sequence</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click <strong className="text-gray-700">Sequence</strong> to reorder models along the x-axis by dragging the handles.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Sparkles size={15} className="text-emerald-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Auto-select</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click <strong className="text-gray-700">Auto-select</strong> and choose a score dimension to show the five lowest-scoring models, ordered from lowest to highest.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-500 text-xs font-black">GL</span>
              </div>
              <span className="font-black text-sm text-gray-800">Layer Navigation</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              The grey background bar is the current general-layer score. The foreground bars are the next granular layer. Click a foreground bar to drill down when another layer is available, and use <strong className="text-gray-700">Back</strong> to return.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <Tags size={15} className="text-green-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Granular Layer Toggle</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Where a layer has two valid breakdowns, use the buttons in the top right to switch between them.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Info size={15} className="text-blue-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Tooltips</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click the info icon to toggle score tooltips on or off.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                <MousePointer2 size={15} className="text-purple-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Helper Line</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click the cursor icon to toggle a horizontal reference line that follows your mouse across the chart.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Calculator size={15} className="text-emerald-500" />
              </div>
              <span className="font-black text-sm text-gray-800">Dynamic Recalculation</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Click the calculator icon to make the grey background bar recalculate as the average of the currently visible foreground bars when legend entries are hidden.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Visualization;
