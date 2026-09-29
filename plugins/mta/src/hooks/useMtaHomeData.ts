import { useCallback, useEffect, useMemo, useState } from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { usePersonaRole } from './usePersonaRole';
import { useKonveyorApplications } from './useKonveyorData';
import type { MigrationStatus } from '../types';

export interface MtaAppInfo {
  name: string;
  title?: string;
  namespace: string;
  status: MigrationStatus;
  issuesCount: number;
  criticalIssues: number;
}

interface RawEntity {
  name: string;
  title?: string;
  namespace: string;
  annotations: Record<string, string>;
}

const MTA_ASSIGNED_DEVELOPER = 'mta.konveyor.io/assigned-developer';

const MIGRATION_STATUSES: readonly string[] = [
  'Not Started',
  'Discovery',
  'Path Selection',
  'Analysis',
  'Active',
  'Post-remediation',
  'Completed',
  'Failed',
];

export function useMtaHomeData(explicitPersona?: 'architect' | 'developer') {
  const { role: detectedPersona, loading: personaLoading } = usePersonaRole();
  const persona =
    explicitPersona ??
    (detectedPersona === 'developer' ? 'developer' : 'architect');
  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const [rawEntities, setRawEntities] = useState<RawEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [entitiesError, setEntitiesError] = useState(false);

  const {
    applications: konveyorApps,
    loading: konveyorLoading,
    error: konveyorError,
    refetch: refetchKonveyor,
  } = useKonveyorApplications();

  const fetchEntities = useCallback(async () => {
    setEntitiesLoading(true);
    setEntitiesError(false);
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
      setRawEntities(
        response.items.map(e => ({
          name: e.metadata.name,
          title: e.metadata.title,
          namespace: e.metadata.namespace ?? 'default',
          annotations: e.metadata.annotations ?? {},
        })),
      );
    } catch {
      setEntitiesError(true);
    } finally {
      setEntitiesLoading(false);
    }
  }, [catalogApi, identityApi, persona]);

  useEffect(() => {
    if (!personaLoading) {
      void fetchEntities();
    }
  }, [personaLoading, fetchEntities]);

  const apps: MtaAppInfo[] = useMemo(() => {
    const konveyorById = new Map<number, (typeof konveyorApps)[0]>();
    const konveyorByName = new Map<string, (typeof konveyorApps)[0]>();
    for (const app of konveyorApps) {
      konveyorById.set(app.id, app);
      konveyorByName.set(app.name.toLowerCase(), app);
    }

    return rawEntities.map(e => {
      const appIdStr = e.annotations['konveyor.io/application-id'];
      const appId = appIdStr ? Number(appIdStr) : undefined;
      const matchedApp =
        (appId !== undefined ? konveyorById.get(appId) : undefined) ??
        konveyorByName.get(e.name.toLowerCase());

      const annotation = e.annotations['mta.konveyor.io/status'];
      let status: MigrationStatus = 'Not Started';

      if (matchedApp) {
        const hasTags = (matchedApp.tags?.length ?? 0) > 0;
        if (!hasTags) {
          status = 'Discovery';
        } else if (matchedApp.tasks && matchedApp.tasks.length > 0) {
          status = 'Active';
        } else {
          status = 'Path Selection';
        }
      } else if (annotation === 'registering') {
        status = 'Discovery';
      } else if (annotation === 'discovered') {
        status = 'Path Selection';
      } else if (annotation === 'failed') {
        status = 'Failed';
      } else if (annotation && MIGRATION_STATUSES.includes(annotation)) {
        status = annotation as MigrationStatus;
      }

      return {
        name: e.name,
        title: e.title,
        namespace: e.namespace,
        status,
        issuesCount: Number(e.annotations['mta.konveyor.io/issues-count'] || 0),
        criticalIssues: Number(
          e.annotations['mta.konveyor.io/critical-issues'] || 0,
        ),
      };
    });
  }, [rawEntities, konveyorApps]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchEntities(), refetchKonveyor()]);
  }, [fetchEntities, refetchKonveyor]);

  const loading = personaLoading || entitiesLoading || konveyorLoading;
  const error = entitiesError || Boolean(konveyorError);

  return { apps, loading, error, refetch };
}
