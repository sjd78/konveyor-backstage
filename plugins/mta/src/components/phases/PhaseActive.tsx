import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import { InfoCard, Table, TableColumn } from '@backstage/core-components';
import { SeverityChip } from '../shared/SeverityChip';
import { IssueDetailPanel } from '../shared/IssueDetailPanel';
import type { KonveyorApplication } from '../../api/types';
import type { MigrationIssue, Persona } from '../../types';

export interface PhaseActiveProps {
  app: KonveyorApplication;
  issues: MigrationIssue[];
  persona: Persona | 'unknown';
  onRunAnalysis?: () => void;
}

const issueColumns: TableColumn<MigrationIssue>[] = [
  {
    title: 'Severity',
    field: 'severity',
    render: row => <SeverityChip severity={row.severity} />,
  },
  {
    title: 'Location',
    render: row => (
      <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
        {row.file
          ? `${row.file}${row.line !== undefined ? `:${row.line}` : ''}`
          : 'No source location reported'}
      </Typography>
    ),
  },
  { title: 'Category', field: 'category' },
  { title: 'Finding', field: 'description' },
];

export function PhaseActive({
  app,
  issues,
  persona,
  onRunAnalysis,
}: PhaseActiveProps) {
  return (
    <>
      <Box
        mb={2}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="h6">Analysis findings for {app.name}</Typography>
        {persona === 'architect' && onRunAnalysis && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutorenewIcon />}
            onClick={onRunAnalysis}
          >
            Run analysis
          </Button>
        )}
      </Box>
      {issues.length === 0 ? (
        <InfoCard title="No findings reported">
          <Typography variant="body2">
            The latest Hub analysis reported no findings. This does not mark the
            migration complete.
          </Typography>
        </InfoCard>
      ) : (
        <Table
          title={`${issues.length} analysis finding${
            issues.length === 1 ? '' : 's'
          }`}
          columns={issueColumns}
          data={issues}
          options={{ paging: issues.length > 10, pageSize: 10, search: true }}
          detailPanel={({ rowData }) => <IssueDetailPanel rowData={rowData} />}
        />
      )}
    </>
  );
}
