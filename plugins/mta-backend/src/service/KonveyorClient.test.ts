import { KonveyorClient, KonveyorClientError } from './KonveyorClient';

const response = (body: unknown, status = 200, total?: number) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 404 ? 'Not Found' : 'Hub response',
  headers: new Headers(total === undefined ? {} : { 'x-total': String(total) }),
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const profile = {
  id: 7,
  name: 'Spring Framework 6',
  mode: { withDeps: false },
  scope: { withKnownLibs: false, packages: { included: [], excluded: [] } },
  rules: { targets: [{ id: 3, name: 'Spring Framework' }] },
};

const application = { id: 1, name: 'Foo', tags: null, archetypes: null };

describe('KonveyorClient', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;
  let client: KonveyorClient;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    client = new KonveyorClient({ baseUrl: 'http://konveyor.example.com///' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads all inventory pages using Hub totals and offsets', async () => {
    mockFetch
      .mockResolvedValueOnce(response([{ id: 1, name: 'Foo' }], 200, 2))
      .mockResolvedValueOnce(response([{ id: 2, name: 'Bar' }], 200, 2));

    await expect(client.getApplications()).resolves.toEqual([
      { id: 1, name: 'Foo' },
      { id: 2, name: 'Bar' },
    ]);
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      'http://konveyor.example.com/hub/applications?offset=0&limit=100',
      'http://konveyor.example.com/hub/applications?offset=1&limit=100',
    ]);
  });

  it('passes the configured Hub bearer token', async () => {
    client = new KonveyorClient({
      baseUrl: 'http://konveyor.example.com',
      token: 'secret-token',
    });
    mockFetch.mockResolvedValueOnce(response(application));
    await client.getApplication(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://konveyor.example.com/hub/applications/1',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      }),
    );
  });

  it('creates applications without fabricating task references', async () => {
    mockFetch.mockResolvedValueOnce(response(application, 201));
    await expect(client.createApplication({ name: 'Foo' })).resolves.toEqual(
      application,
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      name: 'Foo',
    });
  });

  it('uses the Hub filter syntax and pages the explicit application task resource', async () => {
    const task = {
      id: 2,
      kind: 'tech-discovery',
      addon: 'analyzer',
      state: 'Succeeded',
      application: { id: 1, name: 'Foo' },
      data: { mode: { discovery: true, withDeps: true } },
    };
    mockFetch
      .mockResolvedValueOnce(response(application))
      .mockResolvedValueOnce(response([task], 200, 1));
    await expect(client.getApplicationTasks(1)).resolves.toEqual([task]);
    expect(mockFetch.mock.calls[1][0]).toBe(
      'http://konveyor.example.com/hub/tasks?filter=application.id%3A1&offset=0&limit=100',
    );
  });

  it('loads effective application profiles and installed target labels', async () => {
    const target = {
      id: 3,
      name: 'Spring Framework',
      labels: [
        { name: 'Spring Framework 6', label: 'konveyor.io/target=spring6' },
      ],
    };
    mockFetch
      .mockResolvedValueOnce(response([profile]))
      .mockResolvedValueOnce(response([target]));
    await expect(client.getAnalysisProfiles(1)).resolves.toEqual([profile]);
    await expect(client.getTargets()).resolves.toEqual([target]);
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      'http://konveyor.example.com/hub/applications/1/analysis/profiles',
      'http://konveyor.example.com/hub/targets',
    ]);
  });

  it('creates, submits, and reloads real profile-based analyzer work', async () => {
    const task = {
      id: 100,
      kind: 'analyzer',
      addon: 'analyzer',
      state: 'Ready',
      application: { id: 1 },
      data: { profile: { id: 7 }, tagger: { enabled: true }, verbosity: 0 },
    };
    mockFetch
      .mockResolvedValueOnce(response([profile]))
      .mockResolvedValueOnce(response({ ...task, state: 'Created' }, 201))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response(task));

    await expect(client.createAnalysisTask(1, 7)).resolves.toEqual(task);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
      name: 'application-1-analyzer',
      kind: 'analyzer',
      addon: 'analyzer',
      application: { id: 1 },
      data: { profile: { id: 7 }, tagger: { enabled: true }, verbosity: 0 },
    });
    expect(mockFetch.mock.calls[2]).toEqual([
      'http://konveyor.example.com/hub/tasks/100/submit',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ id: 100 }),
      }),
    ]);
    expect(mockFetch.mock.calls[3][0]).toBe(
      'http://konveyor.example.com/hub/tasks/100',
    );
  });

  it('does not submit an analysis profile unavailable to the application', async () => {
    mockFetch.mockResolvedValueOnce(response([]));
    await expect(client.createAnalysisTask(1, 7)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('creates and submits a language-discovery task', async () => {
    const task = {
      id: 101,
      kind: 'language-discovery',
      addon: 'language-discovery',
      state: 'Ready',
      application: { id: 1 },
      data: { source: 'language-discovery' },
    };
    mockFetch
      .mockResolvedValueOnce(response(application))
      .mockResolvedValueOnce(response({ ...task, state: 'Created' }, 201))
      .mockResolvedValueOnce(response(undefined, 204))
      .mockResolvedValueOnce(response(task));
    await expect(client.createDiscoveryTask(1)).resolves.toEqual(task);
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({
      name: 'application-1-language-discovery',
      kind: 'language-discovery',
      addon: 'language-discovery',
      application: { id: 1 },
      data: { source: 'language-discovery' },
    });
    expect(mockFetch.mock.calls[2][0]).toBe(
      'http://konveyor.example.com/hub/tasks/101/submit',
    );
  });

  it('selects the latest non-archived analysis from JSON metadata pages', async () => {
    const older = { id: 5, application: { id: 1 }, effort: 2 };
    const latest = { id: 9, application: { id: 1 }, effort: 4 };
    const archived = {
      id: 10,
      application: { id: 1 },
      effort: 6,
      archived: true,
    };
    mockFetch
      .mockResolvedValueOnce(response([archived, older], 200, 3))
      .mockResolvedValueOnce(response([latest], 200, 3));
    await expect(client.getAnalysis(1)).resolves.toEqual(latest);
    expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
      'http://konveyor.example.com/hub/applications/1/analyses?offset=0&limit=100',
      'http://konveyor.example.com/hub/applications/1/analyses?offset=2&limit=100',
    ]);
  });

  it('returns null when only archived analysis metadata exists', async () => {
    mockFetch.mockResolvedValueOnce(
      response([{ id: 5, application: { id: 1 }, effort: 2, archived: true }]),
    );
    await expect(client.getAnalysis(1)).resolves.toBeNull();
  });

  it('returns null analysis only after confirming an empty metadata list belongs to an existing app', async () => {
    mockFetch
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(application));
    await expect(client.getAnalysis(1)).resolves.toBeNull();
    expect(mockFetch.mock.calls[1][0]).toBe(
      'http://konveyor.example.com/hub/applications/1',
    );
  });

  it('preserves missing application errors instead of returning an empty analysis', async () => {
    mockFetch
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ error: 'application not found' }, 404));
    await expect(client.getAnalysis(999)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('does not suppress a missing analysis metadata resource', async () => {
    mockFetch.mockResolvedValueOnce(
      response({ error: 'route not found' }, 404),
    );
    await expect(client.getAnalysis(1)).rejects.toMatchObject({ status: 404 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns no findings only after an insights 404 and verified absence of analysis', async () => {
    mockFetch
      .mockResolvedValueOnce(response({ error: 'record not found' }, 404))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(application));
    await expect(client.getInsights(1)).resolves.toEqual([]);
  });

  it('preserves an insights 404 when analysis metadata exists', async () => {
    mockFetch
      .mockResolvedValueOnce(response({ error: 'insights not found' }, 404))
      .mockResolvedValueOnce(
        response([{ id: 5, application: { id: 1 }, effort: 3 }]),
      );
    await expect(client.getInsights(1)).rejects.toMatchObject({ status: 404 });
  });

  it('preserves missing applications when loading findings', async () => {
    mockFetch
      .mockResolvedValueOnce(response({ error: 'record not found' }, 404))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ error: 'application not found' }, 404));
    await expect(client.getInsights(999)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('keeps real analysis findings, incidents and snippets intact', async () => {
    const incident = {
      id: 40,
      insight: 20,
      file: 'src/App.java',
      line: 12,
      message: 'Replace the API',
      codeSnip: '12 oldCall();',
      facts: {},
    };
    const insight = {
      id: 20,
      analysis: 5,
      ruleset: 'spring6',
      rule: 'spring6-001',
      name: 'Removed API',
      effort: 3,
      category: 'mandatory',
      incidents: [incident],
      links: [{ url: 'https://spring.io' }],
      labels: ['konveyor.io/target=spring6'],
    };
    mockFetch
      .mockResolvedValueOnce(response([insight], 200, 1))
      .mockResolvedValueOnce(response([incident], 200, 1));
    await expect(client.getInsights(1)).resolves.toEqual([insight]);
    await expect(client.getIncidents(20)).resolves.toEqual([incident]);
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://konveyor.example.com/hub/applications/1/analysis/insights?offset=0&limit=100',
    );
    expect(mockFetch.mock.calls[1][0]).toBe(
      'http://konveyor.example.com/hub/analyses/insights/20/incidents?offset=0&limit=100',
    );
  });

  it.each([401, 403])('preserves Hub authorization status %s', async status => {
    mockFetch.mockResolvedValueOnce(
      response({ error: 'Access denied' }, status),
    );
    const result = client.getAnalysis(1);
    await expect(result).rejects.toBeInstanceOf(KonveyorClientError);
    await expect(result).rejects.toMatchObject({ status });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not report a submission failure as successful task creation', async () => {
    mockFetch
      .mockResolvedValueOnce(response([profile]))
      .mockResolvedValueOnce(response({ id: 100, state: 'Created' }, 201))
      .mockResolvedValueOnce(response({ error: 'Forbidden' }, 403));
    await expect(client.createAnalysisTask(1, 7)).rejects.toMatchObject({
      status: 403,
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
