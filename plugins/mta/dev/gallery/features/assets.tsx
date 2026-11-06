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
import { useState } from 'react';
import { AssetFileBrowser } from '../../../src/components/deploymentAssets/AssetFileBrowser';
import type {
  AssetGenerator,
  RenderedAsset,
} from '../../../src/api/deploymentAssets';
import {
  ASSET_FIXTURE_GENERATORS,
  LONG_PATH_ASSETS,
  renderAssetFixture,
} from '../../fixtures/deploymentAssets';
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

export const assetStates: GalleryState[] = [
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
];
