import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { mtaApiRef } from '../api';
import type { MtaApi } from '../api';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
} from '../api/types';
import type { IssueCategory, IssueSeverity, MigrationIssue } from '../types';

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
  const [application, setApplication] = useState<KonveyorApplication | null>(
    null,
  );
  const [loading, setLoading] = useState(Boolean(appId));
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);
  const currentAppId = useRef(appId);
  currentAppId.current = appId;

  const fetchApplication = useCallback(async () => {
    const request = ++generation.current;
    setApplication(null);
    setError(null);
    if (!appId) {
      setApplication(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await mtaApi.getApplication(appId);
      if (request !== generation.current || currentAppId.current !== appId)
        return;
      setApplication(data);
    } catch (err: unknown) {
      if (request !== generation.current || currentAppId.current !== appId)
        return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (request === generation.current && currentAppId.current === appId) {
        setLoading(false);
      }
    }
  }, [mtaApi, appId]);

  useEffect(() => {
    void fetchApplication();
    return () => {
      generation.current += 1;
    };
  }, [fetchApplication]);

  return {
    application: application?.id === appId ? application : null,
    loading,
    error,
    refetch: fetchApplication,
  };
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

function mapSeverity(category?: string, labels?: string[]): IssueSeverity {
  const cat = (category ?? '').toLowerCase();
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
  if (labels?.some(l => l.toLowerCase().includes('critical')))
    return 'critical';
  if (labels?.some(l => l.toLowerCase().includes('major'))) return 'major';
  return 'info';
}

function mapCategory(category?: string, ruleset?: string): IssueCategory {
  const text = `${category} ${ruleset ?? ''}`.toLowerCase();
  if (text.includes('dependency') || text.includes('package'))
    return 'dependency';
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

export async function loadKonveyorIssues(mtaApi: MtaApi, appId: number) {
  const insights = await mtaApi.getIssues(appId);
  const incidentsList: KonveyorIncident[][] = await Promise.all(
    insights.map(async insight => {
      try {
        return await mtaApi.getIncidents(insight.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Could not load incidents for Hub insight ${insight.id}: ${message}`,
        );
      }
    }),
  );
  const issues: MigrationIssue[] = [];
  insights.forEach((insight, index) => {
    const base = {
      appId: String(appId),
      severity: mapSeverity(insight.category, insight.labels),
      category: mapCategory(insight.category, insight.ruleset),
      description: insight.name || insight.description || insight.rule,
      problem: insight.description,
      links: insight.links?.map(link => ({
        title: link.title || link.url,
        url: link.url,
      })),
      effort: insight.effort,
    };
    const incidents = incidentsList[index];
    if (incidents.length === 0) {
      issues.push({ ...base, id: `issue-${insight.id}` });
    } else {
      incidents.forEach(incident => {
        issues.push({
          ...base,
          id: `issue-${insight.id}-${incident.id}`,
          file: incident.file || undefined,
          line: incident.line,
          message: incident.message,
          codeSnip: incident.codeSnip,
        });
      });
    }
  });
  return { issues, insights };
}

export function useKonveyorIssues(appId?: number) {
  const mtaApi = useMtaApi();
  const [issues, setIssues] = useState<MigrationIssue[]>([]);
  const [rawInsights, setRawInsights] = useState<KonveyorInsight[]>([]);
  const [loading, setLoading] = useState(Boolean(appId));
  const [error, setError] = useState<Error | null>(null);
  const generation = useRef(0);

  const fetchIssues = useCallback(async () => {
    const request = ++generation.current;
    setError(null);
    setIssues([]);
    setRawInsights([]);
    if (!appId) {
      setIssues([]);
      setRawInsights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadKonveyorIssues(mtaApi, appId);
      if (request !== generation.current) return;
      setRawInsights(result.insights);
      setIssues(result.issues);
    } catch (err: unknown) {
      if (request !== generation.current) return;
      setIssues([]);
      setRawInsights([]);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [mtaApi, appId]);

  useEffect(() => {
    void fetchIssues();
    return () => {
      generation.current += 1;
    };
  }, [fetchIssues]);

  return { issues, rawInsights, loading, error, refetch: fetchIssues };
}
