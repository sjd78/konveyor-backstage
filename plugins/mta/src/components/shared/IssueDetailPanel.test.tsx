import { render, screen } from '@testing-library/react';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { IssueDetailPanel } from './IssueDetailPanel';

describe('Hub incident evidence', () => {
  it('shows the actual incident message, code snippet, and linked migration guidance', () => {
    render(
      <UnifiedThemeProvider theme={themes.light}>
        <IssueDetailPanel
          rowData={{
            id: 'issue-11-21',
            appId: '1',
            severity: 'critical',
            category: 'api-change',
            description: 'Legacy API',
            problem: 'Removed API',
            message: 'Call found in Legacy.java',
            codeSnip: '<legacy>call();</legacy>',
            effort: 3,
            links: [
              {
                title: 'Hub migration guide',
                url: 'https://example.org/guide',
              },
            ],
          }}
        />
      </UnifiedThemeProvider>,
    );
    expect(screen.getByText('Call found in Legacy.java')).toBeInTheDocument();
    expect(screen.getByText('<legacy>call();</legacy>')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Hub migration guide' }),
    ).toHaveAttribute('href', 'https://example.org/guide');
  });
});
