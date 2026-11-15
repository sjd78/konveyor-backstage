import { fireEvent, render, screen } from '@testing-library/react';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { MemoryRouter } from 'react-router-dom';
import { PhaseActive } from './PhaseActive';
import type { MigrationIssue, Persona } from '../../types';

function renderFindings(
  persona: Persona | 'unknown',
  onRunAnalysis = jest.fn(),
  issues: MigrationIssue[] = [],
) {
  render(
    <MemoryRouter>
      <UnifiedThemeProvider theme={themes.light}>
        <PhaseActive
          app={{ id: 1, name: 'Live application' }}
          issues={issues}
          persona={persona}
          onRunAnalysis={onRunAnalysis}
        />
      </UnifiedThemeProvider>
    </MemoryRouter>,
  );
  return onRunAnalysis;
}

const finding: MigrationIssue = {
  id: 'issue-1',
  appId: '1',
  severity: 'critical',
  category: 'api-change',
  description: 'Legacy API',
  file: 'src/Legacy.java',
  line: 12,
};

describe('live findings actions', () => {
  it('runs the supplied analysis action for architects', () => {
    const onRunAnalysis = renderFindings('architect');
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(onRunAnalysis).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', {
        name: /remediat|Dev Spaces|deployment|complete/i,
      }),
    ).not.toBeInTheDocument();
  });

  it.each(['unknown', 'developer'] as const)(
    'does not expose analysis actions for %s',
    persona => {
      renderFindings(persona);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );

  it('does not offer a completion action for a successful empty analysis', () => {
    renderFindings('architect');
    expect(screen.getByText('No findings reported')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /complete/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the findings table beside the analysis action', () => {
    renderFindings('architect', jest.fn(), [finding]);
    expect(
      screen.getByRole('heading', {
        name: 'Analysis findings for Live application',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '1 analysis finding' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run analysis' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No findings reported')).not.toBeInTheDocument();
  });
});
