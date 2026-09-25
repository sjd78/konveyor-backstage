import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import { InfoCard, WarningPanel } from '@backstage/core-components';
import { ACTION_TIMEOUT_MS } from '../../utils';
import { useMtaStore } from '../../store/MtaStore';
import { SUPPORT_CONTACT } from '../../store/mockData';
import type { MtaApplication } from '../../types';

export function PhaseFailed({
  app,
  store,
  errorType,
  errorMessage,
}: {
  app: MtaApplication;
  store: ReturnType<typeof useMtaStore>;
  errorType: string;
  errorMessage: string;
}) {
  const title =
    errorType === 'no-archetype-match'
      ? 'No matching application type'
      : errorType === 'repo-access-denied'
      ? 'Repository access denied'
      : 'Analysis failed';

  const message =
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
            borderRadius={4}
            bgcolor="background.paper"
            border={1}
            borderColor="divider"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              lineHeight: 1.6,
            }}
          >
            <Typography
              variant="body2"
              color="error"
              style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
            >
              ERROR: Analysis engine failed at step 3/4
            </Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              style={{ fontFamily: 'inherit', fontSize: 'inherit' }}
            >
              {'  '}at RuleEngine.analyze(rules.java:142)
            </Typography>
            <Typography
              variant="body2"
              style={{
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
              }}
            >
              <Box component="span" color="warning.main">
                Caused by: OutOfMemoryError: heap space exhausted
              </Box>
            </Typography>
          </Box>
        </InfoCard>
      )}
      <Box mt={2} display="flex" alignItems="center" style={{ gap: 8 }}>
        {!errorType && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              store.updateApplication(app.id, { status: 'Analysis' });
              setTimeout(
                () => store.executeAction(app.id, 'run-analysis', 'architect'),
                ACTION_TIMEOUT_MS,
              );
            }}
          >
            Re-run analysis
          </Button>
        )}
        <Typography variant="body2" color="textSecondary">
          If the problem continues, contact{' '}
          <strong>{SUPPORT_CONTACT.name}</strong> ({SUPPORT_CONTACT.email}).
        </Typography>
      </Box>
    </>
  );
}
