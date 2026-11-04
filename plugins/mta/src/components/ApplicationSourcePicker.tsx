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

import { useEffect, useId, useRef, type Ref } from 'react';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import {
  Alert,
  BgProvider,
  Button,
  Card,
  CardBody,
  Flex,
  SearchAutocomplete,
  SearchAutocompleteItem,
  Skeleton,
  Text,
  TextField,
} from '@backstage/ui';
import styles from './ApplicationSourcePicker.module.css';

export type SourceValues = {
  entityRef: string;
  repoUrl: string;
  rootPath: string;
};

export type SourceErrors = {
  selection?: string;
  repo?: string;
  root?: string;
};

export type CatalogSearch = {
  term: string;
  onTermChange: (value: string) => void;
  results: Entity[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  /** Maximum number of results the request asked for. */
  limit: number;
};

export type SelectedApplication = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'invalid';
  entityRef: string;
  title?: string;
  namespace?: string;
  name?: string;
  owner?: string;
  repository?: string;
  repositoryProblem?: string;
  alreadyRegistered?: boolean;
  /** Member-facing reason a saved reference cannot be registered. */
  problem?: string;
};

function optionLabel(entity: Entity): string {
  return `${entity.metadata.title ?? entity.metadata.name} · ${
    entity.metadata.namespace ?? 'default'
  }/${entity.metadata.name} · ${String(entity.spec?.owner ?? 'No owner')}`;
}

/**
 * One choice, two ways in. A member either searches the catalog or enters a
 * repository URL. The two are mutually exclusive, so the form value only ever
 * carries the effective inputs.
 *
 * A saved selection always renders first, whatever the state of the catalog
 * list. Every state offers Change source, so repository entry stays reachable
 * when the entity was deleted or the catalog refuses the lookup.
 */
