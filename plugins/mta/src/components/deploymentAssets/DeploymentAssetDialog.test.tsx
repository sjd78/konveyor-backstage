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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import {
  ASSET_BRANCH_NAME,
  deploymentAssetsApiRef,
  type AssetCommitResult,
  type AssetRenderResult,
  type DeploymentAssetApplication,
  type DeploymentAssetsApi,
} from '../../api/deploymentAssets';
import {
  ASSET_FIXTURE_GENERATORS,
  renderAssetFixture,
} from '../../../dev/fixtures/deploymentAssets';
import { DeploymentAssetDialog } from './DeploymentAssetDialog';

const APPLICATION: DeploymentAssetApplication = {
  id: 7,
  name: 'example-app',
  repository: {
    url: 'https://github.com/konveyor/example-applications.git',
  },
};

const sourceFiles: AssetRenderResult = {
  generators: ASSET_FIXTURE_GENERATORS,
  assets: renderAssetFixture('example-app', APPLICATION.repository!.url),
};

function createApi() {
  return {
    renderDeploymentAssets: jest.fn(),
    commitDeploymentAssets: jest.fn(),
    getDeliveredAssets: jest.fn(),
  };
}

type MockApi = ReturnType<typeof createApi>;

function renderDialog({
  api,
  onClose = jest.fn(),
}: {
  api: MockApi;
  onClose?: () => void;
}) {
  render(
    <MemoryRouter>
      <TestApiProvider
        apis={[[deploymentAssetsApiRef, api as unknown as DeploymentAssetsApi]]}
      >
        <DeploymentAssetDialog
          open
          onClose={onClose}
          application={APPLICATION}
        />
      </TestApiProvider>
    </MemoryRouter>,
  );
  return { onClose };
}

const previewReady = () =>
  screen.findByRole('heading', {
    name: `Files (${sourceFiles.assets.length})`,
  });

const file = (path: string) => screen.getByRole('button', { name: path });

const viewer = (path: string) =>
  screen.getByRole('region', { name: `Contents of ${path}` });

