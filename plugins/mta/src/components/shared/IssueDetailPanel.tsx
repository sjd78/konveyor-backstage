import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { useStyles } from './migrationTabStyles';
import type { MigrationIssue } from '../../types';

export function IssueDetailPanel({ rowData }: { rowData: MigrationIssue }) {
  const classes = useStyles();
  return (
    <Box pl={4} pr={2} py={2} bgcolor="action.hover">
      {rowData.problem && (
        <div className={classes.detailSection}>
          <Typography className={classes.detailLabel}>Problem</Typography>
          <Typography variant="body2">{rowData.problem}</Typography>
        </div>
      )}
      {rowData.impact && (
        <div className={classes.detailSection}>
          <Typography className={classes.detailLabel}>
            Why it matters
          </Typography>
          <Typography variant="body2">{rowData.impact}</Typography>
        </div>
      )}
      {rowData.fixGuidance && (
        <div className={classes.detailSection}>
          <Typography className={classes.detailLabel}>How to fix</Typography>
          <Typography variant="body2">{rowData.fixGuidance}</Typography>
        </div>
      )}
      {!rowData.problem && !rowData.impact && !rowData.fixGuidance && (
        <Typography variant="body2" color="textSecondary">
          No additional details available.
        </Typography>
      )}
    </Box>
  );
}
