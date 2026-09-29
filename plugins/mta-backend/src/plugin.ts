import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';

/**
 * mtaPlugin backend plugin
 *
 * @public
 */
export const mtaPlugin = createBackendPlugin({
  pluginId: 'mta-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        rootConfig: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, rootConfig }) {
        const mtaBaseUrl =
          rootConfig.getOptionalString('mta.baseUrl') ??
          process.env.MTA_HUB_BASE_URL ??
          'http://localhost:8080';

        httpRouter.use(
          await createRouter({
            logger,
            mtaBaseUrl,
          }),
        );

        const unauthenticatedPaths = [
          '/entity',
          '/applications',
          '/archetypes',
          '/tasks',
          '/insights',
        ];
        for (const path of unauthenticatedPaths) {
          httpRouter.addAuthPolicy({ path, allow: 'unauthenticated' });
        }
      },
    });
  },
});
