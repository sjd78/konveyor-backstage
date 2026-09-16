import { LoggerService } from '@backstage/backend-plugin-api';
import express, { Router } from 'express';
import RouterBuilder from 'express-promise-router';
import yaml from 'js-yaml';

export interface RouterOptions {
  logger?: LoggerService;
}

export async function createRouter(_options: RouterOptions): Promise<Router> {
  const router = RouterBuilder();
  router.use(express.json());

  router.get('/entity/:name', (req, res) => {
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

  return router;
}
