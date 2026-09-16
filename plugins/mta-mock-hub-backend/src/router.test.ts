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

  it('should register an application and list applications', async () => {
    const regRes = await request(app)
      .post('/register')
      .send({ repoUrl: 'https://github.com/example/orders' });
    expect(regRes.status).toBe(201);
    expect(regRes.body.name).toBe('orders');

    const listRes = await request(app).get('/applications');
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBeGreaterThan(0);
  });
});
