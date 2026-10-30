import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import mtaPlugin from '@internal/backstage-plugin-mta';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { settingsModule } from './modules/settings';
import authDevUsersModule from '@internal/backstage-plugin-auth-dev-users-frontend';

export default createApp({
  features: [
    catalogPlugin,
    mtaPlugin,
    navModule,
    homeModule,
    settingsModule,
    authDevUsersModule,
  ],
});
