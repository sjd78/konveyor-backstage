import { LoggerService } from '@backstage/backend-plugin-api';
import type {
  KonveyorAnalysis,
  KonveyorAnalysisProfile,
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
  KonveyorTarget,
} from './types';

export interface KonveyorClientOptions {
  baseUrl: string;
  token?: string;
  logger?: LoggerService;
}

export class KonveyorClientError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, statusText: string, path: string, body: string) {
    super(`Konveyor API error [${status} ${statusText}] at ${path}: ${body}`);
    this.name = 'KonveyorClientError';
    this.status = status;
    this.body = body;
  }
}

export class KonveyorClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly logger?: LoggerService;

  constructor(options: KonveyorClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.logger = options.logger;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
    pagination?: { total?: number },
  ): Promise<T> {
    const normalizedPath = path.startsWith('/hub')
      ? path
      : `/hub${path.startsWith('/') ? path : `/${path}`}`;
    const url = `${this.baseUrl}${normalizedPath}`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger?.warn(
        `Konveyor API error [${res.status} ${res.statusText}] at ${normalizedPath}: ${errorText}`,
      );
      throw new KonveyorClientError(
        res.status,
        res.statusText,
        normalizedPath,
        errorText,
      );
    }

    const total = res.headers.get('x-total');
    if (pagination && total !== null) {
      pagination.total = Number(total);
    }
    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  private async list<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const limit = 100;
    for (;;) {
      const pagination: { total?: number } = {};
      const separator = path.includes('?') ? '&' : '?';
      const page = await this.request<T[]>(
        `${path}${separator}offset=${items.length}&limit=${limit}`,
        undefined,
        pagination,
      );
      items.push(...page);
      if (
        page.length === 0 ||
        (pagination.total !== undefined
          ? items.length >= pagination.total
          : page.length < limit)
      ) {
        return items;
      }
    }
  }

  async getApplications(): Promise<KonveyorApplication[]> {
    return this.list<KonveyorApplication>('/applications');
  }

  async getApplication(id: number): Promise<KonveyorApplication> {
    return this.request<KonveyorApplication>(`/applications/${id}`);
  }

  async createApplication(
    app: Partial<KonveyorApplication>,
  ): Promise<KonveyorApplication> {
    return this.request<KonveyorApplication>('/applications', {
      method: 'POST',
      body: JSON.stringify(app),
    });
  }

  async getArchetypes(): Promise<KonveyorArchetype[]> {
    return this.request<KonveyorArchetype[]>('/archetypes');
  }

  async getApplicationTasks(appId: number): Promise<KonveyorTask[]> {
    await this.getApplication(appId);
    return this.list<KonveyorTask>(
      `/tasks?filter=${encodeURIComponent(`application.id:${appId}`)}`,
    );
  }

  async getAnalysisProfiles(appId: number): Promise<KonveyorAnalysisProfile[]> {
    return this.request<KonveyorAnalysisProfile[]>(
      `/applications/${appId}/analysis/profiles`,
    );
  }

  async getTargets(): Promise<KonveyorTarget[]> {
    return this.request<KonveyorTarget[]>('/targets');
  }

  private async createAndSubmitTask(
    task: Omit<KonveyorTask, 'id' | 'state'>,
  ): Promise<KonveyorTask> {
    const created = await this.request<KonveyorTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    await this.request<void>(`/tasks/${created.id}/submit`, {
      method: 'PUT',
      body: JSON.stringify({ id: created.id }),
    });
    return this.getTask(created.id);
  }

  async createAnalysisTask(
    appId: number,
    profileId: number,
  ): Promise<KonveyorTask> {
    const profiles = await this.getAnalysisProfiles(appId);
    if (!profiles.some(profile => profile.id === profileId)) {
      throw new KonveyorClientError(
        400,
        'Bad Request',
        `/applications/${appId}/analysis/profiles`,
        'The selected analysis profile is not available for this application',
      );
    }
    return this.createAndSubmitTask({
      name: `application-${appId}-analyzer`,
      kind: 'analyzer',
      addon: 'analyzer',
      application: { id: appId },
      data: {
        profile: { id: profileId },
        tagger: { enabled: true },
        verbosity: 0,
      },
    });
  }

  async createDiscoveryTask(appId: number): Promise<KonveyorTask> {
    await this.getApplication(appId);
    return this.createAndSubmitTask({
      name: `application-${appId}-language-discovery`,
      kind: 'language-discovery',
      addon: 'language-discovery',
      application: { id: appId },
      data: { source: 'language-discovery' },
    });
  }

  async getTask(taskId: number): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/tasks/${taskId}`);
  }

  async getAnalysis(appId: number): Promise<KonveyorAnalysis | null> {
    const analyses = await this.list<KonveyorAnalysis>(
      `/applications/${appId}/analyses`,
    );
    if (analyses.length === 0) {
      // The metadata list is also empty for an unknown application.
      await this.getApplication(appId);
    }
    return analyses.reduce<KonveyorAnalysis | null>((latest, analysis) => {
      if (analysis.archived) return latest;
      return !latest || analysis.id > latest.id ? analysis : latest;
    }, null);
  }

  async getInsights(appId: number): Promise<KonveyorInsight[]> {
    try {
      return await this.list<KonveyorInsight>(
        `/applications/${appId}/analysis/insights`,
      );
    } catch (error) {
      if (!(error instanceof KonveyorClientError) || error.status !== 404) {
        throw error;
      }
      // Only an existing application without an analysis has empty findings.
      // A missing app or a failed insights resource must keep its error status.
      if (await this.getAnalysis(appId)) throw error;
      return [];
    }
  }

  async getIncidents(insightId: number): Promise<KonveyorIncident[]> {
    return this.list<KonveyorIncident>(
      `/analyses/insights/${insightId}/incidents`,
    );
  }
}
