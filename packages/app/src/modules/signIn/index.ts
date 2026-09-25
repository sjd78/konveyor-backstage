import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';

/**
 * App module that installs a dev-user sign-in page. Users configured under
 * `auth.providers.guest.users` in app-config are presented as selectable
 * persona cards. The selected persona drives plugin behaviour via the
 * standard Backstage `identityApi`.
 */
export const signInModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: async () =>
          (await import('./DevUserSignInPage')).DevUserSignInPage,
      },
    }),
  ],
});
