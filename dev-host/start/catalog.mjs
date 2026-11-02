import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const dataDirectory = new URL('../data/', import.meta.url);
const generatedDirectory = new URL('../.generated/', import.meta.url);
export const generatedCatalog = new URL('catalog.yaml', generatedDirectory);

const OWNER = 'group:default/mta-architects';
const SYSTEM = 'mta-portfolio';

async function loadAssignments() {
  return JSON.parse(
    await readFile(new URL('assignments.json', dataDirectory), 'utf8'),
  );
}

/** Hub application request bodies from data/seeds/*.yaml, in file order. */
export async function loadSeeds() {
  const seedsDirectory = new URL('seeds/', dataDirectory);
  const files = (await readdir(seedsDirectory))
    .filter(file => file.endsWith('.yaml'))
    .sort();
  const seeds = [];
  for (const file of files) {
    const items = parse(await readFile(new URL(file, seedsDirectory), 'utf8'));
    if (!Array.isArray(items)) {
      throw new Error(
        `Seed file ${file} must be a YAML list of Hub application bodies.`,
      );
    }
    for (const seed of items) {
      if (
        typeof seed?.name !== 'string' ||
        typeof seed.repository?.url !== 'string'
      ) {
        throw new Error(
          `Seed file ${file} has an entry without a name and repository.url.`,
        );
      }
      if (seeds.some(existing => existing.name === seed.name)) {
        throw new Error(
          `Seed application name ${seed.name} is defined more than once.`,
        );
      }
      seeds.push(seed);
    }
  }
  return seeds;
}

function repositoryAnnotations(repository) {
  const annotations = {};
  if (repository?.url) {
    annotations['mta.konveyor.io/repo-url'] = repository.url;
    annotations['backstage.io/source-location'] = `url:${repository.url}`;
    if (repository.path)
      annotations['mta.konveyor.io/root-path'] = repository.path;
    if (repository.branch)
      annotations['mta.konveyor.io/repo-branch'] = repository.branch;
  }
  return annotations;
}

function component({ name, title, description, annotations }, assignments) {
  if (Object.hasOwn(assignments, title)) {
    annotations['mta.konveyor.io/assigned-developer'] = assignments[title];
  }
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, title, description, annotations },
    spec: {
      type: 'service',
      lifecycle: 'experimental',
      owner: OWNER,
      system: SYSTEM,
    },
  };
}

/** Components connected to Hub applications through their numeric Hub ID. */
export async function connectedComponents(applications) {
  const assignments = await loadAssignments();
  return applications.map(application =>
    component(
      {
        name: `mta-application-${application.id}`,
        title: application.name,
        description:
          application.description ||
          `Application ${application.name} in Konveyor Hub`,
        annotations: {
          'konveyor.io/application-id': String(application.id),
          ...repositoryAnnotations(application.repository),
        },
      },
      assignments,
    ),
  );
}

/** Backstage-only Components built from seeds, with no Hub application ID. */
export async function unconnectedComponents(seeds) {
  const assignments = await loadAssignments();
  return seeds.map(seed =>
    component(
      {
        name: seed.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        title: seed.name,
        description:
          seed.description || `${seed.name} (not connected to Konveyor Hub)`,
        annotations: repositoryAnnotations(seed.repository),
      },
      assignments,
    ),
  );
}

export async function writeCatalog(components) {
  const entities = [
    ...components,
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: { name: SYSTEM },
      spec: { owner: OWNER },
    },
  ];
  await mkdir(generatedDirectory, { recursive: true });
  const temporary = new URL('catalog.yaml.tmp', generatedDirectory);
  await writeFile(
    temporary,
    `${entities
      .map(entity => JSON.stringify(entity, null, 2))
      .join('\n---\n')}\n`,
  );
  await rename(temporary, generatedCatalog);
  return fileURLToPath(generatedCatalog);
}
