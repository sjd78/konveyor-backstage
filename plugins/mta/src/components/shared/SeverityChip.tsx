import { StatusTag, type StatusTone } from './MtaUi';
import type { MigrationIssue } from '../../types';

const SEVERITY_TONE: Record<MigrationIssue['severity'], StatusTone> = {
  critical: 'danger',
  major: 'warning-emphasis',
  minor: 'warning',
  info: 'info',
};

export function SeverityChip({
  severity,
  label,
}: {
  severity: MigrationIssue['severity'];
  label?: string;
}) {
  return (
    <StatusTag tone={SEVERITY_TONE[severity]}>
      {label ?? severity.charAt(0).toUpperCase() + severity.slice(1)}
    </StatusTag>
  );
}
