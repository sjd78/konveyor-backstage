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
import type { ConfigApi, IdentityApi } from '@backstage/core-plugin-api';
import type { ReactNode } from 'react';
import type { MtaApi } from '../../src/api';
import type { PersonaRole } from '../../src/hooks/usePersonaRole';
import type { CatalogApi } from '../fixtures/catalog';
import {
  homeScenarios,
  migrationScenarios,
  type HomeScenario,
  type MigrationScenario,
} from '../fixtures/scenarios';
import { featureStates } from './features';

/**
 * APIs a tile can replace for its own component, on top of the fixtures its
 * kind provides. `config` applies to every kind: a tile that reads host
 * configuration supplies its own, and every other tile gets an empty config.
 */
export interface GalleryApiOverrides {
  mtaApi?: MtaApi;
  identity?: IdentityApi;
  catalogApi?: CatalogApi;
  config?: ConfigApi;
}

interface GalleryStateBase {
  /** Gallery ID, used by `/gallery?state=<id>` and for screenshots. */
  id: string;
  name: string;
  /** The condition that produces the state, in one line. */
  trigger: string;
  /** APIs this tile replaces, including its configuration. */
  apis?: GalleryApiOverrides;
}

export interface MigrationGalleryState extends GalleryStateBase {
  kind: 'migration';
  scenario: MigrationScenario;
}

export interface HomeGalleryState extends GalleryStateBase {
  kind: 'home';
  scenario: HomeScenario;
}

export interface PersonaGalleryState extends GalleryStateBase {
  kind: 'persona';
  persona: PersonaRole;
}

export interface StatusChipsGalleryState extends GalleryStateBase {
  kind: 'status-chips';
}

export interface SeverityChipsGalleryState extends GalleryStateBase {
  kind: 'severity-chips';
}

/**
 * A tile whose body is any component, for feature work that ships its own
 * fixtures. `render` runs inside the tile's API overrides, so the component
 * can read them with the usual hooks.
 */
export interface CustomGalleryState extends GalleryStateBase {
  kind: 'custom';
  render: () => ReactNode;
}

export type GalleryState =
  | MigrationGalleryState
  | HomeGalleryState
  | PersonaGalleryState
  | StatusChipsGalleryState
  | SeverityChipsGalleryState
  | CustomGalleryState;

export interface GalleryGroup {
  id: string;
  title: string;
  description: string;
  states: GalleryState[];
}

function migration(
  id: string,
  name: string,
  trigger: string,
  scenario: MigrationScenario,
): MigrationGalleryState {
  return { id, name, trigger, kind: 'migration', scenario };
}

function home(
  id: string,
  name: string,
  trigger: string,
  scenario: HomeScenario,
): HomeGalleryState {
  return { id, name, trigger, kind: 'home', scenario };
}

