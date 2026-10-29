// Minimal Konveyor Hub access for development startup scenarios.
// Requests go through the Konveyor UI origin's /hub proxy, like mta-backend.

const REQUEST_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 1_000;

export function hubOrigin() {
  const configured = process.env.MTA_HUB_BASE_URL;
  if (!configured) {
    throw new Error(
      'Set MTA_HUB_BASE_URL (environment or .env) to the Konveyor UI origin, or choose the offline scenario.',
    );
  }
  const origin = new URL(configured);
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
  return origin;
}

async function hubRequest(origin, path, init = {}) {
  const url = new URL(`/hub${path}`, origin);
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `Hub request ${init.method ?? 'GET'} ${url} failed: ${error.message}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Hub request ${init.method ?? 'GET'} ${url} failed (${
        response.status
      }): ${await response.text()}`,
    );
  }
  return response;
}

export async function listApplications(origin) {
  const applications = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await hubRequest(
      origin,
      `/applications?offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`,
    );
    const items = await response.json();
    if (!Array.isArray(items)) {
      throw new Error('Hub application inventory must be an array.');
    }
    applications.push(...items);
    const total = response.headers.get('X-Total');
    const done =
      total !== null
        ? applications.length >= Number(total)
        : items.length < PAGE_SIZE;
    if (done || items.length === 0) {
      for (const application of applications) assertApplication(application);
      return applications;
    }
  }
  throw new Error(`Hub application inventory exceeded ${MAX_PAGES} pages.`);
}

export async function createApplication(origin, body) {
  const response = await hubRequest(origin, '/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const created = await response.json();
  assertApplication(created);
  return created;
}

function assertApplication(application) {
  if (
    !Number.isSafeInteger(application?.id) ||
    application.id <= 0 ||
    typeof application.name !== 'string'
  ) {
    throw new Error('Hub returned an application without a valid id and name.');
  }
}
