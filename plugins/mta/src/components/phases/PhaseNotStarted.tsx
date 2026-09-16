import Button from '@material-ui/core/Button';
import { EmptyState } from '@backstage/core-components';
import type { Persona } from '../../types';

export function PhaseNotStarted({
  persona,
  onStartDiscovery,
}: {
  persona: Persona;
  onStartDiscovery: () => void;
}) {
  if (persona === 'developer') {
    return (
      <EmptyState
        title="Migration not started"
        description="The application architect has not started migration for this application."
        missing="content"
      />
    );
  }

  return (
    <EmptyState
      title="No migration data yet"
      description="Scan this application's source code to discover technologies and find migration paths."
      action={
        <Button variant="contained" color="primary" onClick={onStartDiscovery}>
          Start discovery
        </Button>
      }
      missing="content"
    />
  );
}
