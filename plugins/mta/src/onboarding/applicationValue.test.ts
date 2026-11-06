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

import type { Entity } from '@backstage/catalog-model';
import {
  BROWSE_URL_ERROR,
  COMPONENT_ERROR,
  CONTRADICTION_ERROR,
  normalizeApplicationValue,
  REPOSITORY_ERROR,
  ROOT_PATH_ERROR,
  SELECTION_ERROR,
  UNAVAILABLE_ERROR,
  VERIFICATION_ERROR,
  validateApplicationShape,
  verifyCatalogApplication,
} from './applicationValue';
import {
  REPOSITORY_MISSING_PROBLEM,
  resolveRepositorySource,
} from '../repository';

/**
 * Unit level proof of the registration contract: the shape rules the field
 * renders and the validator enforces, plus the async catalog lookup the
 * validator adds for a catalog selection.
 */

const entity = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'test', namespace: 'default', annotations },
  spec: { type: 'service', owner: 'group:default/team' },
});

/** Shape rules plus the resolver the async validator runs for catalog values. */
function catalogErrors(value: unknown, selected: Entity | undefined): string[] {
  const errors = validateApplicationShape(value);
  if (errors.length || !selected) return errors;
  const problem = resolveRepositorySource(selected).problem;
  return problem ? [problem] : [];
}

describe('repository values', () => {
  it('accepts HTTPS, ports, SSH schemes, SCP syntax and a root path', () => {
    const cases: Record<string, unknown> = {
      'valid-https': {
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app',
      },
      'valid-port': {
        applicationSource: 'repository',
        repoUrl: 'https://git.example.test:8443/acme/app',
      },
      'valid-ssh': {
        applicationSource: 'repository',
        repoUrl: 'ssh://git@git.example.test:2222/acme/app.git',
      },
      'valid-scp': {
        applicationSource: 'repository',
        repoUrl: 'git@git.example.test:acme/app.git',
      },
      'valid-root': {
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app',
        rootPath: 'services/app',
      },
    };
    for (const [id, value] of Object.entries(cases)) {
      expect([id, validateApplicationShape(value)]).toEqual([id, []]);
    }
  });

  it('rejects credentials, a query and a traversal root', () => {
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://audit-marker@github.com/acme/app',
      }),
    ).toEqual([REPOSITORY_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://audit-user:demo-marker@github.com/acme/app',
      }),
    ).toEqual([REPOSITORY_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app?demo=yes',
      }),
    ).toEqual([REPOSITORY_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app',
        rootPath: '../other',
      }),
    ).toEqual([ROOT_PATH_ERROR]);
  });

  it('asks for the repository root when a browse URL is entered', () => {
    for (const browse of [
      'https://github.com/acme/app/tree/main',
      'https://github.com/acme/app/blob/main/README.md',
      'https://gitlab.com/acme/app/-/tree/main/services',
    ]) {
      expect([
        browse,
        validateApplicationShape({
          applicationSource: 'repository',
          repoUrl: browse,
        }),
      ]).toEqual([browse, [BROWSE_URL_ERROR]]);
    }
  });

  it('does not reject a clone URL suffix, trailing slash, host case or default port', () => {
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app.git',
      }),
    ).toEqual([]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://github.com/acme/app/',
      }),
    ).toEqual([]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://GitHub.com/acme/app',
      }),
    ).toEqual([]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 'https://github.com:443/acme/app',
      }),
    ).toEqual([]);
  });
});

describe('catalog values', () => {
  it('accepts a valid Component and resolves its source', () => {
    const value = {
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
    };
    expect(validateApplicationShape(value)).toEqual([]);
    const selected = entity({
      'backstage.io/source-location': 'url:https://github.com/acme/app',
    });
    expect(catalogErrors(value, selected)).toEqual([]);
    expect(resolveRepositorySource(selected).cloneUrl).toBe(
      'https://github.com/acme/app',
    );
  });

  it('rejects a non-Component reference before any lookup', () => {
    expect(
      validateApplicationShape({
        applicationSource: 'catalog',
        entityRef: 'system:default/test',
      }),
    ).toEqual([COMPONENT_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'catalog',
        entityRef: 'component:default/test',
      }),
    ).toEqual([]);
    expect(
      validateApplicationShape({
        applicationSource: 'catalog',
        entityRef: 'not-a-ref',
      }),
    ).toEqual([COMPONENT_ERROR]);
  });

  it('accepts a Component whose source is a branch URL', () => {
    const value = {
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
    };
    const selected = entity({
      'backstage.io/source-location':
        'url:https://github.com/acme/app/tree/main',
    });
    expect(validateApplicationShape(value)).toEqual([]);
    expect(catalogErrors(value, selected)).toEqual([]);
    const resolved = resolveRepositorySource(selected);
    expect(resolved.cloneUrl).toBe('https://github.com/acme/app');
    expect(resolved.ref).toBe('main');
  });

  it('reports the resolver problem for a Component without a source', () => {
    const value = {
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
    };
    expect(catalogErrors(value, entity({}))).toEqual([
      REPOSITORY_MISSING_PROBLEM,
    ]);
  });
});

