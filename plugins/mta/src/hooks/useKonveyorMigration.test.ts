import { act, renderHook } from '@testing-library/react';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorTask,
} from '../api/types';
import { useKonveyorActions } from './useKonveyorActions';
import {
  useKonveyorApplication,
  useKonveyorArchetypes,
  useKonveyorIssues,
} from './useKonveyorData';
import { useKonveyorMigration } from './useKonveyorMigration';
import { useMtaAnalysis } from './useMtaAnalysis';

jest.mock('./useKonveyorActions');
jest.mock('./useKonveyorData');
jest.mock('./useMtaAnalysis');

const mockUseKonveyorActions = useKonveyorActions as jest.MockedFunction<
  typeof useKonveyorActions
>;
const mockUseKonveyorApplication = useKonveyorApplication as jest.MockedFunction<
  typeof useKonveyorApplication
>;
const mockUseKonveyorArchetypes = useKonveyorArchetypes as jest.MockedFunction<
  typeof useKonveyorArchetypes
>;
const mockUseKonveyorIssues = useKonveyorIssues as jest.MockedFunction<
  typeof useKonveyorIssues
>;
const mockUseMtaAnalysis = useMtaAnalysis as jest.MockedFunction<
  typeof useMtaAnalysis
>;

describe('useKonveyorMigration', () => {
  let mockCreateApplication: jest.Mock;
  let mockTriggerAnalysis: jest.Mock;
  let mockRefetchApp: jest.Mock;

  beforeEach(() => {
    mockCreateApplication = jest.fn();
    mockTriggerAnalysis = jest.fn();
    mockRefetchApp = jest.fn();

    mockUseKonveyorActions.mockReturnValue({
      createApplication: mockCreateApplication,
      triggerAnalysis: mockTriggerAnalysis,
      isExecuting: false,
      actionError: null,
    });

    mockUseKonveyorArchetypes.mockReturnValue({
      archetypes: [{ id: 1, name: 'Quarkus' } as KonveyorArchetype],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseKonveyorIssues.mockReturnValue({
      issues: [],
      rawInsights: [],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseMtaAnalysis.mockReturnValue({
      task: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to Not Started phase when no application is found', () => {
    mockUseKonveyorApplication.mockReturnValue({
      application: null,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
      }),
    );

    expect(result.current.phase).toBe('Not Started');
  });

  it('enters Discovery phase when application has no tags', () => {
    const app: KonveyorApplication = {
      id: 1,
      name: 'sample-service',
      tags: [],
    };

    mockUseKonveyorApplication.mockReturnValue({
      application: app,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        appId: 1,
      }),
    );

    expect(result.current.phase).toBe('Discovery');
  });

  it('enters Path Selection phase when application has tags and no active task', () => {
    const app: KonveyorApplication = {
      id: 1,
      name: 'sample-service',
      tags: [{ id: 10, name: 'Java' }],
    };

    mockUseKonveyorApplication.mockReturnValue({
      application: app,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        appId: 1,
      }),
    );

    expect(result.current.phase).toBe('Path Selection');
  });

  it('enters Analysis phase when analysis task is Running', () => {
    const app: KonveyorApplication = {
      id: 1,
      name: 'sample-service',
      tags: [{ id: 10, name: 'Java' }],
      tasks: [100],
    };
    const task: KonveyorTask = {
      id: 100,
      addon: 'analyzer',
      state: 'Running',
    };

    mockUseKonveyorApplication.mockReturnValue({
      application: app,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    mockUseMtaAnalysis.mockReturnValue({
      task,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        appId: 1,
      }),
    );

    expect(result.current.phase).toBe('Analysis');
  });

  it('enters Active phase when analysis task has Succeeded', () => {
    const app: KonveyorApplication = {
      id: 1,
      name: 'sample-service',
      tags: [{ id: 10, name: 'Java' }],
      tasks: [100],
    };
    const task: KonveyorTask = {
      id: 100,
      addon: 'analyzer',
      state: 'Succeeded',
    };

    mockUseKonveyorApplication.mockReturnValue({
      application: app,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    mockUseMtaAnalysis.mockReturnValue({
      task,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        appId: 1,
      }),
    );

    expect(result.current.phase).toBe('Active');
  });

  it('enters Failed phase when analysis task has Failed', () => {
    const app: KonveyorApplication = {
      id: 1,
      name: 'sample-service',
      tags: [{ id: 10, name: 'Java' }],
      tasks: [100],
    };
    const task: KonveyorTask = {
      id: 100,
      addon: 'analyzer',
      state: 'Failed',
      errors: ['Compilation error'],
    };

    mockUseKonveyorApplication.mockReturnValue({
      application: app,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    mockUseMtaAnalysis.mockReturnValue({
      task,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        appId: 1,
      }),
    );

    expect(result.current.phase).toBe('Failed');
  });

  it('triggers createApplication when startDiscovery is invoked', async () => {
    mockUseKonveyorApplication.mockReturnValue({
      application: null,
      loading: false,
      error: null,
      refetch: mockRefetchApp,
    });

    mockCreateApplication.mockResolvedValueOnce({
      id: 5,
      name: 'sample-service',
    });

    const { result } = renderHook(() =>
      useKonveyorMigration({
        entityName: 'sample-service',
        entityRef: 'component:default/sample-service',
        repoUrl: 'https://github.com/example/sample',
      }),
    );

    await act(async () => {
      await result.current.startDiscovery();
    });

    expect(mockCreateApplication).toHaveBeenCalledWith({
      name: 'sample-service',
      repository: { url: 'https://github.com/example/sample' },
    });
    expect(mockRefetchApp).toHaveBeenCalled();
  });
});
