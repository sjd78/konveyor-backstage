import { useCallback, useEffect, useRef, useState } from 'react';
import type { KonveyorTask } from '../api/types';
import { useMtaApi } from './useKonveyorData';

const POLL_INTERVAL_MS = 3000;

export interface UseMtaAnalysisResult {
  task: KonveyorTask | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMtaAnalysis(taskId?: number): UseMtaAnalysisResult {
  const mtaApi = useMtaApi();
  const [task, setTask] = useState<KonveyorTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    try {
      const updated = await mtaApi.getTask(taskId);
      setTask(updated);
      if (
        updated.state === 'Created' ||
        updated.state === 'Pending' ||
        updated.state === 'Running'
      ) {
        pollTimerRef.current = setTimeout(fetchTask, POLL_INTERVAL_MS);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [mtaApi, taskId]);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    setError(null);
    void fetchTask();
    return () => {
      clearTimeout(pollTimerRef.current);
    };
  }, [taskId, fetchTask]);

  return { task, loading, error, refetch: fetchTask };
}
