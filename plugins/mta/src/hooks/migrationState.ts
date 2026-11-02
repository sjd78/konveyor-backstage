import type { KonveyorTask } from '../api/types';
import type { MigrationStatus } from '../types';

export function isDiscoveryTask(task: KonveyorTask): boolean {
  return (
    task.kind === 'language-discovery' ||
    task.kind === 'tech-discovery' ||
    task.addon === 'language-discovery' ||
    task.data?.mode?.discovery === true
  );
}

export function isAnalysisTask(task: KonveyorTask): boolean {
  return (
    !isDiscoveryTask(task) &&
    (task.kind === 'analyzer' || task.addon === 'analyzer')
  );
}

export function isTaskActive(task: KonveyorTask): boolean {
  return [
    'Created',
    'Ready',
    'Postponed',
    'QuotaBlocked',
    'Pending',
    'Running',
  ].includes(task.state);
}

export function isKonveyorTaskTerminal(task: KonveyorTask): boolean {
  return !isTaskActive(task);
}

export function getLatestKonveyorTask(
  tasks: KonveyorTask[],
): KonveyorTask | undefined {
  return tasks.reduce<KonveyorTask | undefined>((latest, task) => {
    if (!isAnalysisTask(task) && !isDiscoveryTask(task)) return latest;
    return !latest || task.id > latest.id ? task : latest;
  }, undefined);
}

export function deriveKonveyorPhase(
  tasks: KonveyorTask[],
  hasAnalysis = false,
): MigrationStatus {
  const latest = getLatestKonveyorTask(tasks);
  if (latest) {
    if (isTaskActive(latest)) {
      return isDiscoveryTask(latest) ? 'Discovery' : 'Analysis';
    }
    if (latest.state === 'Failed' || latest.state === 'Canceled') {
      return 'Failed';
    }
    if (latest.state === 'Succeeded') {
      if (isDiscoveryTask(latest)) return 'Path Selection';
      return hasAnalysis ? 'Active' : 'Analysis Unavailable';
    }
  }
  return hasAnalysis ? 'Active' : 'Not Started';
}
