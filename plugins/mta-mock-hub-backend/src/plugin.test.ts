import { startTestBackend } from '@backstage/backend-test-utils';
import { mtaMockHubPlugin } from './plugin';
import request from 'supertest';

describe('mtaMockHubPlugin', () => {
  it('should list applications', async () => {
    const { server } = await startTestBackend({
      features: [mtaMockHubPlugin],
    });

    const res = await request(server)
      .get('/api/mta-mock-hub/applications')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
