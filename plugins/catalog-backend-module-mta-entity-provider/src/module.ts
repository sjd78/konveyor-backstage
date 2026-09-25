import {
  coreServices,
  createBackendModule,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  catalogProcessingExtensionPoint,
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { ComponentEntity } from '@backstage/catalog-model';

const POLL_INTERVAL_SECONDS = 10;

interface MtaApp {
  id: string;
  name: string;
  repoUrl: string;
  rootPath?: string;
  status: 'registering' | 'discovered' | 'failed';
  discoveredTags?: string[];
  error?: string | null;
  errorMessage?: string | null;
}

function catalogName(app: MtaApp): string {
  const prefix =
    app.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 22) || 'application';
  return `mta-${prefix}-${app.id}`;
}

const statusByHubStatus: Record<MtaApp['status'], string> = {
  registering: 'Discovery',
  discovered: 'Path Selection',
  failed: 'Failed',
};

function appToEntity(app: MtaApp): ComponentEntity {
  const annotations: Record<string, string> = {
    'konveyor.io/application-id': app.id,
    'mta.konveyor.io/repo-url': app.repoUrl,
    'mta.konveyor.io/assigned-developer': 'user:default/dev-chen',
    'mta.konveyor.io/status': statusByHubStatus[app.status],
    'backstage.io/source-location': `url:${app.repoUrl}`,
    'backstage.io/managed-by-location': `mta-entity-provider:${app.id}`,
    'backstage.io/managed-by-origin-location': `mta-entity-provider:${app.id}`,
  };

  if (app.discoveredTags && app.discoveredTags.length > 0) {
    annotations['mta.konveyor.io/discovered-tags'] = JSON.stringify(
      app.discoveredTags,
    );
  }

  if (app.rootPath) {
    annotations['mta.konveyor.io/root-path'] = app.rootPath;
  }

  if (app.error) {
    annotations['mta.konveyor.io/error'] = app.error;
  }
  if (app.errorMessage) {
    annotations['mta.konveyor.io/error-message'] = app.errorMessage;
  }

  const tags =
    app.discoveredTags && app.discoveredTags.length > 0
      ? app.discoveredTags.map(t => t.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
      : undefined;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: catalogName(app),
      title: app.name,
      description: `Application managed by MTA — auto-discovered from ${app.repoUrl}`,
      annotations,
      tags,
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'group:default/mta-architects',
      system: 'mta-portfolio',
    },
  };
}

export class MtaEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private mockHubBaseUrl?: string;

  constructor(
    private readonly logger: LoggerService,
    private readonly discovery: DiscoveryService,
  ) {}

  getProviderName(): string {
    return 'mta-entity-provider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async poll(): Promise<void> {
    if (!this.connection) return;

    try {
      if (!this.mockHubBaseUrl) {
        this.mockHubBaseUrl = await this.discovery.getBaseUrl('mta-mock-hub');
      }

      const response = await fetch(`${this.mockHubBaseUrl}/applications`);
      if (!response.ok) {
        this.logger.warn(
          `MTA Entity Provider: failed to fetch applications — ${response.status}`,
        );
        return;
      }

      const apps = (await response.json()) as MtaApp[];

      const entities = apps.map(app => ({
        entity: appToEntity(app),
        locationKey: `mta-entity-provider:${app.id}`,
      }));

      if (entities.length === 0) return;

      await this.connection.applyMutation({
        type: 'full',
        entities,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`MTA Entity Provider: poll error — ${message}`);
    }
  }
}

export const catalogModuleMtaEntityProvider = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'mta-entity-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        discovery: coreServices.discovery,
      },
      async init({ catalog, logger, scheduler, discovery }) {
        logger.info('MTA Entity Provider module initializing');

        const provider = new MtaEntityProvider(logger, discovery);
        catalog.addEntityProvider(provider);

        logger.info(
          `MTA Entity Provider registered — polling every ${POLL_INTERVAL_SECONDS}s`,
        );

        await scheduler.scheduleTask({
          id: 'mta-entity-provider-poll',
          frequency: { seconds: POLL_INTERVAL_SECONDS },
          timeout: { seconds: 30 },
          fn: () => provider.poll(),
        });
      },
    });
  },
});
