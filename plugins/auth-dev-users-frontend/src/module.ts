import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { DevUserSignInPage } from './components/DevUserSignInPage';

export const authDevUsersModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () => DevUserSignInPage,
      },
    }),
  ],
});

export default authDevUsersModule;
