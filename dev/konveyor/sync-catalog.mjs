import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Development-only catalog snapshot. Never creates or modifies Hub records.
const directory = new URL('./', import.meta.url);
const configuredUrl = process.env.MTA_HUB_BASE_URL;
if (!configuredUrl) {
  throw new Error(
    'Set MTA_HUB_BASE_URL to the Konveyor UI origin before starting development.',
  );
}
const origin = new URL(configuredUrl);
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
) {
  throw new Error(
    'MTA_HUB_BASE_URL must be the UI origin only, without /hub, credentials, or a query string.',
  );
}
const assignments = JSON.parse(
  await readFile(new URL('catalog-assignments.json', directory), 'utf8'),
);
const applications = [];
const pageSize = 100;
for (let offset = 0; ; offset += pageSize) {
  const url = new URL('/hub/applications', origin);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(pageSize));
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `Hub inventory request failed (${
        response.status
      }): ${await response.text()}`,
    );
  }
  const page = await response.json();
  if (!Array.isArray(page))
    throw new Error('Hub application inventory must be an array.');
  applications.push(...page);
  if (page.length < pageSize) break;
}
const entities = applications.map(application => {
  if (
    !Number.isSafeInteger(application.id) ||
    application.id <= 0 ||
    typeof application.name !== 'string'
  ) {
    throw new Error('Hub inventory contains an invalid application identity.');
  }
  const repository = application.repository;
  const annotations = { 'konveyor.io/application-id': String(application.id) };
  if (repository?.url) {
    annotations['mta.konveyor.io/repo-url'] = repository.url;
    annotations['backstage.io/source-location'] = `url:${repository.url}`;
    if (repository.path)
      annotations['mta.konveyor.io/root-path'] = repository.path;
    if (repository.branch)
      annotations['mta.konveyor.io/repo-branch'] = repository.branch;
  }
  if (assignments[application.name]) {
    annotations['mta.konveyor.io/assigned-developer'] =
      assignments[application.name];
  }
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: `mta-application-${application.id}`,
      title: application.name,
      description:
        application.description ||
        `Application ${application.name} in Konveyor Hub`,
      annotations,
    },
    spec: {
      type: 'service',
      lifecycle: 'experimental',
      owner: 'group:default/mta-architects',
      system: 'mta-portfolio',
    },
  };
});
entities.push({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: { name: 'mta-portfolio' },
  spec: { owner: 'group:default/mta-architects' },
});
await mkdir(directory, { recursive: true });
const output = new URL('catalog.local.yaml', directory);
const temporary = new URL('catalog.local.yaml.tmp', directory);
await writeFile(
  temporary,
  entities.map(entity => JSON.stringify(entity, null, 2)).join('\n---\n') +
    '\n',
);
await rename(temporary, output);
console.log(
  `Connected ${applications.length} Hub applications from ${
    origin.origin
  }/hub to ${fileURLToPath(output)}`,
);
for (const entity of entities.filter(entity => entity.kind === 'Component')) {
  console.log(
    `  ${entity.metadata.title} -> component:default/${entity.metadata.name}`,
  );
}
