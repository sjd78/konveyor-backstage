import { useCallback, useState } from 'react';
import type { KonveyorApplication, KonveyorTask } from '../api/types';
import { useMtaApi } from './useKonveyorData';

export interface UseKonveyorActionsResult {
  createApplication: (
    appData: Partial<KonveyorApplication>,
  ) => Promise<KonveyorApplication>;
  triggerAnalysis: (
    appId: number,
    targets: string[],
  ) => Promise<KonveyorTask>;
  isExecuting: boolean;
  actionError: Error | null;
}

export function useKonveyorActions(): UseKonveyorActionsResult {
  const mtaApi = useMtaApi();
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);

  const createApplication = useCallback(
    async (
      appData: Partial<KonveyorApplication>,
    ): Promise<KonveyorApplication> => {
      setIsExecuting(true);
      setActionError(null);
      try {
        return await mtaApi.createApplication(appData);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setActionError(error);
        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [mtaApi],
  );

  const triggerAnalysis = useCallback(
    async (appId: number, targets: string[]): Promise<KonveyorTask> => {
      setIsExecuting(true);
      setActionError(null);
      try {
        return await mtaApi.triggerAnalysis(appId, targets);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setActionError(error);
        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [mtaApi],
  );

  return {
    createApplication,
    triggerAnalysis,
    isExecuting,
    actionError,
  };
}