export function ApplicationSourcePicker({
  search,
  selection,
  values,
  onChange,
  onTouch,
  disabled = false,
  showErrors,
  errors,
  rootRef,
}: {
  search: CatalogSearch;
  selection: SelectedApplication;
  values: SourceValues;
  onChange: (next: SourceValues) => void;
  onTouch: () => void;
  disabled?: boolean;
  showErrors: boolean;
  errors: SourceErrors;
  rootRef?: Ref<HTMLDivElement>;
}) {
  const labelId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef(values.entityRef);
  const previousStatus = useRef<SelectedApplication['status']>('idle');
  const hasUrl = values.repoUrl.trim() !== '';
  const term = search.term.trim();

  // Moving between the search box and the selection region swaps the focused
  // control. Focus lands once the selection has resolved, and after Change
  // source the search box is ready to type in.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = values.entityRef;
    if (previous && !values.entityRef) {
      previousStatus.current = 'idle';
      searchRef.current?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    const status = selection.status;
    if (
      values.entityRef &&
      (status === 'ready' ||
        status === 'unavailable' ||
        status === 'invalid') &&
      previousStatus.current !== status
    ) {
      summaryRef.current?.focus();
    }
    previousStatus.current = values.entityRef ? status : 'idle';
  }, [values.entityRef, selection.status]);

  const changeSource = () =>
    onChange({ entityRef: '', repoUrl: '', rootPath: '' });

  const selectionRegion = () => {
    if (selection.status === 'loading') {
      return (
        <div
          ref={summaryRef}
          role="region"
          aria-label="Selected application"
          tabIndex={-1}
        >
          <Card className={styles.selection}>
            <CardBody className={styles.selectionBody}>
              <Flex direction="column" gap="3">
                <Skeleton style={{ height: 24, width: '40%' }} />
                <div role="status">
                  <Text color="secondary">Loading application...</Text>
                </div>
                <div>
                  <Button
                    variant="tertiary"
                    size="small"
                    isDisabled={disabled}
                    onPress={changeSource}
                  >
                    Change source
                  </Button>
                </div>
              </Flex>
            </CardBody>
          </Card>
        </div>
      );
    }

    if (selection.status === 'invalid') {
      return (
        <div
          ref={summaryRef}
          role="region"
          aria-label="Selected application"
          tabIndex={-1}
        >
          <Flex direction="column" gap="3">
            <Alert
              status="danger"
              title="Application cannot be registered"
              description={selection.problem}
            />
            <div>
              <Button
                variant="secondary"
                isDisabled={disabled}
                onPress={changeSource}
              >
                Change source
              </Button>
            </div>
          </Flex>
        </div>
      );
    }

    if (selection.status === 'unavailable') {
      return (
        <div
          ref={summaryRef}
          role="region"
          aria-label="Selected application"
          tabIndex={-1}
        >
          <Flex direction="column" gap="3">
            <Alert
              status="danger"
              title="Application is no longer available"
              description="It may have been removed or your access may have changed. Change the source to choose another application or enter a repository URL."
            />
            <div>
              <Button
                variant="secondary"
                isDisabled={disabled}
                onPress={changeSource}
              >
                Change source
              </Button>
            </div>
          </Flex>
        </div>
      );
    }

    if (selection.status !== 'ready') return null;

    return (
      <Card
        ref={summaryRef}
        className={styles.selection}
        aria-label="Selected application"
        role="region"
        tabIndex={-1}
      >
        <CardBody className={styles.selectionBody}>
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center" gap="3">
              <Text as="h3" variant="title-x-small">
                {selection.title}
              </Text>
              <Button
                variant="tertiary"
                size="small"
                isDisabled={disabled}
                onPress={changeSource}
              >
                Change source
              </Button>
            </Flex>
            <dl className={styles.details}>
              <dt>Catalog reference</dt>
              <dd>{selection.entityRef}</dd>
              <dt>Owner</dt>
              <dd>{selection.owner || 'Not specified'}</dd>
              <dt>Repository</dt>
              <dd>{selection.repository || 'Not available'}</dd>
            </dl>
            {selection.repositoryProblem && (
              <Alert
                status="warning"
                title="Repository needs review"
                description={selection.repositoryProblem}
              />
            )}
            {selection.alreadyRegistered && (
              <Alert
                status="info"
                title="Already registered with MTA"
                description="Continue to view the current migration state. Registration will not restart discovery."
              />
            )}
          </Flex>
        </CardBody>
      </Card>
    );
  };

  const searchRegion = () => {
    // SearchAutocomplete has no disabled state. A disabled TextField keeps the
    // locked field visible and inert with a supported control instead of a
    // search box the member can still type into.
    if (disabled) {
      return (
        <TextField
          id="mta-application-search"
          label="Application"
          size="medium"
          value={search.term}
          isDisabled
          placeholder="Search by application, namespace, or owner"
          description="Catalog search is unavailable while this field is locked."
        />
      );
    }
    return (
      <Flex direction="column" gap="2">
        <Text as="span" id={labelId} variant="body-small" weight="bold">
          Application
        </Text>
        <div ref={searchRef}>
          <SearchAutocomplete
            aria-labelledby={labelId}
            inputValue={search.term}
            onInputChange={search.onTermChange}
            placeholder="Search by application, namespace, or owner"
            size="medium"
            isLoading={search.loading}
          >
            {search.results.map(entity => {
              const entityRef = stringifyEntityRef(entity);
              return (
                <SearchAutocompleteItem
                  key={entityRef}
                  id={entityRef}
                  textValue={optionLabel(entity)}
                  onAction={() => {
                    search.onTermChange('');
                    onChange({ entityRef, repoUrl: '', rootPath: '' });
                  }}
                >
                  {optionLabel(entity)}
                </SearchAutocompleteItem>
              );
            })}
          </SearchAutocomplete>
        </div>
        {search.error && (
          <Alert
            status="danger"
            title="Could not search applications"
            description={search.error}
          />
        )}
        {search.error && (
          <div>
            <Button
              variant="secondary"
              isDisabled={disabled}
              onPress={search.onRetry}
            >
              Try again
            </Button>
          </div>
        )}
        {!search.loading &&
          !search.error &&
          !!term &&
          search.results.length === 0 && (
            <div role="status">
              <Text variant="body-small">
                {`No applications match "${term}". Try another search, or enter a repository URL below.`}
              </Text>
            </div>
          )}
        {!search.loading &&
          !search.error &&
          !!term &&
          search.results.length === search.limit && (
            <Text variant="body-small" color="secondary">
              {`Showing the first ${search.limit} applications. Keep typing to narrow the list.`}
            </Text>
          )}
      </Flex>
    );
  };

  return (
    // RHDH renders the template card outside the BUI background context, so
    // inputs would fall back to the neutral-1 fill and disappear on the page.
    // Neutral-1 gives the fields the neutral-2 fill they have in the design.
    <BgProvider bg="neutral-1">
      <div
        ref={rootRef}
        className={styles.root}
        aria-label="Application selection"
        aria-describedby={
          showErrors && errors.selection
            ? 'mta-application-selection-error'
            : undefined
        }
        tabIndex={-1}
      >
        <Flex direction="column" gap="4">
          {values.entityRef ? selectionRegion() : searchRegion()}

          {!values.entityRef && (
            <>
              <div className={styles.or} aria-hidden>
                or
              </div>
              <TextField
                id="mta-repository-url"
                label="Repository URL"
                size="medium"
                value={values.repoUrl}
                isDisabled={disabled}
                onChange={value =>
                  onChange({
                    entityRef: '',
                    repoUrl: value,
                    rootPath: values.rootPath,
                  })
                }
                onBlur={onTouch}
                isInvalid={showErrors && !!errors.repo}
                description="HTTPS and SSH repository URLs are supported."
                placeholder="https://github.com/org/repository"
              />
              {showErrors && errors.repo && (
                <Text
                  as="p"
                  variant="body-x-small"
                  color="danger"
                  id="mta-repository-url-error"
                  role="alert"
                >
                  {errors.repo}
                </Text>
              )}
              {hasUrl && (
                <>
                  <TextField
                    id="mta-application-root-path"
                    label="Application root path"
                    size="medium"
                    value={values.rootPath}
                    isDisabled={disabled}
                    onChange={value =>
                      onChange({
                        entityRef: '',
                        repoUrl: values.repoUrl,
                        rootPath: value,
                      })
                    }
                    onBlur={onTouch}
                    isInvalid={showErrors && !!errors.root}
                    description="Optional. Enter a folder for a monorepo, or leave blank to use the repository root."
                    placeholder="services/payments"
                  />
                  {showErrors && errors.root && (
                    <Text
                      as="p"
                      variant="body-x-small"
                      color="danger"
                      id="mta-application-root-path-error"
                      role="alert"
                    >
                      {errors.root}
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          {showErrors && errors.selection && (
            <Text
              as="p"
              variant="body-x-small"
              color="danger"
              id="mta-application-selection-error"
              role="alert"
            >
              {errors.selection}
            </Text>
          )}
        </Flex>
      </div>
    </BgProvider>
  );
}