export const GALLERY_GROUPS: GalleryGroup[] = [
  {
    id: 'migration-tab',
    title: 'Migration tab',
    description:
      'MigrationTab with an EntityProvider entity, a fixture Hub API and a persona identity.',
    states: [
      migration(
        'tab-loading',
        'Loading',
        'Hub requests never resolve.',
        migrationScenarios.loading,
      ),
      migration(
        'tab-invalid-link',
        'Invalid Hub application connection',
        'konveyor.io/application-id: abc.',
        migrationScenarios.invalidLink,
      ),
      migration(
        'tab-not-connected-architect',
        'No Hub application connected',
        'No annotation, architect.',
        migrationScenarios.notConnectedArchitect,
      ),
      migration(
        'tab-not-connected-developer',
        'No Hub application connected',
        'No annotation, developer.',
        migrationScenarios.notConnectedDeveloper,
      ),
      migration(
        'tab-app-missing',
        'Hub application 4242 was not found',
        'Valid ID, application lookup returns nothing.',
        migrationScenarios.appMissing,
      ),
      migration(
        'tab-load-error',
        'Unable to load or update Hub migration data',
        'Application request rejects with a 500 error.',
        migrationScenarios.loadError,
      ),
      migration(
        'tab-not-started-architect',
        'Discovery not started, with Start discovery',
        'Connected, no tasks, no analysis, architect.',
        migrationScenarios.notStartedArchitect,
      ),
      migration(
        'tab-not-started-developer',
        'Discovery not started, no button',
        'Same, developer.',
        migrationScenarios.notStartedDeveloper,
      ),
      migration(
        'tab-discovery-queued',
        'Repository discovery, task Pending',
        'Latest task is discovery, state Pending.',
        migrationScenarios.discoveryQueued,
      ),
      migration(
        'tab-discovery-running',
        'Repository discovery, task Running with activity',
        'Latest task is discovery, state Running, activity has lines.',
        migrationScenarios.discoveryRunning,
      ),
      migration(
        'tab-path-architect',
        'Select an analysis profile, with profiles and tags',
        'Discovery Succeeded, one or more profiles, architect.',
        migrationScenarios.pathArchitect,
      ),
      migration(
        'tab-path-no-profiles',
        'Select an analysis profile, none available',
        'Discovery Succeeded, no profiles.',
        migrationScenarios.pathNoProfiles,
      ),
      migration(
        'tab-path-developer',
        'Analysis profile selection (empty state)',
        'Discovery Succeeded, developer.',
        migrationScenarios.pathDeveloper,
      ),
      migration(
        'tab-analysis-running',
        'Analysis task, Running, with profile name',
        'Latest task is analyzer, Running.',
        migrationScenarios.analysisRunning,
      ),
      migration(
        'tab-results-unavailable-architect',
        'Analysis results are not available, with both buttons',
        'Analyzer Succeeded, analysis is null, architect.',
        migrationScenarios.resultsUnavailableArchitect,
      ),
      migration(
        'tab-results-unavailable-developer',
        'Analysis results are not available, Refresh only',
        'Analyzer Succeeded, analysis is null, developer.',
        migrationScenarios.resultsUnavailableDeveloper,
      ),
      migration(
        'tab-findings-architect',
        'Analysis findings, more than 10 rows, Run analysis',
        'Analysis present, 12 issues, architect.',
        migrationScenarios.findingsArchitect,
      ),
      migration(
        'tab-findings-developer',
        'Analysis findings, no Run analysis button',
        'Analysis present, 12 issues, developer.',
        migrationScenarios.findingsDeveloper,
      ),
      migration(
        'tab-findings-empty',
        'No findings reported',
        'Analysis present, no issues.',
        migrationScenarios.findingsEmpty,
      ),
      migration(
        'tab-findings-load-error',
        'Unable to load findings, with Retry',
        'Issues request rejects.',
        migrationScenarios.findingsLoadError,
      ),
      migration(
        'tab-failed-discovery',
        'Hub task failed, discovery, with Hub error text, Retry task',
        'Latest task is discovery, Failed, errors set.',
        migrationScenarios.failedDiscovery,
      ),
      migration(
        'tab-failed-analysis',
        'Hub task failed, analyzer, Retry task and Select analysis profile',
        'Latest analyzer Failed with a known profile.',
        migrationScenarios.failedAnalysis,
      ),
      migration(
        'tab-canceled',
        'Hub task canceled',
        'Latest task Canceled.',
        migrationScenarios.canceled,
      ),
      migration(
        'tab-failed-developer',
        'Hub task failed, no buttons',
        'Latest task Failed, developer.',
        migrationScenarios.failedDeveloper,
      ),
      migration(
        'tab-unknown-persona',
        'Findings without architect controls',
        'Analysis present, identity in neither group.',
        migrationScenarios.unknownPersona,
      ),
    ],
  },
  {
    id: 'migration-actions',
    title: 'Migration tab, interactive',
    description:
      'These tiles render the start state. Click the named control to reach the state.',
    states: [
      migration(
        'tab-action-error',
        'Discovery submission rejected',
        'Start discovery, then the Hub rejects the submission.',
        migrationScenarios.actionError,
      ),
      migration(
        'tab-choose-profile',
        'Profile selection from findings',
        'Run analysis, which opens profile selection with Cancel.',
        migrationScenarios.chooseProfile,
      ),
    ],
  },
  {
    id: 'home-card',
    title: 'Home card',
    description:
      'MtaHomeSection with a fixture catalog API, Hub API and persona identity.',
    states: [
      home(
        'home-loading',
        'Skeleton',
        'Identity never resolves.',
        homeScenarios.loading,
      ),
      home(
        'home-unknown-persona',
        'Migration access unavailable',
        'Identity in neither group.',
        homeScenarios.unknownPersona,
      ),
      home(
        'home-error',
        'Could not load migration data',
        'Catalog request rejects.',
        homeScenarios.error,
      ),
      home(
        'home-empty-architect',
        'No applications registered for migration, Register for migration',
        'Architect, catalog returns no entities.',
        homeScenarios.emptyArchitect,
      ),
      home(
        'home-empty-developer',
        'No assigned applications',
        'Developer, catalog returns no entities.',
        homeScenarios.emptyDeveloper,
      ),
      home(
        'home-architect-rows',
        'Every row status',
        'Architect, one entity per row status.',
        homeScenarios.architectRows,
      ),
      home(
        'home-developer-rows',
        'Your Migration, assigned rows',
        'Developer, two assigned entities.',
        homeScenarios.developerRows,
      ),
    ],
  },
  {
    id: 'settings',
    title: 'Settings persona card',
    description: 'MtaPersonaCard with the persona identity.',
    states: [
      {
        id: 'persona-architect',
        name: 'Architect',
        trigger: 'Identity in group:default/mta-architects.',
        kind: 'persona',
        persona: 'architect',
      },
      {
        id: 'persona-developer',
        name: 'Developer',
        trigger: 'Identity in group:default/mta-developers.',
        kind: 'persona',
        persona: 'developer',
      },
      {
        id: 'persona-unknown',
        name: 'Unassigned',
        trigger: 'Identity in neither persona group.',
        kind: 'persona',
        persona: 'unknown',
      },
    ],
  },
  {
    id: 'chips',
    title: 'Chips',
    description: 'Chips rendered directly, one tile per chip component.',
    states: [
      {
        id: 'chips-status',
        name: 'MigrationStatusChip for every MigrationStatus value',
        trigger: 'One chip per MigrationStatus value.',
        kind: 'status-chips',
      },
      {
        id: 'chips-severity',
        name: 'SeverityChip for every severity and a custom label',
        trigger: 'critical, major, minor, info and a custom label.',
        kind: 'severity-chips',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features',
    description:
      'Tiles added by feature pull requests. Each feature keeps its own file in dev/gallery/features and lists its states in features/index.ts.',
    states: featureStates,
  },
];

/** Every state ID in the gallery, in catalogue order. */
export const GALLERY_STATE_IDS: string[] = GALLERY_GROUPS.flatMap(group =>
  group.states.map(state => state.id),
);

export function findGalleryState(id: string): GalleryState | undefined {
  for (const group of GALLERY_GROUPS) {
    const state = group.states.find(candidate => candidate.id === id);
    if (state) {
      return state;
    }
  }
  return undefined;
}
