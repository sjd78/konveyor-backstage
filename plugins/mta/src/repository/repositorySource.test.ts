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
  isValidRepoUrl,
  parseRepositoryUrl,
  REPOSITORY_INVALID_PROBLEM,
  REPOSITORY_MISSING_PROBLEM,
  REPOSITORY_UNRESOLVED_PROBLEM,
  resolveRepositorySource,
  safeWebHref,
  shortRepoName,
  type HostClassifier,
} from './index';

// Assembled from parts because no-script-url rejects a script URL literal.
// These values exist only to prove that they never become links or clone URLs.
const unsafeScriptUrl = ['javascript', ':', 'alert(1)'].join('');

const entityWith = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'app', namespace: 'default', annotations },
});

const sourceLocation = (value: string) =>
  entityWith({ 'backstage.io/source-location': `url:${value}` });

const repoUrlAnnotation = (value: string) =>
  entityWith({ 'mta.konveyor.io/repo-url': value });

const githubEnterprise: HostClassifier = {
  byHost: host =>
    host === 'git.example.test' ? { type: 'github' } : undefined,
};

describe('resolveRepositorySource and parseRepositoryUrl', () => {
  it('resolves a GitHub tree source location to the repository root', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://github.com/acme/legacy-crm-backend/tree/main/'),
      ),
    ).toEqual({
      cloneUrl: 'https://github.com/acme/legacy-crm-backend',
      webUrl: 'https://github.com/acme/legacy-crm-backend',
      ref: 'main',
      path: undefined,
      provider: 'github',
    });
  });

  it('keeps the directory after a GitHub branch', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://github.com/acme/app/tree/main/services/api'),
      ),
    ).toEqual({
      cloneUrl: 'https://github.com/acme/app',
      webUrl: 'https://github.com/acme/app',
      ref: 'main',
      path: 'services/api',
      provider: 'github',
    });
  });

  it('drops the file name from a GitHub blob URL', () => {
    expect(
      resolveRepositorySource(
        sourceLocation(
          'https://github.com/acme/app/blob/main/services/api/catalog-info.yaml',
        ),
      ),
    ).toEqual({
      cloneUrl: 'https://github.com/acme/app',
      webUrl: 'https://github.com/acme/app',
      ref: 'main',
      path: 'services/api',
      provider: 'github',
    });
  });

  it('resolves a GitLab tree source location', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://gitlab.com/group/app/-/tree/main/'),
      ),
    ).toEqual({
      cloneUrl: 'https://gitlab.com/group/app',
      webUrl: 'https://gitlab.com/group/app',
      ref: 'main',
      path: undefined,
      provider: 'gitlab',
    });
  });

  it('resolves a nested GitLab group with a directory', () => {
    expect(
      resolveRepositorySource(
        sourceLocation(
          'https://gitlab.example.test/appdev-uxd/mta-for-rhdh/-/tree/main/svc',
        ),
      ),
    ).toEqual({
      cloneUrl: 'https://gitlab.example.test/appdev-uxd/mta-for-rhdh',
      webUrl: 'https://gitlab.example.test/appdev-uxd/mta-for-rhdh',
      ref: 'main',
      path: 'svc',
      provider: 'gitlab',
    });
  });

  it('resolves a Bitbucket src source location', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://bitbucket.org/workspace/app/src/main/'),
      ),
    ).toEqual({
      cloneUrl: 'https://bitbucket.org/workspace/app',
      webUrl: 'https://bitbucket.org/workspace/app',
      ref: 'main',
      path: undefined,
      provider: 'bitbucket',
    });
  });

  it('resolves an Azure DevOps URL with path and branch query', () => {
    expect(
      resolveRepositorySource(
        sourceLocation(
          'https://dev.azure.com/org/proj/_git/app?path=/svc&version=GBmain',
        ),
      ),
    ).toEqual({
      cloneUrl: 'https://dev.azure.com/org/proj/_git/app',
      webUrl: 'https://dev.azure.com/org/proj/_git/app',
      ref: 'main',
      path: 'svc',
      provider: 'azure',
    });
  });

  it('accepts a plain GitHub repository URL', () => {
    expect(
      resolveRepositorySource(sourceLocation('https://github.com/acme/app')),
    ).toEqual({
      cloneUrl: 'https://github.com/acme/app',
      webUrl: 'https://github.com/acme/app',
      ref: undefined,
      path: undefined,
      provider: 'github',
    });
  });

  it('does not invent a provider route for an unknown host', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://git.example.test/acme/app/tree/main'),
      ),
    ).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_UNRESOLVED_PROBLEM,
    });
  });

  it('uses the host integrations to resolve a GitHub Enterprise browse URL', () => {
    expect(
      resolveRepositorySource(
        sourceLocation('https://git.example.test/acme/app/tree/main'),
        githubEnterprise,
      ),
    ).toEqual({
      cloneUrl: 'https://git.example.test/acme/app',
      webUrl: 'https://git.example.test/acme/app',
      ref: 'main',
      path: undefined,
      provider: 'github',
    });
  });

  it('matches an enterprise host that includes a port', () => {
    const withPort: HostClassifier = {
      byHost: host =>
        host === 'git.example.test:8443' ? { type: 'github' } : undefined,
    };
    expect(
      resolveRepositorySource(
        sourceLocation('https://git.example.test:8443/acme/app/tree/main'),
        withPort,
      ),
    ).toEqual({
      cloneUrl: 'https://git.example.test:8443/acme/app',
      webUrl: 'https://git.example.test:8443/acme/app',
      ref: 'main',
      path: undefined,
      provider: 'github',
    });
  });

  it('accepts an SCP repository annotation without a web URL', () => {
    expect(
      resolveRepositorySource(repoUrlAnnotation('git@github.com:acme/app.git')),
    ).toEqual({
      cloneUrl: 'git@github.com:acme/app.git',
      provider: 'github',
    });
  });

  it('accepts an ssh repository annotation without a web URL', () => {
    expect(
      resolveRepositorySource(
        repoUrlAnnotation('ssh://git@git.example.test:2222/acme/app.git'),
      ),
    ).toEqual({
      cloneUrl: 'ssh://git@git.example.test:2222/acme/app.git',
      provider: 'other',
    });
  });

  it('rejects a javascript repository annotation', () => {
    expect(resolveRepositorySource(repoUrlAnnotation(unsafeScriptUrl))).toEqual(
      {
        cloneUrl: '',
        provider: 'other',
        problem: REPOSITORY_INVALID_PROBLEM,
      },
    );
  });

  it('rejects a data repository annotation', () => {
    expect(
      resolveRepositorySource(
        repoUrlAnnotation('data:text/plain,https://github.com/acme/app'),
      ),
    ).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_INVALID_PROBLEM,
    });
  });

  it('rejects a relative repository URL', () => {
    expect(resolveRepositorySource(repoUrlAnnotation('acme/app'))).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_INVALID_PROBLEM,
    });
  });

  it('rejects a relative source location', () => {
    expect(
      resolveRepositorySource(
        entityWith({ 'backstage.io/source-location': 'url:acme/app' }),
      ),
    ).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_INVALID_PROBLEM,
    });
  });

  it('rejects HTTPS user information in a repository annotation', () => {
    expect(
      resolveRepositorySource(
        repoUrlAnnotation('https://token123@github.com/acme/app'),
      ),
    ).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_INVALID_PROBLEM,
    });
  });

  it('prefers the repository annotation over the source location', () => {
    expect(
      resolveRepositorySource(
        entityWith({
          'mta.konveyor.io/repo-url': 'https://github.com/acme/app',
          'backstage.io/source-location':
            'url:https://github.com/acme/other/tree/main/',
        }),
      ),
    ).toEqual({
      cloneUrl: 'https://github.com/acme/app',
      webUrl: 'https://github.com/acme/app',
      ref: undefined,
      path: undefined,
      provider: 'github',
    });
  });

  it('reports missing repository information when no annotation exists', () => {
    expect(resolveRepositorySource(entityWith({}))).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_MISSING_PROBLEM,
    });
  });

  it('reports a non-url source location as unresolved', () => {
    expect(
      resolveRepositorySource(
        entityWith({
          'backstage.io/source-location': 'file:./catalog-info.yaml',
        }),
      ),
    ).toEqual({
      cloneUrl: '',
      provider: 'other',
      problem: REPOSITORY_UNRESOLVED_PROBLEM,
    });
  });

  it('takes the first segment of a slash-containing ref', () => {
    const source = parseRepositoryUrl(
      'https://github.com/acme/app/tree/feature/x/services/api',
    );
    expect(source.cloneUrl).toBe('https://github.com/acme/app');
    expect(source.ref).toBe('feature');
    expect(source.path).toBe('x/services/api');
  });
});

