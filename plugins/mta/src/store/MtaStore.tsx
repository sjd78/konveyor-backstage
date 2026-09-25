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
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import type {
  Archetype,
  TargetProfile,
  MtaApplication,
  MigrationIssue,
  ActionHistoryEntry,
  ActionType,
  ActionStatus,
  MigrationStatus,
} from '../types';
import { DISCOVERY_DELAY_MS, ACTION_TIMEOUT_MS } from '../utils';
import {
  generateMockIssues,
  initialArchetypes,
  initialTargetProfiles,
  initialApplications,
  initialIssues,
  initialActionHistory,
  tagsForUrl,
} from './mockData';

export {
  DEFAULT_DEVSPACES_CONFIG,
  DEPLOYMENT_ASSETS,
  DEPLOYMENT_ASSET_PREVIEWS,
} from './mockData';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface CatalogEntity {
  name: string;
  repoUrl: string;
  description?: string;
  type?: string;
  lifecycle?: string;
  owner?: string;
  system?: string;
  tags?: string[];
}

interface MtaState {
  applications: MtaApplication[];
  archetypes: Archetype[];
  targetProfiles: TargetProfile[];
  issues: MigrationIssue[];
  actionHistory: ActionHistoryEntry[];
}

export interface AggregateStats {
  totalApps: number;
  inProgress: number;
  completed: number;
  totalCriticalIssues: number;
  totalStoryPoints: number;
}

interface MtaStoreValue extends MtaState {
  addApplication: (app: Omit<MtaApplication, 'id'>) => string;
  updateApplication: (
    id: string,
    updates: Partial<Omit<MtaApplication, 'id'>>,
  ) => void;
  getApplicationById: (id: string) => MtaApplication | undefined;
  getApplicationByEntityRef: (entityRef: string) => MtaApplication | undefined;
  ensureApplication: (
    entityRef: string,
    defaults: Omit<MtaApplication, 'id'>,
  ) => string;

  simulateDiscovery: (repoUrl: string) => Promise<string[]>;
  matchArchetypes: (tags: string[]) => Archetype[];
  getArchetypeById: (id: string) => Archetype | undefined;
  getTargetsForArchetype: (archetypeId: string) => TargetProfile[];
  getTargetProfileById: (id: string) => TargetProfile | undefined;

  getIssuesForApp: (appId: string) => MigrationIssue[];
  getActionsForApp: (appId: string) => ActionHistoryEntry[];
  executeAction: (
    appId: string,
    action: ActionType,
    triggeredBy: 'architect' | 'developer',
  ) => void;

  seedIssuesIfNeeded: (appId: string) => void;
  resolveAiFixableIssues: (appId: string) => void;

  getAggregateStats: () => AggregateStats;
  isRepoAlreadyOnboarded: (repoUrl: string) => boolean;
  catalogEntities: CatalogEntity[];
  resetToInitial: () => void;
}

// ---------------------------------------------------------------------------
// Annotation key used to identify MTA-eligible catalog entities
// ---------------------------------------------------------------------------

const MTA_REPO_ANNOTATION = 'mta.konveyor.io/repo-url';

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const MtaContext = createContext<MtaStoreValue | null>(null);

const archetypeTargetMap: Record<string, string[]> = {
  'arch-1': ['target-1', 'target-2'],
};

const SESSION_KEY = 'mta-store-state';

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }
  return null;
}

export function readDemoApplications(): MtaApplication[] {
  return loadSessionState()?.applications ?? initialApplications;
}

function saveSessionState(
  apps: MtaApplication[],
  iss: MigrationIssue[],
  hist: ActionHistoryEntry[],
) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ applications: apps, issues: iss, actionHistory: hist }),
    );
  } catch {
    /* noop */
  }
}

