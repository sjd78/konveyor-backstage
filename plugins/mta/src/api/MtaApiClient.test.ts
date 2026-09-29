import type { DiscoveryApi } from '@backstage/core-plugin-api';
import { MtaApiClient } from './MtaApiClient';

describe('MtaApiClient', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;
  let mockDiscoveryApi: jest.Mocked<DiscoveryApi>;
  let client: MtaApiClient;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    mockDiscoveryApi = {
      getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/mta-backend'),
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
      json: async () => ({ id: 100, state: 'Created' }),
    });

    const task = await client.triggerAnalysis(1, ['quarkus']);
    expect(task).toEqual({ id: 100, state: 'Created' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/mta-backend/applications/1/analyze',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ targets: ['quarkus'] }),
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
