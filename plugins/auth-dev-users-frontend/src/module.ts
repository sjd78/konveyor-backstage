import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { signInPageExtension } from './extensions';

export const authDevUsersModule = createFrontendModule({
  pluginId: 'app',
  extensions: [signInPageExtension],
});

export default authDevUsersModule;
