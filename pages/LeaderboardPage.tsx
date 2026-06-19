
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { METRICS } from '../constants';
import { MetricKey, DataPoint } from '../types';
import { useEvaluationData } from '../services/EvaluationDataContext';
import { isScoreValue } from '../services/evaluationData';
import { Columns, ArrowDown, ArrowUp, ArrowUpDown, ChevronUp, ChevronDown, ListOrdered, Plus, RotateCcw, X } from 'lucide-react';

type SortDirection = 'asc' | 'desc';
type RankingDirection = 'normal' | 'inverse';

interface SingleSortConfig {
  key: keyof DataPoint;
  direction: SortDirection;
}

interface RankedRow {
  row: DataPoint;
  rankingScore: number | null;
}

interface RankingCriterionConfig {
  key: MetricKey;
  direction: RankingDirection;
}

interface RankingCriterion extends RankingCriterionConfig {
  label: string;
  rawWeight: number;
  normalizedWeight: number;
}

const BENCHMARK_AGGREGATES: MetricKey[] = [
  'stereotypes_aggregate',
  'fairness_aggregate',
  'toxicity_aggregate',
  'sentiment_aggregate'
];

const BENCHMARKS: MetricKey[] = [
  'stereoset',
  'redditbias',
  'winobias',
  'bbq',
  'discrimeval',
  'discrimevalgen',
  'dt_fairness',
  'bold_toxicity',
  'dt_toxicity',
  'bold_sentiment'
];

const DEMOGRAPHIC_SCORES: MetricKey[] = [
  'gender_score',
  'race_score',
  'religion_score',
  'age_score'
];

const DEMOGRAPHIC_SUBGROUPS: MetricKey[] = [
  'male',
  'female',
  'black',
  'asian',
  'white',
  'muslim',
  'christian',
  'jewish',
  'young',
  'senior'
];

const DEFAULT_SINGLE_SORT: SingleSortConfig = { key: 'category', direction: 'asc' };
const DEFAULT_RANKING_CRITERIA: RankingCriterionConfig[] = [];

const sameRankingCriteria = (a: RankingCriterionConfig[], b: RankingCriterionConfig[]) => (
  a.length === b.length && a.every((criterion, index) => (
    criterion.key === b[index].key && criterion.direction === b[index].direction
  ))
);

const compareScore = (aValue: DataPoint[keyof DataPoint], bValue: DataPoint[keyof DataPoint], direction: SortDirection) => {
  if (!isScoreValue(aValue) && isScoreValue(bValue)) return 1;
  if (isScoreValue(aValue) && !isScoreValue(bValue)) return -1;
  if (isScoreValue(aValue) && isScoreValue(bValue)) {
    return direction === 'asc' ? aValue - bValue : bValue - aValue;
  }
  return 0;
};

const rankingContribution = (score: number, direction: RankingDirection) => (
  direction === 'inverse' ? 100 - score : score
);

