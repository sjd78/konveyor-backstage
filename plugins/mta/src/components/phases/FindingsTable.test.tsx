import { fireEvent, render, screen, within } from '@testing-library/react';
import { FindingsTable } from './FindingsTable';
import type { MigrationIssue } from '../../types';

/*
 * jsdom has no ResizeObserver, and the BUI table wraps a table with sized
 * columns in a resizable container, which observes it. The stubbed observer
 * keeps the table mountable; no layout is measured in jsdom.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
    ResizeObserverStub;
});

function issue(
  index: number,
  overrides: Partial<MigrationIssue> = {},
): MigrationIssue {
  return {
    id: `issue-${index}`,
    appId: '1',
    severity: 'minor',
    category: 'dependency',
    description: `Finding ${index}`,
    file: `src/service-${index}.java`,
    line: index,
    ...overrides,
  };
}

function issues(count: number): MigrationIssue[] {
  return Array.from({ length: count }, (_, index) => issue(index + 1));
}

function expander(description: string): HTMLElement {
  return screen.getByRole('button', {
    name: new RegExp(`^Show details for ${description},`),
  });
}

describe('findings table', () => {
  it('renders the severity, location, category and finding of each issue', () => {
    render(
      <FindingsTable
        issues={[
          issue(1, {
            severity: 'critical',
            category: 'api-change',
            description: 'Legacy API',
            file: 'src/legacy/Legacy.java',
            line: 12,
          }),
          issue(2, { description: 'Unlocated rule', file: undefined }),
        ]}
      />,
    );
    expect(
      screen.getByRole('heading', { name: '2 analysis findings' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('src/legacy/Legacy.java:12')).toBeInTheDocument();
    expect(screen.getByText('api-change')).toBeInTheDocument();
    expect(screen.getByText('Legacy API')).toBeInTheDocument();
    expect(screen.getByText('No source location reported')).toBeInTheDocument();
  });

  it('uses the singular finding count for a single issue', () => {
    render(<FindingsTable issues={[issue(1)]} />);
    expect(
      screen.getByRole('heading', { name: '1 analysis finding' }),
    ).toBeInTheDocument();
  });

  it('filters the rows by severity, location, category and finding text', () => {
    render(
      <FindingsTable
        issues={[
          issue(1, {
            severity: 'critical',
            description: 'Legacy API',
            category: 'api-change',
            file: 'src/legacy/Legacy.java',
          }),
          issue(2, {
            severity: 'minor',
            description: 'Spring dependency',
            category: 'dependency',
            file: 'src/spring/Boot.java',
          }),
        ]}
      />,
    );
    const search = screen.getByRole('searchbox', { name: 'Filter' });
    fireEvent.change(search, { target: { value: 'critical' } });
    expect(screen.getByText('Legacy API')).toBeInTheDocument();
    expect(screen.queryByText('Spring dependency')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Boot.java' } });
    expect(screen.getByText('Spring dependency')).toBeInTheDocument();
    expect(screen.queryByText('Legacy API')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'api-change' } });
    expect(screen.getByText('Legacy API')).toBeInTheDocument();
    expect(screen.queryByText('Spring dependency')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Spring dependency' } });
    expect(screen.getByText('Spring dependency')).toBeInTheDocument();
    expect(screen.queryByText('Legacy API')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'nothing matches' } });
    expect(screen.getByText('No records to display')).toBeInTheDocument();
  });

  it('reveals the incident details from the row toggle', () => {
    render(
      <FindingsTable
        issues={[
          issue(1, {
            description: 'Legacy API',
            problem: 'Removed API',
            message: 'Call found in Legacy.java',
            effort: 3,
          }),
        ]}
      />,
    );
    const toggle = expander('Legacy API');
    expect(toggle).toHaveAccessibleName(
      'Show details for Legacy API, src/service-1.java:1',
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Rule description')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const expanded = screen.getByRole('button', {
      name: /^Hide details for Legacy API,/,
    });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    expect(expanded).toHaveAttribute('aria-controls', 'issue-details-issue-1');
    expect(screen.getByText('Rule description')).toBeInTheDocument();
    expect(screen.getByText('Removed API')).toBeInTheDocument();
    expect(screen.getByText('Call found in Legacy.java')).toBeInTheDocument();
    expect(screen.getByText('Rule effort: 3')).toBeInTheDocument();
    fireEvent.click(expanded);
    expect(screen.queryByText('Removed API')).not.toBeInTheDocument();
  });

  it('sorts severity by rank instead of alphabetically', () => {
    render(
      <FindingsTable
        issues={[
          issue(1, { severity: 'info' }),
          issue(2, { severity: 'critical' }),
          issue(3, { severity: 'minor' }),
          issue(4, { severity: 'major' }),
        ]}
      />,
    );
    const table = screen.getByRole('grid');
    fireEvent.click(screen.getByRole('columnheader', { name: /Severity/ }));
    const severities = within(table)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('gridcell')[1].textContent);
    expect(severities).toEqual(['Critical', 'Major', 'Minor', 'Info']);
  });

  it('pages only when there are more than ten findings', () => {
    const { unmount } = render(<FindingsTable issues={issues(10)} />);
    expect(
      screen.queryByRole('button', { name: 'Next table page' }),
    ).not.toBeInTheDocument();
    unmount();
    render(<FindingsTable issues={issues(12)} />);
    expect(
      screen.getByRole('button', { name: 'Next table page' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Show details for/ }),
    ).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Next table page' }));
    expect(
      screen.getAllByRole('button', { name: /^Show details for/ }),
    ).toHaveLength(2);
  });
});
