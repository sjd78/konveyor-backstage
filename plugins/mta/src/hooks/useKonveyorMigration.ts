import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorTask,
} from '../api/types';
import type { MigrationIssue, MigrationStatus } from '../types';
import { useKonveyorActions } from './useKonveyorActions';
import {
  useKonveyorApplication,
  useKonveyorArchetypes,
  useKonveyorIssues,
} from './useKonveyorData';
import { useMtaAnalysis } from './useMtaAnalysis';

export interface UseKonveyorMigrationOptions {
  entityName: string;
  entityRef: string;
  appId?: number;
  repoUrl?: string;
}

export interface UseKonveyorMigrationResult {
  phase: MigrationStatus;
  application: KonveyorApplication | null;
  archetypes: KonveyorArchetype[];
  issues: MigrationIssue[];
  activeTask: KonveyorTask | null;
  loading: boolean;
  error: Error | null;
  isExecuting: boolean;
  startDiscovery: () => Promise<void>;
  startAnalysis: (targets: string[]) => Promise<void>;
  retryAnalysis: () => Promise<void>;
}

export function useKonveyorMigration(
  options: UseKonveyorMigrationOptions,
): UseKonveyorMigrationResult {
  const { entityName, appId: initialAppId, repoUrl } = options;
  const [createdAppId, setCreatedAppId] = useState<number | undefined>(undefined);
  const effectiveAppId = initialAppId ?? createdAppId;

  const [activeTaskId, setActiveTaskId] = useState<number | undefined>(undefined);
  const lastTargetsRef = useRef<string[]>([]);

  const {
    application,
    loading: appLoading,
    error: appError,
    refetch: refetchApp,
  } = useKonveyorApplication(effectiveAppId);

  const {
    archetypes,
    loading: archetypesLoading,
    error: archetypesError,
  } = useKonveyorArchetypes();

  const {
    issues,
    loading: issuesLoading,
    error: issuesError,
  } = useKonveyorIssues(effectiveAppId);

  const {
    task: activeTask,
    loading: taskLoading,
    error: taskError,
  } = useMtaAnalysis(activeTaskId);

  const {
    createApplication,
    triggerAnalysis,
    isExecuting,
    actionError,
  } = useKonveyorActions();

  // Pick up latest task from application if not explicitly tracked
  useEffect(() => {
    if (application?.tasks && application.tasks.length > 0 && !activeTaskId) {
      const latest = application.tasks[application.tasks.length - 1];
      setActiveTaskId(latest);
    }
  }, [application, activeTaskId]);

  const startDiscovery = useCallback(async () => {
    const newApp = await createApplication({
      name: entityName,
      repository: repoUrl ? { url: repoUrl } : undefined,
    });
    setCreatedAppId(newApp.id);
    await refetchApp();
  }, [createApplication, entityName, repoUrl, refetchApp]);

  const startAnalysis = useCallback(
    async (targets: string[]) => {
      if (!effectiveAppId) {
        throw new Error('Cannot run analysis without an application ID');
      }
      lastTargetsRef.current = targets;
      const task = await triggerAnalysis(effectiveAppId, targets);
      setActiveTaskId(task.id);
    },
    [effectiveAppId, triggerAnalysis],
  );

  const retryAnalysis = useCallback(async () => {
    await startAnalysis(lastTargetsRef.current);
  }, [startAnalysis]);

  // Derive phase state
  let phase: MigrationStatus = 'Not Started';

  if (!effectiveAppId || (!appLoading && !application)) {
    phase = 'Not Started';
  } else if (application) {
    const hasTags = (application.tags?.length ?? 0) > 0;
    if (!hasTags && (!activeTask || activeTask.state === 'Created')) {
      phase = 'Discovery';
    } else if (activeTask) {
      if (
        activeTask.state === 'Created' ||
        activeTask.state === 'Pending' ||
        activeTask.state === 'Running'
      ) {
        phase = 'Analysis';
      } else if (activeTask.state === 'Succeeded') {
        phase = 'Active';
      } else if (
        activeTask.state === 'Failed' ||
        activeTask.state === 'Canceled'
      ) {
        phase = 'Failed';
      } else {
        phase = 'Path Selection';
      }
    } else if (issues.length > 0) {
      phase = 'Active';
    } else {
      phase = 'Path Selection';
    }
  }

  const combinedError =
    actionError ||
    appError ||
    archetypesError ||
    issuesError ||
    taskError ||
    (activeTask?.state === 'Failed'
      ? new Error(activeTask.errors?.join(', ') || 'Analysis failed')
      : null);

  const loading =
    appLoading ||
    archetypesLoading ||
    (Boolean(effectiveAppId) && issuesLoading) ||
    taskLoading;

  return {
    phase,
    application,
    archetypes,
    issues,
    activeTask,
    loading,
    error: combinedError,
    isExecuting,
    startDiscovery,
    startAnalysis,
    retryAnalysis,
  };
}
