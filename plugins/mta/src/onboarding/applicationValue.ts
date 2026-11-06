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
 * The registration form value and the rules that guard it.
 *
 * The value is a discriminated union: a member either selects an existing
 * catalog Component or enters a repository URL. The field and the Scaffolder
 * validator read the same contract, so saved and query prefilled data cannot
 * reach the form as an ambiguous object.
 *
 * Plain TypeScript on purpose: no React, no CSS, so the rules can be unit
 * tested and reused by the extension validator.
 */

import { parseEntityRef, type Entity } from '@backstage/catalog-model';
import {
  isValidRepoUrl,
  parseRepositoryUrl,
  resolveRepositorySource,
  type HostClassifier,
} from '../repository';

export type MtaApplicationValue =
  | {
      applicationSource: 'catalog';
      entityRef: string;
      /** Display and handoff fields derived from the selected entity. */
      owner?: string;
      repository?: string;
      rootPath?: string;
      alreadyRegistered?: boolean;
    }
  | { applicationSource: 'repository'; repoUrl: string; rootPath?: string };

/**
 * Safe field state built from untrusted data. Every property is optional
 * because a saved value can be partial, malformed or empty.
 */
export interface NormalizedApplicationValue {
  applicationSource?: 'catalog' | 'repository';
  entityRef?: string;
  repoUrl?: string;
  rootPath?: string;
  owner?: string;
  repository?: string;
  alreadyRegistered?: boolean;
}

export const SELECTION_ERROR =
  'Select an application from the catalog or enter a repository URL.';
export const CONTRADICTION_ERROR =
  'Choose a catalog application or enter a repository URL, not both.';
export const COMPONENT_ERROR =
  'Select a catalog application. Only Components can be registered.';
export const REPOSITORY_ERROR =
  'Enter an HTTPS or SSH Git repository URL without a password, query, or fragment.';
export const BROWSE_URL_ERROR =
  'Enter the repository URL, not a branch or file link. Use Application root path for a folder.';
export const ROOT_PATH_ERROR =
  'Enter a relative directory without . or .. segments, such as services/inventory.';
export const UNAVAILABLE_ERROR =
  'This application is no longer available. Select another application.';
export const VERIFICATION_ERROR =
  'Could not verify this application. Check your access and select it again.';

