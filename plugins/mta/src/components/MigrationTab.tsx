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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@backstage/core-components';
import { discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useMtaStore } from '../store/MtaStore';
import type { MigrationStatus } from '../types';
import { DEVELOPER_PHASE_CONFIG, DEFAULT_DEVELOPER_PHASE } from '../utils';
import { PhaseNotStarted } from './phases/PhaseNotStarted';
import { PhaseDiscovery } from './phases/PhaseDiscovery';
import { PhasePathSelection } from './phases/PhasePathSelection';
import { PhaseAnalyzing } from './phases/PhaseAnalyzing';
import { PhaseActive } from './phases/PhaseActive';
import { PhaseCompleted } from './phases/PhaseCompleted';
import { PhaseFailed } from './phases/PhaseFailed';

interface MockHubApplication {
  status: 'registering' | 'discovered' | 'failed';
  discoveredTags: string[];
  error: string | null;
  errorMessage: string | null;
}

function mockStatus(status: string | undefined): MigrationStatus {
  switch (status) {
    case 'discovered':
    case 'Path Selection':
      return 'Path Selection';
    case 'failed':
    case 'Failed':
      return 'Failed';
    default:
      return 'Discovery';
  }
}

function annotatedTags(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const tags: unknown = JSON.parse(value);
    return Array.isArray(tags) && tags.every(tag => typeof tag === 'string')
      ? tags
      : [];
  } catch {
    return [];
  }
}