describe('DeploymentAssetDialog', () => {
  let api: MockApi;

  beforeEach(() => {
    api = createApi();
    api.renderDeploymentAssets.mockResolvedValue(sourceFiles);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the files for the application and previews the first one', async () => {
    renderDialog({ api });
    expect(
      screen.getByRole('heading', {
        name: 'Deployment assets for example-app',
      }),
    ).toBeInTheDocument();
    // The loading state announces the work while the Hub renders.
    expect(screen.getByText('Preparing files.')).toBeInTheDocument();

    await previewReady();
    expect(api.renderDeploymentAssets).toHaveBeenCalledWith(
      expect.objectContaining({ application: APPLICATION }),
    );
    expect(viewer('Containerfile')).toHaveTextContent(
      'FROM registry.access.redhat.com/ubi9/openjdk-21',
    );
    // The first file takes focus once the files appear.
    expect(file('Containerfile')).toHaveFocus();
    expect(
      screen.getByText('New branch', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText(ASSET_BRANCH_NAME)).toBeInTheDocument();
    expect(
      screen.getByText('konveyor/example-applications'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download ZIP' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Commit files' }),
    ).toBeInTheDocument();
  });

  it('downloads an archive that holds every rendered file', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    const clicked: HTMLAnchorElement[] = [];
    jest
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        blobs.push(blob as Blob);
        return 'blob:deployment-assets';
      });
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function capture(this: HTMLAnchorElement) {
        clicked.push(this);
      });

    renderDialog({ api });
    await previewReady();
    await user.click(screen.getByRole('button', { name: 'Download ZIP' }));

    expect(
      await screen.findByRole('heading', { name: 'Archive downloaded' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${sourceFiles.assets.length} files in`, {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('example-app-deployment-assets.zip'),
    ).toBeInTheDocument();

    expect(blobs).toHaveLength(1);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('example-app-deployment-assets.zip');
    const text = await blobs[0].text();
    for (const asset of sourceFiles.assets) {
      expect(text).toContain(`example-app-deployment-assets/${asset.path}`);
      expect(text).toContain(asset.content.split('\n')[0]);
    }
  });

  it('reports an unsafe file name instead of delivering the archive', async () => {
    const user = userEvent.setup();
    api.renderDeploymentAssets.mockResolvedValue({
      generators: ASSET_FIXTURE_GENERATORS,
      assets: [
        {
          path: '../outside.txt',
          generatorId: 'container',
          content: 'x',
        },
      ],
    });
    renderDialog({ api });
    await screen.findByRole('heading', { name: 'Files (1)' });

    await user.click(screen.getByRole('button', { name: 'Download ZIP' }));
    expect(
      screen.getByText('Could not create the archive'),
    ).toBeInTheDocument();
    expect(screen.getByText(/unsafe path segment/)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Archive downloaded' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download ZIP' })).toBeEnabled();
  });

  it('commits to a new branch of the source repository and links to it', async () => {
    const user = userEvent.setup();
    const result: AssetCommitResult = {
      repositoryUrl: APPLICATION.repository!.url,
      branch: ASSET_BRANCH_NAME,
      branchUrl:
        'https://github.com/konveyor/example-applications/tree/mta/deployment-assets',
    };
    api.commitDeploymentAssets.mockResolvedValue(result);
    renderDialog({ api });
    await previewReady();

    await user.click(screen.getByRole('button', { name: 'Commit files' }));
    expect(
      await screen.findByRole('heading', {
        name: `${sourceFiles.assets.length} files committed`,
      }),
    ).toBeInTheDocument();
    expect(api.commitDeploymentAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        application: APPLICATION,
        repository: 'source',
        repositoryUrl: APPLICATION.repository!.url,
      }),
    );
    expect(screen.getByText(ASSET_BRANCH_NAME)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open branch' })).toHaveAttribute(
      'href',
      result.branchUrl,
    );
    expect(
      screen.getByText(
        'The default branch is not changed. Open a pull request in your Git provider to merge it.',
      ),
    ).toBeInTheDocument();
  });

  it('links to the repository when the Hub returns no branch URL', async () => {
    const user = userEvent.setup();
    api.commitDeploymentAssets.mockResolvedValue({
      repositoryUrl: APPLICATION.repository!.url,
      branch: ASSET_BRANCH_NAME,
    });
    renderDialog({ api });
    await previewReady();

    await user.click(screen.getByRole('button', { name: 'Commit files' }));
    // The repository URL is the normalized web URL, without the .git suffix.
    expect(
      await screen.findByRole('link', { name: 'Open repository' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/konveyor/example-applications',
    );
  });

  it('keeps the files and reports a failed commit', async () => {
    const user = userEvent.setup();
    api.commitDeploymentAssets.mockRejectedValue(
      new Error('The repository is read only.'),
    );
    renderDialog({ api });
    await previewReady();

    await user.click(screen.getByRole('button', { name: 'Commit files' }));
    expect(
      await screen.findByText('Could not commit files'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The repository is read only. Your choices are kept.'),
    ).toBeInTheDocument();
    expect(viewer('Containerfile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit files' })).toBeEnabled();
  });

  it('reports a failed render and retries it', async () => {
    const user = userEvent.setup();
    api.renderDeploymentAssets
      .mockRejectedValueOnce(new Error('The Hub is unavailable.'))
      .mockResolvedValueOnce(sourceFiles);
    renderDialog({ api });

    expect(
      await screen.findByText('Could not prepare deployment assets'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The Hub is unavailable. Your selections are kept when you retry.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await previewReady();
    expect(api.renderDeploymentAssets).toHaveBeenCalledTimes(2);
  });

  it('explains an empty result and closes', async () => {
    const user = userEvent.setup();
    api.renderDeploymentAssets.mockResolvedValue({
      generators: [],
      assets: [],
    });
    const { onClose } = renderDialog({ api });

    expect(
      await screen.findByText('No deployment assets for this application'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The selected target has no generators that apply to example-app. Ask your migration architect to add generators to the target in MTA.',
      ),
    ).toBeInTheDocument();

    // The dialog header also has a Close button, so take the footer one.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for the configuration URL before committing there', async () => {
    const user = userEvent.setup();
    api.commitDeploymentAssets.mockResolvedValue({
      repositoryUrl: 'https://github.com/acme/deploy-config',
      branch: ASSET_BRANCH_NAME,
    });
    renderDialog({ api });
    await previewReady();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.click(
      screen.getByRole('radio', { name: /Separate configuration repository/ }),
    );
    const url = screen.getByRole('textbox', {
      name: 'Configuration repository URL',
    });
    expect(url).toHaveAccessibleDescription(
      'Files are committed to this repository on a new branch',
    );

    // Committing without a usable URL opens the field instead of calling the API.
    await user.click(screen.getByRole('button', { name: 'Commit files' }));
    expect(api.commitDeploymentAssets).not.toHaveBeenCalled();
    expect(url).toHaveAccessibleDescription(
      'Enter a Git repository URL, such as https://github.com/acme/deploy-config',
    );
    await waitFor(() => expect(url).toHaveFocus());

    // A single change event: typing this URL one key at a time makes the test
    // depend on machine speed rather than on the validation it proves.
    fireEvent.change(url, {
      target: { value: 'https://github.com/acme/deploy-config' },
    });
    await user.click(screen.getByRole('button', { name: 'Commit files' }));
    await screen.findByRole('heading', {
      name: `${sourceFiles.assets.length} files committed`,
    });
    expect(api.commitDeploymentAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: 'config',
        repositoryUrl: 'https://github.com/acme/deploy-config',
      }),
    );
    const result = await screen.findByText('acme/deploy-config');
    expect(result).toBeInTheDocument();
  });
});
