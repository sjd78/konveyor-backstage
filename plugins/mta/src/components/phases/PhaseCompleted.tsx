import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import LaunchIcon from '@material-ui/icons/Launch';
import { InfoCard } from '@backstage/core-components';
import { DEPLOYMENT_ASSETS } from '../../store/MtaStore';
import { useStyles } from '../shared/migrationTabStyles';
import { ActionHistory } from '../shared/ActionHistory';
import type { MtaApplication, ActionHistoryEntry, MigrationIssue } from '../../types';

export function PhaseCompleted({
  actions,
  issues,
}: {
  app: MtaApplication;
  actions: ActionHistoryEntry[];
  issues: MigrationIssue[];
}) {
  const classes = useStyles();
  const completedIssues = issues.map(i => ({ ...i, resolved: true }));
  const autoFixed = completedIssues.filter(i => i.aiFixAvailable).length;
  const manualFixed = completedIssues.filter(i => !i.aiFixAvailable).length;
  const totalFixed = completedIssues.length;
  return (
    <>
      <Box mb={2}>
        <InfoCard>
          <Box display="flex" alignItems="center" style={{ gap: 16 }} mb={2}>
            <CheckCircleIcon className={classes.success} style={{ fontSize: 32 }} />
            <Box flex={1}>
              <Typography variant="h6" style={{ fontWeight: 600 }}>
                Migration complete
              </Typography>
              <Typography variant="body2" color="textSecondary">
                All issues resolved. Deployment assets generated and delivered.
              </Typography>
            </Box>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box textAlign="center">
                <Typography className={`${classes.metricValue} ${classes.success}`}>{totalFixed}</Typography>
                <Typography variant="caption" className={classes.metricLabel}>Fixed</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box textAlign="center">
                <Typography className={classes.metricValue}>{autoFixed}</Typography>
                <Typography variant="caption" className={classes.metricLabel}>Auto-fixed</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box textAlign="center">
                <Typography className={classes.metricValue}>{manualFixed}</Typography>
                <Typography variant="caption" className={classes.metricLabel}>Manual</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box textAlign="center">
                <Typography className={classes.metricValue}>{DEPLOYMENT_ASSETS.length}</Typography>
                <Typography variant="caption" className={classes.metricLabel}>Assets</Typography>
              </Box>
            </Grid>
          </Grid>
        </InfoCard>
      </Box>

      <Box mb={2}>
        <InfoCard title="Deployment assets">
          {DEPLOYMENT_ASSETS.map(asset => (
            <div key={asset.name} className={classes.configRow}>
              <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                {asset.path}{asset.name}
              </Typography>
              <Chip label={asset.type} size="small" variant="outlined" />
            </div>
          ))}
          <Box mt={2}>
            <Button variant="outlined" size="small" startIcon={<LaunchIcon />}>
              View in repository
            </Button>
          </Box>
        </InfoCard>
      </Box>

      <ActionHistory actions={actions} defaultExpanded />
    </>
  );
}
