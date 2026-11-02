import Box from '@material-ui/core/Box';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import { useStyles } from './migrationTabStyles';
import type { MigrationIssue } from '../../types';

export function IssueDetailPanel({ rowData }: { rowData: MigrationIssue }) {
  const classes = useStyles();
  const links =
    rowData.links?.filter(link => /^https?:\/\//i.test(link.url)) ?? [];
  return (
    <Box pl={4} pr={2} py={2} bgcolor="action.hover">
      {rowData.problem && (
        <div className={classes.detailSection}>
          <Typography className={classes.detailLabel}>
            Rule description
          </Typography>
          <Typography variant="body2">{rowData.problem}</Typography>
        </div>
      )}
      {rowData.message && (
        <div className={classes.detailSection}>
          <Typography className={classes.detailLabel}>Incident</Typography>
          <Typography variant="body2">{rowData.message}</Typography>
        </div>
      )}
      {rowData.codeSnip && (
        <Box component="pre" overflow="auto" style={{ whiteSpace: 'pre-wrap' }}>
          <code>{rowData.codeSnip}</code>
        </Box>
      )}
      {rowData.effort !== undefined && (
        <Typography variant="body2">Rule effort: {rowData.effort}</Typography>
      )}
      {links.length > 0 && (
        <Box component="ul">
          {links.map(link => (
            <li key={link.url}>
              <Link href={link.url} target="_blank" rel="noopener noreferrer">
                {link.title || link.url}
              </Link>
            </li>
          ))}
        </Box>
      )}
      {!rowData.problem &&
        !rowData.message &&
        !rowData.codeSnip &&
        rowData.effort === undefined &&
        links.length === 0 && (
          <Typography variant="body2" color="textSecondary">
            No additional details were reported by Hub.
          </Typography>
        )}
    </Box>
  );
}
