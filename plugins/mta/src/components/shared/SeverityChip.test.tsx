import { render, screen } from '@testing-library/react';
import { SeverityChip } from './SeverityChip';
import type { MigrationIssue } from '../../types';

/*
 * Jest maps CSS module classes to their own names, so the tone class is the
 * only observable evidence of the tone in jsdom.
 */
const TONE: Record<MigrationIssue['severity'], string> = {
  critical: 'toneDanger',
  major: 'toneWarningEmphasis',
  minor: 'toneWarning',
  info: 'toneInfo',
};

describe('SeverityChip', () => {
  it.each(Object.entries(TONE) as [MigrationIssue['severity'], string][])(
    'capitalizes %s and shows it in its tone',
    (severity, tone) => {
      render(<SeverityChip severity={severity} />);
      const label = screen.getByText(
        severity.charAt(0).toUpperCase() + severity.slice(1),
      );
      expect(label).toHaveClass('tag', tone);
    },
  );

  it('shows the given label instead of the severity', () => {
    render(<SeverityChip severity="critical" label="Must fix" />);
    expect(screen.getByText('Must fix')).toHaveClass('tag', 'toneDanger');
    expect(screen.queryByText('Critical')).not.toBeInTheDocument();
  });
});
