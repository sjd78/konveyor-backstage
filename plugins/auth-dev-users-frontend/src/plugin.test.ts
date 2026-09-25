import { authDevUsersModule } from './module';

describe('authDevUsersModule', () => {
  it('should export module for app plugin', () => {
    expect(authDevUsersModule).toBeDefined();
    expect(authDevUsersModule.$$type).toBe('@backstage/FrontendModule');
    expect(authDevUsersModule.pluginId).toBe('app');
  });
});
