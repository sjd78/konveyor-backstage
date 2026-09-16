import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(async () => {
    const router = await createRouter({
      logger: mockServices.logger.mock(),
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should return entity YAML for application', async () => {
    const response = await request(app).get(
      '/entity/test-app?repoUrl=https://github.com/example/test',
    );
    expect(response.status).toBe(200);
    expect(response.header['content-type']).toContain('text/yaml');
    expect(response.text).toContain('name: test-app');
    expect(response.text).toContain(
      'mta.konveyor.io/repo-url: https://github.com/example/test',
    );
  });
});
