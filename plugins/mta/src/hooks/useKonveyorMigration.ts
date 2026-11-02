import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  KonveyorAnalysisProfile,
  KonveyorApplication,
  KonveyorTask,
} from '../api/types';
import type { MigrationIssue, MigrationStatus } from '../types';
import { useKonveyorActions } from './useKonveyorActions';
import {
  useKonveyorApplication,
  useKonveyorIssues,
  useMtaApi,
} from './useKonveyorData';
import {
  deriveKonveyorPhase,
  getLatestKonveyorTask,
  isKonveyorTaskTerminal,
  isDiscoveryTask,
} from './migrationState';
import { useMtaAnalysis } from './useMtaAnalysis';

export interface UseKonveyorMigrationOptions {
  appId?: number;
}

export interface UseKonveyorMigrationResult {
  phase: MigrationStatus;
  application: KonveyorApplication | null;
  profiles: KonveyorAnalysisProfile[];
  issues: MigrationIssue[];
  activeTask: KonveyorTask | null;
  loading: boolean;
  error: Error | null;
  issuesError: Error | null;
  isExecuting: boolean;
  startDiscovery: () => Promise<void>;
  startAnalysis: (profileId: number) => Promise<void>;
  retryAnalysis: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface LifecycleData {
  appId?: number;
  tasks: KonveyorTask[];
  profiles: KonveyorAnalysisProfile[];
  hasAnalysis: boolean;
  error: Error | null;
  loading: boolean;
}

export function useKonveyorMigration({
  appId,
}: UseKonveyorMigrationOptions): UseKonveyorMigrationResult {
  const mtaApi = useMtaApi();
  const [lifecycle, setLifecycle] = useState<LifecycleData>({
    tasks: [],
    profiles: [],
    hasAnalysis: false,
    error: null,
    loading: Boolean(appId),
  });
  const [submittedTask, setSubmittedTask] = useState<{
    appId: number;
    task: KonveyorTask;
  }>();
  const currentAppId = useRef(appId);
  const requestSequence = useRef(0);
  const refreshedTerminal = useRef('');
  currentAppId.current = appId;

  const {
    application: loadedApplication,
    loading: appLoading,
    error: appError,
    refetch: refetchApp,
  } = useKonveyorApplication(appId);
  const application =
    loadedApplication?.id === appId ? loadedApplication : null;
  const {
    issues,
    loading: issuesLoading,
    error: issuesError,
    refetch: refetchIssues,
  } = useKonveyorIssues(application?.id);
  const {
    triggerDiscovery,
    triggerAnalysis,
    isExecuting,
    actionError,
    clearActionError,
  } = useKonveyorActions();

  const fetchLifecycle = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!appId) {
      setLifecycle({
        tasks: [],
        profiles: [],
        hasAnalysis: false,
        error: null,
        loading: false,
      });
      return;
    }
    setLifecycle(previous => ({ ...previous, loading: true, error: null }));
    const [tasks, profiles, analysis] = await Promise.allSettled([
      mtaApi.getApplicationTasks(appId),
      mtaApi.getAnalysisProfiles(appId),
      mtaApi.getAnalysis(appId),
    ]);
    if (
      currentAppId.current !== appId ||
      sequence !== requestSequence.current
    ) {
      return;
    }
    const failed = [tasks, profiles, analysis].find(
      result => result.status === 'rejected',
    );
    let lifecycleError: Error | null = null;
    if (failed?.status === 'rejected') {
      lifecycleError =
        failed.reason instanceof Error
          ? failed.reason
          : new Error(String(failed.reason));
    }
    setLifecycle(previous => {
      const previousData = previous.appId === appId ? previous : undefined;
      return {
        appId,
        tasks:
          tasks.status === 'fulfilled'
            ? tasks.value
            : previousData?.tasks ?? [],
        profiles:
          profiles.status === 'fulfilled'
            ? profiles.value
            : previousData?.profiles ?? [],
        hasAnalysis:
          analysis.status === 'fulfilled'
            ? analysis.value !== null
            : previousData?.hasAnalysis ?? false,
        error: lifecycleError,
        loading: false,
      };
    });
  }, [appId, mtaApi]);

  useEffect(() => {
    void fetchLifecycle();
    return () => {
      requestSequence.current += 1;
    };
  }, [fetchLifecycle]);

  const tasks = lifecycle.appId === appId ? lifecycle.tasks : [];
  const profiles = useMemo(
    () => (lifecycle.appId === appId ? lifecycle.profiles : []),
    [lifecycle.appId, lifecycle.profiles, appId],
  );
  const latestTask = getLatestKonveyorTask(
    submittedTask && submittedTask.appId === appId
      ? [...tasks, submittedTask.task]
      : tasks,
  );
  const {
    task: polledTask,
    loading: taskLoading,
    error: taskError,
    refetch: refetchTask,
  } = useMtaAnalysis(latestTask?.id);
  const activeTask =
    polledTask?.id === latestTask?.id ? polledTask : latestTask;

  const refresh = useCallback(async () => {
    clearActionError();
    await Promise.all([
      refetchApp(),
      fetchLifecycle(),
      refetchIssues(),
      refetchTask(),
    ]);
  }, [
    clearActionError,
    refetchApp,
    fetchLifecycle,
    refetchIssues,
    refetchTask,
  ]);

  useEffect(() => {
    if (!activeTask || !isKonveyorTaskTerminal(activeTask)) return;
    const key = `${appId}:${activeTask.id}:${activeTask.state}`;
    if (refreshedTerminal.current === key) return;
    refreshedTerminal.current = key;
    void Promise.all([refetchApp(), fetchLifecycle(), refetchIssues()]);
  }, [appId, activeTask, refetchApp, fetchLifecycle, refetchIssues]);

  const startDiscovery = useCallback(async () => {
    if (!application)
      throw new Error(
        'Connect this component to a Hub application before discovery.',
      );
    const task = await triggerDiscovery(application.id);
    if (currentAppId.current === application.id) {
      setSubmittedTask({ appId: application.id, task });
    }
  }, [application, triggerDiscovery]);

  const startAnalysis = useCallback(
    async (profileId: number) => {
      if (!application)
        throw new Error(
          'Connect this component to a Hub application before analysis.',
        );
      if (!profiles.some(profile => profile.id === profileId)) {
        throw new Error(
          'Select an effective analysis profile for this application.',
        );
      }
      const task = await triggerAnalysis(application.id, profileId);
      if (currentAppId.current === application.id) {
        setSubmittedTask({ appId: application.id, task });
      }
    },
    [application, profiles, triggerAnalysis],
  );

  const retryAnalysis = useCallback(async () => {
    if (activeTask && isDiscoveryTask(activeTask)) {
      await startDiscovery();
      return;
    }
    const profileId = activeTask?.data?.profile?.id;
    if (typeof profileId !== 'number') {
      throw new Error('Select an analysis profile to retry this task.');
    }
    await startAnalysis(profileId);
  }, [activeTask, startDiscovery, startAnalysis]);

  const phase = deriveKonveyorPhase(
    activeTask
      ? [...tasks.filter(task => task.id !== activeTask.id), activeTask]
      : tasks,
    lifecycle.appId === appId && lifecycle.hasAnalysis,
  );
  const missingApplication =
    appId && !appLoading && !application && !appError
      ? new Error(
          `Hub application ${appId} was not found. Correct the konveyor.io/application-id annotation or restore the application in Hub.`,
        )
      : null;

  return {
    phase,
    application,
    profiles,
    issues,
    activeTask: activeTask ?? null,
    loading:
      Boolean(appId) &&
      (appLoading ||
        lifecycle.loading ||
        lifecycle.appId !== appId ||
        issuesLoading ||
        taskLoading),
    error:
      actionError ||
      appError ||
      missingApplication ||
      lifecycle.error ||
      taskError,
    issuesError,
    isExecuting,
    startDiscovery,
    startAnalysis,
    retryAnalysis,
    refresh,
  };
}
