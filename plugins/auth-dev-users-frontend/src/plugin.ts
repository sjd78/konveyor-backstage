import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { signInPageExtension } from './extensions';

export const authDevUsersPlugin = createFrontendPlugin({
  pluginId: 'auth-dev-users',
  extensions: [signInPageExtension],
});
