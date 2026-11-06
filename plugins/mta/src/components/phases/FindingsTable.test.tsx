import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
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

/** Reports the URL and how the last navigation changed it. */
function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return (
    <output data-testid="location">
      {`${location.pathname}${location.search}|${navigationType}`}
    </output>
  );
}

/** Follows a finding link the way a pasted URL or a new tab would. */
function IssueLink({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/migration?issue=${id}`)}
    >{`Link to ${id}`}</button>
  );
}

/** Leaves the tab, which should skip over every row disclosure. */
function BackLink() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Go back
    </button>
  );
}

function renderTable(
  findings: MigrationIssue[],
  entries: string[] = ['/migration'],
  initialIndex?: number,
) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <FindingsTable issues={findings} />
      <LocationProbe />
      <BackLink />
    </MemoryRouter>,
  );
}

describe('findings table', () => {
  it('renders the severity, location, category and finding of each issue', () => {
    renderTable([
      issue(1, {
        severity: 'critical',
        category: 'api-change',
        description: 'Legacy API',
        file: 'src/legacy/Legacy.java',
        line: 12,
      }),
      issue(2, { description: 'Unlocated rule', file: undefined }),
    ]);
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
    renderTable([issue(1)]);
    expect(
      screen.getByRole('heading', { name: '1 analysis finding' }),
    ).toBeInTheDocument();
  });

  it('filters the rows by severity, location, category and finding text', () => {
    renderTable([
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
    ]);
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
    renderTable([
      issue(1, {
        description: 'Legacy API',
        problem: 'Removed API',
        message: 'Call found in Legacy.java',
        effort: 3,
      }),
    ]);
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
    renderTable([
      issue(1, { severity: 'info' }),
      issue(2, { severity: 'critical' }),
      issue(3, { severity: 'minor' }),
      issue(4, { severity: 'major' }),
    ]);
    const table = screen.getByRole('grid');
    fireEvent.click(screen.getByRole('columnheader', { name: /Severity/ }));
    const severities = within(table)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('gridcell')[1].textContent);
    expect(severities).toEqual(['Critical', 'Major', 'Minor', 'Info']);
  });

  it('pages only when there are more than ten findings', () => {
    const { unmount } = renderTable(issues(10));
    expect(
      screen.queryByRole('button', { name: 'Next table page' }),
    ).not.toBeInTheDocument();
    unmount();
    renderTable(issues(12));
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

describe('finding links', () => {
  it('opens the finding on its page from the URL after load', () => {
    const scrollIntoView = jest.fn();
    (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView =
      scrollIntoView;
    try {
      renderTable(issues(25), ['/migration?issue=issue-15']);
      // Page two holds findings 11 to 20, so the linked row is mounted.
      expect(screen.getByText('Finding 11')).toBeInTheDocument();
      expect(screen.queryByText('Finding 1')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^Hide details for Finding 15,/ }),
      ).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByText('No additional details were reported by Hub.'),
      ).toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalled();
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/migration?issue=issue-15|POP',
      );
    } finally {
      delete (Element.prototype as { scrollIntoView?: () => void })
        .scrollIntoView;
    }
  });

  it('moves to the finding page when the link changes', () => {
    render(
      <MemoryRouter initialEntries={['/migration']}>
        <FindingsTable issues={issues(25)} />
        <IssueLink id="issue-22" />
        <LocationProbe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Link to issue-22' }));
    expect(screen.getByText('Finding 21')).toBeInTheDocument();
    expect(screen.queryByText('Finding 1')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Hide details for Finding 22,/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('writes and clears the finding without adding history entries', () => {
    renderTable(issues(3), ['/home', '/migration?view=all'], 1);
    fireEvent.click(expander('Finding 2'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/migration?view=all&issue=issue-2|REPLACE',
    );
    fireEvent.click(
      screen.getByRole('button', { name: /^Hide details for Finding 2,/ }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/migration?view=all|REPLACE',
    );
    // Both disclosures replaced the same entry, so Back leaves the tab.
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/home|POP');
  });

  it('ignores an unknown finding in the link', () => {
    renderTable(issues(3), ['/migration?issue=does-not-exist']);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(
      screen.queryByText('No additional details were reported by Hub.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Show details for/ }),
    ).toHaveLength(3);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/migration?issue=does-not-exist|POP',
    );
  });

  it('keeps the chosen page size and a linked finding in the larger page', () => {
    renderTable(issues(12), ['/migration?issue=issue-12']);
    // The link opens page two, which holds findings 11 and 12.
    expect(
      screen.getAllByRole('button', { name: /^(Show|Hide) details for/ }),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Show 10 results/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Show 20 results' }));
    expect(
      screen.getAllByRole('button', { name: /^(Show|Hide) details for/ }),
    ).toHaveLength(12);
    expect(screen.getByText('Finding 12')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Hide details for Finding 12,/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('1 - 12 of 12')).toBeInTheDocument();
  });

  it('leaves a finding that sorting hides closed and keeps its link', () => {
    const findings = issues(12).map((finding, index) =>
      index === 0
        ? { ...finding, description: 'Zebra finding' }
        : { ...finding, description: `Alpha finding ${index + 1}` },
    );
    renderTable(findings, ['/migration?issue=issue-1']);
    expect(
      screen.getByRole('button', { name: /^Hide details for Zebra finding,/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    // Sorting by finding moves the linked row to page two of the new order.
    fireEvent.click(screen.getByRole('columnheader', { name: /Finding/ }));
    expect(screen.getByText('Alpha finding 2')).toBeInTheDocument();
    expect(screen.queryByText('Zebra finding')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No additional details were reported by Hub.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('button', { name: /^Hide details for/ }),
    ).toHaveLength(0);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/migration?issue=issue-1|POP',
    );
  });

  it('leaves a finding that search hides closed and keeps its link', () => {
    renderTable(issues(3), ['/migration?issue=issue-2']);
    expect(
      screen.getByText('No additional details were reported by Hub.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter' }), {
      target: { value: 'nothing matches' },
    });
    expect(screen.getByText('No records to display')).toBeInTheDocument();
    expect(
      screen.queryByText('No additional details were reported by Hub.'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/migration?issue=issue-2|POP',
    );
  });
});
