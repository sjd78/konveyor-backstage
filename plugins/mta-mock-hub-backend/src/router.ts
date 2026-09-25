import { LoggerService } from '@backstage/backend-plugin-api';
import express, { Router } from 'express';
import RouterBuilder from 'express-promise-router';
import yaml from 'js-yaml';
import crypto from 'crypto';

export interface MtaMockApp {
  id: string;
  name: string;
  repoUrl: string;
  rootPath: string;
  status: 'registering' | 'discovered' | 'failed';
  discoveredTags: string[];
  error: string | null;
  errorMessage: string | null;
  registeredAt: string;
}

const DISCOVERY_DELAY_MS = 20000;
const JAVA_EE_TAGS = ['JPA entities', 'Java EE JSON-P'];
const SUPPORT_CONTACT = {
  name: 'Platform Engineering',
  email: 'platform-eng@example.com',
};

const applications = new Map<string, MtaMockApp>();

function sanitizeName(repoUrl: string): string {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.replace(/^\/|\/$/g, '').split('/');
    const lastPart = parts[parts.length - 1] || 'application';
    return lastPart
      .replace(/\.git$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
  } catch {
    return repoUrl.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  }
}

function findByRepoUrl(repoUrl: string): MtaMockApp | null {
  for (const app of applications.values()) {
    if (app.repoUrl === repoUrl) return app;
  }
  return null;
}

function registerApplication(
  repoUrl: string,
  name?: string,
  rootPath?: string,
  logger?: LoggerService,
): MtaMockApp {
  const existing = findByRepoUrl(repoUrl);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const appName = name || sanitizeName(repoUrl);

  const app: MtaMockApp = {
    id,
    name: appName,
    repoUrl,
    rootPath: rootPath || '',
    status: 'registering',
    discoveredTags: [],
    error: null,
    errorMessage: null,
    registeredAt: new Date().toISOString(),
  };

  applications.set(id, app);

  if (repoUrl.includes('access-denied')) {
    app.status = 'failed';
    app.error = 'repo-access-denied';
    app.errorMessage =
      'Repository access denied. The MTA Hub does not have credentials to access this repository. Verify that the repository URL is correct and that the required access tokens have been configured.';
    logger?.info(
      `Application ${appName} (${id}) — simulated repo-access-denied error`,
    );
    return app;
  }

  setTimeout(() => {
    const current = applications.get(id);
    if (!current || current.status !== 'registering') return;

    if (repoUrl.includes('no-archetype')) {
      current.status = 'failed';
      current.error = 'no-archetype-match';
      current.discoveredTags = ['Unknown Framework 1.x', 'Custom Build System'];
      current.errorMessage =
        'Technology discovery completed, but the discovered technologies do not match any configured archetype. Discovered tags: ' +
        current.discoveredTags.join(', ') +
        '.';
      logger?.info(
        `Application ${appName} (${id}) — simulated no-archetype-match error`,
      );
    } else {
      current.status = 'discovered';
      current.discoveredTags = [...JAVA_EE_TAGS];
      logger?.info(
        `Application ${appName} (${id}) — discovery complete, tags: ${current.discoveredTags.join(
          ', ',
        )}`,
      );
    }
  }, DISCOVERY_DELAY_MS).unref();

  return app;
}

export interface RouterOptions {
  logger: LoggerService;
}

export async function createRouter(options: RouterOptions): Promise<Router> {
  const { logger } = options;
  const router = RouterBuilder();

  router.use(express.json());

  // Register a new application
  router.post('/register', (req, res) => {
    const { repoUrl, name, rootPath } = req.body;
    if (!repoUrl || typeof repoUrl !== 'string') {
      res.status(400).json({ error: 'repoUrl is required' });
      return;
    }

    const app = registerApplication(repoUrl.trim(), name, rootPath, logger);
    logger.info(
      `Registered application: ${app.name} (${app.id})${
        app.rootPath ? ` rootPath=${app.rootPath}` : ''
      } — status: ${app.status}`,
    );
    res.status(201).json(app);
  });

  // List all applications
  router.get('/applications', (_req, res) => {
    res.json(Array.from(applications.values()));
  });

  // Get single application
  router.get('/applications/:id', (req, res) => {
    const app = applications.get(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }
    res.json(app);
  });

  // Get support contact configuration
  router.get('/support-contact', (_req, res) => {
    res.json(SUPPORT_CONTACT);
  });

  // Get entity YAML for a specific application
  router.get('/entity/:id', (req, res) => {
    const app = applications.get(req.params.id);
    if (!app) {
      res.status(404).json({ error: 'Application not found' });
      return;
    }

    const annotations: Record<string, string> = {
      'konveyor.io/application-id': app.id,
      'mta.konveyor.io/repo-url': app.repoUrl,
      'backstage.io/source-location': `url:${app.repoUrl}`,
    };

    if (app.rootPath) {
      annotations['mta.konveyor.io/root-path'] = app.rootPath;
    }

    const doc = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: app.name,
        description: `Application managed by MTA — auto-discovered from ${app.repoUrl}`,
        annotations,
        tags:
          app.discoveredTags.length > 0
            ? app.discoveredTags.map(t =>
                t.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              )
            : undefined,
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'user:default/guest',
        system: 'mta-portfolio',
      },
    };

    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(doc, { lineWidth: -1 }));
  });

  return router;
}
