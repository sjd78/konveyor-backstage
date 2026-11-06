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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApiHolder } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import type { Entity } from '@backstage/catalog-model';
import {
  CONTRADICTION_ERROR,
  REPOSITORY_ERROR,
  ROOT_PATH_ERROR,
  SELECTION_ERROR,
  UNAVAILABLE_ERROR,
  VERIFICATION_ERROR,
  type MtaApplicationValue,
} from '../onboarding/applicationValue';
import { REPOSITORY_MISSING_PROBLEM } from '../repository';
import {
  MtaApplicationSourceField,
  validateMtaApplicationSource,
} from './MtaApplicationSourceField';

/**
 * The registration field as the Scaffolder renders it: the harness owns the
 * form value, the field resolves a saved catalog reference and searches a
 * bounded catalog, and the validator the template runs is invoked directly.
 */

type Catalog = (typeof catalogApiRef)['T'];

const component = (overrides: Partial<Entity> = {}): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'app',
    namespace: 'default',
    title: 'App',
    annotations: {
      'backstage.io/source-location': 'url:https://github.com/acme/app',
    },
  },
  spec: { type: 'service', owner: 'group:default/team' },
  ...overrides,
});

function createCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    getEntityByRef: jest.fn().mockResolvedValue(undefined),
    queryEntities: jest
      .fn()
      .mockResolvedValue({ items: [], totalItems: 0, pageInfo: {} }),
    getEntities: jest.fn(),
    ...overrides,
  } as unknown as Catalog;
}

function fieldProps(
  overrides: Partial<FieldExtensionComponentProps<MtaApplicationValue>> = {},
): FieldExtensionComponentProps<MtaApplicationValue> {
  return {
    schema: {},
    uiSchema: {},
    idSchema: { $id: 'root_application' },
    formData: undefined,
    onChange: jest.fn(),
    onBlur: jest.fn(),
    onFocus: jest.fn(),
    disabled: false,
    readonly: false,
    name: 'application',
    rawErrors: [],
    registry: {},
    ...overrides,
  } as unknown as FieldExtensionComponentProps<MtaApplicationValue>;
}

/** The form value behaves like the Scaffolder form: onChange replaces it. */
function Harness({
  catalog,
  initialFormData,
  rawErrors = [],
  onChange,
  disabled,
}: {
  catalog: Catalog;
  initialFormData?: MtaApplicationValue;
  rawErrors?: string[];
  onChange?: (next: MtaApplicationValue | undefined) => void;
  disabled?: boolean;
}) {
  const [formData, setFormData] = useState<MtaApplicationValue | undefined>(
    initialFormData,
  );
  return (
    <TestApiProvider apis={[[catalogApiRef, catalog]]}>
      <MtaApplicationSourceField
        {...fieldProps({
          formData,
          rawErrors,
          disabled,
          onChange: next => {
            setFormData(next);
            onChange?.(next);
          },
        })}
      />
    </TestApiProvider>
  );
}

