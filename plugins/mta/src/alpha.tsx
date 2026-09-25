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
import type { ExtensionDefinition } from '@backstage/frontend-plugin-api';
import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { HomePageWidgetBlueprint } from '@backstage/plugin-home-react/alpha';
import { MigrationTabPage } from './components/MigrationTabPage';
import { MtaHomeSection } from './components/MtaHomeCards';
import { rootRouteRef } from './routes';

const mtaEntityContent = EntityContentBlueprint.makeWithOverrides({
  name: 'migration',
  factory(original) {
    return original({
      path: '/migration',
      title: 'Migration',
      filter: (entity: Entity): boolean => entity.kind === 'Component',
      loader: async () => <MigrationTabPage />,
    });
  },
});

const mtaHomeWidget = HomePageWidgetBlueprint.make({
  name: 'mta-migration-cards',
  params: {
    name: 'MtaHomeSection',
    title: 'Migration',
    description:
      'Migration Toolkit for Applications status and recommendations',
    components: async () => ({
      Content: () => <MtaHomeSection />,
    }),
  },
});

const mtaPage = PageBlueprint.make({
  params: {
    path: '/mta',
    routeRef: rootRouteRef,
    loader: async () => <MtaHomeSection />,
  },
});

export const mtaPlugin = createFrontendPlugin({
  pluginId: 'mta',
  extensions: [
    mtaEntityContent,
    mtaHomeWidget,
    mtaPage,
  ] as ExtensionDefinition[],
  routes: {
    root: rootRouteRef,
  },
});

export default mtaPlugin;
