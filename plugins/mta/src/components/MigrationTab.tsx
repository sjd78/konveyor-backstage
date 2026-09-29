import { EmptyState, Progress } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useKonveyorMigration } from '../hooks/useKonveyorMigration';
import { DEVELOPER_PHASE_CONFIG, DEFAULT_DEVELOPER_PHASE } from '../utils';
import { PhaseNotStarted } from './phases/PhaseNotStarted';
import { PhaseDiscovery } from './phases/PhaseDiscovery';
import { PhasePathSelection } from './phases/PhasePathSelection';
import { PhaseAnalyzing } from './phases/PhaseAnalyzing';
import { PhaseActive } from './phases/PhaseActive';
import { PhaseCompleted } from './phases/PhaseCompleted';
import { PhaseFailed } from './phases/PhaseFailed';

export function MigrationTab() {
  const { entity } = useEntity();
  const { role: persona, loading: personaLoading } = usePersonaRole();
  const annotations = entity.metadata.annotations ?? {};
  const appIdStr = annotations['konveyor.io/application-id'];
  const appId = appIdStr ? Number(appIdStr) : undefined;
  const repoUrl =
    annotations['mta.konveyor.io/repo-url'] ||
    annotations['backstage.io/source-location']?.replace('url:', '') ||
    '';

  const {
    phase,
    application,
    archetypes,
    issues,
    activeTask,
    loading,
    error,
    startDiscovery,
    startAnalysis,
    retryAnalysis,
  } = useKonveyorMigration({
    entityName: entity.metadata.name,
    entityRef: stringifyEntityRef(entity),
    appId,
    repoUrl,
  });

  if (loading || personaLoading) {
    return <Progress />;
  }

  if (
    persona !== 'architect' &&
    phase !== 'Active' &&
    phase !== 'Post-remediation'
  ) {
    const phaseConfig =
      DEVELOPER_PHASE_CONFIG[phase] ?? DEFAULT_DEVELOPER_PHASE;
    return (
      <EmptyState
        title={phaseConfig.title}
        description={phaseConfig.description}
        missing="content"
      />
    );
  }

  switch (phase) {
    case 'Not Started':
      return (
        <PhaseNotStarted
          persona={persona === 'developer' ? 'developer' : 'architect'}
          onStartDiscovery={startDiscovery}
        />
      );
    case 'Discovery':
      return <PhaseDiscovery repoUrl={repoUrl} />;
    case 'Path Selection':
      return (
        <PhasePathSelection
          app={application!}
          archetypes={archetypes}
          onStartAnalysis={startAnalysis}
        />
      );
    case 'Analysis':
      return (
        <PhaseAnalyzing
          task={activeTask}
          targetName={archetypes[0]?.name}
          appTypeName={application?.name}
        />
      );
    case 'Active':
    case 'Post-remediation':
      return (
        <PhaseActive
          app={application!}
          issues={issues}
          persona={persona}
          isPostRemediation={phase === 'Post-remediation'}
          onRunAnalysis={() => startAnalysis([])}
        />
      );
    case 'Completed':
      return <PhaseCompleted app={application!} issues={issues} />;
    case 'Failed':
      return <PhaseFailed error={error} onRetry={retryAnalysis} />;
    default:
      return (
        <PhaseNotStarted
          persona={persona === 'developer' ? 'developer' : 'architect'}
          onStartDiscovery={startDiscovery}
        />
      );
  }
}
