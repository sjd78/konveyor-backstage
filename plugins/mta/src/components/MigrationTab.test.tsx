import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const mockUseMigration = useKonveyorMigration as jest.MockedFunction<
  typeof useKonveyorMigration
>;

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'inventory-service',
    annotations: { 'konveyor.io/application-id': '1' },
  },
};

const profile = {
  id: 7,
  name: 'Spring modernization',
  mode: { withDeps: false },
  scope: { withKnownLibs: false },
  rules: { targets: [{ id: 3, name: 'Spring 6' }] },
};

function migration(
  overrides: Partial<UseKonveyorMigrationResult> = {},
): UseKonveyorMigrationResult {
  return {
    phase: 'Not Started',
    application: {
      id: 1,
      name: 'inventory-service',
      repository: {
        url: 'https://example.com/inventory.git',
        branch: 'release',
        path: 'services/inventory',
      },
    },
    profiles: [profile],
    issues: [],
    activeTask: null,
    loading: false,
    error: null,
    issuesError: null,
    isExecuting: false,
    startDiscovery: jest.fn().mockResolvedValue(undefined),
    startAnalysis: jest.fn().mockResolvedValue(undefined),
    retryAnalysis: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('MigrationTab', () => {
  beforeEach(() => {
    mockUseEntity.mockReturnValue({ entity } as { entity: Entity });
    mockUsePersonaRole.mockReturnValue({ role: 'architect', loading: false });
    mockUseMigration.mockReturnValue(migration());
  });
  afterEach(() => jest.clearAllMocks());

  it('runs discovery against the already connected application', async () => {
    const state = migration();
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Start discovery' }));
    await waitFor(() => expect(state.startDiscovery).toHaveBeenCalledTimes(1));
    expect(mockUseMigration).toHaveBeenCalledWith({ appId: 1 });
  });

  it('requires an explicit real profile choice and submits its numeric ID', async () => {
    const state = migration({
      phase: 'Path Selection',
      profiles: [profile, { ...profile, id: 8, name: 'Alternative profile' }],
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    expect(
      screen.getByRole('button', { name: 'Start analysis' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Alternative profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    await waitFor(() => expect(state.startAnalysis).toHaveBeenCalledWith(8));
    expect(state.startAnalysis).toHaveBeenCalledTimes(1);
  });

  it('does not invent migration paths when no effective profiles exist', async () => {
    const state = migration({ phase: 'Path Selection', profiles: [] });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start analysis' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh profiles' }));
    await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  });

  it('shows submission failures without unhandled promises and permits another attempt', async () => {
    const state = migration({
      startDiscovery: jest
        .fn()
        .mockRejectedValueOnce(new Error('Repository credentials are required'))
        .mockResolvedValueOnce(undefined),
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Start discovery' }));
    await screen.findByText('Repository credentials are required');
    fireEvent.click(screen.getByRole('button', { name: 'Start discovery' }));
    await waitFor(() => expect(state.startDiscovery).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.queryByText('Repository credentials are required'),
      ).not.toBeInTheDocument(),
    );
  });

  it('retries a failed task and displays only genuine Hub failure details', async () => {
    const state = migration({
      phase: 'Failed',
      activeTask: {
        id: 50,
        addon: 'analyzer',
        state: 'Failed',
        data: { profile: { id: 7 } },
        errors: [
          {
            severity: 'error',
            description: 'Repository access denied by remote',
          },
        ],
      },
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    expect(
      screen.getByText('Repository access denied by remote'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/OutOfMemoryError/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry task' }));
    await waitFor(() => expect(state.retryAnalysis).toHaveBeenCalled());
  });

  it.each(['unknown', 'developer'] as const)(
    'does not offer architect actions to the %s persona',
    persona => {
      mockUsePersonaRole.mockReturnValue({ role: persona, loading: false });
      mockUseMigration.mockReturnValue(migration({ phase: 'Path Selection' }));
      render(<MigrationTab />);
      expect(
        screen.queryByRole('button', {
          name: /Start analysis|Run discovery|Refresh profiles/,
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    },
  );

  it('offers connection guidance rather than temporary registration for unconnected entities', () => {
    mockUseEntity.mockReturnValue({
      entity: { ...entity, metadata: { name: 'unconnected' } },
    } as { entity: Entity });
    render(<MigrationTab />);
    expect(
      screen.getByText(/konveyor.io\/application-id annotation/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start discovery' }),
    ).not.toBeInTheDocument();
    expect(mockUseMigration).toHaveBeenCalledWith({ appId: undefined });
  });

  it.each(['not-a-number', '0', '-1', '1.5', 'Infinity'])(
    'rejects invalid connection annotation %s before requesting a Hub app',
    value => {
      mockUseEntity.mockReturnValue({
        entity: {
          ...entity,
          metadata: {
            name: 'invalid',
            annotations: { 'konveyor.io/application-id': value },
          },
        },
      } as { entity: Entity });
      render(<MigrationTab />);
      expect(
        screen.getByText(/positive numeric application ID/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Start discovery' }),
      ).not.toBeInTheDocument();
      expect(mockUseMigration).toHaveBeenCalledWith({ appId: undefined });
    },
  );

  it('shows missing Hub application errors with a reload action, not a start discovery action', async () => {
    const state = migration({
      application: null,
      error: new Error('Hub application 1 not found'),
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    expect(screen.getByText('Hub application 1 not found')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start discovery' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading Hub data' }),
    );
    await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  });

  it('keeps findings read errors visible with an explicit retry', async () => {
    const state = migration({
      phase: 'Active',
      issuesError: new Error('Incident request failed'),
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    expect(screen.getByText('Incident request failed')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry loading findings' }),
    );
    await waitFor(() => expect(state.refresh).toHaveBeenCalled());
  });

  it('reopens effective profile selection instead of rerunning analysis with invented targets', async () => {
    const state = migration({ phase: 'Active' });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    expect(state.startAnalysis).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('radio', { name: /Spring modernization/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start analysis' }));
    await waitFor(() => expect(state.startAnalysis).toHaveBeenCalledWith(7));
  });

  it('leaves profile selection after discovery starts and shows the running task', async () => {
    const state = migration({ phase: 'Active' });
    state.startDiscovery = jest.fn().mockImplementation(async () => {
      mockUseMigration.mockReturnValue({
        ...state,
        phase: 'Discovery',
        activeTask: { id: 92, addon: 'language-discovery', state: 'Running' },
      });
    });
    mockUseMigration.mockReturnValue(state);
    render(<MigrationTab />);
    fireEvent.click(screen.getByRole('button', { name: 'Run analysis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run discovery' }));
    await waitFor(() =>
      expect(screen.getByText(/92 · Running/)).toBeInTheDocument(),
    );
    expect(state.startDiscovery).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('button', { name: 'Run discovery' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start analysis' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it.each(['developer', 'unknown'] as const)(
    'shows findings without a runnable analysis control for %s',
    persona => {
      mockUsePersonaRole.mockReturnValue({ role: persona, loading: false });
      mockUseMigration.mockReturnValue(migration({ phase: 'Active' }));
      render(<MigrationTab />);
      expect(
        screen.queryByRole('button', { name: 'Run analysis' }),
      ).not.toBeInTheDocument();
    },
  );

  it('displays the real blocked task status and repository ref and path', () => {
    mockUseMigration.mockReturnValue(
      migration({
        phase: 'Analysis',
        activeTask: {
          id: 91,
          addon: 'analyzer',
          state: 'QuotaBlocked',
          data: { profile: { id: 7 } },
        },
      }),
    );
    render(<MigrationTab />);
    expect(screen.getByText(/91 · QuotaBlocked/)).toBeInTheDocument();
    expect(screen.getByText('Ref: release')).toBeInTheDocument();
    expect(screen.getByText('Path: services/inventory')).toBeInTheDocument();
  });

  it('does not present discovery as not started when task history cannot be loaded', () => {
    mockUseMigration.mockReturnValue(
      migration({ error: new Error('Task history request failed') }),
    );
    render(<MigrationTab />);
    expect(screen.getByText('Task history request failed')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start discovery' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry loading Hub data' }),
    ).toBeInTheDocument();
  });

  async function renderAnalysisUnavailable(
    persona: 'architect' | 'developer' | 'unknown',
  ) {
    const state = migration({
      phase: 'Analysis Unavailable',
      activeTask: { id: 93, addon: 'analyzer', state: 'Succeeded' },
    });
    mockUseMigration.mockReturnValue(state);
    mockUsePersonaRole.mockReturnValue({ role: persona, loading: false });
    render(<MigrationTab />);
    expect(screen.queryByText('No findings reported')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh analysis availability' }),
    );
    await waitFor(() => expect(state.refresh).toHaveBeenCalledTimes(1));
    return state;
  }

  it('offers an availability refresh and profile selection to architects without inventing empty findings', async () => {
    const state = await renderAnalysisUnavailable('architect');
    fireEvent.click(
      screen.getByRole('button', { name: 'Select analysis profile' }),
    );
    expect(
      screen.getByRole('radio', { name: /Spring modernization/ }),
    ).toBeInTheDocument();
    expect(state.startAnalysis).not.toHaveBeenCalled();
  });

  it.each(['developer', 'unknown'] as const)(
    'offers an availability refresh without profile selection or invented empty findings for %s',
    async persona => {
      const state = await renderAnalysisUnavailable(persona);
      expect(
        screen.queryByRole('button', { name: 'Select analysis profile' }),
      ).not.toBeInTheDocument();
      expect(state.startAnalysis).not.toHaveBeenCalled();
    },
  );
});
