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
import { useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef } from '@backstage/integration-react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type { Entity } from '@backstage/catalog-model';
import {
  type CustomFieldValidator,
  type FieldExtensionComponentProps,
} from '@backstage/plugin-scaffolder-react';
import {
  ApplicationSourcePicker,
  type CatalogSearch,
  type SelectedApplication,
  type SourceErrors,
  type SourceValues,
} from './ApplicationSourcePicker';
import {
  BROWSE_URL_ERROR,
  COMPONENT_ERROR,
  REPOSITORY_ERROR,
  ROOT_PATH_ERROR,
  VERIFICATION_ERROR,
  catalogValue,
  normalizeApplicationValue,
  repositoryValue,
  validateApplicationShape,
  verifyCatalogApplication,
  type MtaApplicationValue,
} from '../onboarding/applicationValue';
import { resolveRepositorySource } from '../repository';

/** How many catalog applications one search request may return. */
const SEARCH_LIMIT = 25;
/** Typing pause before a catalog search request is sent. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Only the fields the option label, the entity reference, the selection
 * summary and the repository resolver need. A catalog can hold thousands of
 * Components, so the request must not download them in full.
 */
const SEARCH_FIELDS = [
  'kind',
  'metadata.name',
  'metadata.namespace',
  'metadata.title',
  'metadata.annotations',
  'spec.owner',
];

/** Group the flat contract errors into the slots the picker renders. */
function errorsFor(errors: string[]): SourceErrors {
  const mapped: SourceErrors = {};
  for (const error of errors) {
    if (error === REPOSITORY_ERROR || error === BROWSE_URL_ERROR) {
      mapped.repo ??= error;
    } else if (error === ROOT_PATH_ERROR) {
      mapped.root ??= error;
    } else {
      mapped.selection ??= error;
    }
  }
  return mapped;
}

/**
 * The single field the MTA template renders in its Application details step.
 * Selecting a catalog application and entering a repository URL are mutually
 * exclusive, so the form value only carries the effective inputs.
 */
