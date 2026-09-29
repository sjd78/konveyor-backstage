import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import { KonveyorClient, KonveyorClientError } from './service/KonveyorClient';

describe('createRouter', () => {
  let app: express.Express;
  let mockClient: jest.Mocked<
    Pick<
      KonveyorClient,
      | 'getApplications'
      | 'getApplication'
      | 'createApplication'
      | 'getArchetypes'
      | 'createAnalysisTask'
      | 'getTask'
      | 'getInsights'
      | 'getIncidents'
    >
  >;

  beforeEach(async () => {
    mockClient = {
      getApplications: jest.fn(),
      getApplication: jest.fn(),
      createApplication: jest.fn(),
      getArchetypes: jest.fn(),
      createAnalysisTask: jest.fn(),
      getTask: jest.fn(),
      getInsights: jest.fn(),
      getIncidents: jest.fn(),
    };

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      konveyorClient: mockClient as unknown as KonveyorClient,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  describe('GET /applications', () => {
    it('returns applications list', async () => {
      mockClient.getApplications.mockResolvedValueOnce([
        { id: 1, name: 'app-one' },
      ]);
      const res = await request(app).get('/applications');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 1, name: 'app-one' }]);
    });
  });

  describe('GET /applications/:id', () => {
    it('returns application by id', async () => {
      mockClient.getApplication.mockResolvedValueOnce({
        id: 1,
        name: 'app-one',
      });
      const res = await request(app).get('/applications/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 1, name: 'app-one' });
      expect(mockClient.getApplication).toHaveBeenCalledWith(1);
    });

    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/applications/invalid-id');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid application ID');
    });

    it('propagates 404 from KonveyorClient', async () => {
      mockClient.getApplication.mockRejectedValueOnce(
        new KonveyorClientError(404, 'Not Found', '/hub/applications/99', 'App not found'),
      );
      const res = await request(app).get('/applications/99');
      expect(res.status).toBe(404);
      expect(res.body.error.status).toBe(404);
    });
  });

  describe('POST /applications', () => {
    it('creates application and returns 201', async () => {
      mockClient.createApplication.mockResolvedValueOnce({
        id: 5,
        name: 'new-service',
      });
      const res = await request(app)
        .post('/applications')
        .send({ name: 'new-service' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 5, name: 'new-service' });
      expect(mockClient.createApplication).toHaveBeenCalledWith({
        name: 'new-service',
      });
    });
  });

  describe('GET /archetypes', () => {
    it('returns archetypes list', async () => {
      mockClient.getArchetypes.mockResolvedValueOnce([
        { id: 10, name: 'Spring to Quarkus' },
      ]);
      const res = await request(app).get('/archetypes');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 10, name: 'Spring to Quarkus' }]);
    });
  });

  describe('POST /applications/:id/analyze', () => {
    it('triggers analysis task and returns 201', async () => {
      mockClient.createAnalysisTask.mockResolvedValueOnce({
        id: 42,
        addon: 'analyzer',
        state: 'Created',
      });
      const res = await request(app)
        .post('/applications/1/analyze')
        .send({ targets: ['quarkus'] });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 42, addon: 'analyzer', state: 'Created' });
      expect(mockClient.createAnalysisTask).toHaveBeenCalledWith(1, {
        targets: ['quarkus'],
      });
    });

    it('returns 400 for non-numeric application id', async () => {
      const res = await request(app).post('/applications/abc/analyze');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns task status and details', async () => {
      mockClient.getTask.mockResolvedValueOnce({
        id: 42,
        addon: 'analyzer',
        state: 'Running',
      });
      const res = await request(app).get('/tasks/42');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 42, addon: 'analyzer', state: 'Running' });
    });

    it('returns 400 for non-numeric task id', async () => {
      const res = await request(app).get('/tasks/xyz');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /applications/:id/issues', () => {
    it('returns insights list for application', async () => {
      mockClient.getInsights.mockResolvedValueOnce([
        {
          id: 101,
          ruleset: 'quarkus',
          rule: 'rule-1',
          name: 'Deprecated API',
          description: 'Use new API',
          category: 'mandatory',
          effort: 3,
        },
      ]);
      const res = await request(app).get('/applications/1/issues');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Deprecated API');
    });

    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/applications/invalid/issues');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /insights/:id/incidents', () => {
    it('returns incidents list for insight', async () => {
      mockClient.getIncidents.mockResolvedValueOnce([
        {
          id: 501,
          file: 'src/main/App.java',
          line: 12,
          message: 'Found deprecated method',
        },
      ]);
      const res = await request(app).get('/insights/101/incidents');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].file).toBe('src/main/App.java');
    });

    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/insights/invalid/incidents');
      expect(res.status).toBe(400);
    });
  });

  describe('Error propagation', () => {
    it('propagates upstream 500 error status', async () => {
      mockClient.getApplications.mockRejectedValueOnce(
        new KonveyorClientError(500, 'Server Error', '/hub/applications', 'Hub crashed'),
      );
      const res = await request(app).get('/applications');
      expect(res.status).toBe(500);
      expect(res.body.error.status).toBe(500);
    });
  });

  describe('GET /entity/:name', () => {
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
});
