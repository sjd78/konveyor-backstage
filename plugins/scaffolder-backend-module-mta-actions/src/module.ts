import {
  coreServices,
  createBackendModule,
  type DiscoveryService,
} from '@backstage/backend-plugin-api';
import {
  createTemplateAction,
  type TemplateAction,
} from '@backstage/plugin-scaffolder-node';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';

const CATALOG_SYNC_WAIT_MS = 12000;

/**
 * The namespace the catalog applies to an entity that omits one. The MTA entity
 * provider builds Component entities without metadata.namespace, so this is the
 * namespace of every Component it writes, and it is the namespace an entity
 * reference without one resolves to.
 */
const DEFAULT_CATALOG_NAMESPACE = 'default';

interface RegisterAppResponse {
  id: string;
  name: string;
  repoUrl: string;
  rootPath?: string;
  status: string;
}

/** The registration inputs the template forwards for either onboarding path. */
export type RegisterApplicationInput = {
  entityRef?: string;
  repoUrl?: string;
  repository?: string;
  rootPath?: string;
};

/** The registration result the template reads back. */
type RegisterApplicationOutput = {
  applicationId: string;
  applicationName: string;
  applicationTitle: string;
  entityRef: string;
  entityNamespace: string;
  entityName: string;
  autoDiscover: boolean;
  message: string;
};

/** The backend services a registration needs, without the scaffolder plumbing. */
interface RegisterApplicationDeps {
  logger: {
    info(message: string): void;
    warn(message: string): void;
  };
  discovery: Pick<DiscoveryService, 'getBaseUrl'>;
}

interface EntityRefParts {
  kind: string;
  namespace: string;
  name: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

function readString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Read `[kind:]namespace/name`, `[kind:]name` and `name` the way the catalog
 * resolves an entity reference: an omitted kind is a Component and an omitted
 * namespace is the default one. Returns undefined for anything else.
 */
function parseEntityRef(entityRef: string): EntityRefParts | undefined {
  const match = /^(?:([^:/\s]+):)?(?:([^:/\s]+)\/)?([^:/\s]+)$/.exec(entityRef);
  if (!match) {
    return undefined;
  }
  const [, kind = 'component', namespace = DEFAULT_CATALOG_NAMESPACE, name] =
    match;
  return { kind: kind.toLowerCase(), namespace, name };
}

/**
 * The catalog name the entity provider derives for a Hub application. It must
 * stay in step with `catalogName` in the MTA entity provider module, because
 * the template links to the entity that provider writes.
 */
function catalogName(app: RegisterAppResponse): string {
  const prefix =
    app.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 22) || 'application';
  return `mta-${prefix}-${app.id}`;
}

