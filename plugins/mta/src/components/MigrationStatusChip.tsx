import { StatusTag, type StatusTone } from './shared/MtaUi';
import type { MigrationStatus } from '../types';

const STATUS_TONE: Record<MigrationStatus, StatusTone> = {
  'Not Started': 'neutral',
  Discovery: 'info',
  'Path Selection': 'info',
  Analysis: 'info',
  'Analysis Unavailable': 'danger',
  Active: 'success',
  Failed: 'danger',
};

export function MigrationStatusChip({ status }: { status: MigrationStatus }) {
  return <StatusTag tone={STATUS_TONE[status]}>{status}</StatusTag>;
}