export function MtaApplicationSourceField({
  formData,
  onChange,
  rawErrors,
  disabled,
  readonly,
}: FieldExtensionComponentProps<MtaApplicationValue>) {
  const catalog = useApi(catalogApiRef);
  const [touched, setTouched] = useState(false);
  const [wasInvalid, setWasInvalid] = useState(false);
  const fieldRoot = useRef<HTMLDivElement>(null);

  // Search state. The term is local: it is not part of the form value.
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchAttempt, setSearchAttempt] = useState(0);
  const requestRef = useRef(0);

  // The saved selection is resolved on its own, independent of the list.
  const [selection, setSelection] = useState<SelectedApplication>({
    status: 'idle',
    entityRef: '',
  });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const locked = disabled || readonly;

  // Saved and query-prefilled values are untrusted. Normalize once so every
  // render works with strings, never with a number or an object.
  const { value, errors: shapeErrors } = normalizeApplicationValue(formData);
  const valueRef = useRef(value);
  valueRef.current = value;
  const values: SourceValues = {
    entityRef: value.entityRef ?? '',
    repoUrl: value.repoUrl ?? '',
    rootPath: value.rootPath ?? '',
  };
  const errors = errorsFor(shapeErrors);
  const showErrors = touched || !!rawErrors?.length;

  useEffect(() => {
    const entityRef = values.entityRef;
    if (!entityRef) {
      setSelection({ status: 'idle', entityRef: '' });
      return undefined;
    }
    // A saved ref that is not a Component can never be registered. Report the
    // kind problem instead of a misleading availability message.
    if (validateApplicationShape(valueRef.current).includes(COMPONENT_ERROR)) {
      setSelection({ status: 'invalid', entityRef, problem: COMPONENT_ERROR });
      return undefined;
    }
    let active = true;
    setSelection({ status: 'loading', entityRef });
    catalog.getEntityByRef(entityRef).then(
      entity => {
        if (!active) return;
        if (!entity || entity.kind.toLowerCase() !== 'component') {
          setSelection({ status: 'unavailable', entityRef });
          return;
        }
        const source = resolveRepositorySource(entity);
        const next: SelectedApplication = {
          status: 'ready',
          entityRef,
          title: entity.metadata.title ?? entity.metadata.name,
          namespace: entity.metadata.namespace ?? 'default',
          name: entity.metadata.name,
          owner: String(entity.spec?.owner ?? ''),
          repository: source.cloneUrl,
          repositoryProblem: source.problem ?? '',
          alreadyRegistered:
            !!entity.metadata.annotations?.['konveyor.io/application-id'],
        };
        setSelection(next);

        // Hand the derived display fields to the form so the native Review
        // step and the template step can show and use them. A value that
        // breaks the contract is left untouched, so its error stays visible
        // instead of being silently rewritten into a valid selection.
        const current = valueRef.current;
        if (validateApplicationShape(current).length > 0) return;
        if (
          current.owner !== next.owner ||
          current.repository !== next.repository ||
          current.rootPath !== (source.path ?? '') ||
          !!current.alreadyRegistered !== next.alreadyRegistered
        ) {
          onChangeRef.current(
            catalogValue(entityRef, {
              owner: next.owner,
              repository: next.repository,
              rootPath: source.path,
              alreadyRegistered: next.alreadyRegistered,
            }),
          );
        }
      },
      () => {
        // A deleted entity, a 403 or a 503 all leave the saved ref unusable.
        if (active) setSelection({ status: 'unavailable', entityRef });
      },
    );
    return () => {
      active = false;
    };
  }, [catalog, values.entityRef]);

  useEffect(() => {
    const input = term.trim();
    if (!input || !catalog || locked || valueRef.current.entityRef) {
      requestRef.current += 1;
      setResults([]);
      setSearching(false);
      setSearchError('');
      return undefined;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    setSearching(true);
    setSearchError('');
    const timer = setTimeout(() => {
      catalog
        .queryEntities({
          filter: { kind: 'Component' },
          fullTextFilter: {
            term: input,
            fields: ['metadata.name', 'metadata.title', 'spec.owner'],
          },
          orderFields: { field: 'metadata.name', order: 'asc' },
          limit: SEARCH_LIMIT,
          fields: SEARCH_FIELDS,
        })
        .then(
          result => {
            if (requestRef.current !== request) return;
            setResults(result.items);
            setSearching(false);
          },
          cause => {
            if (requestRef.current !== request) return;
            setSearchError(
              cause instanceof Error ? cause.message : String(cause),
            );
            setSearching(false);
          },
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [catalog, term, values.entityRef, searchAttempt, locked]);

  // The wizard renders the error under the field, but the member is still
  // looking at the Review button. Move focus to the invalid field once.
  const errorKey = rawErrors?.join('\n') ?? '';
  useEffect(() => {
    if (errorKey && !wasInvalid) fieldRoot.current?.focus();
    setWasInvalid(!!errorKey);
  }, [errorKey, wasInvalid]);

  const emit = (next: SourceValues) => {
    setTouched(false);
    if (next.entityRef) {
      onChange(catalogValue(next.entityRef));
      return;
    }
    if (next.repoUrl.trim()) {
      onChange(repositoryValue(next.repoUrl, next.rootPath));
      return;
    }
    onChange(catalogValue(''));
  };

  const search: CatalogSearch = {
    term,
    onTermChange: next => {
      setTerm(next);
      setResults([]);
      setSearchError('');
    },
    results,
    loading: searching,
    error: searchError,
    onRetry: () => setSearchAttempt(current => current + 1),
    limit: SEARCH_LIMIT,
  };

  return (
    <ApplicationSourcePicker
      search={search}
      selection={selection}
      values={values}
      onChange={emit}
      onTouch={() => setTouched(true)}
      disabled={locked}
      showErrors={showErrors}
      errors={errors}
      rootRef={fieldRoot}
    />
  );
}

/**
 * The validation the Scaffolder runs before it allows the member past the
 * step: the same shape rules the field renders, then one catalog lookup so a
 * deleted entity, a refused lookup and a non-Component each get their own
 * message.
 */
export const validateMtaApplicationSource: CustomFieldValidator<
  MtaApplicationValue
> = async (value, validation, { apiHolder }) => {
  const shapeErrors = validateApplicationShape(value);
  if (shapeErrors.length) {
    for (const message of shapeErrors) validation.addError(message);
    return;
  }
  const entityRef = normalizeApplicationValue(value).value.entityRef;
  if (!entityRef) return;

  const api = apiHolder.get(catalogApiRef);
  if (!api) {
    validation.addError(VERIFICATION_ERROR);
    return;
  }
  const integrations = apiHolder.get(scmIntegrationsApiRef);
  const problem = await verifyCatalogApplication(
    () => api.getEntityByRef(entityRef),
    integrations,
  );
  if (problem) validation.addError(problem);
};
