import { mockServices } from '@backstage/backend-test-utils';
import { KonveyorClient, KonveyorClientError } from './KonveyorClient';

describe('KonveyorClient', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes baseUrl and fetches applications', async () => {
    const client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com///',
      logger: mockServices.logger.mock(),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ id: 1, name: 'app-1' }],
    });

    const apps = await client.getApplications();
    expect(apps).toEqual([{ id: 1, name: 'app-1' }]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://konveyor.example.com/hub/applications',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('includes bearer token when provided', async () => {
    const client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com',
      token: 'secret-token',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, name: 'app-42' }),
    });

    await client.getApplication(42);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://konveyor.example.com/hub/applications/42',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      }),
    );
  });

  it('creates an application via POST', async () => {
    const client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 2, name: 'new-app' }),
    });

    const created = await client.createApplication({ name: 'new-app' });
    expect(created).toEqual({ id: 2, name: 'new-app' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://konveyor.example.com/hub/applications',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'new-app' }),
      }),
    );
  });

  it('triggers analysis task with default analyzer config', async () => {
    const client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com',
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 100, addon: 'analyzer', state: 'Created' }),
    });

    const task = await client.createAnalysisTask(1, {
      targets: ['cloud-readiness', 'quarkus'],
      sources: ['java'],
    });

    expect(task.id).toBe(100);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://konveyor.example.com/hub/tasks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          addon: 'analyzer',
          application: { id: 1 },
          data: {
            targets: ['cloud-readiness', 'quarkus'],
            sources: ['java'],
            mode: {
              binary: false,
              withDeps: true,
            },
          },
        }),
      }),
    );
  });

  it('throws KonveyorClientError with status and text on failure', async () => {
    const client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com',
      logger: mockServices.logger.mock(),
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Application not found',
    });

    await expect(client.getApplication(999)).rejects.toThrow(
      KonveyorClientError,
    );
  });
});
