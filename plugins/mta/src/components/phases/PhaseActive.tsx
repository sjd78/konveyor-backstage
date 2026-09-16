import { useMemo, useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import LinearProgress from '@material-ui/core/LinearProgress';
import Paper from '@material-ui/core/Paper';
import SvgIcon from '@material-ui/core/SvgIcon';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import LaunchIcon from '@material-ui/icons/Launch';
import DescriptionIcon from '@material-ui/icons/Description';
import {
  InfoCard,
  Table,
  TableColumn,
} from '@backstage/core-components';
import {
  useMtaStore,
  DEFAULT_DEVSPACES_CONFIG,
  DEPLOYMENT_ASSETS,
  DEPLOYMENT_ASSET_PREVIEWS,
} from '../../store/MtaStore';
import { timeAgo, ACTION_TIMEOUT_MS } from '../../utils';
import { useStyles } from '../shared/migrationTabStyles';
import { SeverityChip } from '../shared/SeverityChip';
import { IssueDetailPanel } from '../shared/IssueDetailPanel';
import { ActionHistory } from '../shared/ActionHistory';
import { RemediationRunning } from '../shared/RemediationRunning';
import { DevSpacesLaunchDialog } from '../DevSpacesLaunchDialog';
import { DeploymentAssetDialog } from '../DeploymentAssetDialog';
import type {
  MigrationIssue,
  ActionHistoryEntry,
  ActionType,
  MtaApplication,
  Persona,
} from '../../types';
import type { PrototypeScopeId } from '../../prototype';

export function PhaseActive({
  app,
  issues,
  actions,
  store,
  persona,
  target,
  isPostRemediation,
  scope,
}: {
  app: MtaApplication;
  issues: MigrationIssue[];
  actions: ActionHistoryEntry[];
  store: ReturnType<typeof useMtaStore>;
  persona: Persona;
  target?: { name: string; generatorName?: string };
  isPostRemediation: boolean;
  scope: PrototypeScopeId;
}) {
  const classes = useStyles();
  const theme = useTheme();
  const [runningAction, setRunningAction] = useState<ActionType | null>(null);
  const [remediationRunning, setRemediationRunning] = useState(false);
  const [devSpacesOpen, setDevSpacesOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const issueColumns: TableColumn<MigrationIssue>[] = useMemo(() => {
    const cols: TableColumn<MigrationIssue>[] = [
      {
        title: 'Severity',
        field: 'severity',
        render: row => <SeverityChip severity={row.severity} />,
      },
      {
        title: 'File',
        render: row => (
          <Typography
            variant="body2"
            style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
          >
            {row.file}:{row.line}
          </Typography>
        ),
      },
      { title: 'Category', field: 'category' },
      { title: 'Description', field: 'description' },
    ];
    if (scope === 'enhancements') {
      cols.push({
        title: 'Status',
        render: row => {
          if (row.resolved) {
            return (
              <Chip
                label="Resolved"
                size="small"
                style={{
                  backgroundColor: theme.palette.status?.ok ?? theme.palette.success.main,
                  color: theme.palette.common.white,
                }}
              />
            );
          }
          return <Chip label="Unresolved" size="small" variant="outlined" />;
        },
        width: '110px',
      });
    }
    return cols;
  }, [theme, scope]);

  const displayIssues = useMemo(() => {
    if (!isPostRemediation) return issues;
    return issues.map(i => (i.aiFixAvailable ? { ...i, resolved: true } : i));
  }, [issues, isPostRemediation]);

  const resolvedCount = displayIssues.filter(i => i.resolved).length;
  const unresolvedIssues = displayIssues.filter(i => !i.resolved);
  const unresolvedCount = unresolvedIssues.length;
  const totalIssues = displayIssues.length || 1;
  const progress = Math.round((resolvedCount / totalIssues) * 100);
  const estimatedEffort = unresolvedCount * 2;

  const hasRunRemediation = isPostRemediation;
  const devSpacesActive = app.devSpacesActive === true;
  const startedAgo = app.devSpacesStartedAt
    ? timeAgo(app.devSpacesStartedAt)
    : '15 minutes ago';

  const handleAction = (action: ActionType, triggeredBy: Persona) => {
    if (action === 'trigger-ai-remediator') {
      setRemediationRunning(true);
      return;
    }
    setRunningAction(action);
    store.executeAction(app.id, action, triggeredBy);
    setTimeout(() => setRunningAction(null), ACTION_TIMEOUT_MS);
  };

  const devSpacesTooltip = 'Open a preconfigured cloud workspace with migration tooling ready';

  return (
    <>
      {scope === 'agentic' && remediationRunning && !isPostRemediation && (
        <RemediationRunning />
      )}

      {scope === 'agentic' && hasRunRemediation && (
        <Box mb={2}>
          <div className={classes.infoCallout}>
            <CheckCircleOutlineIcon className={classes.infoIcon} />
            <Typography variant="body2">
              <strong>Auto-remediation complete.</strong>
              {` ${resolvedCount} of ${totalIssues} issues fixed. ${unresolvedCount} remaining ${
                unresolvedCount === 1 ? 'issue requires' : 'issues require'
              } manual fixes${devSpacesActive ? '.' : ' in Dev Spaces.'}`}
            </Typography>
          </div>
        </Box>
      )}

      {scope === 'enhancements' && (
        <Grid container spacing={2} style={{ marginBottom: 16 }}>
          <Grid item xs={12} sm={4} className={classes.gridItemStretch}>
            <Paper variant="outlined" style={{ borderRadius: 8 }}>
              <Box className={classes.gaugeCard}>
                <Box position="relative" width={72} height={72} mb={0.5}>
                  <svg
                    width="72"
                    height="72"
                    viewBox="0 0 72 72"
                    className={classes.gaugeSvg}
                    role="img"
                    aria-label={`${progress}% issues fixed`}
                  >
                    <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="5" opacity={0.2} />
                    <circle
                      cx="36" cy="36" r="30" fill="none"
                      className={classes.success}
                      stroke="currentColor" strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 30}`}
                      strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <Typography className={`${classes.gaugeLabel} ${classes.success}`}>
                    {progress}%
                  </Typography>
                </Box>
                <Typography className={classes.metricLabel}>Issues fixed</Typography>
                <Typography className={classes.metricSub}>{resolvedCount} of {totalIssues}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4} className={classes.gridItemStretch}>
            <Paper variant="outlined" style={{ borderRadius: 8 }}>
              <Box className={classes.gaugeCard}>
                <Typography className={`${classes.metricValue} ${unresolvedCount > 0 ? classes.critical : classes.success}`}>
                  {unresolvedCount}
                </Typography>
                <Typography className={classes.metricLabel}>Issues remaining</Typography>
                {unresolvedIssues.length > 0 && (
                  <Box display="flex" flexWrap="wrap" justifyContent="center" style={{ gap: 4 }} mt={0.5}>
                    {(['critical', 'major', 'minor', 'info'] as const).map(sev => {
                      const count = unresolvedIssues.filter(i => i.severity === sev).length;
                      if (count === 0) return null;
                      return <SeverityChip key={sev} severity={sev} label={`${count} ${sev.charAt(0).toUpperCase() + sev.slice(1)}`} />;
                    })}
                  </Box>
                )}
                {unresolvedIssues.length === 0 && (
                  <Typography className={`${classes.metricSub} ${classes.success}`}>None remaining</Typography>
                )}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={4} className={classes.gridItemStretch}>
            <Paper variant="outlined" style={{ borderRadius: 8 }}>
              <Box className={classes.gaugeCard}>
                <Typography className={classes.metricValue}>~{estimatedEffort}h</Typography>
                <Typography className={classes.metricLabel}>Estimated effort</Typography>
                <Typography className={classes.metricSub}>Based on issue complexity</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Box mb={2}>
        <InfoCard title="Next steps">
          <div className={classes.actionStrip}>
            {scope === 'core' && (
              <>
                <Button variant="outlined" size="small" startIcon={<DescriptionIcon />} onClick={() => setAssetsOpen(true)}>
                  Generate deployment assets
                </Button>
                <Button variant="outlined" size="small" startIcon={<AutorenewIcon />} disabled={runningAction !== null} onClick={() => handleAction('run-analysis', persona)}>
                  Re-run analysis
                </Button>
                <Tooltip title={devSpacesTooltip}>
                  <Button variant="contained" color="primary" size="small" startIcon={<LaunchIcon />} href="#devspaces-placeholder" target="_blank" rel="noopener noreferrer" component="a">
                    Open in Dev Spaces
                  </Button>
                </Tooltip>
              </>
            )}
            {scope === 'agentic' && (
              <Button
                variant="contained" color="primary" size="small"
                startIcon={<SvgIcon viewBox="0 0 24 24" fontSize="small"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor" /></SvgIcon>}
                disabled={runningAction !== null}
                onClick={() => handleAction('trigger-ai-remediator', 'architect')}
              >
                AI remediation
              </Button>
            )}
            {scope === 'experience' && (
              <Button variant="contained" color="primary" size="small" startIcon={<LaunchIcon />} onClick={() => setDevSpacesOpen(true)}>
                {persona === 'architect' ? 'Assign to Dev Spaces' : 'Open in Dev Spaces'}
              </Button>
            )}
            {scope === 'enhancements' && (
              <>
                <Button variant="outlined" size="small" startIcon={<DescriptionIcon />} onClick={() => setAssetsOpen(true)}>
                  Generate deployment assets
                </Button>
                <Button variant="outlined" size="small" startIcon={<AutorenewIcon />} disabled={runningAction !== null} onClick={() => handleAction('run-analysis', persona)}>
                  Re-run analysis
                </Button>
                <Tooltip title={devSpacesTooltip}>
                  <Button variant="contained" color="primary" size="small" startIcon={<LaunchIcon />} href="#devspaces-placeholder" target="_blank" rel="noopener noreferrer" component="a">
                    Open in Dev Spaces
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
          {runningAction && <LinearProgress style={{ marginTop: 8 }} />}
        </InfoCard>
      </Box>

      {scope === 'experience' && hasRunRemediation && devSpacesActive && (
        <Box mb={2}>
          <InfoCard title="Developer status">
            <Box display="flex" alignItems="center" mb={1.5}>
              <span className={classes.devStatusDot} />
              <Typography variant="subtitle2" color="primary" style={{ fontWeight: 600 }}>
                Active in Dev Spaces
              </Typography>
            </Box>
            <div className={classes.configRow}>
              <span className={classes.configKey}>Workspace</span>
              <span>{app.name}-ws</span>
            </div>
            <div className={classes.configRow}>
              <span className={classes.configKey}>Member</span>
              <span>{app.devSpacesUser ?? 'developer'}</span>
            </div>
            <div className={classes.configRow}>
              <span className={classes.configKey}>Started</span>
              <span>{startedAgo}</span>
            </div>
            <Box mt={2}>
              <div className={classes.infoCallout}>
                <Typography variant="caption" color="textSecondary">
                  {persona === 'developer'
                    ? 'When finished, return to Developer Hub and re-run analysis to update metrics.'
                    : 'Developer is working on manual fixes. Metrics update after re-analysis.'}
                </Typography>
              </div>
            </Box>
          </InfoCard>
        </Box>
      )}

      {displayIssues.length > 0 && (
        <Box mb={2}>
          <Table
            title={`Migration issues (${
              hasRunRemediation
                ? `${unresolvedCount} remaining of ${displayIssues.length}`
                : `${displayIssues.length}`
            })`}
            columns={issueColumns}
            data={displayIssues}
            options={{
              paging: displayIssues.length > 10,
              pageSize: Math.min(displayIssues.length || 1, 10),
              search: true,
              filtering: true,
            }}
            detailPanel={({ rowData }) => (
              <IssueDetailPanel rowData={rowData} />
            )}
          />
        </Box>
      )}

      {scope === 'enhancements' && (
        <ActionHistory actions={actions} defaultExpanded={hasRunRemediation} />
      )}

      <DevSpacesLaunchDialog
        open={devSpacesOpen}
        onClose={() => setDevSpacesOpen(false)}
        onLaunch={() => handleAction('launch-workspace', persona)}
        appName={app.name}
        repoUrl={app.repoUrl}
        config={DEFAULT_DEVSPACES_CONFIG}
        available={app.devSpacesAvailable !== false}
      />
      <DeploymentAssetDialog
        open={assetsOpen}
        onClose={() => setAssetsOpen(false)}
        onGenerate={() => store.executeAction(app.id, 'generate-deployment-assets', persona)}
        appName={app.name}
        assets={DEPLOYMENT_ASSETS}
        previews={DEPLOYMENT_ASSET_PREVIEWS}
        generatorName={target?.generatorName}
      />
    </>
  );
}
