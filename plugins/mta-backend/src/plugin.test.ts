import { startTestBackend } from '@backstage/backend-test-utils';
import { mtaPlugin } from './plugin';
import request from 'supertest';

describe('mtaPlugin', () => {
  it('should serve entity YAML', async () => {
    const { server } = await startTestBackend({
      features: [mtaPlugin],
    });

    const res = await request(server)
      .get(
        '/api/mta-backend/entity/test-service?repoUrl=https://github.com/org/repo',
      )
      .expect(200);

    expect(res.text).toContain('name: test-service');
  });
});
