import { createRegisterApplicationAction, registerApplication } from './module';

const HUB_APP = {
  id: '5a1c2f60-3f5b-4f0e-9d1b-2b1c9c8a7e11',
  name: 'legacy-crm-backend',
  repoUrl: 'https://github.com/acme/legacy-crm-backend',
  status: 'registering',
};

const MOCK_HUB_URL = 'http://localhost:7007/api/mta-mock-hub';

function setup() {
  const logger = { info: jest.fn(), warn: jest.fn() };
  const getBaseUrl = jest.fn().mockResolvedValue(MOCK_HUB_URL);
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(HUB_APP), { status: 201 }));
  return {
    deps: { logger, discovery: { getBaseUrl } },
    logger,
    getBaseUrl,
    fetchMock,
  };
}

function registeredBody(fetchMock: jest.SpyInstance) {
  const [, init] = fetchMock.mock.calls[0];
  return JSON.parse(String(init?.body));
}

describe('registerApplication', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('registers a repository URL and links the Component the provider creates', async () => {
    jest.useFakeTimers();
    const { deps, fetchMock } = setup();

    const registration = registerApplication(
      {
        repoUrl: 'https://github.com/acme/legacy-crm-backend',
        rootPath: 'services/api',
      },
      deps,
    );
    await jest.runAllTimersAsync();
    const result = await registration;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${MOCK_HUB_URL}/register`);
    expect(registeredBody(fetchMock)).toEqual({
      repoUrl: 'https://github.com/acme/legacy-crm-backend',
      rootPath: 'services/api',
    });
    expect(result).toEqual({
      applicationId: HUB_APP.id,
      applicationName: `mta-legacy-crm-backend-${HUB_APP.id}`,
      applicationTitle: HUB_APP.name,
      entityRef: `component:default/mta-legacy-crm-backend-${HUB_APP.id}`,
      entityNamespace: 'default',
      entityName: `mta-legacy-crm-backend-${HUB_APP.id}`,
      autoDiscover: true,
      message: `Application "${HUB_APP.name}" registered successfully.`,
    });
  });

  it('registers the resolved repository of a catalog application and links the existing Component', async () => {
    const { deps, fetchMock } = setup();

    // No catalog sync wait on this path: the Component already exists, so the
    // call resolves without advancing any timer.
    const result = await registerApplication(
      {
        entityRef: 'component:default/legacy-crm-backend',
        repository: 'https://github.com/acme/legacy-crm-backend',
        rootPath: 'services/api',
      },
      deps,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(registeredBody(fetchMock)).toEqual({
      repoUrl: 'https://github.com/acme/legacy-crm-backend',
      rootPath: 'services/api',
    });
    expect(result).toEqual({
      applicationId: HUB_APP.id,
      applicationName: 'legacy-crm-backend',
      applicationTitle: 'legacy-crm-backend',
      entityRef: 'component:default/legacy-crm-backend',
      entityNamespace: 'default',
      entityName: 'legacy-crm-backend',
      autoDiscover: false,
      message: 'Application "legacy-crm-backend" is ready for migration.',
    });
  });

  it('reads the namespace from the catalog application reference', async () => {
    const { deps } = setup();

    const result = await registerApplication(
      {
        entityRef: 'component:payments/legacy-crm-backend',
        repository: 'https://github.com/acme/legacy-crm-backend',
      },
      deps,
    );

    expect(result.entityNamespace).toBe('payments');
    expect(result.entityName).toBe('legacy-crm-backend');
  });

  it('rejects a registration that provides both a catalog application and a repository URL', async () => {
    const { deps, fetchMock } = setup();

    await expect(
      registerApplication(
        {
          entityRef: 'component:default/legacy-crm-backend',
          repoUrl: 'https://github.com/acme/legacy-crm-backend',
          repository: 'https://github.com/acme/legacy-crm-backend',
        },
        deps,
      ),
    ).rejects.toThrow(
      'Provide exactly one of entityRef or repoUrl to register an application.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a registration that provides neither a catalog application nor a repository URL', async () => {
    const { deps, fetchMock } = setup();

    await expect(registerApplication({}, deps)).rejects.toThrow(
      'Provide exactly one of entityRef or repoUrl to register an application.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a catalog application with no resolved repository', async () => {
    const { deps, fetchMock } = setup();

    await expect(
      registerApplication(
        { entityRef: 'component:default/legacy-crm-backend' },
        deps,
      ),
    ).rejects.toThrow(
      'Cannot register "component:default/legacy-crm-backend" with MTA: the application has no Git repository. Add a source location to the catalog application, or register a repository URL instead.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a catalog reference that is not a Component', async () => {
    const { deps, fetchMock } = setup();

    await expect(
      registerApplication(
        {
          entityRef: 'group:default/mta-architects',
          repository: 'https://github.com/acme/legacy-crm-backend',
        },
        deps,
      ),
    ).rejects.toThrow(
      'Only catalog Components can be registered. Received "group".',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a catalog reference that cannot be parsed', async () => {
    const { deps, fetchMock } = setup();

    await expect(
      registerApplication(
        {
          entityRef: 'component:default/',
          repository: 'https://github.com/acme/legacy-crm-backend',
        },
        deps,
      ),
    ).rejects.toThrow(
      'The catalog application reference is not valid: "component:default/".',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a Hub registration failure with the Hub status', async () => {
    const { deps, fetchMock } = setup();
    fetchMock.mockResolvedValue(
      new Response('repository not found', { status: 404 }),
    );

    await expect(
      registerApplication(
        {
          entityRef: 'component:default/legacy-crm-backend',
          repository: 'https://github.com/acme/legacy-crm-backend',
        },
        deps,
      ),
    ).rejects.toThrow('MTA registration failed: 404 — repository not found');
  });
});

describe('createRegisterApplicationAction', () => {
  it('keeps the action id and accepts either onboarding path', () => {
    const { deps } = setup();
    const action = createRegisterApplicationAction(deps);

    expect(action.id).toBe('mta:register-application');
    expect(action.schema?.input?.properties).toEqual(
      expect.objectContaining({
        entityRef: expect.objectContaining({ type: 'string' }),
        repoUrl: expect.objectContaining({ type: 'string' }),
        repository: expect.objectContaining({ type: 'string' }),
        rootPath: expect.objectContaining({ type: 'string' }),
      }),
    );
    expect(action.schema?.input?.required).toBeUndefined();
    expect(action.schema?.output?.properties).toEqual(
      expect.objectContaining({
        applicationId: expect.objectContaining({ type: 'string' }),
        applicationName: expect.objectContaining({ type: 'string' }),
        applicationTitle: expect.objectContaining({ type: 'string' }),
        entityRef: expect.objectContaining({ type: 'string' }),
        entityNamespace: expect.objectContaining({ type: 'string' }),
        entityName: expect.objectContaining({ type: 'string' }),
        autoDiscover: expect.objectContaining({ type: 'boolean' }),
        message: expect.objectContaining({ type: 'string' }),
      }),
    );
  });
});