export function MigrationTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entity } = useEntity();
  const store = useMtaStore();
  const discoveryApi = useApi(discoveryApiRef);
  const { role: persona, loading: personaLoading } = usePersonaRole();
  const entityRef = stringifyEntityRef(entity);
  const annotations = entity.metadata.annotations ?? {};
  const mockAppId = annotations['konveyor.io/application-id'];
  const annotationStatus = annotations['mta.konveyor.io/status'];
  const annotationTags = annotations['mta.konveyor.io/discovered-tags'];
  const seededRef = useRef('');
  const autoDiscoverHandled = useRef('');
  const [hubError, setHubError] = useState<{
    id: string;
    type: string;
    message: string;
  } | null>(null);

  const repoUrl =
    annotations['mta.konveyor.io/repo-url'] ||
    annotations['backstage.io/source-location']?.replace('url:', '') ||
    '';

  useEffect(() => {
    const tags = mockAppId ? annotatedTags(annotationTags) : [];
    const archetype = store.matchArchetypes(tags)[0];
    store.ensureApplication(entityRef, {
      name: entity.metadata.name,
      repoUrl,
      discoveredTags: tags,
      archetypeId: archetype?.id ?? 'arch-1',
      targetProfileId: 'target-1',
      status: mockAppId ? mockStatus(annotationStatus) : 'Not Started',
      issuesCount: 0,
      criticalIssues: 0,
      storyPoints: 0,
      filesAffected: 0,
      totalIssuesDiscovered: 0,
      entityRef,
      devSpacesAvailable: true,
      devSpacesActive: false,
    });
  }, [
    entityRef,
    entity.metadata.name,
    repoUrl,
    mockAppId,
    annotationStatus,
    annotationTags,
    store.ensureApplication,
    store.matchArchetypes,
  ]);

  const app = store.getApplicationByEntityRef(entityRef);
  const appRef = useRef(app);
  appRef.current = app;
  const appId = app?.id ?? '';
  const displayStatus = app?.status ?? 'Not Started';
  const errorType =
    hubError && hubError.id === mockAppId
      ? hubError.type
      : annotations['mta.konveyor.io/error'] ?? '';
  const errorMessage =
    hubError && hubError.id === mockAppId
      ? hubError.message
      : annotations['mta.konveyor.io/error-message'] ?? '';

  useEffect(() => {
    if (autoDiscoverHandled.current === entityRef) return;
    if (searchParams.get('autoDiscover') !== 'true' || !appId) return;
    autoDiscoverHandled.current = entityRef;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('autoDiscover');
        return next;
      },
      { replace: true },
    );
    if (!mockAppId && displayStatus === 'Not Started') {
      store.updateApplication(appId, { status: 'Discovery' });
    }
  }, [
    searchParams,
    setSearchParams,
    appId,
    entityRef,
    mockAppId,
    displayStatus,
    store.updateApplication,
  ]);

  useEffect(() => {
    if (!appId || mockAppId || displayStatus !== 'Discovery') return undefined;
    let cancelled = false;
    store.simulateDiscovery(repoUrl).then(tags => {
      if (cancelled) return;
      const archetype = store.matchArchetypes(tags)[0];
      store.updateApplication(appId, {
        discoveredTags: tags,
        archetypeId: archetype?.id ?? 'arch-1',
        status: archetype ? 'Path Selection' : 'Failed',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    appId,
    mockAppId,
    displayStatus,
    repoUrl,
    store.simulateDiscovery,
    store.matchArchetypes,
    store.updateApplication,
  ]);

  useEffect(() => {
    if (!appId || !mockAppId) return undefined;
    let cancelled = false;
    let timeout: number | undefined;

    const poll = async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('mta-mock-hub');
        const response = await fetch(
          `${baseUrl}/applications/${encodeURIComponent(mockAppId)}`,
        );
        if (!response.ok)
          throw new Error(`Mock Hub returned ${response.status}`);
        const result = (await response.json()) as MockHubApplication;
        if (cancelled) return;

        const currentApp = appRef.current;
        if (
          currentApp &&
          !['Analysis', 'Active', 'Post-remediation', 'Completed'].includes(
            currentApp.status,
          )
        ) {
          const tags = result.discoveredTags ?? [];
          const archetype = store.matchArchetypes(tags)[0];
          const status = mockStatus(result.status);
          if (
            currentApp.status !== status ||
            currentApp.discoveredTags.length !== tags.length ||
            currentApp.discoveredTags.some(
              (tag, index) => tag !== tags[index],
            ) ||
            (archetype && currentApp.archetypeId !== archetype.id)
          ) {
            store.updateApplication(appId, {
              status,
              discoveredTags: tags,
              ...(archetype ? { archetypeId: archetype.id } : {}),
            });
          }
        }
        if (result.status === 'failed') {
          setHubError({
            id: mockAppId,
            type: result.error ?? '',
            message: result.errorMessage ?? '',
          });
        }
        if (result.status === 'discovered' || result.status === 'failed')
          return;
      } catch {
        // A transient backend error should not replace the last known status.
      }
      if (!cancelled) timeout = window.setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    appId,
    mockAppId,
    discoveryApi,
    store.matchArchetypes,
    store.updateApplication,
  ]);

  useEffect(() => {
    if (!appId) return;
    const needsIssues =
      displayStatus === 'Active' ||
      displayStatus === 'Post-remediation' ||
      displayStatus === 'Completed';
    const key = `${appId}:${displayStatus}`;
    if (needsIssues && seededRef.current !== key) {
      seededRef.current = key;
      store.seedIssuesIfNeeded(appId);
    }
  }, [displayStatus, appId, store.seedIssuesIfNeeded]);

  const target = app
    ? store.getTargetProfileById(app.targetProfileId)
    : undefined;
  const archetype = app ? store.getArchetypeById(app.archetypeId) : undefined;
  const issues = appId ? store.getIssuesForApp(appId) : [];
  const actions = appId ? store.getActionsForApp(appId) : [];

  const handleStartDiscovery = useCallback(() => {
    if (!appId) return;
    store.updateApplication(appId, { status: 'Discovery' });
  }, [appId, store.updateApplication]);

  if (personaLoading) return null;

  if (
    persona !== 'architect' &&
    displayStatus !== 'Active' &&
    displayStatus !== 'Post-remediation'
  ) {
    const phaseConfig =
      DEVELOPER_PHASE_CONFIG[displayStatus] ?? DEFAULT_DEVELOPER_PHASE;
    return (
      <EmptyState
        title={phaseConfig.title}
        description={phaseConfig.description}
        missing="content"
      />
    );
  }

  if (!app) return null;

  switch (displayStatus) {
    case 'Not Started':
      return (
        <PhaseNotStarted
          persona="architect"
          onStartDiscovery={handleStartDiscovery}
        />
      );
    case 'Discovery':
      return <PhaseDiscovery repoUrl={repoUrl} />;
    case 'Path Selection':
      return <PhasePathSelection app={app} store={store} />;
    case 'Analysis':
      return <PhaseAnalyzing target={target} archetype={archetype} />;
    case 'Active':
    case 'Post-remediation':
      return (
        <PhaseActive
          app={app}
          issues={issues}
          actions={actions}
          store={store}
          persona={persona}
          target={target}
          isPostRemediation={displayStatus === 'Post-remediation'}
        />
      );
    case 'Completed':
      return <PhaseCompleted app={app} actions={actions} issues={issues} />;
    case 'Failed':
      return (
        <PhaseFailed
          app={app}
          store={store}
          errorType={errorType}
          errorMessage={errorMessage}
        />
      );
    default:
      return null;
  }
}
