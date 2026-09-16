import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { alpha, useTheme } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import { InfoCard } from '@backstage/core-components';
import { useStyles } from '../shared/migrationTabStyles';

export function PhaseAnalyzing({
  target,
  archetype,
}: {
  target?: { name: string };
  archetype?: { name: string };
}) {
  const classes = useStyles();
  const theme = useTheme();
  const successColor = theme.palette.status?.ok ?? theme.palette.success.main;
  const isDark = theme.palette.type === 'dark';
  return (
    <Box mb={2}>
      <InfoCard
        title="Running analysis"
        subheader="About 2 to 5 minutes"
      >
        <Box display="flex" alignItems="center" mb={2} style={{ gap: 12 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            Checking source code against target platform
          </Typography>
        </Box>
        <LinearProgress style={{ marginBottom: 16 }} />
        {target && (
          <div className={classes.configRow}>
            <span className={classes.configKey}>Migration path</span>
            <span>{target.name}</span>
          </div>
        )}
        {archetype && (
          <div className={classes.configRow}>
            <span className={classes.configKey}>Application type</span>
            <span>{archetype.name}</span>
          </div>
        )}
        <Box
          mt={2}
          p={1.5}
          borderRadius={4}
          bgcolor="action.hover"
          border={1}
          borderColor="divider"
        >
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}
            gutterBottom
          >
            What happens next
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Results will show compatibility issues with severity, file locations, and fix guidance.
          </Typography>
        </Box>
        <Box
          mt={2}
          display="flex"
          alignItems="center"
          p={1.5}
          borderRadius={4}
          style={{
            gap: 8,
            backgroundColor: alpha(successColor, isDark ? 0.12 : 0.06),
            border: `1px solid ${alpha(successColor, isDark ? 0.25 : 0.15)}`,
          }}
        >
          <CheckCircleOutlineIcon style={{ fontSize: 16, color: successColor }} />
          <Typography variant="body2" color="textSecondary" style={{ fontSize: '0.8rem' }}>
            You can leave this page. Results will appear here when ready.
          </Typography>
        </Box>
      </InfoCard>
    </Box>
  );
}
