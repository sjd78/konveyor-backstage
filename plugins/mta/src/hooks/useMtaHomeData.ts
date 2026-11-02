import { useCallback, useEffect, useState } from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { usePersonaRole } from './usePersonaRole';
import { loadKonveyorIssues, useMtaApi } from './useKonveyorData';
import { deriveKonveyorPhase } from './migrationState';
import type { MigrationStatus } from '../types';

export interface MtaAppInfo {
  name: string;
  title?: string;
  namespace: string;
  connection: 'connected' | 'disconnected' | 'missing';
  status?: MigrationStatus;
  issuesCount?: number;
  criticalIssues?: number;
  error?: Error;
}

const MTA_ASSIGNED_DEVELOPER = 'mta.konveyor.io/assigned-developer';

export function useMtaHomeData(explicitPersona?: 'architect' | 'developer') {
  const { role: persona, loading: personaLoading } = usePersonaRole();
  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const mtaApi = useMtaApi();
  const [apps, setApps] = useState<MtaAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setApps([]);
    setError(null);
    if (personaLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }
    if (
      persona === 'unknown' ||
      (explicitPersona && explicitPersona !== persona)
    ) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    const fetchApps = async () => {
      try {
        let filter: Record<string, string>;
        if (persona === 'architect') {
          filter = {
            kind: 'Component',
            'relations.ownedBy': 'group:default/mta-architects',
          };
        } else {
          const identity = await identityApi.getBackstageIdentity();
          filter = {
            kind: 'Component',
            [`metadata.annotations.${MTA_ASSIGNED_DEVELOPER}`]:
              identity.userEntityRef,
          };
        }
        const response = await catalogApi.getEntities({
          filter,
          fields: [
            'metadata.name',
            'metadata.title',
            'metadata.namespace',
            'metadata.annotations',
          ],
        });
        const applications = await mtaApi.getApplications();
        const applicationIds = new Set(applications.map(app => app.id));
        const nextApps = await Promise.all(
          response.items.map(async entity => {
            const base = {
              name: entity.metadata.name,
              title: entity.metadata.title,
              namespace: entity.metadata.namespace ?? 'default',
            };
            const annotation =
              entity.metadata.annotations?.['konveyor.io/application-id'];
            if (!annotation) {
              return { ...base, connection: 'disconnected' as const };
            }
            const id = /^\d+$/.test(annotation) ? Number(annotation) : NaN;
            if (
              !Number.isSafeInteger(id) ||
              id <= 0 ||
              !applicationIds.has(id)
            ) {
              return { ...base, connection: 'missing' as const };
            }
            try {
              const [tasks, analysis] = await Promise.all([
                mtaApi.getApplicationTasks(id),
                mtaApi.getAnalysis(id),
              ]);
              const status = deriveKonveyorPhase(tasks, analysis !== null);
              if (analysis === null) {
                return { ...base, connection: 'connected' as const, status };
              }
              const { issues } = await loadKonveyorIssues(mtaApi, id);
              return {
                ...base,
                connection: 'connected' as const,
                status,
                issuesCount: issues.length,
                criticalIssues: issues.filter(
                  issue => issue.severity === 'critical',
                ).length,
              };
            } catch (err) {
              return {
                ...base,
                connection: 'connected' as const,
                error: err instanceof Error ? err : new Error(String(err)),
              };
            }
          }),
        );
        if (!cancelled) setApps(nextApps);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchApps();
    return () => {
      cancelled = true;
    };
  }, [
    catalogApi,
    identityApi,
    mtaApi,
    persona,
    personaLoading,
    explicitPersona,
    refresh,
  ]);

  const refetch = useCallback(async () => setRefresh(value => value + 1), []);
  return { apps, loading, error, refetch };
}
