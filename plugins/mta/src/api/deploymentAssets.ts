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
import { createApiRef } from '@backstage/core-plugin-api';
import type { KonveyorApplication } from './types';

/*
 * Optional deployment asset contract.
 *
 * The Konveyor Hub already models deployment assets: generators are attached
 * to archetype profiles, an application has an assets repository, and a
 * platform addon task renders the generators into files. This module is the
 * frontend seam for that work. It is optional, and this repository ships no
 * implementation: a host registers one through `deploymentAssetsApiRef`, and
 * the UI that offers generation stays hidden until it does.
 */

/**
 * One generator that produced rendered files.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface AssetGenerator {
  /**
   * Generator id as a string. A Hub-backed implementation stringifies the
   * numeric Hub generator id, so a missing generator can use a sentinel that
   * no Hub id can collide with.
   */
  id: string;
  name: string;
  /** Shown only when the Hub returns one. */
  description?: string;
}

/**
 * One file rendered from a migration template.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface RenderedAsset {
  /** Forward-slash path relative to the archive root. */
  path: string;
  generatorId: string;
  content: string;
}

/**
 * Files the Hub rendered for one application, with the generators that made
 * them.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface AssetRenderResult {
  generators: AssetGenerator[];
  assets: RenderedAsset[];
}

/**
 * The Hub application a deployment asset request targets.
 *
 * The request carries the upstream Hub application (its id, name and
 * repository) instead of loose strings, so a Hub-backed implementation can
 * resolve the application, its archetype profile generators and its assets
 * repository from the same record the Migration tab already loaded.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export type DeploymentAssetApplication = Pick<
  KonveyorApplication,
  'id' | 'name' | 'repository'
>;

/**
 * Repository that receives a new-branch commit of rendered deployment assets.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export type DeploymentAssetRepository = 'source' | 'config';

/**
 * Request to render deployment assets for one application.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface RenderDeploymentAssetsRequest {
  application: DeploymentAssetApplication;
  signal?: AbortSignal;
}

/**
 * Request to commit the files a render produced.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface CommitDeploymentAssetsRequest {
  application: DeploymentAssetApplication;
  repository: DeploymentAssetRepository;
  /**
   * Clone URL that receives the commit: the configuration repository for
   * `config`, the application source repository for `source`.
   */
  repositoryUrl: string;
  signal?: AbortSignal;
}

/**
 * Where a commit landed. The UI shows the destination before the commit runs.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export interface AssetCommitResult {
  repositoryUrl: string;
  branch: string;
  /** Web link to the new branch. A Hub supplies it when it can. */
  branchUrl?: string;
}

/**
 * The optional deployment asset seam for the MTA plugin.
 *
 * A host registers an implementation through `deploymentAssetsApiRef`. This
 * repository ships none, so nothing in the product calls these methods yet:
 * the deployment asset UI is only rendered when a host provides an
 * implementation.
 */
export interface DeploymentAssetsApi {
  /** Render the deployment assets for an application, without committing them. */
  renderDeploymentAssets(
    request: RenderDeploymentAssetsRequest,
  ): Promise<AssetRenderResult>;

  /** Commit rendered files to a new branch of the chosen repository. */
  commitDeploymentAssets(
    request: CommitDeploymentAssetsRequest,
  ): Promise<AssetCommitResult>;

  /**
   * Files the Hub already rendered and delivered for an application, so a
   * later visit shows the previous result without rendering again.
   */
  getDeliveredAssets(
    application: DeploymentAssetApplication,
  ): Promise<AssetRenderResult>;
}

/**
 * Optional API ref for deployment assets. A host registers an implementation
 * for it; this repository ships none, and the related UI stays hidden until a
 * host does.
 */
export const deploymentAssetsApiRef = createApiRef<DeploymentAssetsApi>({
  id: 'plugin.mta.deployment-assets',
});

/**
 * Branch the Hub creates for deployment assets. The UI shows the destination
 * before the commit runs, and a Hub client returns the real branch on commit.
 *
 * Part of the optional deployment asset contract; this repository ships no
 * implementation.
 */
export const ASSET_BRANCH_NAME = 'mta/deployment-assets';
