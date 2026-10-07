import { Router } from 'express';
import {
  createBackendModule,
  coreServices,
  AuthService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createProxyAuthenticator,
  createProxyAuthProviderFactory,
  ProxyAuthenticator,
  SignInResolver,
} from '@backstage/plugin-auth-node';
import { CatalogClient } from '@backstage/catalog-client';
import {
  catalogUsersReady,
  getCatalogUserRefs,
  getCatalogUsers,
  warmupCatalogUsers,
} from './users';

/**
 * Custom auth backend module that replaces the stock guest provider.
 *
 * It queries the catalog for all User entities so the dev sign-in page
 * automatically reflects whatever users are registered, without needing
 * to duplicate them in app-config.yaml.
 *
 * It reads a `X-User-Entity-Ref` header from the sign-in request so the
 * frontend can choose which catalog user to sign in as. When the header is
 * absent it falls back to the first catalog user or `user:default/guest`.
 *
 * It also exposes `GET /api/auth/dev-users` (unauthenticated) so the
 * `DevUserSignInPage` frontend can discover the available personas without
 * needing direct access to the catalog.
 */
export const authModuleDevUsers = createBackendModule({
  pluginId: 'auth',
  moduleId: 'dev-users',
  register(reg) {
    reg.registerInit({
      deps: {
        authProviders: authProvidersExtensionPoint,
        httpRouter: coreServices.httpRouter,
        discovery: coreServices.discovery,
        auth: coreServices.auth,
        parentLogger: coreServices.logger,
      },
      async init({ authProviders, httpRouter, discovery, auth, parentLogger }) {
        const logger = parentLogger.child({ module: 'dev-users' });
        const catalogClient = new CatalogClient({ discoveryApi: discovery });

        // Start background warmup — polls the catalog until User entities
        // are ingested, then populates the user cache.
        warmupCatalogUsers({ auth, catalogClient, logger });

        const router = Router();
        router.get('/dev-users', async (_req, res) => {
          // Wait for the warmup to finish so the first request doesn't
          // return fallback users while the catalog is still ingesting.
          await catalogUsersReady;
          const users = await getCatalogUsers({ auth, catalogClient, logger });
          res.json({ users });
        });
        httpRouter.use(router);
        httpRouter.addAuthPolicy({
          path: '/dev-users',
          allow: 'unauthenticated',
        });

        authProviders.registerProvider({
          providerId: 'devUsers',
          factory: createProxyAuthProviderFactory({
            authenticator: usersAuthenticator(auth, catalogClient, logger),
            signInResolver: signInAsCatalogUser(),
          }),
        });

        logger.info('module initialized');
      },
    });
  },
});

function signInAsCatalogUser(): SignInResolver<{ userEntityRef: string; }> | undefined {
  return async (info, ctx) => {
    const userRef = info.result &&
      typeof info.result === 'object' &&
      'userEntityRef' in info.result &&
      typeof info.result.userEntityRef === 'string'
      ? info.result.userEntityRef
      : 'user:default/guest';
    try {
      return await ctx.signInWithCatalogUser({
        entityRef: userRef,
      });
    } catch {
      return ctx.issueToken({
        claims: { sub: userRef, ent: [userRef] },
      });
    }
  };
}

function usersAuthenticator(auth: AuthService, catalogClient: CatalogClient, logger: LoggerService): ProxyAuthenticator<unknown, { userEntityRef: string; }, unknown> {
  return createProxyAuthenticator({
    defaultProfileTransform: async () => ({ profile: {} }),
    initialize() { },
    async authenticate({ req }) {
      const requested = req.header('x-user-entity-ref');

      const refs = await getCatalogUserRefs({ auth, catalogClient, logger });
      const userEntityRef = requested && refs.includes(requested)
        ? requested
        : 'user:default/guest';

      logger.debug(`Authenticating user ${userEntityRef}`);
      return { result: { userEntityRef } };
    },
  });
}

