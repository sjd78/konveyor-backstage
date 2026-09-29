import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { InfoCard, WarningPanel } from '@backstage/core-components';
import { ACTION_TIMEOUT_MS } from '../../utils';
import { useMtaStore } from '../../store/MtaStore';
import { SUPPORT_CONTACT } from '../../store/mockData';
import type { KonveyorApplication } from '../../api/types';
import type { MtaApplication } from '../../types';

const TITLE_BY_ERROR_TYPE: Record<string, string> = {
  'no-archetype-match': 'No matching application type',
  'repo-access-denied': 'Repository access denied',
};

export interface PhaseFailedProps {
  app?: KonveyorApplication | MtaApplication;
  store?: ReturnType<typeof useMtaStore>;
  error?: Error | null;
  errorType?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

export function PhaseFailed({
  app,
  store,
  error,
  errorType = '',
  errorMessage,
  onRetry,
}: PhaseFailedProps) {
  const title = TITLE_BY_ERROR_TYPE[errorType] ?? 'Analysis failed';

  const message =
    error?.message ||
    errorMessage ||
    'The analysis engine encountered an error. Try again or contact your administrator.';

  return (
    <>
      <Box mb={2}>
        <WarningPanel severity="error" title={title} message={message} />
      </Box>
      {!errorType && (
        <InfoCard title="Error details">
          <Box
            p={2}
            bgcolor="action.hover"
            borderRadius={4}
            fontFamily="monospace"
            fontSize="0.8rem"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            <Typography
              variant="caption"
              color="textSecondary"
              style={{ display: 'block', marginBottom: 8 }}
            >
              Exit code 1 — Analyzer process terminated unexpectedly
            </Typography>
            <Typography
              variant="body2"
              component="div"
              style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
            >
              [ERROR] Failed to execute goal
              org.konveyor:analyzer-maven-plugin:analyze
              <br />
              [ERROR] Failed to parse AST for source tree
              <br />
              [ERROR] {message}
              <br />
              <Box component="span" color="warning.main">
                Caused by: OutOfMemoryError: heap space exhausted
              </Box>
            </Typography>
          </Box>
        </InfoCard>
      )}
      <Box mt={2} display="flex" alignItems="center" style={{ gap: 8 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (onRetry) {
              onRetry();
            } else if (store && app) {
              store.updateApplication(String(app.id), { status: 'Analysis' });
              setTimeout(
                () =>
                  store.executeAction(String(app.id), 'run-analysis', 'architect'),
                ACTION_TIMEOUT_MS,
              );
            }
          }}
        >
          Re-run analysis
        </Button>
        <Typography variant="body2" color="textSecondary">
          If the problem continues, contact{' '}
          <strong>{SUPPORT_CONTACT.name}</strong> ({SUPPORT_CONTACT.email}).
        </Typography>
      </Box>
    </>
  );
}
