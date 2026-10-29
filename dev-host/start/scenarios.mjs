import { createApplication, hubOrigin, listApplications } from './hub.mjs';
import {
  connectedComponents,
  loadSeeds,
  unconnectedComponents,
} from './catalog.mjs';

const sameRepository = (a = {}, b = {}) =>
  (a.url ?? '') === (b.url ?? '') &&
  (a.branch ?? '') === (b.branch ?? '') &&
  (a.path ?? '') === (b.path ?? '');

async function snapshot(log) {
  const origin = hubOrigin();
  const applications = await listApplications(origin);
  log(`Read ${applications.length} Hub applications from ${origin.origin}/hub`);
  return connectedComponents(applications);
}

/** Creates missing seed applications in Hub; never adopts a mismatched record. */
async function provisionSeeds(log) {
  const origin = hubOrigin();
  const existing = await listApplications(origin);
  for (const seed of await loadSeeds()) {
    const match = existing.find(application => application.name === seed.name);
    if (match && !sameRepository(match.repository, seed.repository)) {
      throw new Error(
        `Hub application "${seed.name}" (id ${match.id}) has a different repository than its seed; refusing to adopt it.`,
      );
    }
    if (match) {
      log(`  exists   ${seed.name} (Hub id ${match.id})`);
      continue;
    }
    const created = await createApplication(origin, seed);
    log(`  created  ${seed.name} (Hub id ${created.id})`);
  }
}

/**
 * Development data scenarios. Each `prepare` returns the Components written to
 * dev-host/.generated/catalog.yaml, which dev-host/app-config.yaml always loads.
 */
export const scenarios = [
  {
    id: 'live',
    label: 'Live Hub snapshot',
    description:
      'Read-only: every Hub application becomes a connected Component.',
    prepare: snapshot,
  },
  {
    id: 'live-seeded',
    label: 'Live Hub + provisioned seeds',
    description:
      'Creates missing data/seeds applications in Hub (no analysis), then snapshots.',
    async prepare(log) {
      await provisionSeeds(log);
      return snapshot(log);
    },
  },
  {
    id: 'live-unconnected',
    label: 'Live Hub snapshot + unconnected seed Components',
    description:
      'Read-only snapshot plus Backstage-only Components from data/seeds without Hub IDs.',
    async prepare(log) {
      const connected = await snapshot(log);
      return [
        ...connected,
        ...(await unconnectedComponents(await loadSeeds())),
      ];
    },
  },
  {
    id: 'offline',
    label: 'Offline (no Hub)',
    description:
      'No Hub calls: personas plus unconnected seed Components only.',
    prepare: async () => unconnectedComponents(await loadSeeds()),
  },
];
