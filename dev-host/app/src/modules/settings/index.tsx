import {
  createFrontendModule,
  SubPageBlueprint,
} from '@backstage/frontend-plugin-api';
import { UserSettingsGeneralWithMta } from './UserSettingsGeneralWithMta';

export const settingsModule = createFrontendModule({
  pluginId: 'user-settings',
  extensions: [
    SubPageBlueprint.make({
      name: 'general',
      params: {
        path: 'general',
        title: 'General',
        loader: async () => <UserSettingsGeneralWithMta />,
      },
    }),
  ],
});
