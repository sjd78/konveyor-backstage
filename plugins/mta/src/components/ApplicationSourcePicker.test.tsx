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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Entity } from '@backstage/catalog-model';
import {
  ApplicationSourcePicker,
  type CatalogSearch,
  type SelectedApplication,
  type SourceErrors,
  type SourceValues,
} from './ApplicationSourcePicker';

/**
 * The picker is the visual layer of the registration field: one choice with
 * two ways in. These cases render it with explicit state, so each branch is
 * proven without the catalog round trip. The wrapper owns the value, the way
 * the Scaffolder form does.
 */

const emptyValues: SourceValues = { entityRef: '', repoUrl: '', rootPath: '' };

const idleSearch: CatalogSearch = {
  term: '',
  onTermChange: jest.fn(),
  results: [],
  loading: false,
  error: '',
  onRetry: jest.fn(),
  limit: 25,
};

function Picker({
  search,
  selection = { status: 'idle', entityRef: '' },
  initialValues = emptyValues,
  showErrors = false,
  errors = {},
  disabled = false,
  onChange,
}: {
  search?: Partial<CatalogSearch>;
  selection?: SelectedApplication;
  initialValues?: SourceValues;
  showErrors?: boolean;
  errors?: SourceErrors;
  disabled?: boolean;
  onChange?: (next: SourceValues) => void;
}) {
  const [values, setValues] = useState(initialValues);
  return (
    <ApplicationSourcePicker
      search={{ ...idleSearch, ...search }}
      selection={selection}
      values={values}
      onChange={next => {
        setValues(next);
        onChange?.(next);
      }}
      onTouch={jest.fn()}
      disabled={disabled}
      showErrors={showErrors}
      errors={errors}
    />
  );
}

describe('application source picker', () => {
  it('offers catalog search and repository entry as two ways in', () => {
    render(<Picker />);
    expect(
      screen.getByRole('searchbox', { name: 'Application' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeInTheDocument();
    expect(screen.getByText('or', { exact: true })).toBeInTheDocument();
  });

  it('describes the repository URL with its helper text', () => {
    render(<Picker />);
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toHaveAccessibleDescription(
      'HTTPS and SSH repository URLs are supported.',
    );
  });

  it('describes the root path as optional and for a monorepo', () => {
    render(
      <Picker
        initialValues={{
          entityRef: '',
          repoUrl: 'https://github.com/acme/app',
          rootPath: '',
        }}
      />,
    );
    const root = screen.getByRole('textbox', {
      name: 'Application root path',
    });
    expect(root).toHaveAccessibleDescription(/Optional\./);
    expect(root).toHaveAccessibleDescription(/monorepo/);
  });

  it('marks the repository field invalid and announces the error after a touch', () => {
    render(
      <Picker
        showErrors
        errors={{ repo: 'Enter a repository URL.' }}
        initialValues={{ entityRef: '', repoUrl: 'not a url', rootPath: '' }}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a repository URL.',
    );
  });

  it('shows the selection summary and returns focus to the source choice', async () => {
    const onChange = jest.fn();
    render(
      <Picker
        onChange={onChange}
        initialValues={{
          entityRef: 'component:default/app',
          repoUrl: '',
          rootPath: '',
        }}
        selection={{
          status: 'ready',
          entityRef: 'component:default/app',
          title: 'App',
          owner: 'group:default/team',
          repository: 'https://github.com/acme/app',
        }}
      />,
    );

    const summary = screen.getByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent('component:default/app');
    expect(summary).toHaveTextContent('group:default/team');
    expect(summary).toHaveTextContent('https://github.com/acme/app');

    await userEvent.click(
      screen.getByRole('button', { name: 'Change source' }),
    );
    expect(onChange).toHaveBeenCalledWith(emptyValues);
    expect(
      screen.queryByRole('region', { name: 'Selected application' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeVisible();
  });

  it('explains a saved selection that is no longer available and keeps recovery reachable', async () => {
    const onChange = jest.fn();
    render(
      <Picker
        onChange={onChange}
        initialValues={{
          entityRef: 'component:default/app',
          repoUrl: '',
          rootPath: '',
        }}
        selection={{
          status: 'unavailable',
          entityRef: 'component:default/app',
        }}
      />,
    );

    const summary = screen.getByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('Application is no longer available');
    expect(summary).toHaveTextContent(
      'It may have been removed or your access may have changed.',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Change source' }),
    );
    expect(onChange).toHaveBeenCalledWith(emptyValues);
    expect(
      screen.getByRole('searchbox', { name: 'Application' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeVisible();
  });

  it('explains a saved non-Component as a kind problem, not as availability', () => {
    render(
      <Picker
        initialValues={{
          entityRef: 'system:default/app',
          repoUrl: '',
          rootPath: '',
        }}
        selection={{
          status: 'invalid',
          entityRef: 'system:default/app',
          problem:
            'Select a catalog application. Only Components can be registered.',
        }}
      />,
    );

    const summary = screen.getByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('Application cannot be registered');
    expect(summary).toHaveTextContent('Only Components can be registered');
    expect(
      screen.queryByText('Application is no longer available'),
    ).not.toBeInTheDocument();
  });

  it('keeps a locked field inert and says why search is unavailable', () => {
    render(<Picker disabled />);
    expect(
      screen.queryByRole('searchbox', { name: 'Application' }),
    ).not.toBeInTheDocument();
    const application = screen.getByRole('textbox', { name: 'Application' });
    expect(application).toBeDisabled();
    expect(application).toHaveAccessibleDescription(
      'Catalog search is unavailable while this field is locked.',
    );
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeDisabled();
  });

  it('surfaces a catalog search failure with a retry', async () => {
    const onRetry = jest.fn();
    render(
      <Picker
        search={{ term: 'app', error: 'Catalog unavailable (503)', onRetry }}
      />,
    );
    expect(screen.getByText('Could not search applications')).toBeVisible();
    expect(screen.getByText('Catalog unavailable (503)')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the bounded result note when the list fills the request', () => {
    const entities: Entity[] = Array.from({ length: 25 }, (_, index) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: `app-${index}`, namespace: 'default', title: 'App' },
      spec: { owner: 'group:default/team' },
    }));
    render(<Picker search={{ term: 'app', results: entities }} />);
    expect(
      screen.getByText(
        'Showing the first 25 applications. Keep typing to narrow the list.',
      ),
    ).toBeVisible();
  });

  it('reports no matches without a dead end', () => {
    render(<Picker search={{ term: 'nothing', results: [] }} />);
    expect(
      screen.getByText(
        'No applications match "nothing". Try another search, or enter a repository URL below.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeVisible();
  });
});
