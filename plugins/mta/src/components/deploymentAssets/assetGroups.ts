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
import type { AssetGenerator, RenderedAsset } from '../../api/deploymentAssets';

export interface AssetGroup {
  generator: AssetGenerator;
  assets: RenderedAsset[];
}

/**
 * Sentinel id for files whose generator is missing from the result. It is
 * separate from any Hub generator id so collapse state cannot overlap.
 */
export const OTHER_FILES_GROUP_ID = '__other_files__';
export const OTHER_FILES_GROUP_NAME = 'Other files';

/**
 * Group rendered files in generator order. Files whose generator is not in the
 * result stay visible in a final "Other files" group instead of disappearing
 * from the browser while still being part of the download.
 */
export function groupAssets(
  generators: AssetGenerator[],
  assets: RenderedAsset[],
): AssetGroup[] {
  const groups = generators
    .map(generator => ({
      generator,
      assets: assets.filter(asset => asset.generatorId === generator.id),
    }))
    .filter(group => group.assets.length);

  const known = new Set(generators.map(generator => generator.id));
  const ungrouped = assets.filter(asset => !known.has(asset.generatorId));
  if (ungrouped.length) {
    groups.push({
      generator: { id: OTHER_FILES_GROUP_ID, name: OTHER_FILES_GROUP_NAME },
      assets: ungrouped,
    });
  }
  return groups;
}
