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
import type { Entity } from '@backstage/catalog-model';
import type { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { MtaApplicationSourceField } from '../../../src/components/MtaApplicationSourceField';
import {
  REPOSITORY_ERROR,
  type MtaApplicationValue,
} from '../../../src/onboarding/applicationValue';
import { createCatalog } from '../../fixtures/catalog';
import type { CustomGalleryState } from '../states';

/**
 * The registration field needs the props the Scaffolder form passes. The
 * gallery owns the form value, the same way the form does, and none of the
 * form internals are read by the field.
 */
function RegistrationField({
  initialFormData,
  rawErrors = [],
}: {
  initialFormData: MtaApplicationValue;
  rawErrors?: string[];
}) {
  const [formData, setFormData] = useState<MtaApplicationValue | undefined>(
    initialFormData,
  );
  return (
    <MtaApplicationSourceField
      {...({
        schema: {},
        uiSchema: {},
        idSchema: { $id: 'root_application' },
        formData,
        onChange: setFormData,
        onBlur: () => {},
        onFocus: () => {},
        disabled: false,
        readonly: false,
        name: 'application',
        rawErrors,
        registry: {},
      } as unknown as FieldExtensionComponentProps<MtaApplicationValue>)}
    />
  );
}

const registeredApplication: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'legacy-crm-backend',
    namespace: 'default',
    title: 'Legacy CRM backend',
    annotations: {
      'backstage.io/source-location':
        'url:https://github.com/acme/legacy-crm-backend',
    },
  },
  spec: { type: 'service', owner: 'group:default/crm-team' },
};

/** Tiles for the registration onboarding field (PR 12). */
export const registrationStates: CustomGalleryState[] = [
  {
    id: 'feature-registration-catalog',
    name: 'Registration field, catalog application selected',
    trigger: 'A saved Component reference resolves to its repository.',
    kind: 'custom',
    apis: { catalogApi: createCatalog([registeredApplication]) },
    render: () => (
      <RegistrationField
        initialFormData={{
          applicationSource: 'catalog',
          entityRef: 'component:default/legacy-crm-backend',
        }}
      />
    ),
  },
  {
    id: 'feature-registration-repository',
    name: 'Registration field, repository URL entered',
    trigger: 'A repository URL and root path are entered directly.',
    kind: 'custom',
    apis: { catalogApi: createCatalog([]) },
    render: () => (
      <RegistrationField
        initialFormData={{
          applicationSource: 'repository',
          repoUrl: 'https://github.com/acme/legacy-crm-backend',
          rootPath: 'services/api',
        }}
      />
    ),
  },
  {
    id: 'feature-registration-error',
    name: 'Registration field, validation error after blur',
    trigger: 'The repository URL is not a supported Git URL.',
    kind: 'custom',
    apis: { catalogApi: createCatalog([]) },
    render: () => (
      <RegistrationField
        initialFormData={{
          applicationSource: 'repository',
          repoUrl: 'not a url',
        }}
        rawErrors={[REPOSITORY_ERROR]}
      />
    ),
  },
  {
    id: 'feature-registration-unavailable',
    name: 'Registration field, saved selection no longer available',
    trigger: 'The saved Component reference no longer resolves.',
    kind: 'custom',
    apis: { catalogApi: createCatalog([]) },
    render: () => (
      <RegistrationField
        initialFormData={{
          applicationSource: 'catalog',
          entityRef: 'component:default/deleted-app',
        }}
      />
    ),
  },
];
