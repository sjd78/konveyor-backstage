import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import type { MtaApi } from '../api';
import {
  loadKonveyorIssues,
  useKonveyorApplication,
  useKonveyorIssues,
} from './useKonveyorData';

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: jest.fn(),
}));

const mockUseApi = useApi as jest.MockedFunction<typeof useApi>;
const insight = {
  id: 11,
  analysis: 7,
  name: 'Replace legacy API',
  description: 'The API is no longer supported.',
  category: 'mandatory',
  rule: 'legacy-001',
  ruleset: 'java',
  effort: 3,
  links: [{ title: 'Migration guide', url: 'https://example.org/migrate' }],
};

function createApi() {
  return {
    getApplication: jest.fn().mockResolvedValue({ id: 2, name: 'App B' }),
    getIssues: jest.fn().mockResolvedValue([insight]),
    getIncidents: jest.fn().mockResolvedValue([
      {
        id: 21,
        insight: 11,
        file: 'src/Legacy.java',
        line: 42,
        message: 'Legacy call found',
        codeSnip: 'legacy.call();',
      },
    ]),
  };
}

describe('live findings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves Hub source evidence without fabricating remediation', async () => {
    const api = createApi();
    const { issues } = await loadKonveyorIssues(api as unknown as MtaApi, 1);
    expect(api.getIssues).toHaveBeenCalledWith(1);
    expect(api.getIncidents).toHaveBeenCalledWith(11);
    expect(issues).toEqual([
      {
        id: 'issue-11-21',
        appId: '1',
        severity: 'critical',
        category: 'api-change',
        description: insight.name,
        problem: insight.description,
        effort: 3,
        links: insight.links,
        file: 'src/Legacy.java',
        line: 42,
        message: 'Legacy call found',
        codeSnip: 'legacy.call();',
      },
    ]);
  });

  it('retains a reported rule without inventing a file or line', async () => {
    const api = createApi();
    api.getIncidents.mockResolvedValue([]);
    const { issues } = await loadKonveyorIssues(api as unknown as MtaApi, 1);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBeUndefined();
    expect(issues[0].line).toBeUndefined();
  });

  it('surfaces denied incident reads instead of reporting empty findings', async () => {
    const api = createApi();
    api.getIncidents.mockRejectedValue(
      new Error('403 Forbidden at /insights/11/incidents'),
    );
    mockUseApi.mockReturnValue(api);
    const { result } = renderHook(() => useKonveyorIssues(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toContain('insight 11');
    expect(result.current.error?.message).toContain('403 Forbidden');
    expect(result.current.issues).toEqual([]);
  });

  it('distinguishes a successful empty result from a failed read', async () => {
    const api = createApi();
    api.getIssues.mockResolvedValue([]);
    mockUseApi.mockReturnValue(api);
    const { result } = renderHook(() => useKonveyorIssues(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.issues).toEqual([]);
    expect(api.getIncidents).not.toHaveBeenCalled();
  });

  it('does not show the previous application findings after changing application', async () => {
    const api = createApi();
    let resolveOld!: (value: (typeof insight)[]) => void;
    const promise = new Promise<(typeof insight)[]>(resolve => {
      resolveOld = resolve;
    });
    api.getIssues.mockReturnValueOnce(promise);
    api.getIssues.mockResolvedValue([]);
    mockUseApi.mockReturnValue(api);
    const { result, rerender } = renderHook(
      ({ appId }) => useKonveyorIssues(appId),
      {
        initialProps: { appId: 1 },
      },
    );
    rerender({ appId: 2 });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      resolveOld([insight]);
    });
    expect(result.current.issues).toEqual([]);
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores a late application A %s after application B has loaded',
    async outcome => {
      const api = createApi();
      let resolveOld!: (value: { id: number; name: string }) => void;
      let rejectOld!: (error: Error) => void;
      const oldRequest = new Promise<{ id: number; name: string }>(
        (resolve, reject) => {
          resolveOld = resolve;
          rejectOld = reject;
        },
      );
      api.getApplication.mockReturnValueOnce(oldRequest);
      mockUseApi.mockReturnValue(api);
      const { result, rerender } = renderHook(
        ({ appId }) => useKonveyorApplication(appId),
        { initialProps: { appId: 1 } },
      );
      rerender({ appId: 2 });
      await waitFor(() => expect(result.current.application?.id).toBe(2));
      await act(async () => {
        if (outcome === 'resolve') resolveOld({ id: 1, name: 'App A' });
        else rejectOld(new Error('Application A is unavailable'));
      });
      expect(result.current.application).toEqual({ id: 2, name: 'App B' });
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    },
  );
});