async function registerWithHub(
  deps: RegisterApplicationDeps,
  repoUrl: string,
  rootPath: string | undefined,
): Promise<RegisterAppResponse> {
  let mockHubUrl: string;
  try {
    mockHubUrl = await deps.discovery.getBaseUrl('mta-mock-hub');
  } catch {
    mockHubUrl = 'http://localhost:7007/api/mta-mock-hub';
    deps.logger.warn(
      `Could not resolve mta-mock-hub URL, using fallback: ${mockHubUrl}`,
    );
  }

  deps.logger.info(`Registering application with MTA Hub: ${repoUrl}`);
  const body: { repoUrl: string; rootPath?: string } = { repoUrl };
  if (rootPath) {
    body.rootPath = rootPath;
  }

  const response = await fetch(`${mockHubUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `MTA registration failed: ${response.status} — ${errorText}`,
    );
  }

  return (await response.json()) as RegisterAppResponse;
}

/**
 * The catalog path: the Component is already in the catalog and the field
 * resolved its repository, so only the repository is registered with the Hub.
 */
async function registerCatalogApplication(
  entityRef: string,
  repository: string | undefined,
  rootPath: string | undefined,
  deps: RegisterApplicationDeps,
): Promise<RegisterApplicationOutput> {
  const parsed = parseEntityRef(entityRef);
  if (!parsed) {
    throw new Error(
      `The catalog application reference is not valid: "${entityRef}".`,
    );
  }
  if (parsed.kind !== 'component') {
    throw new Error(
      `Only catalog Components can be registered. Received "${parsed.kind}".`,
    );
  }
  if (!repository) {
    throw new Error(
      `Cannot register "${entityRef}" with MTA: the application has no Git repository. Add a source location to the catalog application, or register a repository URL instead.`,
    );
  }

  deps.logger.info(
    `Catalog application ${entityRef} is already in the Software Catalog.`,
  );
  const app = await registerWithHub(deps, repository, rootPath);
  deps.logger.info(`Application registered: ${app.name} (${app.id})`);
  deps.logger.info(
    'This step does not change the catalog application or its konveyor.io/application-id annotation.',
  );

  // The Component already exists, so the member is not waiting for an entity to
  // appear and the step does not wait for a catalog sync.
  return {
    applicationId: app.id,
    applicationName: parsed.name,
    applicationTitle: parsed.name,
    entityRef,
    entityNamespace: parsed.namespace,
    entityName: parsed.name,
    autoDiscover: false,
    message: `Application "${parsed.name}" is ready for migration.`,
  };
}

/**
 * The repository path: register the repository, then wait for the entity
 * provider to sync the new Component into the catalog.
 */
async function registerRepositoryApplication(
  repoUrl: string,
  rootPath: string | undefined,
  deps: RegisterApplicationDeps,
): Promise<RegisterApplicationOutput> {
  const app = await registerWithHub(deps, repoUrl, rootPath);
  deps.logger.info(`Application registered: ${app.name} (${app.id})`);

  deps.logger.info('Waiting for catalog sync...');
  await sleep(CATALOG_SYNC_WAIT_MS);
  deps.logger.info(
    'Catalog sync wait complete. Application should now be visible in the Software Catalog.',
  );

  const entityName = catalogName(app);
  return {
    applicationId: app.id,
    applicationName: entityName,
    applicationTitle: app.name,
    entityRef: `component:${DEFAULT_CATALOG_NAMESPACE}/${entityName}`,
    entityNamespace: DEFAULT_CATALOG_NAMESPACE,
    entityName,
    autoDiscover: true,
    message: `Application "${app.name}" registered successfully.`,
  };
}

/**
 * Register one application for migration. The member either picks an existing
 * catalog Component, whose repository URL the form resolved, or enters a
 * repository URL directly; both paths register a repository with the MTA Hub.
 */
export async function registerApplication(
  input: RegisterApplicationInput,
  deps: RegisterApplicationDeps,
): Promise<RegisterApplicationOutput> {
  const entityRef = readString(input.entityRef);
  const repoUrl = readString(input.repoUrl);
  const repository = readString(input.repository);
  const rootPath = readString(input.rootPath);

  if (entityRef && !repoUrl) {
    return registerCatalogApplication(entityRef, repository, rootPath, deps);
  }
  if (repoUrl && !entityRef) {
    return registerRepositoryApplication(repoUrl, rootPath, deps);
  }
  throw new Error(
    'Provide exactly one of entityRef or repoUrl to register an application.',
  );
}

export function createRegisterApplicationAction(
  deps: RegisterApplicationDeps,
): TemplateAction<RegisterApplicationInput, RegisterApplicationOutput> {
  return createTemplateAction<
    RegisterApplicationInput,
    RegisterApplicationOutput
  >({
    id: 'mta:register-application',
    description:
      'Register a catalog application or a Git repository for migration with the Migration Toolkit for Applications',
    schema: {
      input: {
        type: 'object',
        properties: {
          entityRef: {
            type: 'string',
            title: 'Catalog Application',
            description:
              'Entity reference of a catalog Component. Provide this or repoUrl, not both.',
          },
          repoUrl: {
            type: 'string',
            title: 'Repository URL',
            description:
              'The Git repository URL of the application. Provide this or entityRef, not both.',
          },
          repository: {
            type: 'string',
            title: 'Resolved Repository URL',
            description:
              'Clone URL resolved from the selected catalog application',
          },
          rootPath: {
            type: 'string',
            title: 'Application Root Path',
            description:
              'Optional path within the repository to the application root directory',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          applicationId: {
            type: 'string',
            title: 'Application ID',
          },
          applicationName: {
            type: 'string',
            title: 'Application Name',
          },
          applicationTitle: {
            type: 'string',
            title: 'Application Display Name',
          },
          entityRef: {
            type: 'string',
            title: 'Entity Reference',
          },
          entityNamespace: {
            type: 'string',
            title: 'Entity Namespace',
          },
          entityName: {
            type: 'string',
            title: 'Entity Name',
          },
          autoDiscover: {
            type: 'boolean',
            title: 'Start Discovery',
          },
          message: {
            type: 'string',
            title: 'Result Message',
          },
        },
      },
    },
    async handler(ctx) {
      const result = await registerApplication(ctx.input, deps);
      ctx.output('applicationId', result.applicationId);
      ctx.output('applicationName', result.applicationName);
      ctx.output('applicationTitle', result.applicationTitle);
      ctx.output('entityRef', result.entityRef);
      ctx.output('entityNamespace', result.entityNamespace);
      ctx.output('entityName', result.entityName);
      ctx.output('autoDiscover', result.autoDiscover);
      ctx.output('message', result.message);
    },
  });
}

export const scaffolderModuleMtaActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'mta-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        logger: coreServices.logger,
        discovery: coreServices.discovery,
      },
      async init({ scaffolder, logger, discovery }) {
        logger.info(
          'MTA Scaffolder Actions: registering mta:register-application',
        );

        scaffolder.addActions(
          createRegisterApplicationAction({ logger, discovery }),
        );
      },
    });
  },
});
