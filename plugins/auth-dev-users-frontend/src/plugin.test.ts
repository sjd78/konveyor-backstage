import { authDevUsersPlugin } from './plugin';

describe('authDevUsersPlugin', () => {
  it('should export plugin', () => {
    expect(authDevUsersPlugin).toBeDefined();
    expect(authDevUsersPlugin.id).toBe('auth-dev-users');
  });
});
