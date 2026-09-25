import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import { DevUserSignInPage } from './components/DevUserSignInPage';

export const signInPageExtension = SignInPageBlueprint.make({
  params: {
    loader: async () => DevUserSignInPage,
  },
});
