import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { InfoCard, WarningPanel } from '@backstage/core-components';
import type { KonveyorTask } from '../../api/types';

export interface PhaseFailedProps {
  task: KonveyorTask | null;
  error?: Error | null;
  canRetry?: boolean;
  isExecuting?: boolean;
  onRetry: () => void;
  onSelectProfile?: () => void;
}

export function PhaseFailed({
  task,
  error,
  canRetry = true,
  isExecuting = false,
  onRetry,
  onSelectProfile,
}: PhaseFailedProps) {
  const details =
    task?.errors?.map(item => item.description).filter(Boolean) ?? [];
  return (
    <>
      <Box mb={2}>
        <WarningPanel
          severity="error"
          title={`Hub task ${
            task?.state === 'Canceled' ? 'canceled' : 'failed'
          }`}
          message={
            error?.message ||
            details.join('\n') ||
            'Hub did not provide failure details. Check the task in Hub, correct its configuration, then retry.'
          }
        />
      </Box>
      <InfoCard title="Task details">
        <Typography variant="body2">
          Task ID: {task?.id ?? 'Unavailable'}
        </Typography>
        <Typography variant="body2">
          Addon: {task?.addon ?? 'Unavailable'}
        </Typography>
        <Typography variant="body2">
          Status: {task?.state ?? 'Unavailable'}
        </Typography>
      </InfoCard>
      <Box mt={2} display="flex" style={{ gap: 8 }}>
        {canRetry && (
          <Button
            variant="contained"
            color="primary"
            disabled={isExecuting}
            onClick={onRetry}
          >
            Retry task
          </Button>
        )}
        {onSelectProfile && (
          <Button disabled={isExecuting} onClick={onSelectProfile}>
            Select analysis profile
          </Button>
        )}
      </Box>
    </>
  );
}