describe('async catalog lookup', () => {
  it('reports outage, deletion and non-Components', async () => {
    const component = entity({
      'mta.konveyor.io/repo-url': 'https://github.com/acme/app',
    });
    await expect(
      verifyCatalogApplication(async () => component),
    ).resolves.toBeUndefined();
    await expect(verifyCatalogApplication(async () => undefined)).resolves.toBe(
      UNAVAILABLE_ERROR,
    );
    await expect(
      verifyCatalogApplication(async () => {
        throw new Error('Catalog unavailable (503)');
      }),
    ).resolves.toBe(VERIFICATION_ERROR);
    await expect(
      verifyCatalogApplication(async () => ({ ...component, kind: 'System' })),
    ).resolves.toBe(COMPONENT_ERROR);
    await expect(
      verifyCatalogApplication(async () => entity({})),
    ).resolves.toBe(REPOSITORY_MISSING_PROBLEM);
  });

  it('treats a deleted reference as a lookup outcome, not a shape outcome', async () => {
    const value = {
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
    };
    expect(validateApplicationShape(value)).toEqual([]);
    expect(await verifyCatalogApplication(async () => undefined)).toBe(
      UNAVAILABLE_ERROR,
    );
  });
});

describe('discriminators and value types', () => {
  it('rejects contradictory discriminators and dual inputs', () => {
    expect(
      validateApplicationShape({
        applicationSource: 'catalog',
        repoUrl: 'https://github.com/acme/app',
      }),
    ).toEqual([CONTRADICTION_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        entityRef: 'component:default/test',
      }),
    ).toEqual([CONTRADICTION_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'catalog',
        entityRef: 'component:default/test',
        repoUrl: 'https://github.com/acme/other',
      }),
    ).toEqual([CONTRADICTION_ERROR]);
    expect(
      validateApplicationShape({
        applicationSource: 'repository',
        entityRef: 'component:default/test',
        repoUrl: 'https://github.com/acme/other',
      }),
    ).toEqual([CONTRADICTION_ERROR]);
  });

  it('infers a missing discriminator from the single value', () => {
    const catalog = normalizeApplicationValue({
      entityRef: 'component:default/test',
    });
    expect(catalog.errors).toEqual([]);
    expect(catalog.value.applicationSource).toBe('catalog');

    const repository = normalizeApplicationValue({
      repoUrl: 'https://github.com/acme/app',
    });
    expect(repository.errors).toEqual([]);
    expect(repository.value.applicationSource).toBe('repository');

    expect(
      normalizeApplicationValue({ applicationSource: 'catalog' }).errors,
    ).toEqual([SELECTION_ERROR]);
  });

  it('drops non-string values instead of crashing', () => {
    const result = normalizeApplicationValue({
      applicationSource: 'repository',
      repoUrl: 42,
      rootPath: 7,
    });
    expect(result.value.repoUrl).toBeUndefined();
    expect(result.value.rootPath).toBeUndefined();
    // No usable field remains, so the member sees the empty selection message,
    // not a contradiction about a value that was dropped.
    expect(result.errors).toEqual([SELECTION_ERROR]);
    expect(() =>
      validateApplicationShape({
        applicationSource: 'repository',
        repoUrl: 42,
      }),
    ).not.toThrow();

    const mixed = normalizeApplicationValue({
      entityRef: 'component:default/test',
      repoUrl: 42,
    });
    expect(mixed.value.entityRef).toBe('component:default/test');
    expect(mixed.value.repoUrl).toBeUndefined();
    expect(mixed.errors).toEqual([]);
  });

  it('treats null, strings and arrays as no selection', () => {
    for (const value of [null, undefined, '', 'component:default/test', []]) {
      expect(validateApplicationShape(value)).toEqual([SELECTION_ERROR]);
      expect(normalizeApplicationValue(value)).toEqual({
        value: {},
        errors: [SELECTION_ERROR],
      });
    }
    expect(
      validateApplicationShape([
        { applicationSource: 'catalog', entityRef: 'component:default/test' },
      ]),
    ).toEqual([SELECTION_ERROR]);
  });
});

describe('normalization', () => {
  it('keeps display fields and discards unknown ones', () => {
    const result = normalizeApplicationValue({
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
      owner: 'group:default/team',
      repository: 'https://github.com/acme/app',
      rootPath: 'services/app',
      alreadyRegistered: true,
      extra: 'ignored',
    });
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      applicationSource: 'catalog',
      entityRef: 'component:default/test',
      owner: 'group:default/team',
      repository: 'https://github.com/acme/app',
      rootPath: 'services/app',
      alreadyRegistered: true,
    });
  });

  it('trims values and keeps a valid root path', () => {
    const result = normalizeApplicationValue({
      applicationSource: 'repository',
      repoUrl: '  https://github.com/acme/app  ',
      rootPath: 'services/app',
    });
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({
      applicationSource: 'repository',
      repoUrl: 'https://github.com/acme/app',
      rootPath: 'services/app',
    });
  });
});
