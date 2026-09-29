import { render, screen } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useKonveyorMigration } from '../hooks/useKonveyorMigration';
import { MigrationTab } from './MigrationTab';
import type { UseKonveyorMigrationResult } from '../hooks/useKonveyorMigration';

jest.mock('@backstage/plugin-catalog-react');
jest.mock('../hooks/usePersonaRole');
jest.mock('../hooks/useKonveyorMigration');

const mockUseEntity = useEntity as jest.MockedFunction<typeof useEntity>;
const mockUsePersonaRole = usePersonaRole as jest.MockedFunction<
  typeof usePersonaRole
>;
const mockUseKonveyorMigration = useKonveyorMigration as jest.MockedFunction<
  typeof useKonveyorMigration
>;

describe('MigrationTab', () => {
  const baseMigrationResult: UseKonveyorMigrationResult = {
    phase: 'Not Started',
    application: null,
    archetypes: [],
    issues: [],
    activeTask: null,
    loading: false,
    error: null,
    isExecuting: false,
    startDiscovery: jest.fn(),
    startAnalysis: jest.fn(),
    retryAnalysis: jest.fn(),
  };

  beforeEach(() => {
    mockUseEntity.mockReturnValue({
      entity: {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'inventory-service',
          namespace: 'default',
          annotations: {
            'konveyor.io/application-id': '1',
          },
        },
        spec: {
          type: 'service',
        },
      },
    } as unknown as { entity: Entity });

    mockUsePersonaRole.mockReturnValue({
      role: 'architect',
      loading: false,
    });

    mockUseKonveyorMigration.mockReturnValue(baseMigrationResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders PhaseNotStarted when phase is Not Started', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Not Started',
    });

    render(<MigrationTab />);
    expect(screen.getByText('No migration data yet')).toBeInTheDocument();
  });

  it('renders PhaseDiscovery when phase is Discovery', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Discovery',
    });

    render(<MigrationTab />);
    expect(screen.getByText('Scanning repository')).toBeInTheDocument();
  });

  it('renders PhasePathSelection when phase is Path Selection', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Path Selection',
      application: {
        id: 1,
        name: 'inventory-service',
        tags: [{ id: 10, name: 'Java' }],
      },
      archetypes: [
        { id: 1, name: 'Quarkus Modernization', description: 'Migrate to Quarkus' },
      ],
    });

    render(<MigrationTab />);
    expect(screen.getByText('Technologies discovered')).toBeInTheDocument();
    expect(screen.getAllByText('Quarkus Modernization').length).toBeGreaterThan(0);
  });

  it('renders PhaseAnalyzing when phase is Analysis', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Analysis',
      activeTask: {
        id: 101,
        addon: 'analyzer',
        state: 'Running',
      },
    });

    render(<MigrationTab />);
    expect(screen.getByText('Running analysis')).toBeInTheDocument();
  });

  it('renders PhaseActive when phase is Active', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Active',
      application: {
        id: 1,
        name: 'inventory-service',
      },
    });

    render(<MigrationTab />);
    expect(screen.getByText('Next steps')).toBeInTheDocument();
    expect(screen.getByText('Re-run analysis')).toBeInTheDocument();
  });

  it('renders PhaseCompleted when phase is Completed', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Completed',
      application: {
        id: 1,
        name: 'inventory-service',
      },
    });

    render(<MigrationTab />);
    expect(screen.getByText('Migration complete')).toBeInTheDocument();
  });

  it('renders PhaseFailed when phase is Failed', () => {
    mockUseKonveyorMigration.mockReturnValue({
      ...baseMigrationResult,
      phase: 'Failed',
      error: new Error('Konveyor timeout'),
    });

    render(<MigrationTab />);
    expect(screen.getByText(/Analysis failed/i)).toBeInTheDocument();
  });
});
