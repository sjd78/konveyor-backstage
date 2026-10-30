import { useCallback, useState } from 'react';
import type { KonveyorApplication, KonveyorTask } from '../api/types';
import { useMtaApi } from './useKonveyorData';

export interface UseKonveyorActionsResult {
  createApplication: (
    appData: Partial<KonveyorApplication>,
  ) => Promise<KonveyorApplication>;
  triggerDiscovery: (appId: number) => Promise<KonveyorTask>;
  triggerAnalysis: (appId: number, profileId: number) => Promise<KonveyorTask>;
  isExecuting: boolean;
  actionError: Error | null;
  clearActionError: () => void;
}

export function useKonveyorActions(): UseKonveyorActionsResult {
  const mtaApi = useMtaApi();
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const clearActionError = useCallback(() => setActionError(null), []);

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

  const triggerDiscovery = useCallback(
    async (appId: number): Promise<KonveyorTask> => {
      setIsExecuting(true);
      setActionError(null);
      try {
        return await mtaApi.triggerDiscovery(appId);
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
    async (appId: number, profileId: number): Promise<KonveyorTask> => {
      setIsExecuting(true);
      setActionError(null);
      try {
        return await mtaApi.triggerAnalysis(appId, profileId);
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
    triggerDiscovery,
    triggerAnalysis,
    isExecuting,
    actionError,
    clearActionError,
  };
}