describe('application source field', () => {
  it('reports the missing selection after Review and moves focus to the field', () => {
    render(
      <Harness
        catalog={createCatalog()}
        initialFormData={{ applicationSource: 'catalog', entityRef: '' }}
        rawErrors={[SELECTION_ERROR]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(SELECTION_ERROR);
    expect(screen.getByLabelText('Application selection')).toHaveFocus();
  });

  it('reports a contradictory value instead of choosing one input silently', () => {
    render(
      <Harness
        catalog={createCatalog({
          getEntityByRef: jest.fn(() => new Promise(() => {})),
        })}
        initialFormData={
          // Saved and query-prefilled data is untrusted and can carry both
          // inputs, which is the case the field has to report.
          {
            applicationSource: 'catalog',
            entityRef: 'component:default/app',
            repoUrl: 'https://github.com/acme/other',
          } as unknown as MtaApplicationValue
        }
        rawErrors={[CONTRADICTION_ERROR]}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(CONTRADICTION_ERROR);
  });

  it('shows repository errors on blur and clears them when the value is fixed', async () => {
    render(<Harness catalog={createCatalog()} />);
    const url = screen.getByRole('textbox', { name: 'Repository URL' });
    await userEvent.type(url, 'not a url');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.tab();
    expect(url).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(REPOSITORY_ERROR);

    await userEvent.clear(url);
    await userEvent.type(url, 'https://github.com/acme/app');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(url).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a root path error on blur', async () => {
    render(
      <Harness
        catalog={createCatalog()}
        initialFormData={{
          applicationSource: 'repository',
          repoUrl: 'https://github.com/acme/app',
        }}
      />,
    );
    const root = screen.getByRole('textbox', {
      name: 'Application root path',
    });
    await userEvent.type(root, '../outside');
    await userEvent.tab();
    expect(root).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(ROOT_PATH_ERROR);
  });

  it('describes the repository input with its helper text', () => {
    render(<Harness catalog={createCatalog()} />);
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toHaveAccessibleDescription(
      'HTTPS and SSH repository URLs are supported.',
    );
  });

  it('resolves a saved selection and hands the derived repository to the form', async () => {
    const catalog = createCatalog({
      getEntityByRef: jest.fn().mockResolvedValue(
        component({
          metadata: {
            name: 'app',
            namespace: 'default',
            title: 'App',
            annotations: {
              'backstage.io/source-location':
                'url:https://github.com/acme/app/tree/main/services',
            },
          },
        }),
      ),
    });
    const onChange = jest.fn();
    render(
      <Harness
        catalog={catalog}
        onChange={onChange}
        initialFormData={{
          applicationSource: 'catalog',
          entityRef: 'component:default/app',
        }}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Selected application' }),
      ).toHaveTextContent('App'),
    );
    const summary = screen.getByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('https://github.com/acme/app');
    expect(onChange).toHaveBeenCalledWith({
      applicationSource: 'catalog',
      entityRef: 'component:default/app',
      owner: 'group:default/team',
      repository: 'https://github.com/acme/app',
      rootPath: 'services',
    });
  });

  it('recovers to repository entry when a saved selection is gone', async () => {
    const catalog = createCatalog({
      getEntityByRef: jest.fn().mockResolvedValue(undefined),
    });
    render(
      <Harness
        catalog={catalog}
        initialFormData={{
          applicationSource: 'catalog',
          entityRef: 'component:default/gone',
        }}
      />,
    );

    const summary = await screen.findByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('Application is no longer available');

    await userEvent.click(
      screen.getByRole('button', { name: 'Change source' }),
    );
    expect(
      screen.queryByRole('region', { name: 'Selected application' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeVisible();
    expect(
      screen.getByRole('searchbox', { name: 'Application' }),
    ).toHaveFocus();
  });

  it('recovers when the catalog refuses the saved selection lookup', async () => {
    const catalog = createCatalog({
      getEntityByRef: jest.fn().mockRejectedValue(new Error('Forbidden')),
    });
    render(
      <Harness
        catalog={catalog}
        initialFormData={{
          applicationSource: 'catalog',
          entityRef: 'component:default/app',
        }}
      />,
    );
    const summary = await screen.findByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('Application is no longer available');
  });

  it('searches the catalog with a bound and finds an application beyond the first page', async () => {
    const wanted = component({
      metadata: {
        name: 'wanted-app-0420',
        namespace: 'default',
        title: 'Wanted Application',
        annotations: {
          'backstage.io/source-location': 'url:https://github.com/acme/wanted',
        },
      },
    });
    const catalog = createCatalog({
      queryEntities: jest.fn().mockResolvedValue({
        items: [wanted],
        totalItems: 1,
        pageInfo: {},
      }),
      getEntityByRef: jest.fn().mockResolvedValue(wanted),
    });
    render(<Harness catalog={catalog} />);

    const search = screen.getByRole('searchbox', { name: 'Application' });
    await userEvent.type(search, 'wanted');

    await waitFor(() => expect(catalog.queryEntities).toHaveBeenCalled());
    expect(catalog.queryEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: 'Component' },
        limit: 25,
        fullTextFilter: expect.objectContaining({ term: 'wanted' }),
        fields: expect.arrayContaining([
          'metadata.title',
          'metadata.annotations',
          'spec.owner',
        ]),
      }),
    );
    // The field never downloads the whole catalog.
    expect(catalog.getEntities).not.toHaveBeenCalled();

    const option = await screen.findByRole('option', {
      name: /Wanted Application/,
    });
    await userEvent.click(option);

    expect(catalog.getEntityByRef).toHaveBeenCalledWith(
      'component:default/wanted-app-0420',
    );
    const summary = await screen.findByRole('region', {
      name: 'Selected application',
    });
    expect(summary).toHaveTextContent('wanted-app-0420');
  });

  it('cannot be changed while the template locks the field', () => {
    render(<Harness catalog={createCatalog()} disabled />);
    expect(
      screen.queryByRole('searchbox', { name: 'Application' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Application' })).toBeDisabled();
    expect(
      screen.getByRole('textbox', { name: 'Repository URL' }),
    ).toBeDisabled();
  });
});

describe('application source validation', () => {
  function apiHolder(apis: {
    catalog?: Catalog;
    integrations?: { byHost: (host: string) => { type: string } | undefined };
  }): ApiHolder {
    return {
      get: (ref: unknown) => {
        if (ref === catalogApiRef) return apis.catalog;
        if (ref === scmIntegrationsApiRef) return apis.integrations;
        return undefined;
      },
    } as unknown as ApiHolder;
  }

  async function validate(
    value: MtaApplicationValue,
    holder: ApiHolder,
  ): Promise<string[]> {
    const addError = jest.fn();
    await validateMtaApplicationSource(
      value,
      { addError },
      {
        apiHolder: holder,
        formData: {},
        schema: {},
      },
    );
    return addError.mock.calls.map(([message]) => message);
  }

  it('reports shape errors without a catalog lookup', async () => {
    const catalog = createCatalog();
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: '' },
        apiHolder({ catalog }),
      ),
    ).toEqual([SELECTION_ERROR]);
    expect(catalog.getEntityByRef).not.toHaveBeenCalled();
  });

  it('verifies that a catalog selection still exists and is a Component', async () => {
    const valid = createCatalog({
      getEntityByRef: jest.fn().mockResolvedValue(component()),
    });
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({ catalog: valid }),
      ),
    ).toEqual([]);

    const gone = createCatalog({
      getEntityByRef: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({ catalog: gone }),
      ),
    ).toEqual([UNAVAILABLE_ERROR]);

    const outage = createCatalog({
      getEntityByRef: jest.fn().mockRejectedValue(new Error('Forbidden')),
    });
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({ catalog: outage }),
      ),
    ).toEqual([VERIFICATION_ERROR]);

    const wrongKind = createCatalog({
      getEntityByRef: jest
        .fn()
        .mockResolvedValue(component({ kind: 'System' })),
    });
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({ catalog: wrongKind }),
      ),
    ).toEqual([
      'Select a catalog application. Only Components can be registered.',
    ]);
  });

  it('reports a selected Component without a source repository', async () => {
    const catalog = createCatalog({
      getEntityByRef: jest.fn().mockResolvedValue(
        component({
          metadata: { name: 'app', namespace: 'default', title: 'App' },
        }),
      ),
    });
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({ catalog }),
      ),
    ).toEqual([REPOSITORY_MISSING_PROBLEM]);
  });

  it('cannot verify a catalog selection when the host provides no catalog', async () => {
    expect(
      await validate(
        { applicationSource: 'catalog', entityRef: 'component:default/app' },
        apiHolder({}),
      ),
    ).toEqual([VERIFICATION_ERROR]);
  });
});