export function MtaStoreProvider(props: { children: ReactNode }) {
  const [{ cached, lastId }] = useState(() => {
    const cached = loadSessionState();
    let lastId = 100;
    for (const entries of [
      cached?.applications,
      cached?.issues,
      cached?.actionHistory,
    ]) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        const match = /-(\d+)$/.exec(String(entry.id));
        if (match) lastId = Math.max(lastId, Number(match[1]));
      }
    }
    return { cached, lastId };
  });
  const idCounterRef = useRef(lastId);
  const nextId = useCallback((prefix: string): string => {
    idCounterRef.current += 1;
    return `${prefix}-${idCounterRef.current}`;
  }, []);

  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const [fetchedCatalogEntities, setFetchedCatalogEntities] = useState<
    CatalogEntity[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        return catalogApi.getEntities({
          filter: {
            kind: 'Component',
            'relations.ownedBy': identity.ownershipEntityRefs,
          },
          fields: [
            'metadata.name',
            'metadata.description',
            'metadata.annotations',
            'metadata.tags',
            'spec.type',
            'spec.lifecycle',
            'spec.owner',
            'spec.system',
          ],
        });
      })
      .then(response => {
        if (cancelled) return;
        const mapped: CatalogEntity[] = response.items.map(entity => {
          const annotations = entity.metadata.annotations ?? {};
          return {
            name: entity.metadata.name,
            repoUrl:
              (annotations[MTA_REPO_ANNOTATION] as string) ||
              (annotations['backstage.io/source-location'] as string)?.replace(
                'url:',
                '',
              ) ||
              '',
            description: entity.metadata.description,
            type: (entity.spec as Record<string, unknown>)?.type as string,
            lifecycle: (entity.spec as Record<string, unknown>)
              ?.lifecycle as string,
            owner: (entity.spec as Record<string, unknown>)?.owner as string,
            system: (entity.spec as Record<string, unknown>)?.system as string,
            tags: entity.metadata.tags,
          };
        });
        setFetchedCatalogEntities(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [catalogApi, identityApi]);

  const [applications, setApplications] = useState<MtaApplication[]>(
    cached?.applications ?? initialApplications,
  );
  const [issues, setIssues] = useState<MigrationIssue[]>(
    cached?.issues ?? initialIssues,
  );
  const [actionHistory, setActionHistory] = useState<ActionHistoryEntry[]>(
    cached?.actionHistory ?? initialActionHistory,
  );

  useEffect(() => {
    saveSessionState(applications, issues, actionHistory);
  }, [applications, issues, actionHistory]);

  const applicationsRef = useRef(applications);
  applicationsRef.current = applications;
  const issuesRef = useRef(issues);
  issuesRef.current = issues;

  const archetypes = initialArchetypes;
  const targetProfiles = initialTargetProfiles;

  // -- Application CRUD -----------------------------------------------------

  const addApplication = useCallback(
    (app: Omit<MtaApplication, 'id'>): string => {
      const id = nextId('app');
      setApplications(prev => [...prev, { ...app, id }]);
      return id;
    },
    [nextId],
  );

  const updateApplication = useCallback(
    (id: string, updates: Partial<Omit<MtaApplication, 'id'>>) => {
      setApplications(prev =>
        prev.map(a => (a.id === id ? { ...a, ...updates } : a)),
      );
    },
    [],
  );

  const getApplicationById = useCallback(
    (id: string) => applications.find(a => a.id === id),
    [applications],
  );

  const getApplicationByEntityRef = useCallback(
    (entityRef: string) => applications.find(a => a.entityRef === entityRef),
    [applications],
  );

  const ensureApplication = useCallback(
    (entityRef: string, defaults: Omit<MtaApplication, 'id'>): string => {
      const existing = applicationsRef.current.find(
        a => a.entityRef === entityRef,
      );
      if (existing) return existing.id;
      return addApplication({ ...defaults, entityRef });
    },
    [addApplication],
  );

  // -- Discovery ------------------------------------------------------------

  const simulateDiscovery = useCallback(
    (repoUrl: string): Promise<string[]> =>
      new Promise(resolve => {
        setTimeout(() => resolve(tagsForUrl(repoUrl)), DISCOVERY_DELAY_MS);
      }),
    [],
  );

  // -- Archetype matching ---------------------------------------------------

  const matchArchetypes = useCallback(
    (tags: string[]): Archetype[] => {
      if (tags.length === 0) return [];
      const normalizedTags = tags.map(t => t.toLowerCase());
      return archetypes.filter(arch =>
        arch.criteriaTags.every(ct =>
          normalizedTags.includes(ct.toLowerCase()),
        ),
      );
    },
    [archetypes],
  );

  const getArchetypeById = useCallback(
    (id: string) => archetypes.find(a => a.id === id),
    [archetypes],
  );

  // -- Targets --------------------------------------------------------------

  const getTargetsForArchetype = useCallback(
    (archetypeId: string): TargetProfile[] => {
      const targetIds = archetypeTargetMap[archetypeId] ?? [];
      return targetProfiles.filter(t => targetIds.includes(t.id));
    },
    [targetProfiles],
  );

  const getTargetProfileById = useCallback(
    (id: string) => targetProfiles.find(t => t.id === id),
    [targetProfiles],
  );

  // -- Issues ---------------------------------------------------------------

  const getIssuesForApp = useCallback(
    (appId: string) => issues.filter(i => i.appId === appId),
    [issues],
  );

  // -- Actions --------------------------------------------------------------

  const getActionsForApp = useCallback(
    (appId: string) =>
      actionHistory
        .filter(a => a.appId === appId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [actionHistory],
  );

  const executeAction = useCallback(
    (
      appId: string,
      action: ActionType,
      triggeredBy: 'architect' | 'developer',
    ) => {
      const entryId = nextId('action');
      const entry: ActionHistoryEntry = {
        id: entryId,
        appId,
        action,
        timestamp: new Date().toISOString(),
        status: 'running',
        triggeredBy,
      };
      setActionHistory(prev => [entry, ...prev]);

      if (action === 'run-analysis') {
        const currentApp = applicationsRef.current.find(a => a.id === appId);
        if (currentApp?.status === 'Analysis') {
          setActionHistory(prev =>
            prev.map(a =>
              a.id === entryId
                ? { ...a, status: 'completed' as ActionStatus }
                : a,
            ),
          );
          const existing = issuesRef.current.filter(i => i.appId === appId);
          if (existing.length === 0) {
            const newIssues = generateMockIssues(
              appId,
              currentApp.archetypeId,
              nextId,
            );
            setIssues(prev => [...prev, ...newIssues]);
            const critCount = newIssues.filter(
              i => i.severity === 'critical',
            ).length;
            const uniqueFiles = new Set(newIssues.map(i => i.file)).size;
            setApplications(prev =>
              prev.map(a =>
                a.id === appId
                  ? {
                      ...a,
                      status: 'Active' as MigrationStatus,
                      totalIssuesDiscovered: newIssues.length,
                      issuesCount: newIssues.length,
                      criticalIssues: critCount,
                      storyPoints: newIssues.length * 2,
                      filesAffected: uniqueFiles,
                    }
                  : a,
              ),
            );
          } else {
            setApplications(prev =>
              prev.map(a =>
                a.id === appId
                  ? { ...a, status: 'Active' as MigrationStatus }
                  : a,
              ),
            );
          }
          return;
        }
        setApplications(prev =>
          prev.map(a => (a.id === appId ? { ...a, status: 'Analysis' } : a)),
        );
        return;
      }

      const statusMap: Partial<Record<ActionType, MigrationStatus>> = {
        'trigger-ai-remediator': 'Post-remediation',
      };
      if (statusMap[action]) {
        setApplications(prev =>
          prev.map(a =>
            a.id === appId ? { ...a, status: statusMap[action]! } : a,
          ),
        );
      }

      setTimeout(() => {
        setActionHistory(prev =>
          prev.map(a =>
            a.id === entryId
              ? { ...a, status: 'completed' as ActionStatus }
              : a,
          ),
        );

        if (action === 'trigger-ai-remediator') {
          setIssues(prev =>
            prev.map(i =>
              i.appId === appId && i.aiFixAvailable
                ? { ...i, resolved: true }
                : i,
            ),
          );
          const updated = issuesRef.current.map(i =>
            i.appId === appId && i.aiFixAvailable
              ? { ...i, resolved: true }
              : i,
          );
          const remaining = updated.filter(
            i => i.appId === appId && !i.resolved,
          );
          setApplications(prev =>
            prev.map(a =>
              a.id === appId
                ? {
                    ...a,
                    issuesCount: remaining.length,
                    criticalIssues: remaining.filter(
                      i => i.severity === 'critical',
                    ).length,
                    storyPoints: remaining.length * 2,
                  }
                : a,
            ),
          );
        }
        if (action === 'apply-quick-fixes') {
          const unresolved = issuesRef.current.filter(
            i => i.appId === appId && !i.resolved,
          );
          const toFix = unresolved.slice(0, 2).map(i => i.id);
          setIssues(prev =>
            prev.map(i =>
              toFix.includes(i.id) ? { ...i, resolved: true } : i,
            ),
          );
          const remainingCount = unresolved.length - toFix.length;
          const remainingCritical = unresolved
            .filter(i => !toFix.includes(i.id))
            .filter(i => i.severity === 'critical').length;
          setApplications(prev =>
            prev.map(a =>
              a.id === appId
                ? {
                    ...a,
                    issuesCount: remainingCount,
                    criticalIssues: remainingCritical,
                    storyPoints: remainingCount * 2,
                  }
                : a,
            ),
          );
        }
      }, ACTION_TIMEOUT_MS);
    },
    [nextId],
  );

  // -- Seed issues for phase dropdown demo ----------------------------------

  const seedIssuesIfNeeded = useCallback(
    (appId: string) => {
      const currentApp = applicationsRef.current.find(a => a.id === appId);
      if (!currentApp) return;
      const existingIssues = issuesRef.current.filter(i => i.appId === appId);
      if (existingIssues.length > 0) return;

      const newIssues = generateMockIssues(
        appId,
        currentApp.archetypeId,
        nextId,
      );
      setIssues(prev => [...prev, ...newIssues]);
      const critCount = newIssues.filter(i => i.severity === 'critical').length;
      const uniqueFiles = new Set(newIssues.map(i => i.file)).size;
      setApplications(prev =>
        prev.map(a =>
          a.id === appId
            ? {
                ...a,
                totalIssuesDiscovered: newIssues.length,
                issuesCount: newIssues.length,
                criticalIssues: critCount,
                storyPoints: newIssues.length * 2,
                filesAffected: uniqueFiles,
              }
            : a,
        ),
      );
    },
    [nextId],
  );

  const resolveAiFixableIssues = useCallback(
    (appId: string) => {
      const appIssues = issuesRef.current.filter(i => i.appId === appId);
      const alreadyResolved = appIssues.some(i => i.resolved);
      if (alreadyResolved) return;

      setIssues(prev =>
        prev.map(i =>
          i.appId === appId && i.aiFixAvailable ? { ...i, resolved: true } : i,
        ),
      );
      const remaining = appIssues.filter(i => !i.aiFixAvailable);
      setApplications(prev =>
        prev.map(a =>
          a.id === appId
            ? {
                ...a,
                issuesCount: remaining.length,
                criticalIssues: remaining.filter(i => i.severity === 'critical')
                  .length,
                storyPoints: remaining.length * 2,
              }
            : a,
        ),
      );
      const hasRemediationAction = actionHistory.some(
        ah => ah.appId === appId && ah.action === 'trigger-ai-remediator',
      );
      if (!hasRemediationAction) {
        setActionHistory(prev => [
          {
            id: nextId('action'),
            appId,
            action: 'trigger-ai-remediator',
            timestamp: new Date().toISOString(),
            status: 'completed',
            triggeredBy: 'architect',
          },
          ...prev,
        ]);
      }
    },
    [nextId, actionHistory],
  );

  // -- Aggregates -----------------------------------------------------------

  const getAggregateStats = useCallback((): AggregateStats => {
    const active: MigrationStatus[] = [
      'Discovery',
      'Analysis',
      'Active',
      'Post-remediation',
    ];
    return {
      totalApps: applications.length,
      inProgress: applications.filter(a => active.includes(a.status)).length,
      completed: applications.filter(a => a.status === 'Completed').length,
      totalCriticalIssues: applications.reduce(
        (sum, a) => sum + a.criticalIssues,
        0,
      ),
      totalStoryPoints: applications.reduce((sum, a) => sum + a.storyPoints, 0),
    };
  }, [applications]);

  // -- Duplicate detection --------------------------------------------------

  const isRepoAlreadyOnboarded = useCallback(
    (repoUrl: string) =>
      applications.some(a => a.repoUrl.toLowerCase() === repoUrl.toLowerCase()),
    [applications],
  );

  // -- Catalog entities (un-onboarded) -------------------------------------

  const catalogEntities = useMemo(
    () =>
      fetchedCatalogEntities.filter(
        ce =>
          !applications.some(
            a => a.repoUrl.toLowerCase() === ce.repoUrl.toLowerCase(),
          ),
      ),
    [applications, fetchedCatalogEntities],
  );

  // -- Demo reset -----------------------------------------------------------

  const resetToInitial = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setApplications(initialApplications);
    setIssues(initialIssues);
    setActionHistory([]);
  }, []);

  // -- Context value --------------------------------------------------------

  const value = useMemo<MtaStoreValue>(
    () => ({
      applications,
      archetypes,
      targetProfiles,
      issues,
      actionHistory,

      addApplication,
      updateApplication,
      getApplicationById,
      getApplicationByEntityRef,
      ensureApplication,

      simulateDiscovery,
      matchArchetypes,
      getArchetypeById,
      getTargetsForArchetype,
      getTargetProfileById,

      getIssuesForApp,
      getActionsForApp,
      executeAction,
      seedIssuesIfNeeded,
      resolveAiFixableIssues,

      getAggregateStats,
      isRepoAlreadyOnboarded,
      catalogEntities,
      resetToInitial,
    }),
    [
      applications,
      archetypes,
      targetProfiles,
      issues,
      actionHistory,
      addApplication,
      updateApplication,
      getApplicationById,
      getApplicationByEntityRef,
      ensureApplication,
      simulateDiscovery,
      matchArchetypes,
      getArchetypeById,
      getTargetsForArchetype,
      getTargetProfileById,
      getIssuesForApp,
      getActionsForApp,
      executeAction,
      seedIssuesIfNeeded,
      resolveAiFixableIssues,
      getAggregateStats,
      isRepoAlreadyOnboarded,
      catalogEntities,
      resetToInitial,
    ],
  );

  return (
    <MtaContext.Provider value={value}>{props.children}</MtaContext.Provider>
  );
}

export function useMtaStore(): MtaStoreValue {
  const ctx = useContext(MtaContext);
  if (!ctx) {
    throw new Error('useMtaStore must be used within MtaStoreProvider');
  }
  return ctx;
}
