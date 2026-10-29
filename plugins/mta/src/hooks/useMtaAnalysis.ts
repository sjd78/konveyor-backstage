import { useCallback, useEffect, useRef, useState } from 'react';
import type { KonveyorTask } from '../api/types';
import { useMtaApi } from './useKonveyorData';
import { isKonveyorTaskTerminal } from './migrationState';

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
  const pollTimerRef = useRef<NodeJS.Timeout>();
  const currentTaskId = useRef(taskId);
  const requestSequence = useRef(0);
  const mounted = useRef(false);
  currentTaskId.current = taskId;

  const fetchTask = useCallback(async () => {
    clearTimeout(pollTimerRef.current);
    if (!taskId) return;
    const sequence = ++requestSequence.current;
    setError(null);
    try {
      const updated = await mtaApi.getTask(taskId);
      if (
        !mounted.current ||
        currentTaskId.current !== taskId ||
        sequence !== requestSequence.current
      ) {
        return;
      }
      setTask(updated);
      if (!isKonveyorTaskTerminal(updated)) {
        pollTimerRef.current = setTimeout(() => {
          void fetchTask();
        }, POLL_INTERVAL_MS);
      }
    } catch (err: unknown) {
      if (
        mounted.current &&
        currentTaskId.current === taskId &&
        sequence === requestSequence.current
      ) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (
        mounted.current &&
        currentTaskId.current === taskId &&
        sequence === requestSequence.current
      ) {
        setLoading(false);
      }
    }
  }, [mtaApi, taskId]);

  useEffect(() => {
    mounted.current = true;
    setTask(null);
    setError(null);
    setLoading(Boolean(taskId));
    if (taskId) void fetchTask();
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      clearTimeout(pollTimerRef.current);
    };
  }, [taskId, fetchTask]);

  return { task, loading, error, refetch: fetchTask };
}
