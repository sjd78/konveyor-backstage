import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useStyles } from './migrationTabStyles';
import { ACTION_LABELS, timeAgo } from '../../utils';
import type { ActionHistoryEntry } from '../../types';

export function ActionHistory({
  actions,
  defaultExpanded,
}: {
  actions: ActionHistoryEntry[];
  defaultExpanded?: boolean;
}) {
  const classes = useStyles();
  if (actions.length === 0) return null;
  return (
    <Box mb={2}>
      <Accordion
        defaultExpanded={defaultExpanded}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
            Action history ({actions.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails style={{ display: 'block' }}>
          {actions.map((entry: ActionHistoryEntry) => (
            <div key={entry.id} className={classes.historyItem}>
              <Box>
                <Typography variant="body2">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {timeAgo(entry.timestamp)} &middot; {entry.triggeredBy}
                </Typography>
              </Box>
              <Chip
                label={entry.status}
                size="small"
                color={entry.status === 'completed' ? 'primary' : 'default'}
                variant="outlined"
              />
            </div>
          ))}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
