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

/**
 * Repository source resolution and URL policy.
 *
 * Catalog entities usually carry a browse URL (a tree, blob, src or version
 * URL), not a clone URL. MTA clones the repository, so every consumer goes
 * through this module to get the clone URL, the ref, the directory inside the
 * repository and a member-facing problem when the value cannot be used.
 *
 * Plain TypeScript on purpose: no React, no CSS, so it can be unit tested and
 * reused by the field validators.
 */

import type { Entity } from '@backstage/catalog-model';

/** Host family a repository URL belongs to, used to pick browse URL routes. */
export type RepositoryProvider =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure'
  | 'other';

/** Everything a consumer needs to clone and describe one repository. */
export interface RepositorySource {
  /** Repository identity MTA can clone, such as https://github.com/acme/app. Empty string when unusable. */
  cloneUrl: string;
  /** Browser URL of the repository root. http(s) only. Undefined for SSH and SCP values. */
  webUrl?: string;
  /** Branch or tag parsed from a browse URL (tree, blob, src, version=GB...). */
  ref?: string;
  /** Directory inside the repository, without leading or trailing slashes. Undefined for the root. */
  path?: string;
  provider: RepositoryProvider;
  /** Member-facing reason the value cannot be used. Undefined when usable. */
  problem?: string;
}

/** Structural subset of Backstage's ScmIntegrationRegistry, so this module needs no import. */
export interface HostClassifier {
  byHost(host: string): { type: string } | undefined;
}

/** Member-facing problem for an entity without any repository annotation. */
export const REPOSITORY_MISSING_PROBLEM =
  'Repository information is missing. Ask the application owner to add its source repository, or enter a repository URL.';
/** Member-facing problem for a value that needs a repository and branch instead. */
export const REPOSITORY_UNRESOLVED_PROBLEM =
  'The source location needs repository and branch resolution. Enter the repository URL instead.';
/** Member-facing problem for a value that is not a supported Git URL. */
export const REPOSITORY_INVALID_PROBLEM =
  'The repository URL is not a supported HTTPS or SSH Git URL. Enter the repository URL instead.';

/** Annotation an entity carries when its repository URL was entered directly. */
const MTA_REPO_URL_ANNOTATION = 'mta.konveyor.io/repo-url';
/** Annotation Backstage writes for the location an entity was registered from. */
const SOURCE_LOCATION_ANNOTATION = 'backstage.io/source-location';

const BROWSE_SEGMENTS = new Set(['tree', 'blob', '-', 'src', 'browse']);

function unusable(
  provider: RepositoryProvider,
  problem: string,
): RepositorySource {
  return { cloneUrl: '', provider, problem };
}

function detectProvider(
  host: string,
  integrations?: HostClassifier,
): RepositoryProvider {
  const raw = host.toLowerCase();
  // A configured enterprise host can include a port, so try the exact host
  // first and the bare host name second.
  const hostname = raw.replace(/:\d+$/, '');
  const type =
    integrations?.byHost(raw)?.type ?? integrations?.byHost(hostname)?.type;
  if (type) {
    if (type === 'github') return 'github';
    if (type === 'gitlab') return 'gitlab';
    if (type === 'bitbucketCloud' || type === 'bitbucket') return 'bitbucket';
    if (type === 'azure') return 'azure';
    return 'other';
  }
  if (hostname === 'github.com' || hostname.includes('github')) return 'github';
  if (hostname === 'gitlab.com' || hostname.includes('gitlab')) return 'gitlab';
  if (hostname === 'bitbucket.org') return 'bitbucket';
  if (hostname === 'dev.azure.com' || hostname.endsWith('.visualstudio.com'))
    return 'azure';
  return 'other';
}

/** Split "/acme/app/tree/main/" into ["acme", "app", "tree", "main"]. */
function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/**
 * Read <ref> and the directory that follows it from the segments after a
 * browse marker. A ref that itself contains a slash, such as feature/x, cannot
 * be distinguished from a directory in a browse URL: the first segment wins and
 * the rest is treated as a directory.
 */
function readRefAndPath(
  segments: string[],
  options: { dropFile: boolean },
): { ref?: string; path?: string } {
  const [ref, ...rest] = segments;
  const directory = options.dropFile ? rest.slice(0, -1) : rest;
  return {
    ref: ref || undefined,
    path: directory.length ? directory.join('/') : undefined,
  };
}

