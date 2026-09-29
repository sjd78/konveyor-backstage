import { LoggerService } from '@backstage/backend-plugin-api';
import express, { NextFunction, Request, Response, Router } from 'express';
import RouterBuilder from 'express-promise-router';
import yaml from 'js-yaml';
import { KonveyorClient } from './service/KonveyorClient';

export interface RouterOptions {
  logger?: LoggerService;
  konveyorClient?: KonveyorClient;
  mtaBaseUrl?: string;
}

export async function createRouter(options: RouterOptions): Promise<Router> {
  const { logger, konveyorClient, mtaBaseUrl } = options;
  const client =
    konveyorClient ??
    new KonveyorClient({
      baseUrl: mtaBaseUrl ?? 'http://localhost:8080',
      logger,
    });

  const router = RouterBuilder();
  router.use(express.json());

  router.get('/applications', async (_req: Request, res: Response) => {
    const apps = await client.getApplications();
    res.json(apps);
  });

  router.get('/applications/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: { message: 'Invalid application ID', status: 400 } });
      return;
    }
    const app = await client.getApplication(id);
    res.json(app);
  });

  router.post('/applications', async (req: Request, res: Response) => {
    const app = await client.createApplication(req.body);
    res.status(201).json(app);
  });

  router.get('/archetypes', async (_req: Request, res: Response) => {
    const archetypes = await client.getArchetypes();
    res.json(archetypes);
  });

  router.post('/applications/:id/analyze', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: { message: 'Invalid application ID', status: 400 } });
      return;
    }
    const task = await client.createAnalysisTask(id, req.body);
    res.status(201).json(task);
  });

  router.get('/tasks/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: { message: 'Invalid task ID', status: 400 } });
      return;
    }
    const task = await client.getTask(id);
    res.json(task);
  });

  router.get('/applications/:id/issues', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: { message: 'Invalid application ID', status: 400 } });
      return;
    }
    const issues = await client.getInsights(id);
    res.json(issues);
  });

  router.get('/insights/:id/incidents', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: { message: 'Invalid insight ID', status: 400 } });
      return;
    }
    const incidents = await client.getIncidents(id);
    res.json(incidents);
  });

  router.get('/entity/:name', (req: Request, res: Response) => {
    const { name } = req.params;
    const description =
      typeof req.query.description === 'string'
        ? req.query.description
        : 'Application managed by MTA';
    const type =
      typeof req.query.type === 'string' ? req.query.type : 'service';
    const lifecycle =
      typeof req.query.lifecycle === 'string'
        ? req.query.lifecycle
        : 'production';
    const owner =
      typeof req.query.owner === 'string'
        ? req.query.owner
        : 'user:default/guest';
    const system =
      typeof req.query.system === 'string'
        ? req.query.system
        : 'mta-portfolio';
    const repoUrl =
      typeof req.query.repoUrl === 'string' ? req.query.repoUrl : '';
    const tags =
      typeof req.query.tags === 'string'
        ? req.query.tags.split(',').filter(Boolean)
        : [];

    const annotations: Record<string, string> = {};
    if (repoUrl) {
      annotations['mta.konveyor.io/repo-url'] = repoUrl;
      annotations['backstage.io/source-location'] = `url:${repoUrl}`;
    }

    const doc = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name,
        description,
        ...(Object.keys(annotations).length > 0 ? { annotations } : {}),
        ...(tags.length > 0 ? { tags } : {}),
        labels: {
          'mta/migration-status': 'Not-Started',
        },
      },
      spec: {
        type,
        lifecycle,
        owner,
        system,
      },
    };

    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(doc, { lineWidth: -1 }));
  });

  router.use(
    (err: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (res.headersSent) {
        return next(err);
      }
      const errObj =
        typeof err === 'object' && err !== null
          ? (err as Record<string, unknown>)
          : undefined;
      const status =
        typeof errObj?.status === 'number' &&
        errObj.status >= 400 &&
        errObj.status < 600
          ? errObj.status
          : 500;
      const message =
        typeof errObj?.message === 'string'
          ? errObj.message
          : 'Internal server error';
      return res.status(status).json({
        error: {
          message,
          status,
        },
      });
    },
  );

  return router;
}