describe('isValidRepoUrl', () => {
  for (const value of [
    'https://github.com/acme/app',
    'https://git.example.test:8443/acme/app',
    'https://github.com/acme/app.git',
    'ssh://git@git.example.test:2222/acme/app.git',
    'git@git.example.test:acme/app.git',
    'https://dev.azure.com/org/proj/_git/app',
  ]) {
    it(`accepts ${value}`, () => {
      expect(isValidRepoUrl(value)).toBe(true);
    });
  }

  for (const value of [
    'https://github.com/acme',
    'https://token123@github.com/acme/app',
    'https://audit-user:demo@github.com/acme/app',
    'https://github.com/acme/app?demo=yes',
    'https://github.com/acme/app#x',
    'http://github.com/acme/app',
    'ssh://git.example.test/acme/app.git',
    unsafeScriptUrl,
    'data:text/plain,https://github.com/acme/app',
    'acme/app',
    '',
    'https://github.com/acme/ app',
  ]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(isValidRepoUrl(value)).toBe(false);
    });
  }
});

describe('shortRepoName', () => {
  it('drops the host and the .git suffix', () => {
    expect(shortRepoName('https://github.com/acme/app.git')).toBe('acme/app');
  });

  it('handles SCP syntax', () => {
    expect(shortRepoName('git@github.com:acme/app.git')).toBe('acme/app');
  });

  it('handles ssh with a port', () => {
    expect(shortRepoName('ssh://git@host:2222/acme/app.git')).toBe('acme/app');
  });
});

describe('safeWebHref', () => {
  it('passes through https', () => {
    expect(safeWebHref('https://github.com/acme/app')).toBe(
      'https://github.com/acme/app',
    );
  });

  it('passes through http', () => {
    expect(safeWebHref('http://git.example.test/acme/app')).toBe(
      'http://git.example.test/acme/app',
    );
  });

  for (const value of [
    unsafeScriptUrl,
    'data:text/html,<script>alert(1)</script>',
    'git@github.com:acme/app.git',
    'ssh://git@host/acme/app',
    'https://user@host/a/b',
    'acme/app',
    '/acme/app',
    '//git.example.test/acme/app',
    undefined,
  ]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(safeWebHref(value)).toBeUndefined();
    });
  }
});
