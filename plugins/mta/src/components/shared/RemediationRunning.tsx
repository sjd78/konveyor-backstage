import Box from '@material-ui/core/Box';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import SyncIcon from '@material-ui/icons/Sync';
import { InfoCard } from '@backstage/core-components';
import { useStyles } from './migrationTabStyles';

export function RemediationRunning() {
  const classes = useStyles();
  return (
    <Box mb={2}>
      <InfoCard title="AI remediation in progress">
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Applying automated fixes to migration issues. This typically takes 15 to 30 minutes. You can navigate away and check back later.
        </Typography>
        <LinearProgress />
        <ul className={classes.stepList}>
          <li className={classes.stepItem}>
            <CheckCircleOutlineIcon
              fontSize="small"
              className={classes.stepDone}
            />
            Identifying fixable issues
          </li>
          <li className={classes.stepItem}>
            <SyncIcon fontSize="small" className={classes.stepRunning} />
            Generating code patches
          </li>
          <li className={classes.stepItem}>
            <RadioButtonUncheckedIcon
              fontSize="small"
              className={classes.stepPending}
            />
            Applying changes
          </li>
          <li className={classes.stepItem}>
            <RadioButtonUncheckedIcon
              fontSize="small"
              className={classes.stepPending}
            />
            Verifying fixes
          </li>
        </ul>
      </InfoCard>
    </Box>
  );
}
