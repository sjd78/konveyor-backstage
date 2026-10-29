import { createApiRef, DiscoveryApi } from '@backstage/core-plugin-api';
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

export const mtaApiRef = createApiRef<MtaApi>({
  id: 'plugin.mta.api',
});

export interface MtaApi {
  getApplications(): Promise<KonveyorApplication[]>;
  getApplication(id: number): Promise<KonveyorApplication>;
  createApplication(
    app: Partial<KonveyorApplication>,
  ): Promise<KonveyorApplication>;
  getArchetypes(): Promise<KonveyorArchetype[]>;
  getApplicationTasks(appId: number): Promise<KonveyorTask[]>;
  getAnalysis(appId: number): Promise<KonveyorAnalysis | null>;
  getAnalysisProfiles(appId: number): Promise<KonveyorAnalysisProfile[]>;
  getTargets(): Promise<KonveyorTarget[]>;
  triggerDiscovery(appId: number): Promise<KonveyorTask>;
  triggerAnalysis(appId: number, profileId: number): Promise<KonveyorTask>;
  getTask(taskId: number): Promise<KonveyorTask>;
  getIssues(appId: number): Promise<KonveyorInsight[]>;
  getIncidents(insightId: number): Promise<KonveyorIncident[]>;
}

export class MtaApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    path: string,
    statusText: string,
  ) {
    super(
      `MTA API request failed [${status} ${statusText}] at ${path}: ${body}`,
    );
    this.name = 'MtaApiError';
  }
}

export class MtaApiClient implements MtaApi {
  constructor(private readonly discoveryApi: DiscoveryApi) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const baseUrl = await this.discoveryApi.getBaseUrl('mta-backend');
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new MtaApiError(res.status, errorText, path, res.statusText);
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

  async getApplicationTasks(appId: number): Promise<KonveyorTask[]> {
    return this.request<KonveyorTask[]>(`/applications/${appId}/tasks`);
  }

  async getAnalysis(appId: number): Promise<KonveyorAnalysis | null> {
    return this.request<KonveyorAnalysis | null>(
      `/applications/${appId}/analysis`,
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

  async triggerDiscovery(appId: number): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/applications/${appId}/discover`, {
      method: 'POST',
    });
  }

  async triggerAnalysis(
    appId: number,
    profileId: number,
  ): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/applications/${appId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ profileId }),
    });
  }

  async getTask(taskId: number): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/tasks/${taskId}`);
  }

  async getIssues(appId: number): Promise<KonveyorInsight[]> {
    return this.request<KonveyorInsight[]>(`/applications/${appId}/issues`);
  }

  async getIncidents(insightId: number): Promise<KonveyorIncident[]> {
    return this.request<KonveyorIncident[]>(`/insights/${insightId}/incidents`);
  }
}
