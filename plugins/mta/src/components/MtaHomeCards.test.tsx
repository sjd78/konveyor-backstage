import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useMtaHomeData } from '../hooks/useMtaHomeData';
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
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open inventory-service migration tab',
      }),
    );
    expect(screen.getByText('Application migration route')).toBeInTheDocument();
  });

  it('does not fetch or display portfolio data for an unknown persona', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: false });
    renderCard();
    expect(mockUseMtaHomeData).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /Open .* migration tab/ }),
    ).not.toBeInTheDocument();
  });

  it('does not present zero findings as migration completion', () => {
    renderCard();
    expect(screen.getByText('No findings reported')).toBeInTheDocument();
    expect(screen.queryByText('Migration complete')).not.toBeInTheDocument();
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
    expect(screen.queryByText('No findings reported')).not.toBeInTheDocument();
    expect(screen.queryByText('0 total findings')).not.toBeInTheDocument();
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
      screen.getByText('403 Forbidden at /applications'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Hub data' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
