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
      },
      async init({ httpRouter, logger }) {
        httpRouter.use(
          await createRouter({
            logger,
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/entity',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