function parseGithub(segments: string[]):
  | {
      owner: string;
      repo: string;
      ref?: string;
      path?: string;
    }
  | undefined {
  const [owner, repoRaw, browse, ...rest] = segments;
  if (!owner || !repoRaw) return undefined;
  const repo = repoRaw.replace(/\.git$/, '');
  if (!repo) return undefined;
  if (browse === 'tree' || browse === 'blob') {
    const { ref, path } = readRefAndPath(rest, { dropFile: browse === 'blob' });
    return { owner, repo, ref, path };
  }
  return { owner, repo };
}

function parseGitlab(segments: string[]):
  | {
      repoPath: string[];
      ref?: string;
      path?: string;
    }
  | undefined {
  const marker = segments.indexOf('-');
  const repository = marker === -1 ? segments : segments.slice(0, marker);
  if (repository.length < 2) return undefined;
  if (marker === -1) return { repoPath: repository };
  const browse = segments[marker + 1];
  if (browse !== 'tree' && browse !== 'blob') return undefined;
  const { ref, path } = readRefAndPath(segments.slice(marker + 2), {
    dropFile: browse === 'blob',
  });
  return { repoPath: repository, ref, path };
}

function parseBitbucket(segments: string[]):
  | {
      workspace: string;
      repo: string;
      ref?: string;
      path?: string;
    }
  | undefined {
  const [workspace, repo, browse, ref, ...rest] = segments;
  if (!workspace || !repo) return undefined;
  if (browse === 'src') {
    return {
      workspace,
      repo: repo.replace(/\.git$/, ''),
      ref: ref || undefined,
      path: rest.length ? rest.join('/') : undefined,
    };
  }
  return { workspace, repo: repo.replace(/\.git$/, '') };
}

function parseAzure(
  segments: string[],
  searchParams: URLSearchParams,
):
  | {
      org: string;
      project: string;
      repo: string;
      ref?: string;
      path?: string;
    }
  | undefined {
  const [org, project, git, repo] = segments;
  if (!org || !project || git !== '_git' || !repo) return undefined;
  const version = searchParams.get('version');
  // Azure encodes the ref kind in a prefix: GB for branch, GT for tag.
  const ref = version ? version.replace(/^(GB|GT)/, '') : undefined;
  const rawPath = searchParams.get('path');
  const directory = rawPath ? pathSegments(rawPath).join('/') : undefined;
  return {
    org,
    project,
    repo: repo.replace(/\.git$/, ''),
    ref: ref || undefined,
    path: directory || undefined,
  };
}

/** Shared tail: reject a clone URL the validator would not accept. */
function finishHttps(
  cloneUrl: string,
  provider: RepositoryProvider,
  details: { ref?: string; path?: string },
): RepositorySource {
  if (!isValidRepoUrl(cloneUrl))
    return unusable(provider, REPOSITORY_INVALID_PROBLEM);
  return {
    cloneUrl,
    webUrl: cloneUrl,
    ref: details.ref,
    path: details.path,
    provider,
  };
}

/**
 * Resolve a typed repository URL into a clone URL, provider, ref and path.
 * Browse URLs become the repository root; unusable values carry a problem.
 */
