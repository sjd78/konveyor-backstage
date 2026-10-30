import { act, renderHook, waitFor } from '@testing-library/react';
import type { MtaApi } from '../api';
import type { KonveyorAnalysisProfile, KonveyorTask } from '../api/types';
import { useKonveyorActions } from './useKonveyorActions';
import {
  useKonveyorApplication,
  useKonveyorIssues,
  useMtaApi,
} from './useKonveyorData';
import { useKonveyorMigration } from './useKonveyorMigration';
import { useMtaAnalysis } from './useMtaAnalysis';

jest.mock('./useKonveyorActions');
jest.mock('./useKonveyorData');
jest.mock('./useMtaAnalysis');

const mockUseActions = useKonveyorActions as jest.MockedFunction<
  typeof useKonveyorActions
>;
const mockUseApplication = useKonveyorApplication as jest.MockedFunction<
  typeof useKonveyorApplication
>;
const mockUseIssues = useKonveyorIssues as jest.MockedFunction<
  typeof useKonveyorIssues
>;
const mockUseMtaApi = useMtaApi as jest.MockedFunction<typeof useMtaApi>;
const mockUseAnalysis = useMtaAnalysis as jest.MockedFunction<
  typeof useMtaAnalysis
>;

const profile: KonveyorAnalysisProfile = {
  id: 7,
  name: 'Spring modernization',
  mode: { withDeps: false },
  scope: { withKnownLibs: false },
  rules: { targets: [{ id: 3, name: 'Spring 6' }] },
};

