import { AuthService, LoggerService } from "@backstage/backend-plugin-api";
import { CatalogClient } from "@backstage/catalog-client";
import { stringifyEntityRef, parseEntityRef, type UserEntity, type GroupEntity } from '@backstage/catalog-model';
import { DevUser, DevUserGroup } from "./types";
import { inspect } from "node:util";

const FALLBACK_USERS: DevUser[] = [
  { userEntityRef: 'user:default/guest', displayName: 'Guest' },
];

const CACHE_TTL_MS = 30_000;

/** Max attempts when warming the cache at startup */
const WARMUP_MAX_ATTEMPTS = 30;
/** Delay between warmup retries */
const WARMUP_RETRY_MS = 2_000;

let cachedUsers: DevUser[] | undefined;
let cacheExpiry = 0;

let warmupResolve: (() => void) | undefined;

/**
 * Promise that resolves once the catalog user cache has been warmed
 * (i.e. at least one successful fetch returned real users), or when
 * the warmup gives up after max retries.
 */
export const catalogUsersReady: Promise<void> = new Promise(resolve => {
  warmupResolve = resolve;
});

/**
 * Starts a background loop that polls the catalog until User entities
 * are available, then warms the cache and resolves `catalogUsersReady`.
 *
 * Call this once during module init — callers that need users (e.g. the
 * `/dev-users` endpoint) should `await catalogUsersReady` first.
 */
export async function warmupCatalogUsers(opts: {
  auth: AuthService;
  catalogClient: CatalogClient;
  logger: LoggerService;
}): Promise<void> {
  const { logger } = opts;

  for (let attempt = 1; attempt <= WARMUP_MAX_ATTEMPTS; attempt++) {
    await getCatalogUsers(opts);
    if (cachedUsers && cachedUsers.length > 0) {
      logger.info(
        `Catalog user cache warmed with ${cachedUsers.length} user(s) after ${attempt} attempt(s)`,
      );
      warmupResolve?.();
      return;
    }
    logger.debug(
      `Warmup: catalog users not yet available, retrying in ${WARMUP_RETRY_MS}ms (attempt ${attempt}/${WARMUP_MAX_ATTEMPTS})`,
    );
    await new Promise(r => setTimeout(r, WARMUP_RETRY_MS));
  }

  logger.warn(
    'Warmup: catalog users not available after max retries; requests will use fallback users until the catalog is ready',
  );
  warmupResolve?.();
}

export async function getCatalogUsers({ auth, catalogClient, logger }: { auth: AuthService, catalogClient: CatalogClient, logger: LoggerService }): Promise<DevUser[]> {
  const now = Date.now();
  if (cachedUsers && now < cacheExpiry) {
    return cachedUsers;
  }

  try {
    logger.debug('Getting catalog users');
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: await auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    const [userResponse, groupResponse] = await Promise.all([
      catalogClient.getEntities(
        {
          filter: { kind: 'User' },
          fields: [
            'kind',
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'spec.profile',
            'spec.memberOf',
          ],
        },
        { token },
      ),
      catalogClient.getEntities(
        {
          filter: { kind: 'Group' },
          fields: [
            'kind',
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'spec.profile',
          ],
        },
        { token },
      ),
    ]);
    logger.debug(`Users found in the catalog: ${inspect(userResponse, { depth: 4 })}`);

    const groupDisplayNames = new Map<string, string>();
    for (const entity of groupResponse.items) {
      const group = entity as GroupEntity;
      const ref = stringifyEntityRef(group);
      const profile = group.spec?.profile as Record<string, unknown> | undefined;
      const displayName =
        (typeof profile?.displayName === 'string' && profile.displayName) ||
        group.metadata?.title ||
        group.metadata?.name ||
        ref;
      groupDisplayNames.set(ref, String(displayName));
    }

    const users: DevUser[] = userResponse.items.map(entity => {
      const user = entity as UserEntity;
      const ref = stringifyEntityRef(user);
      const displayName =
        user.spec?.profile?.displayName ||
        user.metadata?.title ||
        user.metadata?.name ||
        ref;

      const memberOf: DevUserGroup[] | undefined = user.spec?.memberOf?.map(rawRef => {
        const parsed = parseEntityRef(rawRef, { defaultKind: 'Group', defaultNamespace: user.metadata?.namespace ?? 'default' });
        const groupRef = stringifyEntityRef(parsed);
        return {
          groupEntityRef: groupRef,
          displayName: groupDisplayNames.get(groupRef) ?? parsed.name,
        };
      });

      return { userEntityRef: ref, displayName, memberOf };
    });
    logger.debug(`Users loaded from catalog: ${users.map(user => user.displayName).join(', ')}`);

    if (users.length > 0) {
      cachedUsers = users;
      cacheExpiry = now + CACHE_TTL_MS;
      logger.info(`Loaded ${users.length} user(s) from catalog`);
      return users;
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(
      `Failed to fetch users from catalog, using fallback: ${err}`, error
    );
  }

  return cachedUsers ?? FALLBACK_USERS;
}

export async function getCatalogUserRefs({ auth, catalogClient, logger }: { auth: AuthService, catalogClient: CatalogClient, logger: LoggerService }): Promise<string[]> {
  const users = await getCatalogUsers({ auth, catalogClient, logger });
  const refs = users.map(user => user.userEntityRef);
  if (refs.length === 0) {
    logger.warn('No user refs found in the catalog');
    return FALLBACK_USERS.map(user => user.userEntityRef);
  }
  return refs;
}
