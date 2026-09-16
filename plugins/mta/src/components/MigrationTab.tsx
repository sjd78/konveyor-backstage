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
import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePrototypeScope, usePersona, useGlobalPhase, resolveEntityPhase, advancePhase } from '../prototype';
import { useMtaStore } from '../store/MtaStore';
import { DEVELOPER_PHASE_CONFIG, DEFAULT_DEVELOPER_PHASE } from '../utils';
import { PhaseNotStarted } from './phases/PhaseNotStarted';
import { PhaseDiscovery } from './phases/PhaseDiscovery';
import { PhasePathSelection } from './phases/PhasePathSelection';
import { PhaseAnalyzing } from './phases/PhaseAnalyzing';
import { PhaseActive } from './phases/PhaseActive';
import { PhaseCompleted } from './phases/PhaseCompleted';
import { PhaseFailed } from './phases/PhaseFailed';

export function MigrationTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { entity } = useEntity();
  const store = useMtaStore();
  const persona = usePersona();
  const scope = usePrototypeScope();
  const globalPhase = useGlobalPhase();
  const entityRef = stringifyEntityRef(entity);
  const seededRef = useRef('');
  const autoDiscoverHandled = useRef(false);
  const lastGenRef = useRef(-1);
  const [errorType, setErrorType] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      setErrorType(detail.errorType ?? '');
      setErrorMessage(detail.errorMessage ?? '');
    };
    window.addEventListener('mta-error-type-override', handler);
    return () => window.removeEventListener('mta-error-type-override', handler);
  }, []);

  const repoUrl =
    entity.metadata.annotations?.['mta.konveyor.io/repo-url'] ||
    entity.metadata.annotations?.['backstage.io/source-location']?.replace('url:', '') ||
    '';

  useEffect(() => {
    const existingApp = store.getApplicationByEntityRef(entityRef);
    const isNewApp = !existingApp;

    const id = store.ensureApplication(entityRef, {
      name: entity.metadata.name,
      repoUrl,
      discoveredTags: [],
      archetypeId: 'arch-1',
      targetProfileId: 'target-1',
      status: globalPhase,
      issuesCount: 0,
      criticalIssues: 0,
      storyPoints: 0,
      filesAffected: 0,
      totalIssuesDiscovered: 0,
      entityRef,
      devSpacesAvailable: true,
      devSpacesActive: false,
    });

    const resolved = resolveEntityPhase(
      entityRef,
      isNewApp ? undefined : store.getApplicationById(id),
      globalPhase,
      lastGenRef.current,
    );
    lastGenRef.current = resolved.nextGen;
    if (resolved.shouldUpdate) {
      store.updateApplication(id, { status: resolved.phase });
    }
  }, [entityRef, store, entity.metadata.name, repoUrl, globalPhase]);

  const app = store.getApplicationByEntityRef(entityRef);
  const appId = app?.id ?? '';
  const displayStatus = app?.status ?? 'Not Started';

  useEffect(() => {
    if (autoDiscoverHandled.current) return;
    if (searchParams.get('autoDiscover') !== 'true') return;
    if (!appId) return;
    autoDiscoverHandled.current = true;
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('autoDiscover');
      return next;
    }, { replace: true });
    store.updateApplication(appId, { status: 'Discovery' });
    advancePhase(entityRef, 'Discovery');
  }, [searchParams, setSearchParams, appId, store, entityRef]);

  useEffect(() => {
    if (!appId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.entityRef === entityRef) {
        store.updateApplication(appId, { status: detail.phase });
      }
    };
    window.addEventListener('mta-phase-override', handler);
    return () => window.removeEventListener('mta-phase-override', handler);
  }, [entityRef, appId, store]);

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
  }, [displayStatus, appId, store]);

  const target = app ? store.getTargetProfileById(app.targetProfileId) : undefined;
  const archetype = app ? store.getArchetypeById(app.archetypeId) : undefined;
  const issues = appId ? store.getIssuesForApp(appId) : [];
  const actions = appId ? store.getActionsForApp(appId) : [];

  const handleStartDiscovery = useCallback(() => {
    if (!appId) return;
    store.updateApplication(appId, { status: 'Discovery' });
    advancePhase(entityRef, 'Discovery');
  }, [appId, store, entityRef]);

  if (persona === 'developer' && displayStatus !== 'Active' && displayStatus !== 'Post-remediation') {
    const phaseConfig = DEVELOPER_PHASE_CONFIG[displayStatus] ?? DEFAULT_DEVELOPER_PHASE;
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
      return <PhaseNotStarted persona={persona} onStartDiscovery={handleStartDiscovery} />;
    case 'Discovery':
      return <PhaseDiscovery repoUrl={repoUrl} store={store} entityRef={entityRef} />;
    case 'Path Selection':
      return <PhasePathSelection app={app} store={store} entityRef={entityRef} />;
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
          scope={scope}
        />
      );
    case 'Completed':
      return scope === 'enhancements' ? <PhaseCompleted app={app} actions={actions} issues={issues} /> : null;
    case 'Failed':
      return <PhaseFailed app={app} store={store} errorType={errorType} errorMessage={errorMessage} />;
    default:
      return null;
  }
}
