import { LoggerService } from '@backstage/backend-plugin-api';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
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

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
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

    if (res.status === 204) {
      return undefined as T;
    }

    return (await res.json()) as T;
  }

  async getApplications(): Promise<KonveyorApplication[]> {
    return this.request<KonveyorApplication[]>('/applications');
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

  async createAnalysisTask(
    appId: number,
    options: { targets: string[]; sources?: string[] },
  ): Promise<KonveyorTask> {
    return this.request<KonveyorTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        addon: 'analyzer',
        application: { id: appId },
        data: {
          targets: options.targets,
          sources: options.sources || [],
          mode: {
            binary: false,
            withDeps: true,
          },
        },
      }),
    });
  }

  async getTask(taskId: number): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/tasks/${taskId}`);
  }

  async getInsights(appId: number): Promise<KonveyorInsight[]> {
    return this.request<KonveyorInsight[]>(
      `/applications/${appId}/analysis/insights`,
    );
  }

  async getIncidents(insightId: number): Promise<KonveyorIncident[]> {
    return this.request<KonveyorIncident[]>(
      `/analyses/insights/${insightId}/incidents`,
    );
  }
}
