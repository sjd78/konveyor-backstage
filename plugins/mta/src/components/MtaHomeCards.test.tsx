import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useMtaHomeData } from '../hooks/useMtaHomeData';
import { MTA_REGISTER_TEMPLATE_PATH } from '../utils';
import { MtaHomeSection } from './MtaHomeCards';

jest.mock('../hooks/usePersonaRole');
jest.mock('../hooks/useMtaHomeData');
const mockUsePersonaRole = usePersonaRole as jest.MockedFunction<
  typeof usePersonaRole
>;
const mockUseMtaHomeData = useMtaHomeData as jest.MockedFunction<
  typeof useMtaHomeData
>;
const refetch = jest.fn();

function renderCard() {
  return render(
    <UnifiedThemeProvider theme={themes.light}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<MtaHomeSection />} />
          <Route
            path="/catalog/default/component/inventory-service/migration"
            element={<div>Application migration route</div>}
          />
        </Routes>
      </MemoryRouter>
    </UnifiedThemeProvider>,
  );
}

describe('portfolio access and actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePersonaRole.mockReturnValue({ role: 'architect', loading: false });
    mockUseMtaHomeData.mockReturnValue({
      apps: [
        {
          name: 'inventory-service',
          namespace: 'default',
          connection: 'connected',
          status: 'Active',
          issuesCount: 0,
          criticalIssues: 0,
        },
      ],
      loading: false,
      error: null,
      refetch,
    });
  });

  it('opens the catalog migration tab for the selected real application', () => {
    renderCard();
    const row = screen.getByRole('link', {
      name: 'Open inventory-service migration tab',
    });
    expect(row).toHaveAttribute(
      'href',
      '/catalog/default/component/inventory-service/migration',
    );
    fireEvent.click(row);
    expect(screen.getByText('Application migration route')).toBeInTheDocument();
  });

  it('does not fetch or display portfolio data for an unknown persona', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: false });
    renderCard();
    expect(mockUseMtaHomeData).not.toHaveBeenCalled();
    expect(
      screen.getByText('Migration access unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your account is not assigned a migration role. Contact your administrator for access.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open .* migration tab/ }),
    ).not.toBeInTheDocument();
  });

  it('does not present zero findings as migration completion', () => {
    renderCard();
    expect(screen.getByText('No findings reported')).toBeInTheDocument();
    expect(screen.queryByText('Migration complete')).not.toBeInTheDocument();
    expect(
      screen.getByText('Zero findings does not mark a migration complete.'),
    ).toBeInTheDocument();
  });

  it('offers a refresh without reporting empty findings when persisted analysis is missing', () => {
    mockUseMtaHomeData.mockReturnValue({
      apps: [
        {
          name: 'inventory-service',
          namespace: 'default',
          connection: 'connected',
          status: 'Analysis Unavailable',
        },
      ],
      loading: false,
      error: null,
      refetch,
    });
    renderCard();
    expect(
      screen.getByText(
        'Analysis results unavailable — refresh or run analysis',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('No findings reported')).not.toBeInTheDocument();
    expect(screen.queryByText('0 total findings')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Zero findings does not mark a migration complete.'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Hub data' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('preserves actionable Hub failures and allows a fresh read', () => {
    mockUseMtaHomeData.mockReturnValue({
      apps: [],
      loading: false,
      error: new Error('403 Forbidden at /applications'),
      refetch,
    });
    renderCard();
    expect(
      screen.getByText('Could not load migration data'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('403 Forbidden at /applications'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Hub data' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a row skeleton while the migration role resolves', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: true });
    renderCard();
    expect(
      screen.getByRole('status', { name: 'Loading migration applications' }),
    ).toBeInTheDocument();
    expect(mockUseMtaHomeData).not.toHaveBeenCalled();
  });

  it('offers registration when no applications are registered', () => {
    mockUseMtaHomeData.mockReturnValue({
      apps: [],
      loading: false,
      error: null,
      refetch,
    });
    renderCard();
    expect(
      screen.getByText('No applications registered for migration'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Register an application to begin migration.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Register for migration' }),
    ).toHaveAttribute('href', MTA_REGISTER_TEMPLATE_PATH);
  });

  it('asks the architect to assign an application for a developer with no assignments', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'developer', loading: false });
    mockUseMtaHomeData.mockReturnValue({
      apps: [],
      loading: false,
      error: null,
      refetch,
    });
    renderCard();
    expect(screen.getByText('Your Migration')).toBeInTheDocument();
    expect(screen.getByText('No assigned applications')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ask your application architect to assign an application.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Register for migration' }),
    ).not.toBeInTheDocument();
  });

  it('labels every row status without making the label a control', () => {
    mockUseMtaHomeData.mockReturnValue({
      apps: [
        {
          name: 'not-connected',
          namespace: 'default',
          connection: 'disconnected',
        },
        {
          name: 'missing',
          namespace: 'default',
          connection: 'missing',
        },
        {
          name: 'row-error',
          namespace: 'default',
          connection: 'connected',
          error: new Error('Request failed with status 500'),
        },
        {
          name: 'discovery',
          namespace: 'default',
          connection: 'connected',
          status: 'Discovery',
        },
        {
          name: 'path',
          namespace: 'default',
          connection: 'connected',
          status: 'Path Selection',
        },
        {
          name: 'analysis',
          namespace: 'default',
          connection: 'connected',
          status: 'Analysis',
        },
        {
          name: 'unavailable',
          namespace: 'default',
          connection: 'connected',
          status: 'Analysis Unavailable',
        },
        {
          name: 'findings',
          title: 'Findings Service',
          namespace: 'default',
          connection: 'connected',
          status: 'Active',
          issuesCount: 12,
          criticalIssues: 3,
        },
        {
          name: 'failed',
          namespace: 'default',
          connection: 'connected',
          status: 'Failed',
        },
        {
          name: 'not-started',
          namespace: 'default',
          connection: 'connected',
          status: 'Not Started',
        },
      ],
      loading: false,
      error: null,
      refetch,
    });
    renderCard();
    expect(screen.getByText('Not connected to Hub')).toBeInTheDocument();
    expect(
      screen.getByText('Linked Hub application is missing or unavailable'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Request failed with status 500'),
    ).toBeInTheDocument();
    expect(screen.getByText('Discovery in progress')).toBeInTheDocument();
    expect(screen.getByText('Path selection needed')).toBeInTheDocument();
    expect(screen.getByText('Analysis in progress')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Analysis results unavailable — refresh or run analysis',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Analysis findings')).toBeInTheDocument();
    expect(screen.getByText('Task failed — view details')).toBeInTheDocument();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    expect(screen.getByText('3 critical')).toBeInTheDocument();
    expect(screen.getByText('12 total findings')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open findings migration tab' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Findings Service')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Analysis findings' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Analysis findings' }),
    ).not.toBeInTheDocument();
  });
});
