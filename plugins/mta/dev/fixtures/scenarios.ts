/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { Entity } from '@backstage/catalog-model';
import type { KonveyorApplication, KonveyorTask } from '../../src/api';
import type { PersonaRole } from '../../src/hooks/usePersonaRole';
import {
  createArchitectHomeEntities,
  createDeveloperHomeEntities,
} from './catalog';
import {
  hubAnalysis,
  hubAnalysisRunningTask,
  hubAnalysisSucceededTask,
  hubApplication,
  hubCanceledDiscoveryTask,
  hubDiscoverySucceededTask,
  hubFailedDiscoveryTask,
  hubFailingApplication,
  hubIncidents,
  hubInsights,
  hubProfile,
  hubTechDiscoverySucceededTask,
} from './hub';
import type { MtaApiFixtureOptions, MtaAppFixture } from './mtaApi';

export interface MigrationScenario {
  persona: PersonaRole;
  /** Value of `konveyor.io/application-id`, or undefined when unconnected. */
  annotation?: string;
  api: MtaApiFixtureOptions;
}

export interface HomeScenario {
  persona: PersonaRole;
  api: MtaApiFixtureOptions;
  entities: Entity[];
  catalogError?: string;
  pendingIdentity?: boolean;
}

function app(overrides: Partial<MtaAppFixture> = {}): MtaAppFixture {
  return {
    application: hubApplication,
    tasks: [],
    profiles: [],
    analysis: null,
    ...overrides,
  };
}

function oneApp(
  overrides: Partial<MtaAppFixture> = {},
  options: Partial<MtaApiFixtureOptions> = {},
): MtaApiFixtureOptions {
  return { apps: [app(overrides)], ...options };
}

const discoveryDone = [
  hubDiscoverySucceededTask,
  hubTechDiscoverySucceededTask,
];

const queuedDiscovery: KonveyorTask = {
  id: 6,
  name: 'Backstage Phase 2 Spring-language-discovery',
  kind: 'language-discovery',
  addon: 'language-discovery',
  state: 'Pending',
  application: { id: 1, name: 'Backstage Phase 2 Spring' },
  data: { source: 'language-discovery' },
};

const runningDiscovery: KonveyorTask = {
  ...queuedDiscovery,
  state: 'Running',
  started: '2026-11-04T12:02:11.408721318Z',
  activity: [
    '[CMD] Running: /usr/bin/git clone https://github.com/konveyor/example-applications.git',
    '[CMD] /usr/bin/git succeeded.',
    '[CMD] Running: /usr/bin/git checkout main',
  ],
};

const failedAnalysis: KonveyorTask = {
  id: 7,
  name: 'application-1-analyzer',
  kind: 'analyzer',
  addon: 'analyzer',
  state: 'Failed',
  application: { id: 1, name: 'Backstage Phase 2 Spring' },
  data: { profile: { id: 1 }, verbosity: 0 },
  errors: [
    { severity: 'Error', description: 'Container (addon) failed: Error' },
    {
      severity: 'Error',
      description:
        'Analysis failed while evaluating rule spring-framework-5.x-to-6.0-baseline-00001.',
    },
  ],
  activity: ['[ANALYZER] starting to process 867 rules'],
};

const findings = app({
  tasks: [...discoveryDone, hubAnalysisSucceededTask],
  profiles: [hubProfile],
  analysis: hubAnalysis,
  insights: hubInsights,
  incidents: hubIncidents,
});

/** Migration tab scenarios, one per state in the state catalog. */
export const migrationScenarios: Record<string, MigrationScenario> = {
  loading: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({}, { pendingApplication: true }),
  },
  invalidLink: {
    persona: 'architect',
    annotation: 'abc',
    api: oneApp(),
  },
  notConnectedArchitect: {
    persona: 'architect',
    api: oneApp(),
  },
  notConnectedDeveloper: {
    persona: 'developer',
    api: oneApp(),
  },
  appMissing: {
    persona: 'architect',
    annotation: '4242',
    api: { apps: [] },
  },
  loadError: {
    persona: 'architect',
    annotation: '1',
    api: oneApp(
      {},
      { applicationError: new Error('Request failed with status 500') },
    ),
  },
  notStartedArchitect: {
    persona: 'architect',
    annotation: '1',
    api: oneApp(),
  },
  notStartedDeveloper: {
    persona: 'developer',
    annotation: '1',
    api: oneApp(),
  },
  discoveryQueued: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({ tasks: [queuedDiscovery] }),
  },
  discoveryRunning: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({ tasks: [runningDiscovery] }),
  },
  pathArchitect: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({ tasks: discoveryDone, profiles: [hubProfile] }),
  },
  pathNoProfiles: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({ tasks: discoveryDone }),
  },
  pathDeveloper: {
    persona: 'developer',
    annotation: '1',
    api: oneApp({ tasks: discoveryDone, profiles: [hubProfile] }),
  },
  analysisRunning: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, hubAnalysisRunningTask],
      profiles: [hubProfile],
    }),
  },
  resultsUnavailableArchitect: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, hubAnalysisSucceededTask],
      profiles: [hubProfile],
    }),
  },
  resultsUnavailableDeveloper: {
    persona: 'developer',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, hubAnalysisSucceededTask],
      profiles: [hubProfile],
    }),
  },
  findingsArchitect: {
    persona: 'architect',
    annotation: '1',
    api: { apps: [findings] },
  },
  findingsDeveloper: {
    persona: 'developer',
    annotation: '1',
    api: { apps: [findings] },
  },
  findingsEmpty: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, hubAnalysisSucceededTask],
      profiles: [hubProfile],
      analysis: hubAnalysis,
      insights: [],
    }),
  },
  findingsLoadError: {
    persona: 'architect',
    annotation: '1',
    api: {
      apps: [
        {
          ...findings,
          issuesError: new Error(
            'Request failed with status 500 for /applications/1/issues',
          ),
        },
      ],
    },
  },
  failedDiscovery: {
    persona: 'architect',
    annotation: '2',
    api: oneApp({
      application: hubFailingApplication,
      tasks: [hubFailedDiscoveryTask],
    }),
  },
  failedAnalysis: {
    persona: 'architect',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, failedAnalysis],
      profiles: [hubProfile],
    }),
  },
  canceled: {
    persona: 'architect',
    annotation: '2',
    api: oneApp({
      application: hubFailingApplication,
      tasks: [hubFailedDiscoveryTask, hubCanceledDiscoveryTask],
    }),
  },
  failedDeveloper: {
    persona: 'developer',
    annotation: '1',
    api: oneApp({
      tasks: [...discoveryDone, failedAnalysis],
      profiles: [hubProfile],
    }),
  },
  unknownPersona: {
    persona: 'unknown',
    annotation: '1',
    api: { apps: [findings] },
  },
  actionError: {
    persona: 'architect',
    annotation: '1',
    api: oneApp(
      {},
      { discoveryError: new Error('Repository credentials are required') },
    ),
  },
  chooseProfile: {
    persona: 'architect',
    annotation: '1',
    api: { apps: [findings] },
  },
};

