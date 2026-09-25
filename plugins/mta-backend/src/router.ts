import { LoggerService } from '@backstage/backend-plugin-api';
import express, { Router } from 'express';
import RouterBuilder from 'express-promise-router';
import yaml from 'js-yaml';

export interface RouterOptions {
  logger?: LoggerService;
}

function stringOrDefault(value: unknown, defaultValue: string): string {
  return typeof value === 'string' ? value : defaultValue;
}

export async function createRouter(_options: RouterOptions): Promise<Router> {
  const router = RouterBuilder();
  router.use(express.json());

  router.get('/entity/:name', (req, res) => {
    const { name } = req.params;
    const description = stringOrDefault(req.query.description, 'Application managed by MTA');
    const type = stringOrDefault(req.query.type, 'service');
    const lifecycle = stringOrDefault(req.query.lifecycle, 'production');
    const owner = stringOrDefault(req.query.owner, 'user:default/guest');
    const system = stringOrDefault(req.query.system, 'mta-portfolio');
    const repoUrl = stringOrDefault(req.query.repoUrl, '');
    const tags = stringOrDefault(req.query.tags, '').split(',').filter(Boolean);

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
