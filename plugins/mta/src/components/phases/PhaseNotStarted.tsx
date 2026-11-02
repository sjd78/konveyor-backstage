import Button from '@material-ui/core/Button';
import { EmptyState } from '@backstage/core-components';
import type { PersonaRole } from '../../hooks/usePersonaRole';

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
        missing="content"
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
            variant="contained"
            color="primary"
            disabled={isExecuting}
            onClick={onStartDiscovery}
          >
            Start discovery
          </Button>
        ) : undefined
      }
      missing="content"
    />
  );
}
