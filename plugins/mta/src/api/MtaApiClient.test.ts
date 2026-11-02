import type { DiscoveryApi } from '@backstage/core-plugin-api';
import { MtaApiClient, MtaApiError } from './MtaApiClient';

describe('MtaApiClient', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;
  let mockDiscoveryApi: jest.Mocked<DiscoveryApi>;
  let client: MtaApiClient;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    mockDiscoveryApi = {
      getBaseUrl: jest
        .fn()
        .mockResolvedValue('http://localhost:7007/api/mta-backend'),
    };

    client = new MtaApiClient(mockDiscoveryApi);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches applications list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, name: 'app-1' }],
    });

    const apps = await client.getApplications();
    expect(apps).toEqual([{ id: 1, name: 'app-1' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('fetches single application by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: 'app-42' }),
    });

    const app = await client.getApplication(42);
    expect(app).toEqual({ id: 42, name: 'app-42' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications/42',
      expect.any(Object),
    );
  });

  it('creates an application via POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 5, name: 'created-app' }),
    });

    const created = await client.createApplication({ name: 'created-app' });
    expect(created).toEqual({ id: 5, name: 'created-app' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'created-app' }),
      }),
    );
  });

  it('fetches archetypes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 10, name: 'Quarkus' }],
    });

    const archetypes = await client.getArchetypes();
    expect(archetypes).toEqual([{ id: 10, name: 'Quarkus' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/archetypes',
      expect.any(Object),
    );
  });

  it('triggers analysis task via POST', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 100,
        kind: 'analyzer',
        state: 'Ready',
        data: { profile: { id: 7 } },
      }),
    });

    const task = await client.triggerAnalysis(1, 7);
    expect(task).toEqual({
      id: 100,
      kind: 'analyzer',
      state: 'Ready',
      data: { profile: { id: 7 } },
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications/1/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ profileId: 7 }),
      }),
    );
  });

  it('fetches task by id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 100, state: 'Running' }),
    });

    const task = await client.getTask(100);
    expect(task).toEqual({ id: 100, state: 'Running' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/tasks/100',
      expect.any(Object),
    );
  });

  it('fetches issues for application', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, name: 'Issue 1' }],
    });

    const issues = await client.getIssues(1);
    expect(issues).toEqual([{ id: 1, name: 'Issue 1' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications/1/issues',
      expect.any(Object),
    );
  });

  it('fetches incidents for insight', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 10, file: 'App.java' }],
    });

    const incidents = await client.getIncidents(1);
    expect(incidents).toEqual([{ id: 10, file: 'App.java' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/insights/1/incidents',
      expect.any(Object),
    );
  });

  it('fetches explicit application task history', async () => {
    const tasks = [
      {
        id: 1,
        kind: 'language-discovery',
        addon: 'language-discovery',
        state: 'Succeeded',
        data: { source: 'language-discovery' },
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => tasks });
    await expect(client.getApplicationTasks(1)).resolves.toEqual(tasks);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:7007/api/mta-backend/applications/1/tasks',
    );
  });

  it('retains null analysis separately from a missing application error', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ error: { status: 404 } }),
      });
    await expect(client.getAnalysis(1)).resolves.toBeNull();
    await expect(client.getAnalysis(999)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('fetches effective analysis profiles and installed targets', async () => {
    const profiles = [
      {
        id: 7,
        name: 'Spring 6',
        mode: { withDeps: false },
        scope: { withKnownLibs: false },
        rules: { targets: [{ id: 3 }] },
      },
    ];
    const targets = [
      {
        id: 3,
        name: 'Spring Framework',
        labels: [{ name: 'Spring 6', label: 'konveyor.io/target=spring6' }],
      },
    ];
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => profiles })
      .mockResolvedValueOnce({ ok: true, json: async () => targets });
    await expect(client.getAnalysisProfiles(1)).resolves.toEqual(profiles);
    await expect(client.getTargets()).resolves.toEqual(targets);
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:7007/api/mta-backend/applications/1/analysis/profiles',
      'http://localhost:7007/api/mta-backend/targets',
    ]);
  });

  it('triggers discovery without inventing local task results', async () => {
    const task = {
      id: 2,
      kind: 'language-discovery',
      addon: 'language-discovery',
      state: 'Ready',
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => task });
    await expect(client.triggerDiscovery(1)).resolves.toEqual(task);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications/1/discover',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each([401, 403])('retains typed authorization status %s', async status => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      statusText: 'Access denied',
      text: async () => 'Hub authorization failed',
    });
    const result = client.getApplication(1);
    await expect(result).rejects.toBeInstanceOf(MtaApiError);
    await expect(result).rejects.toMatchObject({
      status,
      body: 'Hub authorization failed',
    });
  });

  it('throws descriptive error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Database failure',
    });

    await expect(client.getApplication(999)).rejects.toThrow(
      'MTA API request failed [500 Internal Server Error] at /applications/999: Database failure',
    );
  });
});
