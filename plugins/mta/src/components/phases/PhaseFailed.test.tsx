import { render, screen } from '@testing-library/react';
import { configApiRef } from '@backstage/core-plugin-api';
import { mockApis, TestApiProvider } from '@backstage/frontend-test-utils';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { PhaseFailed } from './PhaseFailed';
import type { KonveyorTask } from '../../api/types';

const task: KonveyorTask = {
  id: 7,
  name: 'application-1-analyzer',
  addon: 'analyzer',
  state: 'Failed',
  application: { id: 1, name: 'Live application' },
};

function renderFailed(support?: { name?: string; email?: string }) {
  render(
    <TestApiProvider
      apis={[[configApiRef, mockApis.config({ data: { mta: { support } } })]]}
    >
      <UnifiedThemeProvider theme={themes.light}>
        <PhaseFailed task={task} onRetry={jest.fn()} />
      </UnifiedThemeProvider>
    </TestApiProvider>,
  );
}

describe('failed task support contact', () => {
  it('links the name to the address when both are configured', () => {
    renderFailed({
      name: 'Migration Team',
      email: 'migration-team@example.test',
    });
    const link = screen.getByRole('link', { name: 'Migration Team' });
    expect(link).toHaveAttribute('href', 'mailto:migration-team@example.test');
    expect(screen.getByText(/If the problem continues/)).toHaveTextContent(
      'If the problem continues, contact Migration Team.',
    );
  });

  it('names the contact without a link when only a name is configured', () => {
    renderFailed({ name: 'Migration Team' });
    expect(
      screen.getByText('If the problem continues, contact Migration Team.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links the address when only an email is configured', () => {
    renderFailed({ email: 'migration-team@example.test' });
    expect(
      screen.getByRole('link', { name: 'migration-team@example.test' }),
    ).toHaveAttribute('href', 'mailto:migration-team@example.test');
    expect(screen.getByText(/If the problem continues/)).toHaveTextContent(
      'If the problem continues, contact migration-team@example.test.',
    );
  });

  it('renders no contact sentence without configuration', () => {
    renderFailed();
    expect(
      screen.queryByText(/If the problem continues/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('treats an invalid email as not configured', () => {
    renderFailed({ name: 'Migration Team', email: 'not-an-email' });
    expect(
      screen.getByText('If the problem continues, contact Migration Team.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
