import { makeStyles, alpha } from '@material-ui/core/styles';

export const useStyles = makeStyles(theme => ({
  gridItemStretch: {
    display: 'flex',
    '& > *': {
      width: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    '& .MuiCardContent-root.MuiCardContent-root': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column' as const,
    },
  },
  metricValue: {
    fontSize: '1.75rem',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  metricLabel: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  },
  metricSub: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  critical: {
    color: theme.palette.error.main,
  },
  success: {
    color: theme.palette.status?.ok ?? theme.palette.success.main,
  },
  gaugeCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    padding: theme.spacing(2),
    flex: 1,
  },
  gaugeSvg: {
    transform: 'rotate(-90deg)',
    display: 'block',
  },
  gaugeLabel: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  actionStrip: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: theme.spacing(1),
  },
  configRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: '0.875rem',
    '&:last-child': { borderBottom: 'none' },
  },
  configKey: {
    color: theme.palette.text.secondary,
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    fontSize: '0.875rem',
  },
  checkIcon: {
    color: theme.palette.status?.ok ?? theme.palette.success.main,
    fontSize: 18,
  },
  stepList: {
    listStyle: 'none',
    margin: theme.spacing(2, 0, 0, 0),
    padding: 0,
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 0),
    fontSize: '0.875rem',
  },
  stepDone: {
    color: theme.palette.status?.ok ?? theme.palette.success.main,
  },
  stepRunning: {
    color: theme.palette.primary.main,
    animation: '$spin 1.2s linear infinite',
  },
  stepPending: {
    color: theme.palette.text.disabled,
  },
  '@keyframes spin': {
    to: { transform: 'rotate(360deg)' },
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': { borderBottom: 'none' },
  },
  detailSection: {
    marginBottom: theme.spacing(1.5),
    '&:last-child': { marginBottom: 0 },
  },
  detailLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: theme.spacing(0.5),
  },
  devStatusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: theme.palette.primary.main,
    animation: '$pulse 1.5s infinite',
    display: 'inline-block',
    marginRight: theme.spacing(1),
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.4 },
  },
  infoCallout: {
    display: 'flex',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    backgroundColor: alpha(
      theme.palette.info.main,
      theme.palette.type === 'dark' ? 0.12 : 0.08,
    ),
    borderLeft: `3px solid ${theme.palette.info.main}`,
    borderRadius: 4,
    alignItems: 'flex-start',
  },
  infoIcon: {
    color: theme.palette.info.main,
    fontSize: '1.25rem',
    marginTop: 2,
    flexShrink: 0,
  },
}));
