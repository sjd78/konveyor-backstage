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
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@backstage/ui';
import { identityApiRef } from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mtaApiRef } from '../../../src/api';
import { MigrationTab } from '../../../src/components/MigrationTab';
import { AssetFileBrowser } from '../../../src/components/deploymentAssets/AssetFileBrowser';
import { DeploymentAssetDialog } from '../../../src/components/deploymentAssets/DeploymentAssetDialog';
import {
  deploymentAssetsApiRef,
  type AssetGenerator,
  type DeploymentAssetApplication,
  type DeploymentAssetsApi,
  type RenderedAsset,
} from '../../../src/api/deploymentAssets';
import {
  ASSET_FIXTURE_GENERATORS,
  LONG_PATH_ASSETS,
  createDeploymentAssetsFixture,
  renderAssetFixture,
} from '../../fixtures/deploymentAssets';
import { createMigrationEntity } from '../../fixtures/catalog';
import { createIdentity } from '../../fixtures/identity';
import { createMtaApi } from '../../fixtures/mtaApi';
import { migrationScenarios } from '../../fixtures/scenarios';
import type { GalleryState } from '../states';

const fixtureAssets = renderAssetFixture(
  'example-app',
  'https://github.com/konveyor/example-applications.git',
);

/**
 * The browser keeps the selection, so a tile owns it the way the workspace
 * dialog will. The wrapper gives the two panes the height the dialog gives
 * them; on their own they would grow with the file list.
 */
function BrowserTile({
  files,
  generators = ASSET_FIXTURE_GENERATORS,
}: {
  files: RenderedAsset[];
  generators?: AssetGenerator[];
}) {
  const [selectedPath, setSelectedPath] = useState(files[0].path);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '34rem' }}>
      <AssetFileBrowser
        generators={generators}
        assets={files}
        selectedPath={selectedPath}
        onSelect={setSelectedPath}
      />
    </div>
  );
}

const DIALOG_APPLICATION: DeploymentAssetApplication = {
  id: 7,
  name: 'example-app',
  repository: {
    url: 'https://github.com/konveyor/example-applications.git',
  },
};

/**
 * Presses Commit files once the open dialog shows the files, so a tile can
 * present the committed result the way a member reaches it. The dialog owns
 * that state, and the tile keeps using the real action instead of faking a
 * result.
 */
function useCommitWhenReady(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => {
      // The dialog portals to the document body, so it is not inside the tile.
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs[dialogs.length - 1];
      const commit = Array.from(dialog?.querySelectorAll('button') ?? []).find(
        element => element.textContent?.trim() === 'Commit files',
      );
      if (commit) {
        window.clearInterval(timer);
        commit.click();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [enabled]);
}

/**
 * Renders the real dialog with a fixture API. The dialog portals its overlay to
 * the document body, so a tile cannot contain it: `?state=<id>` opens it and
 * lets the tile fill the viewport, which is what the screenshot run loads. In
 * the full gallery the dialog starts closed behind a button, because several
 * open overlays would cover each other.
 */
function DialogTile({
  stateId,
  api,
  commitOnReady = false,
}: {
  stateId: string;
  api: DeploymentAssetsApi;
  commitOnReady?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const focused = searchParams.has('state');
  const [open, setOpen] = useState(focused);
  useCommitWhenReady(open && commitOnReady);
  return (
    <div style={{ position: 'relative', height: '46rem' }}>
      {focused && (
        <style>{`section[data-gallery-state="${stateId}"] { position: fixed; inset: 0; margin: 0; overflow: auto; }`}</style>
      )}
      {!open && (
        <Button variant="secondary" onPress={() => setOpen(true)}>
          Open deployment assets
        </Button>
      )}
      <TestApiProvider apis={[[deploymentAssetsApiRef, api]]}>
        <DeploymentAssetDialog
          open={open}
          onClose={() => setOpen(false)}
          application={DIALOG_APPLICATION}
        />
      </TestApiProvider>
    </div>
  );
}

const previewApi = createDeploymentAssetsFixture();
const commitApi = createDeploymentAssetsFixture();
const renderErrorApi = createDeploymentAssetsFixture({ render: 'error' });
const emptyApi = createDeploymentAssetsFixture({ render: 'empty' });

/**
 * The findings screen as an architect reaches it, with a deployment asset host
 * registered. The screen and its data come from the Migration tab findings
 * scenario, so only the extra action and dialog differ.
 */
function FindingsEntryTile() {
  const scenario = migrationScenarios.findingsArchitect;
  const [api] = useState(() => createMtaApi(scenario.api));
  const [identity] = useState(() => createIdentity(scenario.persona));
  const [entity] = useState(() => createMigrationEntity(scenario.annotation));
  const [assetsApi] = useState(() => createDeploymentAssetsFixture());
  return (
    <EntityProvider entity={entity}>
      <TestApiProvider
        apis={[
          [mtaApiRef, api],
          [identityApiRef, identity],
          [deploymentAssetsApiRef, assetsApi],
        ]}
      >
        <MigrationTab />
      </TestApiProvider>
    </EntityProvider>
  );
}

export const assetStates: GalleryState[] = [
  {
    id: 'feature-assets-entry',
    name: 'Analysis findings, Generate deployment assets',
    trigger:
      'An architect opens findings when a host registers a deployment asset API.',
    kind: 'custom',
    render: () => <FindingsEntryTile />,
  },
  {
    id: 'feature-assets-browser',
    name: 'Asset file browser with preview',
    trigger:
      'Rendered files grouped by generator, with the first file selected.',
    kind: 'custom',
    render: () => <BrowserTile files={fixtureAssets} />,
  },
  {
    id: 'feature-assets-browser-long-paths',
    name: 'Asset file browser, clipped directory names',
    trigger: 'A directory name longer than its row discloses the full path.',
    kind: 'custom',
    render: () => <BrowserTile files={LONG_PATH_ASSETS} />,
  },
  {
    id: 'feature-assets-preview',
    name: 'Asset workspace dialog, files rendered',
    trigger:
      'The dialog previews the rendered files and offers Download ZIP and Commit files.',
    kind: 'custom',
    render: () => (
      <DialogTile stateId="feature-assets-preview" api={previewApi} />
    ),
  },
  {
    id: 'feature-assets-commit-success',
    name: 'Asset workspace dialog, committed to a branch',
    trigger:
      'Committing the files creates the branch, and the dialog reports it with a link.',
    kind: 'custom',
    render: () => (
      <DialogTile
        stateId="feature-assets-commit-success"
        api={commitApi}
        commitOnReady
      />
    ),
  },
  {
    id: 'feature-assets-render-error',
    name: 'Asset workspace dialog, render failed',
    trigger: 'The Hub rejects the render and the dialog offers Retry.',
    kind: 'custom',
    render: () => (
      <DialogTile stateId="feature-assets-render-error" api={renderErrorApi} />
    ),
  },
  {
    id: 'feature-assets-empty',
    name: 'Asset workspace dialog, no files returned',
    trigger:
      'The Hub renders no files for the application, and the dialog explains why.',
    kind: 'custom',
    render: () => <DialogTile stateId="feature-assets-empty" api={emptyApi} />,
  },
];