export function isValidRootPath(value: string): boolean {
  return (
    !value ||
    (!value.startsWith('/') &&
      !value.includes('\\') &&
      !value.split('/').some(part => part === '..' || part === '.') &&
      !Array.from(value).some(character => character.charCodeAt(0) < 32))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

function readSource(value: unknown): 'catalog' | 'repository' | undefined {
  return value === 'catalog' || value === 'repository' ? value : undefined;
}

/** Compare repository roots, ignoring host case, a default port and `.git`. */
function isRepositoryRoot(input: string): boolean {
  const parsed = parseRepositoryUrl(input);
  if (parsed.ref || parsed.path) return false;
  const normalizePath = (path: string) =>
    path.replace(/\/+$/, '').replace(/\.git$/, '');
  try {
    const source = new URL(input);
    const clone = new URL(parsed.cloneUrl);
    return (
      source.protocol === clone.protocol &&
      source.hostname === clone.hostname &&
      source.port === clone.port &&
      normalizePath(source.pathname) === normalizePath(clone.pathname)
    );
  } catch {
    return normalizePath(parsed.cloneUrl) === normalizePath(input.trim());
  }
}

/**
 * Synchronous rules shared by the field (live errors) and the extension
 * validator. Never throws and never inspects a value as a string unless it is
 * one.
 */
export function validateApplicationShape(raw: unknown): string[] {
  if (!isRecord(raw)) return [SELECTION_ERROR];

  const entityRef = nonEmptyString(raw.entityRef);
  const repoUrl = nonEmptyString(raw.repoUrl);
  const source = readSource(raw.applicationSource);

  if (!entityRef && !repoUrl) return [SELECTION_ERROR];
  if (entityRef && repoUrl) return [CONTRADICTION_ERROR];
  if (source === 'catalog' && !entityRef) return [CONTRADICTION_ERROR];
  if (source === 'repository' && !repoUrl) return [CONTRADICTION_ERROR];

  if (entityRef) {
    try {
      const ref = parseEntityRef(entityRef);
      return ref.kind.toLowerCase() === 'component' ? [] : [COMPONENT_ERROR];
    } catch {
      return [COMPONENT_ERROR];
    }
  }

  const errors: string[] = [];
  if (!isValidRepoUrl(repoUrl!)) {
    errors.push(REPOSITORY_ERROR);
  } else if (!isRepositoryRoot(repoUrl!)) {
    errors.push(BROWSE_URL_ERROR);
  }
  const rootPath = raw.rootPath;
  if (
    rootPath !== undefined &&
    rootPath !== null &&
    (typeof rootPath !== 'string' || !isValidRootPath(rootPath.trim()))
  ) {
    errors.push(ROOT_PATH_ERROR);
  }
  return errors;
}

/**
 * Async catalog rules shared by the extension validator and the unit tests:
 * a lookup failure, a deleted entity and a non-Component each get their own
 * member-facing message before the repository resolver runs.
 */
export async function verifyCatalogApplication(
  loadEntity: () => Promise<Entity | undefined>,
  integrations?: HostClassifier,
): Promise<string | undefined> {
  let entity: Entity | undefined;
  try {
    entity = await loadEntity();
  } catch {
    return VERIFICATION_ERROR;
  }
  if (!entity) return UNAVAILABLE_ERROR;
  if (entity.kind.toLowerCase() !== 'component') return COMPONENT_ERROR;
  return resolveRepositorySource(entity, integrations).problem;
}

/**
 * Turns untrusted saved or query-prefilled data into safe field state. Values
 * of the wrong type are dropped instead of being rendered. Never throws.
 */
export function normalizeApplicationValue(raw: unknown): {
  value: NormalizedApplicationValue;
  errors: string[];
} {
  if (!isRecord(raw)) return { value: {}, errors: [SELECTION_ERROR] };

  const errors = validateApplicationShape(raw);
  const value: NormalizedApplicationValue = {};

  const entityRef = nonEmptyString(raw.entityRef);
  const repoUrl = nonEmptyString(raw.repoUrl);
  const source = readSource(raw.applicationSource);
  if (source) value.applicationSource = source;
  else if (entityRef) value.applicationSource = 'catalog';
  else if (repoUrl) value.applicationSource = 'repository';

  if (entityRef) value.entityRef = entityRef;
  if (repoUrl) value.repoUrl = repoUrl;
  for (const key of ['rootPath', 'owner', 'repository'] as const) {
    const field = nonEmptyString(raw[key]);
    if (field) value[key] = field;
  }
  if (typeof raw.alreadyRegistered === 'boolean') {
    value.alreadyRegistered = raw.alreadyRegistered;
  }

  return { value, errors };
}

/** The union member the field emits for a catalog selection. */
export function catalogValue(
  entityRef: string,
  derived: {
    owner?: string;
    repository?: string;
    rootPath?: string;
    alreadyRegistered?: boolean;
  } = {},
): MtaApplicationValue {
  return {
    applicationSource: 'catalog',
    entityRef,
    ...(derived.owner ? { owner: derived.owner } : {}),
    ...(derived.repository ? { repository: derived.repository } : {}),
    ...(derived.rootPath ? { rootPath: derived.rootPath } : {}),
    ...(derived.alreadyRegistered ? { alreadyRegistered: true } : {}),
  };
}

/** The union member the field emits for repository entry. */
export function repositoryValue(
  repoUrl: string,
  rootPath = '',
): MtaApplicationValue {
  return {
    applicationSource: 'repository',
    repoUrl,
    ...(rootPath.trim() ? { rootPath: rootPath.trim() } : {}),
  };
}
