import { Router } from 'express';
import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createProxyAuthenticator,
  createProxyAuthProviderFactory,
} from '@backstage/plugin-auth-node';

/** A preconfigured catalog user that can be selected from the dev sign-in page. */
interface DevUser {
  userEntityRef: string;
  displayName: string;
}

/**
 * Custom auth backend module that replaces the stock guest provider.
 *
 * It reads a `X-User-Entity-Ref` header from the sign-in request so the
 * frontend can choose which catalog user to sign in as. When the header is
 * absent it falls back to the first entry in
 * `auth.providers.guest.users[].userEntityRef` or `user:default/guest`.
 *
 * It also exposes `GET /api/auth/dev-users` (unauthenticated) so the
 * `DevUserSignInPage` frontend can discover the configured personas without
 * needing direct access to backend-only config.
 */
export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'dev-user-auth',
  register(reg) {
    reg.registerInit({
      deps: {
        authProviders: authProvidersExtensionPoint,
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
        parentLogger: coreServices.logger,
      },
      async init({ authProviders, httpRouter, config, parentLogger }) {
        const logger = parentLogger.child({ module: 'dev-user-auth' });

        const guestConfig = config.getOptionalConfig('auth.providers.guest');
        const usersConfig = guestConfig?.getOptionalConfigArray('users') ?? [];
        const allowedRefs = usersConfig.map(c =>
          c.getString('userEntityRef'),
        );
        const defaultRef =
          allowedRefs[0] ??
          guestConfig?.getOptionalString('userEntityRef') ??
          'user:default/guest';

        const devUsers: DevUser[] =
          usersConfig.length > 0
            ? usersConfig.map(c => ({
                userEntityRef: c.getString('userEntityRef'),
                displayName:
                  c.getOptionalString('displayName') ??
                  c.getString('userEntityRef'),
              }))
            : [{ userEntityRef: defaultRef, displayName: 'Guest' }];

        logger.info(`userConfigs=${JSON.stringify(usersConfig.map(c => c.get()))}`);
        logger.info(`allowedRefs=${JSON.stringify(allowedRefs)}`);
        logger.info(`defaultRef="${defaultRef}"`);

        const router = Router();
        router.get('/dev-users', (_req, res) => {
          res.json({ users: devUsers });
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/dev-users',
          allow: 'unauthenticated',
        });

        authProviders.registerProvider({
          providerId: 'guest',
          factory: createProxyAuthProviderFactory({
            authenticator: createProxyAuthenticator({
              defaultProfileTransform: async () => ({ profile: {} }),
              initialize() {},
              async authenticate({ req }) {
                const requested = req.header('x-user-entity-ref');
                const userEntityRef =
                  requested && allowedRefs.includes(requested)
                    ? requested
                    : defaultRef;
                return { result: { userEntityRef } };
              },
            }),
            signInResolver: async (info, ctx) => {
              const userRef =
                (info.result as { userEntityRef?: string }).userEntityRef ??
                defaultRef;
              try {
                return await ctx.signInWithCatalogUser({
                  entityRef: userRef,
                });
              } catch {
                return ctx.issueToken({
                  claims: { sub: userRef, ent: [userRef] },
                });
              }
            },
          }),
        });
      },
    });
  },
});
