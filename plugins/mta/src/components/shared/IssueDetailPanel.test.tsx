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
    expect(
      screen.getByRole('link', { name: 'Hub migration guide' }),
    ).toHaveAttribute('target', '_blank');
    expect(
      screen.getByRole('link', { name: 'Hub migration guide' }),
    ).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links only the http and https guidance Hub reported', () => {
    render(
      <IssueDetailPanel
        rowData={{
          id: 'issue-1',
          appId: '1',
          severity: 'info',
          category: 'dependency',
          description: 'Legacy API',
          problem: 'Removed API',
          links: [
            { title: 'Secure guide', url: 'https://example.org/guide' },
            { title: 'Plain guide', url: 'http://example.org/plain' },
            { title: 'File link', url: 'ftp://example.org/bundle.zip' },
            { title: 'Mail link', url: 'mailto:owner@example.org' },
          ],
        }}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Secure guide' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Plain guide' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'File link' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Mail link' }),
    ).not.toBeInTheDocument();
  });

  it('says so when Hub reported no additional details', () => {
    render(
      <IssueDetailPanel
        rowData={{
          id: 'issue-1',
          appId: '1',
          severity: 'minor',
          category: 'configuration',
          description: 'Legacy API',
          links: [{ title: 'File link', url: 'ftp://example.org/bundle.zip' }],
        }}
      />,
    );
    expect(
      screen.getByText('No additional details were reported by Hub.'),
    ).toBeInTheDocument();
  });
});
