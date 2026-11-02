import { fireEvent, render, screen } from '@testing-library/react';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { PhaseActive } from './PhaseActive';
import type { Persona } from '../../types';

function renderFindings(
  persona: Persona | 'unknown',
  onRunAnalysis = jest.fn(),
) {
  render(
    <UnifiedThemeProvider theme={themes.light}>
      <PhaseActive
        app={{ id: 1, name: 'Live application' }}
        issues={[]}
        persona={persona}
        onRunAnalysis={onRunAnalysis}
      />
    </UnifiedThemeProvider>,
  );
  return onRunAnalysis;
}

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
});
