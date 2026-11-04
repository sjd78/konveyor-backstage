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
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetFileBrowser } from './AssetFileBrowser';
// The gallery renders this fixture, so the browser tests step through the same
// files a reviewer can see in the browser.
import {
  ASSET_FIXTURE_GENERATORS,
  LONG_PATH_ASSETS,
  renderAssetFixture,
} from '../../../dev/fixtures/deploymentAssets';
import type { AssetGenerator, RenderedAsset } from '../../api/deploymentAssets';

const fixtureAssets = renderAssetFixture(
  'example-app',
  'https://github.com/konveyor/example-applications.git',
);

function Harness({
  files = fixtureAssets,
  generators = ASSET_FIXTURE_GENERATORS,
  initialPath = fixtureAssets[0].path,
}: {
  files?: RenderedAsset[];
  generators?: AssetGenerator[];
  initialPath?: string;
}) {
  const [selectedPath, setSelectedPath] = useState(initialPath);
  return (
    <AssetFileBrowser
      generators={generators}
      assets={files}
      selectedPath={selectedPath}
      onSelect={setSelectedPath}
    />
  );
}

const file = (path: string) => screen.getByRole('button', { name: path });

const viewer = (path: string) =>
  screen.getByRole('region', { name: `Contents of ${path}` });

describe('AssetFileBrowser', () => {
  it('arrow keys follow the focused file, not the selected one', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = file('Containerfile');
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(viewer('Containerfile')).toBeInTheDocument();

    // Tab moves focus without changing the selection: the next group header,
    // then deployment.yaml, then the third file, configmap.yaml.
    act(() => first.focus());
    await user.tab();
    expect(
      screen.getByRole('button', { name: /OpenShift Deployment/ }),
    ).toHaveFocus();
    await user.tab();
    const second = file('k8s/base/deployment.yaml');
    expect(second).toHaveFocus();
    expect(second).not.toHaveAttribute('aria-current');

    await user.tab();
    const third = file('k8s/base/configmap.yaml');
    expect(third).toHaveFocus();
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(viewer('Containerfile')).toBeInTheDocument();

    // From the focused third file, ArrowDown must reach the fourth, not the
    // second file after the selected one.
    await user.keyboard('{ArrowDown}');
    const fourth = file('k8s/base/hpa.yaml');
    expect(fourth).toHaveFocus();
    expect(viewer('k8s/base/hpa.yaml')).toHaveTextContent(
      'HorizontalPodAutoscaler',
    );
  });

  it('Home and End reach the first and last visible file and arrows stop at the ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    act(() => file('Containerfile').focus());
    await user.keyboard('{End}');
    const last = file('.tekton/pipelinerun-pr.yaml');
    expect(last).toHaveFocus();
    expect(viewer('.tekton/pipelinerun-pr.yaml')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(last).toHaveFocus();

    await user.keyboard('{Home}');
    const first = file('Containerfile');
    expect(first).toHaveFocus();
    expect(viewer('Containerfile')).toBeInTheDocument();

    await user.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();
  });

  it('collapsing a group hides its files and ArrowUp stays on the nearest visible file', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(viewer('Containerfile')).toBeInTheDocument();

    const group = screen.getByRole('button', { name: /Container Build/ });
    await user.click(group);
    expect(group).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Containerfile' }),
    ).not.toBeInTheDocument();

    // Mouse selection in a later group, then ArrowUp from that focused row.
    // The selected file is hidden, so the nearest visible file before the
    // GitOps group is the last Service file.
    await user.click(file('k8s/base/kustomization.yaml'));
    expect(viewer('k8s/base/kustomization.yaml')).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    const nearest = file('k8s/base/route.yaml');
    expect(nearest).toHaveFocus();
    expect(viewer('k8s/base/route.yaml')).toBeInTheDocument();
  });

  it('mouse selection and arrows stay in sync while stepping through files', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(file('k8s/overlays/dev/kustomization.yaml'));
    expect(viewer('k8s/overlays/dev/kustomization.yaml')).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(file('k8s/overlays/prod/kustomization.yaml')).toHaveFocus();
    expect(viewer('k8s/overlays/prod/kustomization.yaml')).toBeInTheDocument();

    await user.keyboard('{ArrowUp}');
    expect(file('k8s/overlays/dev/kustomization.yaml')).toHaveFocus();
  });

  it('labels the preview and announces a copied file', async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<Harness />);

    expect(viewer('Containerfile')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Source of Containerfile' }),
    ).toHaveTextContent('FROM registry.access.redhat.com/ubi9/openjdk-21');

    await user.click(
      screen.getByRole('button', { name: 'Copy file contents' }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('File contents copied to clipboard'),
    ).toBeInTheDocument();
  });

  it('discloses a clipped directory on focus and hover, and never for a short path', async () => {
    const user = userEvent.setup();
    const [long, short] = LONG_PATH_ASSETS;
    const directory =
      'a-very-long-directory-name-for-a-migration-template/nested-module-with-a-long-name/';
    render(<Harness files={LONG_PATH_ASSETS} initialPath={short.path} />);

    const longRow = file(long.path);
    // jsdom has no layout: give the directory a box narrower than its text so
    // the same measurement the browser uses reports it as clipped.
    const directoryText = within(longRow).getByText(directory, {
      exact: true,
    });
    Object.defineProperty(directoryText, 'scrollWidth', {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(directoryText, 'clientWidth', {
      configurable: true,
      value: 140,
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // A long directory discloses the full path on hover.
    await user.hover(longRow);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(long.path);

    // A short path fits, so it never gets a tooltip.
    await user.hover(file(short.path));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // The same disclosure opens on keyboard focus and closes when focus leaves.
    act(() => longRow.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(long.path);
    act(() => longRow.blur());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
