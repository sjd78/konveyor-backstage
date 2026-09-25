import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import {
  authProvidersExtensionPoint,
  createProxyAuthenticator,
  createProxyAuthProviderFactory,
} from '@backstage/plugin-auth-node';

/**
 * Custom auth backend module that replaces the stock guest provider.
 *
 * It reads a `X-User-Entity-Ref` header from the sign-in request so the
 * frontend can choose which catalog user to sign in as. When the header is
 * absent it falls back to the first entry in
 * `auth.providers.guest.users[].userEntityRef` or `user:default/guest`.
 */
export default createBackendModule({
  pluginId: 'auth',
  moduleId: 'dev-user-selector',
  register(reg) {
    reg.registerInit({
      deps: {
        providers: authProvidersExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ providers, config }) {
        const guestConfig = config.getOptionalConfig('auth.providers.guest');
        const usersConfig = guestConfig?.getOptionalConfigArray('users') ?? [];
        const allowedRefs = usersConfig.map(c =>
          c.getString('userEntityRef'),
        );
        const defaultRef =
          allowedRefs[0] ??
          guestConfig?.getOptionalString('userEntityRef') ??
          'user:default/guest';

        providers.registerProvider({
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