export function parseRepositoryUrl(
  raw: string,
  integrations?: HostClassifier,
): RepositorySource {
  const value = raw.trim();
  if (!value || /\s/.test(value) || hasControlCharacter(value)) {
    return unusable('other', REPOSITORY_INVALID_PROBLEM);
  }

  // Git's SCP-like SSH syntax: user@host:path
  const scp = /^([^/@\s]+)@([^/:\s]+):([^/\s].*)$/.exec(value);
  if (scp) {
    const provider = detectProvider(scp[2], integrations);
    return {
      cloneUrl: value,
      provider,
      ...(isValidRepoUrl(value) ? {} : { problem: REPOSITORY_INVALID_PROBLEM }),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return unusable('other', REPOSITORY_INVALID_PROBLEM);
  }

  if (parsed.protocol === 'ssh:') {
    const provider = detectProvider(parsed.host, integrations);
    return {
      cloneUrl: value,
      provider,
      ...(isValidRepoUrl(value) ? {} : { problem: REPOSITORY_INVALID_PROBLEM }),
    };
  }

  if (parsed.protocol !== 'https:') {
    return unusable('other', REPOSITORY_INVALID_PROBLEM);
  }
  if (parsed.username || parsed.password) {
    return unusable('other', REPOSITORY_INVALID_PROBLEM);
  }

  const provider = detectProvider(parsed.host, integrations);
  const origin = `https://${parsed.host}`;
  const segments = pathSegments(parsed.pathname);

  if (provider === 'github') {
    const result = parseGithub(segments);
    if (!result) return unusable('github', REPOSITORY_INVALID_PROBLEM);
    return finishHttps(
      `${origin}/${result.owner}/${result.repo}`,
      'github',
      result,
    );
  }

  if (provider === 'gitlab') {
    const result = parseGitlab(segments);
    if (!result) return unusable('gitlab', REPOSITORY_UNRESOLVED_PROBLEM);
    return finishHttps(
      `${origin}/${result.repoPath.join('/')}`,
      'gitlab',
      result,
    );
  }

  if (provider === 'bitbucket') {
    const result = parseBitbucket(segments);
    if (!result) return unusable('bitbucket', REPOSITORY_UNRESOLVED_PROBLEM);
    return finishHttps(
      `${origin}/${result.workspace}/${result.repo}`,
      'bitbucket',
      result,
    );
  }

  if (provider === 'azure') {
    const result = parseAzure(segments, parsed.searchParams);
    if (result) {
      return finishHttps(
        `${origin}/${result.org}/${result.project}/_git/${result.repo}`,
        'azure',
        result,
      );
    }
    // Not a recognizable Azure repository URL; fall through to generic rules.
  }

  // Unknown host: a browse URL cannot be resolved into a clone URL without
  // inventing a provider route, so ask for the repository URL instead.
  if (segments.some(segment => BROWSE_SEGMENTS.has(segment))) {
    return unusable(provider, REPOSITORY_UNRESOLVED_PROBLEM);
  }
  return finishHttps(value, provider, {});
}

/**
 * Resolve the repository of a catalog entity, preferring its explicit MTA
 * annotation and falling back to the Backstage source location.
 */
export function resolveRepositorySource(
  entity: Entity,
  integrations?: HostClassifier,
): RepositorySource {
  const annotations = entity.metadata.annotations ?? {};
  const explicit = annotations[MTA_REPO_URL_ANNOTATION];
  if (explicit) return parseRepositoryUrl(explicit, integrations);

  const location = annotations[SOURCE_LOCATION_ANNOTATION];
  if (!location) return unusable('other', REPOSITORY_MISSING_PROBLEM);
  if (!location.startsWith('url:')) {
    return unusable('other', REPOSITORY_UNRESOLVED_PROBLEM);
  }
  return parseRepositoryUrl(location.slice(4), integrations);
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

/**
 * Accept HTTPS and SSH Git syntax only, with no credentials, query or fragment.
 * Registration passes repository URLs through to MTA.
 */
export function isValidRepoUrl(value: string): boolean {
  const url = value.trim();
  if (!url || /\s/.test(url) || hasControlCharacter(url)) return false;

  // Git's SCP-like SSH syntax: user@host:path, with a relative path.
  if (/^[^/@\s]+@[^/:\s]+:[^/\s][^?#\s]*$/.test(url)) return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'ssh:') {
    return (
      !!parsed.username &&
      !!parsed.hostname &&
      pathSegments(parsed.pathname).length >= 1
    );
  }

  if (parsed.protocol === 'https:') {
    return (
      !!parsed.hostname &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash &&
      pathSegments(parsed.pathname).length >= 2
    );
  }

  return false;
}

/** "https://github.com/acme/app.git" -> "acme/app" */
export function shortRepoName(url: string): string {
  const raw = url.trim();
  const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  let value = hadScheme ? raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') : raw;

  if (!hadScheme) {
    const scp = /^[^/@\s]+@[^/:\s]+:([^/].*)$/.exec(value);
    if (scp) value = scp[1];
  }

  if (hadScheme) {
    value = value.replace(/^[^/@]+@/, '');
    const slash = value.indexOf('/');
    value = slash === -1 ? '' : value.slice(slash + 1);
  }

  return value
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

/**
 * Link target for a repository value. Only normalized http(s) URLs without
 * credentials are safe: annotations are catalog data, not trusted input.
 */
export function safeWebHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return undefined;
  }
  if (parsed.username || parsed.password) return undefined;
  return parsed.toString();
}