describe('useKonveyorMigration', () => {
  let getTasks: jest.Mock;
  let getProfiles: jest.Mock;
  let getAnalysis: jest.Mock;
  let triggerDiscovery: jest.Mock;
  let triggerAnalysis: jest.Mock;
  let refetchApp: jest.Mock;
  let refetchIssues: jest.Mock;

  beforeEach(() => {
    getTasks = jest.fn().mockResolvedValue([]);
    getProfiles = jest.fn().mockResolvedValue([profile]);
    getAnalysis = jest.fn().mockResolvedValue(null);
    triggerDiscovery = jest.fn();
    triggerAnalysis = jest.fn();
    refetchApp = jest.fn().mockResolvedValue(undefined);
    refetchIssues = jest.fn().mockResolvedValue(undefined);
    mockUseMtaApi.mockReturnValue({
      getApplicationTasks: getTasks,
      getAnalysisProfiles: getProfiles,
      getAnalysis,
    } as unknown as MtaApi);
    mockUseApplication.mockReturnValue({
      application: {
        id: 1,
        name: 'sample-service',
        repository: { url: 'https://example.com/service.git' },
      },
      loading: false,
      error: null,
      refetch: refetchApp,
    });
    mockUseIssues.mockReturnValue({
      issues: [],
      rawInsights: [],
      loading: false,
      error: null,
      refetch: refetchIssues,
    });
    mockUseAnalysis.mockReturnValue({
      task: null,
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseActions.mockReturnValue({
      createApplication: jest.fn(),
      triggerDiscovery,
      triggerAnalysis,
      isExecuting: false,
      actionError: null,
      clearActionError: jest.fn(),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('does not create or load a Hub application for an unconnected component', async () => {
    const { result } = renderHook(() => useKonveyorMigration({}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.application).toBeNull();
    expect(getTasks).not.toHaveBeenCalled();
    await expect(result.current.startDiscovery()).rejects.toThrow(
      /Connect this component/,
    );
    expect(triggerDiscovery).not.toHaveBeenCalled();
  });

  it.each([
    'Ready',
    'Postponed',
    'QuotaBlocked',
    'Pending',
    'Running',
  ] as const)(
    'restores an analysis task in %s state from the application task endpoint',
    async state => {
      const task: KonveyorTask = {
        id: 12,
        addon: 'analyzer',
        kind: 'analyzer',
        state,
      };
      getTasks.mockResolvedValue([task]);
      const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(getTasks).toHaveBeenCalledWith(1);
      expect(result.current.activeTask).toEqual(task);
      expect(result.current.phase).toBe('Analysis');
      expect(mockUseAnalysis).toHaveBeenLastCalledWith(12);
    },
  );

  it('restores technology discovery without presenting it as completed analysis', async () => {
    getTasks.mockResolvedValue([
      { id: 9, addon: 'analyzer', kind: 'tech-discovery', state: 'Succeeded' },
    ]);
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe('Path Selection');
  });

  it('submits real discovery for the existing application', async () => {
    triggerDiscovery.mockResolvedValue({
      id: 15,
      kind: 'language-discovery',
      addon: 'language-discovery',
      state: 'Ready',
    });
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.startDiscovery();
    });
    expect(triggerDiscovery).toHaveBeenCalledWith(1);
    expect(result.current.phase).toBe('Discovery');
    expect(result.current.activeTask?.id).toBe(15);
  });

  it('submits the selected numeric effective profile and rejects unrelated profiles', async () => {
    triggerAnalysis.mockResolvedValue({
      id: 16,
      addon: 'analyzer',
      state: 'Ready',
      data: { profile: { id: 7 } },
    });
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.startAnalysis(999)).rejects.toThrow(
      /effective analysis profile/,
    );
    await act(async () => {
      await result.current.startAnalysis(7);
    });
    expect(triggerAnalysis).toHaveBeenCalledWith(1, 7);
    expect(triggerAnalysis).toHaveBeenCalledTimes(1);
  });

  it('refreshes application, effective profiles and findings after a terminal task', async () => {
    getTasks.mockResolvedValue([
      { id: 20, addon: 'analyzer', state: 'Running' },
    ]);
    const { result, rerender } = renderHook(() =>
      useKonveyorMigration({ appId: 1 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const profileCalls = getProfiles.mock.calls.length;
    mockUseAnalysis.mockReturnValue({
      task: { id: 20, addon: 'analyzer', state: 'Succeeded' },
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    rerender();
    await waitFor(() =>
      expect(getProfiles.mock.calls.length).toBeGreaterThan(profileCalls),
    );
    expect(refetchApp).toHaveBeenCalled();
    expect(refetchIssues).toHaveBeenCalled();
    expect(result.current.phase).toBe('Analysis Unavailable');
  });

  it('recognizes an existing analysis even when it has no findings or task history', async () => {
    getAnalysis.mockResolvedValue({ id: 3, application: { id: 1 }, effort: 0 });
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe('Active');
    expect(result.current.issues).toEqual([]);
  });

  it('does not infer available findings from a succeeded task without a persisted analysis', async () => {
    getTasks.mockResolvedValue([
      { id: 20, addon: 'analyzer', state: 'Succeeded' },
    ]);
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe('Analysis Unavailable');
    getAnalysis.mockResolvedValue({ id: 4, application: { id: 1 }, effort: 0 });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.phase).toBe('Active');
  });

  it('retries a failed analysis using its persisted profile ID after reload', async () => {
    getTasks.mockResolvedValue([
      {
        id: 21,
        addon: 'analyzer',
        state: 'Failed',
        data: { profile: { id: 7 } },
      },
    ]);
    triggerAnalysis.mockResolvedValue({
      id: 22,
      addon: 'analyzer',
      state: 'Ready',
    });
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.phase).toBe('Failed');
    await act(async () => {
      await result.current.retryAnalysis();
    });
    expect(triggerAnalysis).toHaveBeenCalledWith(1, 7);
  });

  it('surfaces missing applications and failed reads instead of presenting Not Started data', async () => {
    const error = new Error('Hub application 1 not found');
    mockUseApplication.mockReturnValue({
      application: null,
      loading: false,
      error,
      refetch: refetchApp,
    });
    getTasks.mockRejectedValue(new Error('Hub unavailable'));
    const { result } = renderHook(() => useKonveyorMigration({ appId: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(error);
    expect(result.current.application).toBeNull();
  });
});
