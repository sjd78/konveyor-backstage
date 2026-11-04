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
import { mockApis } from '@backstage/frontend-test-utils';
import { migrationScenarios } from '../../fixtures/scenarios';
import type { GalleryState } from '../states';

/** A deployment that names a support contact, as the README documents it. */
const supportConfig = mockApis.config({
  data: {
    mta: {
      support: {
        name: 'Migration Team',
        email: 'migration-team@example.test',
      },
    },
  },
});

/** A deployment that runs a Dev Spaces dashboard. */
const devSpacesConfig = mockApis.config({
  data: {
    mta: {
      devSpaces: { url: 'https://devspaces.apps.example.test' },
    },
  },
});

export const configStates: GalleryState[] = [
  {
    id: 'feature-failed-with-support',
    name: 'Hub task failed, with a support contact',
    trigger: 'mta.support.name and mta.support.email are set.',
    kind: 'migration',
    scenario: migrationScenarios.failedAnalysis,
    apis: { config: supportConfig },
  },
  {
    id: 'feature-findings-devspaces',
    name: 'Analysis findings, Open in Dev Spaces',
    trigger:
      'mta.devSpaces.url is a valid URL. Every persona sees the link; this tile shows an architect beside Run analysis.',
    kind: 'migration',
    scenario: migrationScenarios.findingsArchitect,
    apis: { config: devSpacesConfig },
  },
];