const LeaderboardPage: React.FC = () => {
  const { modelData, availableMetricKeys, isLoading, error } = useEvaluationData();
  const availableMetricSet = useMemo(() => new Set(availableMetricKeys), [availableMetricKeys]);
  const [rankingCriteria, setRankingCriteria] = useState<RankingCriterionConfig[]>(DEFAULT_RANKING_CRITERIA);
  const [singleSortConfig, setSingleSortConfig] = useState<SingleSortConfig | null>(DEFAULT_SINGLE_SORT);
  const [isLedgerColumnMenuOpen, setIsLedgerColumnMenuOpen] = useState(false);
  const [isCriteriaMenuOpen, setIsCriteriaMenuOpen] = useState(false);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [criteriaSearchQuery, setCriteriaSearchQuery] = useState('');
  const [visibleLedgerColumns, setVisibleLedgerColumns] = useState<MetricKey[]>([
    'total_aggregate',
    'stereotypes_aggregate',
    'fairness_aggregate',
    'toxicity_aggregate',
    'sentiment_aggregate'
  ]);

  const ledgerColumnRef = useRef<HTMLDivElement>(null);
  const criteriaMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ledgerColumnRef.current && !ledgerColumnRef.current.contains(event.target as Node)) {
        setIsLedgerColumnMenuOpen(false);
      }
      if (criteriaMenuRef.current && !criteriaMenuRef.current.contains(event.target as Node)) {
        setIsCriteriaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allPossibleMetrics = useMemo(() => {
    return METRICS.filter(m =>
      availableMetricSet.has(m.key) && (
        m.key === 'total_aggregate' ||
        BENCHMARK_AGGREGATES.includes(m.key) ||
        BENCHMARKS.includes(m.key) ||
        DEMOGRAPHIC_SCORES.includes(m.key) ||
        DEMOGRAPHIC_SUBGROUPS.includes(m.key)
      )
    );
  }, [availableMetricSet]);

  const metricByKey = useMemo(() => new Map(allPossibleMetrics.map(metric => [metric.key, metric])), [allPossibleMetrics]);

  useEffect(() => {
    setRankingCriteria(prev => {
      const next = prev.filter(criterion => availableMetricSet.has(criterion.key));
      return sameRankingCriteria(prev, next) ? prev : next;
    });
  }, [availableMetricSet]);

  const rankingCriterionDetails = useMemo<RankingCriterion[]>(() => {
    const activeCriteria = rankingCriteria.filter(criterion => metricByKey.has(criterion.key));
    const totalWeight = activeCriteria.reduce((sum, _key, index) => sum + activeCriteria.length - index, 0);

    return activeCriteria.map((criterion, index) => {
      const rawWeight = activeCriteria.length - index;
      return {
        key: criterion.key,
        direction: criterion.direction,
        label: metricByKey.get(criterion.key)?.label ?? criterion.key,
        rawWeight,
        normalizedWeight: totalWeight > 0 ? rawWeight / totalWeight : 0
      };
    });
  }, [metricByKey, rankingCriteria]);

  const filteredMetricsForMenu = useMemo(() => {
    return allPossibleMetrics.filter(m =>
      m.label.toLowerCase().includes(columnSearchQuery.toLowerCase())
    );
  }, [allPossibleMetrics, columnSearchQuery]);

  const filteredMetricsForCriteriaMenu = useMemo(() => {
    return allPossibleMetrics.filter(m =>
      visibleLedgerColumns.includes(m.key) &&
      m.label.toLowerCase().includes(criteriaSearchQuery.toLowerCase())
    );
  }, [allPossibleMetrics, criteriaSearchQuery, visibleLedgerColumns]);

  const weightedScoreForRow = (row: DataPoint) => {
    let weightedTotal = 0;
    let availableWeight = 0;

    rankingCriterionDetails.forEach(criterion => {
      const value = row[criterion.key];
      if (isScoreValue(value)) {
        weightedTotal += rankingContribution(value, criterion.direction) * criterion.rawWeight;
        availableWeight += criterion.rawWeight;
      }
    });

    return availableWeight > 0 ? weightedTotal / availableWeight : null;
  };

  const sortedLedgerRows = useMemo<RankedRow[]>(() => {
    const rows = modelData.map(row => ({
      row,
      rankingScore: weightedScoreForRow(row)
    }));

    if (singleSortConfig) {
      return rows.sort((a, b) => {
        const { key, direction } = singleSortConfig;
        const aValue = a.row[key];
        const bValue = b.row[key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }

        const comparison = compareScore(aValue, bValue, direction);
        return comparison !== 0 ? comparison : a.row.category.localeCompare(b.row.category);
      });
    }

    return rows.sort((a, b) => {
      if (a.rankingScore === null && b.rankingScore !== null) return 1;
      if (a.rankingScore !== null && b.rankingScore === null) return -1;
      if (a.rankingScore !== null && b.rankingScore !== null && a.rankingScore !== b.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      for (const criterion of rankingCriterionDetails) {
        const aValue = a.row[criterion.key];
        const bValue = b.row[criterion.key];
        if (!isScoreValue(aValue) && isScoreValue(bValue)) return 1;
        if (isScoreValue(aValue) && !isScoreValue(bValue)) return -1;
        const comparison = isScoreValue(aValue) && isScoreValue(bValue)
          ? rankingContribution(bValue, criterion.direction) - rankingContribution(aValue, criterion.direction)
          : 0;
        if (comparison !== 0) return comparison;
      }

      return a.row.category.localeCompare(b.row.category);
    });
  }, [modelData, singleSortConfig, rankingCriterionDetails]);

  const addRankingCriterion = (key: MetricKey) => {
    setSingleSortConfig(null);
    setRankingCriteria(prev => (
      prev.some(criterion => criterion.key === key)
        ? prev
        : [...prev, { key, direction: 'normal' }]
    ));
    setVisibleLedgerColumns(prev => prev.includes(key) ? prev : [...prev, key]);
  };

  const removeRankingCriterion = (key: MetricKey, activateWeightedRanking = true) => {
    setRankingCriteria(prev => {
      const next = prev.filter(activeKey => activeKey.key !== key);
      if (activateWeightedRanking) setSingleSortConfig(next.length > 0 ? null : DEFAULT_SINGLE_SORT);
      return next;
    });
  };

  const toggleRankingDirection = (key: MetricKey) => {
    setSingleSortConfig(null);
    setRankingCriteria(prev => prev.map(criterion => (
      criterion.key === key
        ? { ...criterion, direction: criterion.direction === 'normal' ? 'inverse' : 'normal' }
        : criterion
    )));
  };

  const resetRankingCriteria = () => {
    setSingleSortConfig(DEFAULT_SINGLE_SORT);
    setRankingCriteria(DEFAULT_RANKING_CRITERIA);
  };

  const requestSort = (key: keyof DataPoint) => {
    setSingleSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: key === 'category' ? 'asc' : 'desc' };
    });
  };

  const getColumnSortIcon = (key: keyof DataPoint) => {
    if (singleSortConfig?.key !== key) return <ArrowUpDown size={14} className="ml-2 opacity-30" />;
    return singleSortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="ml-2 text-indigo-600" />
      : <ChevronDown size={14} className="ml-2 text-indigo-600" />;
  };

  const toggleLedgerColumn = (key: MetricKey) => {
    const isVisible = visibleLedgerColumns.includes(key);
    setVisibleLedgerColumns(prev => isVisible ? prev.filter(k => k !== key) : [...prev, key]);
    if (isVisible) removeRankingCriterion(key, singleSortConfig === null);
    if (isVisible && singleSortConfig?.key === key) setSingleSortConfig(DEFAULT_SINGLE_SORT);
  };

  const formatScore = (value: DataPoint[keyof DataPoint]) => {
    return isScoreValue(value) ? value.toFixed(1) : 'N/A';
  };

  const formatRankingScore = (value: number | null) => {
    return value === null ? 'N/A' : value.toFixed(1);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 h-[420px] flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase text-gray-400 font-black tracking-widest mb-3">Loading Data</p>
          <p className="font-black text-gray-900 text-xl">Reading evaluation files from the data folder</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
      >
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-rose-100 h-[420px] flex flex-col items-center justify-center text-center px-8">
          <p className="text-[10px] uppercase text-rose-400 font-black tracking-widest mb-3">Data Load Failed</p>
          <p className="font-black text-gray-900 text-xl mb-2">Unable to read evaluation data</p>
          <p className="text-sm text-gray-500 max-w-xl">{error}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-6 lg:px-8 py-12"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-black text-gray-900 mb-4">Social Bias Leaderboard</h1>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-xl text-gray-900">Model Rankings</h3>
          </div>

          <div className="relative" ref={ledgerColumnRef}>
            <button
              onClick={() => setIsLedgerColumnMenuOpen(!isLedgerColumnMenuOpen)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all text-sm font-bold ${isLedgerColumnMenuOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
            >
              <Columns size={18} className="text-indigo-500" />
              <span>Select Columns</span>
            </button>
            {isLedgerColumnMenuOpen && (
              <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-50">
                  <input
                    type="text"
                    placeholder="Search columns..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                    value={columnSearchQuery}
                    onChange={(e) => setColumnSearchQuery(e.target.value)}
                  />
                </div>
                <div className="p-2 max-h-80 overflow-y-auto">
                  {filteredMetricsForMenu.map(m => {
                    const isVisible = visibleLedgerColumns.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        onClick={() => toggleLedgerColumn(m.key)}
                        className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-colors ${isVisible ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${isVisible ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                          {isVisible && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        {m.label}
                      </button>
                    );
                  })}
                  {filteredMetricsForMenu.length === 0 && (
                    <div className="text-center py-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                      No columns found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-10 py-5 border-b border-gray-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <ListOrdered size={14} className="text-indigo-500" />
                Ranking Criteria
              </div>
              {!singleSortConfig && rankingCriterionDetails.length > 0 && (
                <div className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Weighted Ranking Active
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {rankingCriterionDetails.length > 0 ? (
                rankingCriterionDetails.map((criterion, index) => (
                  <div
                    key={criterion.key}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
                      singleSortConfig
                        ? 'border-gray-100 bg-gray-50 text-gray-500'
                        : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] text-white">
                      {index + 1}
                    </span>
                    <span>{criterion.label}</span>
                    <span className="text-[10px] text-indigo-400">{Math.round(criterion.normalizedWeight * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => toggleRankingDirection(criterion.key)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                        criterion.direction === 'normal'
                          ? 'bg-white text-indigo-600 hover:bg-indigo-100'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                      title={criterion.direction === 'normal' ? 'Higher scores rank higher' : 'Lower scores rank higher'}
                    >
                      {criterion.direction === 'normal' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRankingCriterion(criterion.key)}
                      className="rounded-full p-0.5 text-indigo-300 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
                      title={`Remove ${criterion.label} from ranking criteria`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-black text-gray-500">
                  No ranking criteria selected
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative" ref={criteriaMenuRef}>
              <button
                type="button"
                onClick={() => setIsCriteriaMenuOpen(!isCriteriaMenuOpen)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black transition-all ${
                  isCriteriaMenuOpen
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <Plus size={14} />
                Add Criteria
              </button>
              {isCriteriaMenuOpen && (
                <div className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-3 border-b border-gray-50">
                    <input
                      type="text"
                      placeholder="Search metrics..."
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                      value={criteriaSearchQuery}
                      onChange={(e) => setCriteriaSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="p-2 max-h-80 overflow-y-auto">
                    {filteredMetricsForCriteriaMenu.map(m => {
                      const criterionIndex = rankingCriterionDetails.findIndex(criterion => criterion.key === m.key);
                      const isSelected = criterionIndex >= 0;
                      return (
                        <button
                          key={m.key}
                          onClick={() => addRankingCriterion(m.key)}
                          className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-colors ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          <div className={`w-5 h-5 rounded-full border mr-3 flex items-center justify-center text-[10px] font-black ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-transparent'}`}>
                            {isSelected ? criterionIndex + 1 : ''}
                          </div>
                          {m.label}
                        </button>
                      );
                    })}
                    {filteredMetricsForCriteriaMenu.length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                        No metrics found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={resetRankingCriteria}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-500 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <RotateCcw size={14} />
              Reset Ranking
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/20">
                <th className="px-10 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest sticky left-0 bg-white z-10 cursor-pointer whitespace-nowrap" onClick={() => requestSort('category')}>
                  <div className="flex items-center">Model {getColumnSortIcon('category')}</div>
                </th>
                {!singleSortConfig && rankingCriterionDetails.length > 0 && (
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-indigo-600 bg-indigo-50/40">
                    <div className="flex items-center gap-2">
                      <ListOrdered size={14} />
                      Rank Score
                    </div>
                  </th>
                )}
                {allPossibleMetrics.map(m => (
                  visibleLedgerColumns.includes(m.key) && (
                    <th
                      key={m.key}
                      className={`px-6 py-5 text-[10px] font-black uppercase tracking-widest cursor-pointer whitespace-nowrap ${m.key === 'total_aggregate' ? 'text-indigo-600 bg-indigo-50/30' : 'text-gray-400'}`}
                      onClick={() => requestSort(m.key)}
                      title={`Sort by ${m.label}`}
                    >
                      <div className="flex items-center">{m.label} {getColumnSortIcon(m.key)}</div>
                    </th>
                  )
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedLedgerRows.map(({ row, rankingScore }, index) => (
                <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-10 py-5 text-sm font-black text-gray-900 sticky left-0 bg-white group-hover:bg-indigo-50/20 z-10 border-r border-gray-50 whitespace-nowrap">
                    <span className="mr-3 text-xs font-black text-gray-300">#{index + 1}</span>
                    {row.category}
                  </td>
                  {!singleSortConfig && rankingCriterionDetails.length > 0 && (
                    <td className="px-6 py-5 text-sm font-black text-indigo-700 bg-indigo-50/10">
                      {formatRankingScore(rankingScore)}
                    </td>
                  )}
                  {allPossibleMetrics.map(m => (
                    visibleLedgerColumns.includes(m.key) && (
                      <td
                        key={m.key}
                        className={`px-6 py-5 text-sm font-bold transition-all ${m.key === 'total_aggregate' ? 'text-indigo-700 bg-indigo-50/10 font-black' :
                            BENCHMARK_AGGREGATES.includes(m.key) ? 'text-gray-600' :
                              'text-purple-600 font-black'
                          }`}
                      >
                        {formatScore(row[m.key as keyof DataPoint])}
                      </td>
                    )
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default LeaderboardPage;
