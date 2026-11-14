import { Button } from '@backstage/ui';
import type { PersonaRole } from '../../hooks/usePersonaRole';
import { EmptyState } from '../shared/MtaUi';

export function PhaseNotStarted({
  persona,
  connected = false,
  isExecuting = false,
  onStartDiscovery,
}: {
  persona: PersonaRole;
  connected?: boolean;
  isExecuting?: boolean;
  onStartDiscovery?: () => void;
}) {
  if (!connected) {
    return (
      <EmptyState
        title="No Hub application connected"
        description="Register this application in Konveyor Hub, then set this component's konveyor.io/application-id annotation to its numeric Hub application ID. In development, restart the catalog snapshot after registering the Hub application."
      />
    );
  }

  return (
    <EmptyState
      title="Discovery not started"
      description={
        persona === 'architect'
          ? 'Run repository discovery for this connected Hub application to identify its technologies.'
          : 'An application architect can start discovery for this connected Hub application.'
      }
      action={
        persona === 'architect' && onStartDiscovery ? (
          <Button
            variant="primary"
            isDisabled={isExecuting}
            onPress={onStartDiscovery}
          >
            Start discovery
          </Button>
        ) : undefined
      }
    />
  );
}
