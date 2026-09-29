import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { mtaApiRef } from '../api';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
} from '../api/types';
import type {
  IssueCategory,
  IssueSeverity,
  MigrationIssue,
} from '../types';

export function useMtaApi() {
  return useApi(mtaApiRef);
}

export function useKonveyorApplications() {
  const mtaApi = useMtaApi();
  const [applications, setApplications] = useState<KonveyorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mtaApi.getApplications();
      setApplications(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [mtaApi]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  return { applications, loading, error, refetch: fetchApplications };
}

export function useKonveyorApplication(appId?: number) {
  const mtaApi = useMtaApi();
  const [application, setApplication] = useState<KonveyorApplication | null>(null);
  const [loading, setLoading] = useState(Boolean(appId));
  const [error, setError] = useState<Error | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!appId) {
      setApplication(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await mtaApi.getApplication(appId);
      setApplication(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [mtaApi, appId]);

  useEffect(() => {
    void fetchApplication();
  }, [fetchApplication]);

  return { application, loading, error, refetch: fetchApplication };
}

export function useKonveyorArchetypes() {
  const mtaApi = useMtaApi();
  const [archetypes, setArchetypes] = useState<KonveyorArchetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchArchetypes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mtaApi.getArchetypes();
      setArchetypes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [mtaApi]);

  useEffect(() => {
    void fetchArchetypes();
  }, [fetchArchetypes]);

  return { archetypes, loading, error, refetch: fetchArchetypes };
}

function mapSeverity(category: string, labels?: string[]): IssueSeverity {
  const cat = category.toLowerCase();
  if (
    cat.includes('mandatory') ||
    cat.includes('critical') ||
    cat.includes('blocker')
  ) {
    return 'critical';
  }
  if (cat.includes('potential') || cat.includes('major')) {
    return 'major';
  }
  if (cat.includes('optional') || cat.includes('minor')) {
    return 'minor';
  }
  if (labels?.some(l => l.toLowerCase().includes('critical'))) return 'critical';
  if (labels?.some(l => l.toLowerCase().includes('major'))) return 'major';
  return 'info';
}

function mapCategory(category: string, ruleset?: string): IssueCategory {
  const text = `${category} ${ruleset ?? ''}`.toLowerCase();
  if (text.includes('dependency') || text.includes('package')) return 'dependency';
  if (
    text.includes('config') ||
    text.includes('xml') ||
    text.includes('properties')
  ) {
    return 'configuration';
  }
  if (
    text.includes('deploy') ||
    text.includes('container') ||
    text.includes('docker') ||
    text.includes('k8s')
  ) {
    return 'deployment';
  }
  if (
    text.includes('api') ||
    text.includes('deprecated') ||
    text.includes('mandatory')
  ) {
    return 'api-change';
  }
  return 'code-pattern';
}

export function useKonveyorIssues(appId?: number) {
  const mtaApi = useMtaApi();
  const [issues, setIssues] = useState<MigrationIssue[]>([]);
  const [rawInsights, setRawInsights] = useState<KonveyorInsight[]>([]);
  const [loading, setLoading] = useState(Boolean(appId));
  const [error, setError] = useState<Error | null>(null);

  const fetchIssues = useCallback(async () => {
    if (!appId) {
      setIssues([]);
      setRawInsights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const insights = await mtaApi.getIssues(appId);
      setRawInsights(insights);

      const incidentsList: KonveyorIncident[][] = await Promise.all(
        insights.map(async insight => {
          try {
            return await mtaApi.getIncidents(insight.id);
          } catch {
            return [];
          }
        }),
      );

      const normalized: MigrationIssue[] = [];
      for (let i = 0; i < insights.length; i++) {
        const insight = insights[i];
        const incidents = incidentsList[i];
        if (incidents && incidents.length > 0) {
          for (const incident of incidents) {
            normalized.push({
              id: `issue-${insight.id}-${incident.id}`,
              appId: String(appId),
              severity: mapSeverity(insight.category, insight.labels),
              category: mapCategory(insight.category, insight.ruleset),
              description: insight.name || insight.description,
              file: incident.file || 'General',
              line: incident.line || 1,
              aiFixAvailable: true,
              problem: insight.description || incident.message,
              impact: `Effort level: ${insight.effort} points`,
              fixGuidance: insight.links?.[0]?.url
                ? `See: ${insight.links[0].url}`
                : 'Review migration documentation and update source code.',
            });
          }
        } else {
          normalized.push({
            id: `issue-${insight.id}`,
            appId: String(appId),
            severity: mapSeverity(insight.category, insight.labels),
            category: mapCategory(insight.category, insight.ruleset),
            description: insight.name || insight.description,
            file: 'General',
            line: 1,
            aiFixAvailable: true,
            problem: insight.description,
            impact: `Effort level: ${insight.effort} points`,
            fixGuidance: insight.links?.[0]?.url
              ? `See: ${insight.links[0].url}`
              : 'Review migration documentation and update source code.',
          });
        }
      }

      setIssues(normalized);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [mtaApi, appId]);

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  return { issues, rawInsights, loading, error, refetch: fetchIssues };
}
