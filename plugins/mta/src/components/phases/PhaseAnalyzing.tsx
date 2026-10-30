import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { InfoCard } from '@backstage/core-components';
import type { KonveyorApplication, KonveyorTask } from '../../api/types';

export interface PhaseAnalyzingProps {
  task: KonveyorTask | null;
  app: KonveyorApplication;
  profileName?: string;
}

export function PhaseAnalyzing({
  task,
  app,
  profileName,
}: PhaseAnalyzingProps) {
  return (
    <Box mb={2}>
      <InfoCard
        title="Analysis task"
        subheader={`Task ${task?.id ?? ''} · ${task?.state ?? 'Loading'}`}
      >
        <LinearProgress />
        <Box my={2}>
          <Typography variant="body2">
            {task?.activity?.[task.activity.length - 1] ||
              'Waiting for Hub analysis results.'}
          </Typography>
        </Box>
        {profileName && (
          <Typography variant="body2">
            Analysis profile: {profileName}
          </Typography>
        )}
        <Typography variant="body2">
          Repository: {app.repository?.url || 'Not configured in Hub'}
        </Typography>
        {(app.repository?.branch || app.repository?.tag) && (
          <Typography variant="body2">
            Ref: {app.repository.branch || app.repository.tag}
          </Typography>
        )}
        {app.repository?.path && (
          <Typography variant="body2">Path: {app.repository.path}</Typography>
        )}
        <Box mt={2}>
          <Typography variant="body2" color="textSecondary">
            You can leave this page. Task status and findings are loaded from
            Hub when you return.
          </Typography>
        </Box>
      </InfoCard>
    </Box>
  );
}
