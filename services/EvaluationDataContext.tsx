import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { METRICS } from '../constants';
import { DataPoint, LoadedEvaluationFile, MetricKey } from '../types';
import { isScoreValue, loadEvaluationDataFiles } from './evaluationData';

interface EvaluationDataContextValue {
  modelData: DataPoint[];
  modelFiles: LoadedEvaluationFile[];
  availableMetricKeys: MetricKey[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  getModelFileByName: (modelName: string) => LoadedEvaluationFile | undefined;
}

const EvaluationDataContext = createContext<EvaluationDataContextValue | undefined>(undefined);

export const EvaluationDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modelFiles, setModelFiles] = useState<LoadedEvaluationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedFiles = await loadEvaluationDataFiles();
      setModelFiles(loadedFiles);
    } catch (loadError) {
      console.error('Evaluation data load failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load evaluation data.');
      setModelFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const modelData = useMemo(() => modelFiles.map(file => file.dataPoint), [modelFiles]);

  const availableMetricKeys = useMemo(() => {
    return METRICS
      .filter(metric => modelData.some(model => isScoreValue(model[metric.key])))
      .map(metric => metric.key);
  }, [modelData]);

  const getModelFileByName = useCallback(
    (modelName: string) => modelFiles.find(file => file.dataPoint.category === modelName),
    [modelFiles]
  );

  const value = useMemo<EvaluationDataContextValue>(() => ({
    modelData,
    modelFiles,
    availableMetricKeys,
    isLoading,
    error,
    reload,
    getModelFileByName
  }), [availableMetricKeys, error, getModelFileByName, isLoading, modelData, modelFiles, reload]);

  return (
    <EvaluationDataContext.Provider value={value}>
      {children}
    </EvaluationDataContext.Provider>
  );
};

export function useEvaluationData(): EvaluationDataContextValue {
  const context = useContext(EvaluationDataContext);
  if (!context) {
    throw new Error('useEvaluationData must be used inside EvaluationDataProvider.');
  }
  return context;
}
