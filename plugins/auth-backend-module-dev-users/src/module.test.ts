import { authModuleDevUsers } from './module';

describe('authModuleDevUsers', () => {
  it('should be created as a backend module', () => {
    expect(authModuleDevUsers).toBeDefined();
    expect(authModuleDevUsers.$$type).toBe('@backstage/BackendFeature');
  });
});
