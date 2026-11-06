import { useEffect, useState } from 'react';
import { Alert, Button, Flex, Skeleton } from '@backstage/ui';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useKonveyorMigration } from '../hooks/useKonveyorMigration';
import { isDiscoveryTask } from '../hooks/migrationState';
import { EmptyState } from './shared/MtaUi';
import { PhaseNotStarted } from './phases/PhaseNotStarted';
import { PhaseDiscovery } from './phases/PhaseDiscovery';
import { PhasePathSelection } from './phases/PhasePathSelection';
import { PhaseAnalyzing } from './phases/PhaseAnalyzing';
import { PhaseActive } from './phases/PhaseActive';
import { PhaseFailed } from './phases/PhaseFailed';

export function MigrationTab() {
  const { entity } = useEntity();
  const { role: persona, loading: personaLoading } = usePersonaRole();
  const annotation =
    entity.metadata.annotations?.['konveyor.io/application-id'];
  const validAnnotation =
    annotation !== undefined &&
    /^[1-9]\d*$/.test(annotation) &&
    Number.isSafeInteger(Number(annotation));
  const appId = validAnnotation ? Number(annotation) : undefined;
  const [choosingProfile, setChoosingProfile] = useState(false);
  const [actionFailure, setActionFailure] = useState<Error | null>(null);
  const {
    phase,
    application,
    profiles,
    issues,
    activeTask,
    loading,
    error,
    issuesError,
    isExecuting,
    startDiscovery,
    startAnalysis,
    retryAnalysis,
    refresh,
  } = useKonveyorMigration({ appId });

  useEffect(() => {
    setChoosingProfile(false);
    setActionFailure(null);
  }, [annotation]);

  const execute = async (action: () => Promise<void>) => {
    setActionFailure(null);
    try {
      await action();
    } catch (cause: unknown) {
      setActionFailure(
        cause instanceof Error ? cause : new Error(String(cause)),
      );
    }
  };

  if (annotation !== undefined && !validAnnotation) {
    return (
      <Alert
        status="danger"
        icon
        title="Invalid Hub application connection"
        description="Set konveyor.io/application-id to a positive numeric application ID from Konveyor Hub. The current annotation is not valid."
      />
    );
  }
  if (loading || personaLoading) {
    return (
      <Flex
        direction="column"
        gap="4"
        role="status"
        aria-label="Loading migration"
      >
        <Skeleton width="100%" height={64} />
        <Skeleton width="100%" height={320} />
      </Flex>
    );
  }
  if (!appId) {
    return <PhaseNotStarted persona={persona} />;
  }

  const displayError = actionFailure || error;
  const errorPanel = displayError && (
    <Flex direction="column" gap="3" mb="4">
      <Alert
        status="danger"
        icon
        title="Unable to load or update Hub migration data"
        description={displayError.message}
      />
      <Flex gap="2">
        <Button
          variant="tertiary"
          onPress={() => {
            void execute(refresh);
          }}
        >
          Retry loading Hub data
        </Button>
      </Flex>
    </Flex>
  );
  if (!application)
    return (
      errorPanel || (
        <Alert
          status="danger"
          icon
          title="Hub application unavailable"
          description="Check the component's konveyor.io/application-id annotation and the application's availability in Hub."
        />
      )
    );
  if (error && !actionFailure) return errorPanel;

  const isArchitect = persona === 'architect';
  const profileSelection = (
    <PhasePathSelection
      app={application}
      profiles={profiles}
      isExecuting={isExecuting}
      onStartAnalysis={profileId => {
        void execute(async () => {
          await startAnalysis(profileId);
          setChoosingProfile(false);
        });
      }}
      onStartDiscovery={() => {
        void execute(async () => {
          await startDiscovery();
          setChoosingProfile(false);
        });
      }}
      onRefresh={() => {
        void execute(refresh);
      }}
      onCancel={choosingProfile ? () => setChoosingProfile(false) : undefined}
    />
  );
  let content;
  if (choosingProfile && isArchitect) {
    content = profileSelection;
  } else {
    switch (phase) {
      case 'Not Started':
        content = (
          <PhaseNotStarted
            persona={persona}
            connected
            isExecuting={isExecuting}
            onStartDiscovery={() => {
              void execute(startDiscovery);
            }}
          />
        );
        break;
      case 'Discovery':
        content = <PhaseDiscovery app={application} task={activeTask} />;
        break;
      case 'Path Selection':
        content = isArchitect ? (
          profileSelection
        ) : (
          <EmptyState
            title="Analysis profile selection"
            description="An application architect can select an effective Hub analysis profile and start analysis."
          />
        );
        break;
      case 'Analysis':
        content = (
          <PhaseAnalyzing
            app={application}
            task={activeTask}
            profileName={
              profiles.find(
                profile => profile.id === activeTask?.data?.profile?.id,
              )?.name
            }
          />
        );
        break;
      case 'Analysis Unavailable':
        content = (
          <Flex direction="column" gap="3" mb="4">
            <Alert
              status="warning"
              icon
              title="Analysis results are not available"
              description="The Hub task succeeded, but no persisted analysis is available. Refresh after Hub stores the results. An application architect can select a profile to run analysis again."
            />
            <Flex gap="2">
              <Button
                variant="tertiary"
                isDisabled={isExecuting}
                onPress={() => {
                  void execute(refresh);
                }}
              >
                Refresh analysis availability
              </Button>
              {isArchitect && (
                <Button
                  variant="tertiary"
                  isDisabled={isExecuting}
                  onPress={() => setChoosingProfile(true)}
                >
                  Select analysis profile
                </Button>
              )}
            </Flex>
          </Flex>
        );
        break;
      case 'Active':
        content = issuesError ? null : (
          <PhaseActive
            app={application}
            issues={issues}
            persona={persona}
            onRunAnalysis={
              isArchitect ? () => setChoosingProfile(true) : undefined
            }
          />
        );
        break;
      case 'Failed':
        content = (
          <PhaseFailed
            task={activeTask}
            canRetry={
              isArchitect &&
              Boolean(
                activeTask &&
                  (isDiscoveryTask(activeTask) ||
                    profiles.some(
                      profile => profile.id === activeTask.data?.profile?.id,
                    )),
              )
            }
            isExecuting={isExecuting}
            onRetry={() => {
              void execute(retryAnalysis);
            }}
            onSelectProfile={
              isArchitect ? () => setChoosingProfile(true) : undefined
            }
          />
        );
        break;
      default:
        content = (
          <Alert
            status="warning"
            icon
            title="Unsupported migration state"
            description="Refresh Hub data to load the current task and findings."
          />
        );
    }
  }

  return (
    <>
      {errorPanel}
      {issuesError && (
        <Flex direction="column" gap="3" mb="4">
          <Alert
            status="danger"
            icon
            title="Unable to load findings"
            description={issuesError.message}
          />
          <Flex gap="2">
            <Button
              variant="tertiary"
              onPress={() => {
                void execute(refresh);
              }}
            >
              Retry loading findings
            </Button>
          </Flex>
        </Flex>
      )}
      {content}
    </>
  );
}