function homeApplication(id: number, name: string): KonveyorApplication {
  return {
    id,
    name,
    repository: {
      kind: 'git',
      url: 'https://github.com/konveyor/example-applications.git',
      branch: 'main',
      path: 'example-1',
    },
  };
}

const homeDiscoveryRunning: KonveyorTask = {
  ...hubDiscoverySucceededTask,
  id: 1001,
  state: 'Running',
  terminated: undefined,
  activity: ['[CMD] /usr/bin/git succeeded.'],
};

const homeDiscoveryDone: KonveyorTask = {
  ...hubDiscoverySucceededTask,
  id: 1002,
};

const homeAnalysisRunning: KonveyorTask = {
  ...hubAnalysisRunningTask,
  id: 1003,
};

const homeAnalysisDone: KonveyorTask = {
  ...hubAnalysisSucceededTask,
  id: 1004,
};

const homeDiscoveryFailed: KonveyorTask = {
  ...hubFailedDiscoveryTask,
  id: 1005,
  application: { id: 210, name: 'Gateway Service' },
};

const homeFindingsInsights = hubInsights.slice(0, 5);
const homeFindingIds = new Set(homeFindingsInsights.map(insight => insight.id));
const homeFindingIncidents = Object.fromEntries(
  Object.entries(hubIncidents)
    .filter(([insightId]) => homeFindingIds.has(Number(insightId)))
    .map(([insightId, incidents]) => [Number(insightId), incidents]),
);

const homeApps: MtaAppFixture[] = [
  {
    application: homeApplication(203, 'Checkout Service'),
    tasksError: new Error(
      'Request failed with status 500 for /applications/203',
    ),
  },
  {
    application: homeApplication(204, 'Orders Service'),
    tasks: [homeDiscoveryRunning],
  },
  {
    application: homeApplication(205, 'Catalog Service'),
    tasks: [homeDiscoveryDone],
  },
  {
    application: homeApplication(206, 'Cart Service'),
    tasks: [homeDiscoveryDone, homeAnalysisRunning],
  },
  {
    application: homeApplication(207, 'Shipping Service'),
    tasks: [homeDiscoveryDone, homeAnalysisDone],
  },
  {
    application: homeApplication(208, 'Billing Service'),
    tasks: [homeDiscoveryDone, homeAnalysisDone],
    analysis: hubAnalysis,
    insights: homeFindingsInsights,
    incidents: homeFindingIncidents,
  },
  {
    application: homeApplication(209, 'Notifications Service'),
    tasks: [homeDiscoveryDone, homeAnalysisDone],
    analysis: hubAnalysis,
    insights: [],
  },
  {
    application: homeApplication(210, 'Gateway Service'),
    tasks: [homeDiscoveryFailed],
  },
  {
    application: homeApplication(211, 'Identity Service'),
    tasks: [],
  },
];

const architectEntities = createArchitectHomeEntities();
const developerEntities = createDeveloperHomeEntities();

/** Home card scenarios, one per state in the state catalog. */
export const homeScenarios: Record<string, HomeScenario> = {
  loading: {
    persona: 'architect',
    api: { apps: homeApps },
    entities: architectEntities,
    pendingIdentity: true,
  },
  unknownPersona: {
    persona: 'unknown',
    api: { apps: [] },
    entities: [],
  },
  error: {
    persona: 'architect',
    api: { apps: [] },
    entities: architectEntities,
    catalogError: 'Request failed with status 403 for /entities',
  },
  emptyArchitect: {
    persona: 'architect',
    api: { apps: [] },
    entities: [],
  },
  emptyDeveloper: {
    persona: 'developer',
    api: { apps: [] },
    entities: [],
  },
  architectRows: {
    persona: 'architect',
    api: { apps: homeApps },
    entities: architectEntities,
  },
  developerRows: {
    persona: 'developer',
    api: { apps: homeApps },
    entities: developerEntities,
  },
};
