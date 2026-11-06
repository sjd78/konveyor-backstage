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
import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DeploymentAssetRepository } from '../../api/deploymentAssets';
import { AssetRepositorySettings } from './AssetRepositorySettings';

const SOURCE_URL = 'https://github.com/konveyor/example-applications.git';
const HELPER = 'Files are committed to this repository on a new branch';
const ERROR =
  'Enter a Git repository URL, such as https://github.com/acme/deploy-config';

function Harness({
  initialRepository = 'source',
  initialUrl = '',
  showUrlError = false,
  disabled = false,
}: {
  initialRepository?: DeploymentAssetRepository;
  initialUrl?: string;
  showUrlError?: boolean;
  disabled?: boolean;
}) {
  const [repository, setRepository] =
    useState<DeploymentAssetRepository>(initialRepository);
  const [configRepoUrl, setConfigRepoUrl] = useState(initialUrl);
  const urlInputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <AssetRepositorySettings
        id="settings"
        repository={repository}
        sourceRepoUrl={SOURCE_URL}
        configRepoUrl={configRepoUrl}
        showUrlError={showUrlError}
        disabled={disabled}
        urlInputRef={urlInputRef}
        onRepositoryChange={setRepository}
        onConfigRepoUrlChange={setConfigRepoUrl}
        onConfigRepoUrlBlur={() => {}}
      />
      <button type="button" onClick={() => urlInputRef.current?.focus()}>
        Focus the URL
      </button>
    </>
  );
}

const field = () =>
  screen.getByRole('textbox', { name: 'Configuration repository URL' });

describe('AssetRepositorySettings', () => {
  it('offers the source repository and a separate configuration repository', () => {
    render(<Harness />);
    expect(
      screen.getByRole('radiogroup', {
        name: 'Repository for the new branch',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /Application source repository/ }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /Separate configuration repository/ }),
    ).not.toBeChecked();
    expect(
      screen.getByText('konveyor/example-applications'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {
        name: 'Configuration repository URL',
      }),
    ).not.toBeInTheDocument();
  });

  it('asks for the configuration URL only for the separate repository', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(
      screen.getByRole('radio', { name: /Separate configuration repository/ }),
    );
    expect(field()).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription(HELPER);

    await user.type(field(), 'https://github.com/acme/config');
    expect(field()).toHaveValue('https://github.com/acme/config');

    await user.click(
      screen.getByRole('radio', { name: /Application source repository/ }),
    );
    expect(
      screen.queryByRole('textbox', {
        name: 'Configuration repository URL',
      }),
    ).not.toBeInTheDocument();
  });

  it('replaces the helper text with the error in the accessible description', () => {
    const { rerender } = render(
      <Harness initialRepository="config" initialUrl="bad-url" />,
    );
    expect(field()).toHaveAccessibleDescription(HELPER);
    rerender(
      <Harness initialRepository="config" initialUrl="bad-url" showUrlError />,
    );
    expect(field()).toHaveAccessibleDescription(ERROR);
    expect(screen.queryByText(HELPER)).not.toBeInTheDocument();
    expect(screen.getByText(ERROR)).toBeInTheDocument();
  });

  it('keeps exactly one element for every described-by id after a remount', async () => {
    const user = userEvent.setup();
    render(
      <Harness initialRepository="config" initialUrl="bad-url" showUrlError />,
    );
    expect(field()).toHaveAccessibleDescription(ERROR);

    await user.click(
      screen.getByRole('radio', { name: /Application source repository/ }),
    );
    await user.click(
      screen.getByRole('radio', { name: /Separate configuration repository/ }),
    );
    expect(field()).toHaveAccessibleDescription(ERROR);
    const ids = field().getAttribute('aria-describedby')?.split(/\s+/) ?? [];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    }
  });

  it('moves focus to the configuration URL field when asked', async () => {
    const user = userEvent.setup();
    render(<Harness initialRepository="config" />);
    await user.click(screen.getByRole('button', { name: 'Focus the URL' }));
    expect(field()).toHaveFocus();
  });

  it('disables both choices and the URL field together', () => {
    render(<Harness initialRepository="config" disabled />);
    expect(
      screen.getByRole('radio', { name: /Application source repository/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /Separate configuration repository/ }),
    ).toBeDisabled();
    expect(field()).toBeDisabled();
  });
});
