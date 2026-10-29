import { act, renderHook, waitFor } from '@testing-library/react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useMtaHomeData } from './useMtaHomeData';
import { usePersonaRole } from './usePersonaRole';
import { useMtaApi } from './useKonveyorData';
import type { MtaApi } from '../api';

jest.mock('./usePersonaRole');
jest.mock('./useKonveyorData', () => ({
  ...jest.requireActual('./useKonveyorData'),
  useMtaApi: jest.fn(),
}));
jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: jest.fn(),
}));

const mockUsePersonaRole = usePersonaRole as jest.MockedFunction<
  typeof usePersonaRole
>;
const mockUseMtaApi = useMtaApi as jest.MockedFunction<typeof useMtaApi>;
const mockUseApi = useApi as jest.MockedFunction<typeof useApi>;
const entity = (annotations: Record<string, string> = {}) => ({
  metadata: { name: 'inventory-service', namespace: 'default', annotations },
});

describe('live portfolio data', () => {
  const api = {
    getApplications: jest.fn(),
    getApplicationTasks: jest.fn(),
    getAnalysis: jest.fn(),
    getIssues: jest.fn(),
    getIncidents: jest.fn(),
  };
  const catalogApi = { getEntities: jest.fn() };
  const identityApi = { getBackstageIdentity: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePersonaRole.mockReturnValue({ role: 'architect', loading: false });
    mockUseMtaApi.mockReturnValue(api as unknown as MtaApi);
    mockUseApi.mockImplementation(ref => {
      if (ref === catalogApiRef) return catalogApi;
      if (ref === identityApiRef) return identityApi;
      return {};
    });
    catalogApi.getEntities.mockResolvedValue({
      items: [entity({ 'konveyor.io/application-id': '1' })],
    });
    identityApi.getBackstageIdentity.mockResolvedValue({
      userEntityRef: 'user:default/dev-chen',
    });
    api.getApplications.mockResolvedValue([
      { id: 1, name: 'inventory-service', tags: null, tasks: [12] },
    ]);
    api.getApplicationTasks.mockResolvedValue([
      { id: 12, addon: 'analyzer', kind: 'analyzer', state: 'Succeeded' },
    ]);
    api.getAnalysis.mockResolvedValue({
      id: 7,
      application: { id: 1 },
      effort: 3,
    });
    api.getIssues.mockResolvedValue([
      {
        id: 11,
        analysis: 7,
        name: 'Legacy API',
        rule: 'legacy-1',
        ruleset: 'java',
        category: 'mandatory',
        effort: 3,
      },
    ]);
    api.getIncidents.mockResolvedValue([
      { id: 21, insight: 11, file: 'One.java', line: 1, message: 'Legacy use' },
      { id: 22, insight: 11, file: 'Two.java', line: 2, message: 'Legacy use' },
    ]);
  });

  it('uses actual task and incident reads instead of status/count annotations', async () => {
    catalogApi.getEntities.mockResolvedValue({
      items: [
        entity({
          'konveyor.io/application-id': '1',
          'mta.konveyor.io/status': 'Completed',
          'mta.konveyor.io/issues-count': '42',
          'mta.konveyor.io/critical-issues': '8',
        }),
      ],
    });
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.getApplicationTasks).toHaveBeenCalledWith(1);
    expect(api.getAnalysis).toHaveBeenCalledWith(1);
    expect(result.current.apps[0]).toMatchObject({
      connection: 'connected',
      status: 'Active',
      issuesCount: 2,
      criticalIssues: 2,
    });
  });

  it('does not connect a same-name application without an annotation', async () => {
    catalogApi.getEntities.mockResolvedValue({
      items: [entity({ 'mta.konveyor.io/status': 'Active' })],
    });
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0]).toMatchObject({
      connection: 'disconnected',
    });
    expect(result.current.apps[0].status).toBeUndefined();
    expect(result.current.apps[0].issuesCount).toBeUndefined();
    expect(api.getApplicationTasks).not.toHaveBeenCalled();
  });

  it('does not replace a missing annotated application with a same-name match', async () => {
    catalogApi.getEntities.mockResolvedValue({
      items: [entity({ 'konveyor.io/application-id': '99' })],
    });
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0].connection).toBe('missing');
    expect(api.getAnalysis).not.toHaveBeenCalled();
  });

  it('keeps successful zero-finding analysis active, not completed', async () => {
    api.getIssues.mockResolvedValue([]);
    api.getApplicationTasks.mockResolvedValue([]);
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0]).toMatchObject({
      status: 'Active',
      issuesCount: 0,
      criticalIssues: 0,
    });
  });

  it('does not invent zero findings when a successful task has no persisted analysis', async () => {
    api.getAnalysis.mockResolvedValue(null);
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0].status).toBe('Analysis Unavailable');
    expect(result.current.apps[0].issuesCount).toBeUndefined();
    expect(api.getIssues).not.toHaveBeenCalled();
  });

  it('distinguishes discovery from analysis even with the analyzer addon', async () => {
    api.getAnalysis.mockResolvedValue(null);
    api.getApplicationTasks.mockResolvedValue([
      { id: 12, addon: 'analyzer', kind: 'tech-discovery', state: 'Succeeded' },
    ]);
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0]).toMatchObject({ status: 'Path Selection' });
    expect(result.current.apps[0].issuesCount).toBeUndefined();
    expect(api.getIssues).not.toHaveBeenCalled();
  });

  it('preserves denied incident errors rather than substituting zero findings', async () => {
    api.getIncidents.mockRejectedValue(
      new Error('403 Forbidden /insights/11/incidents'),
    );
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps[0].error?.message).toContain('403 Forbidden');
    expect(result.current.apps[0].issuesCount).toBeUndefined();
  });

  it('fails closed for unknown personas even if an architect view is requested', async () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: false });
    const { result } = renderHook(() => useMtaHomeData('architect'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.apps).toEqual([]);
    expect(catalogApi.getEntities).not.toHaveBeenCalled();
    expect(api.getApplications).not.toHaveBeenCalled();
  });

  it('filters developer inventory by the authenticated user assignment', async () => {
    mockUsePersonaRole.mockReturnValue({ role: 'developer', loading: false });
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(catalogApi.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          kind: 'Component',
          'metadata.annotations.mta.konveyor.io/assigned-developer':
            'user:default/dev-chen',
        },
      }),
    );
  });

  it('refreshes actual Hub findings after a new analysis', async () => {
    const { result } = renderHook(() => useMtaHomeData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.getIssues.mockResolvedValue([]);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.apps[0]?.issuesCount).toBe(0));
    expect(api.getAnalysis).toHaveBeenCalledTimes(2);
  });
});
