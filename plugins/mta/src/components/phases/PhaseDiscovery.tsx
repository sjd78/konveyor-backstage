import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { InfoCard } from '@backstage/core-components';
import type { KonveyorApplication, KonveyorTask } from '../../api/types';

export function PhaseDiscovery({
  app,
  task,
}: {
  app: KonveyorApplication;
  task: KonveyorTask | null;
}) {
  const repository = app.repository;
  return (
    <Box mb={2}>
      <InfoCard
        title="Repository discovery"
        subheader={`Task ${task?.id ?? ''} · ${task?.state ?? 'Loading'}`}
      >
        <LinearProgress />
        <Box my={2}>
          <Typography variant="body2">
            {task?.activity?.[task.activity.length - 1] ||
              'Waiting for Hub discovery results.'}
          </Typography>
        </Box>
        <Typography variant="body2">
          Repository: {repository?.url || 'Not configured in Hub'}
        </Typography>
        {(repository?.branch || repository?.tag) && (
          <Typography variant="body2">
            Ref: {repository.branch || repository.tag}
          </Typography>
        )}
        {repository?.path && (
          <Typography variant="body2">Path: {repository.path}</Typography>
        )}
        <Box mt={2}>
          <Typography variant="body2" color="textSecondary">
            You can leave this page. Discovery status is restored from Hub tasks
            when you return.
          </Typography>
        </Box>
      </InfoCard>
    </Box>
  );
}
