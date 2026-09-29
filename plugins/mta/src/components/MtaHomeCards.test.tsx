import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('MtaHomeCards', () => {
  beforeEach(() => {
    mockUsePersonaRole.mockReturnValue({
      role: 'architect',
      loading: false,
    });

    mockUseMtaHomeData.mockReturnValue({
      apps: [
        {
          name: 'inventory-service',
          title: 'Inventory Service',
          namespace: 'default',
          status: 'Active',
          issuesCount: 42,
          criticalIssues: 8,
        },
      ],
      loading: false,
      error: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders architect view with applications list', () => {
    render(
      <UnifiedThemeProvider theme={themes.light}>
        <MemoryRouter>
          <MtaHomeSection />
        </MemoryRouter>
      </UnifiedThemeProvider>,
    );

    expect(
      screen.getByText('Migration Toolkit for Applications'),
    ).toBeInTheDocument();
    expect(screen.getByText('Inventory Service')).toBeInTheDocument();
    expect(screen.getByText('42 total issues')).toBeInTheDocument();
    expect(screen.getByText('8 critical')).toBeInTheDocument();
  });

  it('renders developer view with assigned applications', () => {
    mockUsePersonaRole.mockReturnValue({
      role: 'developer',
      loading: false,
    });

    render(
      <UnifiedThemeProvider theme={themes.light}>
        <MemoryRouter>
          <MtaHomeSection />
        </MemoryRouter>
      </UnifiedThemeProvider>,
    );

    expect(screen.getByText('Your Migration')).toBeInTheDocument();
    expect(screen.getByText('Inventory Service')).toBeInTheDocument();
  });

  it('renders empty state when no applications are found', () => {
    mockUseMtaHomeData.mockReturnValue({
      apps: [],
      loading: false,
      error: false,
      refetch: jest.fn(),
    });

    render(
      <UnifiedThemeProvider theme={themes.light}>
        <MemoryRouter>
          <MtaHomeSection />
        </MemoryRouter>
      </UnifiedThemeProvider>,
    );

    expect(
      screen.getByText('No applications registered for migration'),
    ).toBeInTheDocument();
  });
});
