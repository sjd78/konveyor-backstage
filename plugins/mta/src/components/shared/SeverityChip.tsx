import Chip from '@material-ui/core/Chip';
import { useTheme } from '@material-ui/core/styles';
import { severityColor } from '../../utils';
import type { MigrationIssue } from '../../types';

export function SeverityChip({
  severity,
  label,
}: {
  severity: MigrationIssue['severity'];
  label?: string;
}) {
  const theme = useTheme();
  const bg = severityColor(severity, theme.palette);
  return (
    <Chip
      label={label ?? severity.charAt(0).toUpperCase() + severity.slice(1)}
      size="small"
      style={{
        backgroundColor: bg,
        color:
          severity === 'minor' || severity === 'info'
            ? theme.palette.text.primary
            : theme.palette.common.white,
      }}
    />
  );
}
