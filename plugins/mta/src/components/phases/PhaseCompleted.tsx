import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import { InfoCard } from '@backstage/core-components';
import { DEPLOYMENT_ASSETS } from '../../store/MtaStore';
import { useStyles } from '../shared/migrationTabStyles';
import { ActionHistory } from '../shared/ActionHistory';
import type {
  MtaApplication,
  ActionHistoryEntry,
  MigrationIssue,
} from '../../types';

export function PhaseCompleted({
  app,
  actions,
  issues,
}: {
  app: MtaApplication;
  actions: ActionHistoryEntry[];
  issues: MigrationIssue[];
}) {
  const classes = useStyles();
  const completedIssues = issues.filter(i => i.resolved);
  const autoFixed = completedIssues.filter(i => i.aiFixAvailable).length;
  const manualFixed = completedIssues.length - autoFixed;
  const totalFixed = issues.length
    ? completedIssues.length
    : app.totalIssuesDiscovered;
  const hasAssets = actions.some(
    action =>
      action.action === 'generate-deployment-assets' &&
      action.status === 'completed',
  );

  return (
    <>
      <Box mb={2}>
        <InfoCard>
          <Box display="flex" alignItems="center" style={{ gap: 16 }} mb={2}>
            <CheckCircleIcon
              className={classes.success}
              style={{ fontSize: 32 }}
            />
            <Box flex={1}>
              <Typography variant="h6" style={{ fontWeight: 600 }}>
                Migration complete
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All tracked migration issues are resolved.
              </Typography>
            </Box>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={issues.length ? 3 : 6}>
              <Box textAlign="center">
                <Typography
                  className={`${classes.metricValue} ${classes.success}`}
                >
                  {totalFixed}
                </Typography>
                <Typography variant="caption" className={classes.metricLabel}>
                  Fixed
                </Typography>
              </Box>
            </Grid>
            {issues.length > 0 && (
              <>
                <Grid item xs={3}>
                  <Box textAlign="center">
                    <Typography className={classes.metricValue}>
                      {autoFixed}
                    </Typography>
                    <Typography
                      variant="caption"
                      className={classes.metricLabel}
                    >
                      Auto-fixed
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={3}>
                  <Box textAlign="center">
                    <Typography className={classes.metricValue}>
                      {manualFixed}
                    </Typography>
                    <Typography
                      variant="caption"
                      className={classes.metricLabel}
                    >
                      Manual
                    </Typography>
                  </Box>
                </Grid>
              </>
            )}
            {hasAssets && (
              <Grid item xs={issues.length ? 3 : 6}>
                <Box textAlign="center">
                  <Typography className={classes.metricValue}>
                    {DEPLOYMENT_ASSETS.length}
                  </Typography>
                  <Typography variant="caption" className={classes.metricLabel}>
                    Assets
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </InfoCard>
      </Box>

      {hasAssets && (
        <Box mb={2}>
          <InfoCard title="Deployment assets">
            {DEPLOYMENT_ASSETS.map(asset => (
              <div key={asset.name} className={classes.configRow}>
                <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                  {asset.path}
                  {asset.name}
                </Typography>
                <Chip label={asset.type} size="small" variant="outlined" />
              </div>
            ))}
          </InfoCard>
        </Box>
      )}

      <ActionHistory actions={actions} defaultExpanded />
    </>
  );
}
