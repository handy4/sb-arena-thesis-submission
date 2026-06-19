import { LoadedEvaluationFile } from '../types';

export function modelPath(model: LoadedEvaluationFile): string {
  return `/models/${encodeURIComponent(model.dataPoint.id)}`;
}

export function findModelByRouteId(
  modelFiles: LoadedEvaluationFile[],
  routeId: string | undefined
): LoadedEvaluationFile | undefined {
  if (!routeId) return undefined;
  const decodedId = decodeURIComponent(routeId);
  return modelFiles.find(file => file.dataPoint.id === decodedId);
}
