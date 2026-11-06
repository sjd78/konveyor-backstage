import { render, screen } from '@testing-library/react';
import { MigrationStatusChip } from './MigrationStatusChip';
import type { MigrationStatus } from '../types';

/*
 * Jest maps CSS module classes to their own names, so the tone class is the
 * only observable evidence of the tone in jsdom.
 */
const TONE: Record<MigrationStatus, string> = {
  'Not Started': 'toneNeutral',
  Discovery: 'toneInfo',
  'Path Selection': 'toneInfo',
  Analysis: 'toneInfo',
  'Analysis Unavailable': 'toneDanger',
  Active: 'toneSuccess',
  Failed: 'toneDanger',
};

describe('MigrationStatusChip', () => {
  it.each(Object.entries(TONE) as [MigrationStatus, string][])(
    'shows %s as static text in its tone',
    (status, tone) => {
      render(<MigrationStatusChip status={status} />);
      const label = screen.getByText(status);
      expect(label).toHaveClass('tag', tone);
    },
  );

  it('is not a control, so keyboard focus never lands on it', () => {
    render(<MigrationStatusChip status="Active" />);
    const label = screen.getByText('Active');
    expect(label.tagName).toBe('SPAN');
    expect(label).not.toHaveAttribute('role');
    expect(label).not.toHaveAttribute('tabindex');
  });
});
