import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { InfoCard } from '@backstage/core-components';
import { useMtaStore } from '../../store/MtaStore';
import { useStyles } from '../shared/migrationTabStyles';

export function PhaseDiscovery({
  repoUrl,
}: {
  repoUrl: string;
  store: ReturnType<typeof useMtaStore>;
  entityRef: string;
}) {
  const classes = useStyles();

  return (
    <Box mb={2}>
      <InfoCard title="Scanning repository" subheader="About 30 seconds">
        <Box display="flex" alignItems="center" mb={2} style={{ gap: 12 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">
            Identifying technologies in source code
          </Typography>
        </Box>
        <LinearProgress style={{ marginBottom: 16 }} />
        {repoUrl && (
          <div className={classes.configRow}>
            <span className={classes.configKey}>Repository</span>
            <Typography variant="body2" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {repoUrl.replace(/^https?:\/\//, '')}
            </Typography>
          </div>
        )}
        <Box mt={2} p={1.5} borderRadius={4} bgcolor="action.hover" border={1} borderColor="divider">
          <Typography
            variant="caption"
            color="textSecondary"
            style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}
            gutterBottom
          >
            What happens next
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Results will show detected technologies, matched application type, and available migration paths.
          </Typography>
        </Box>
      </InfoCard>
    </Box>
  );
}
