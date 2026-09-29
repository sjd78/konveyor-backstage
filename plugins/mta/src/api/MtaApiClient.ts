import { createApiRef, DiscoveryApi } from '@backstage/core-plugin-api';
import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
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
  triggerAnalysis(appId: number, targets: string[]): Promise<KonveyorTask>;
  getTask(taskId: number): Promise<KonveyorTask>;
  getIssues(appId: number): Promise<KonveyorInsight[]>;
  getIncidents(insightId: number): Promise<KonveyorIncident[]>;
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
      throw new Error(
        `MTA API request failed [${res.status} ${res.statusText}] at ${path}: ${errorText}`,
      );
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

  async triggerAnalysis(
    appId: number,
    targets: string[],
  ): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/applications/${appId}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ targets }),
    });
  }

  async getTask(taskId: number): Promise<KonveyorTask> {
    return this.request<KonveyorTask>(`/tasks/${taskId}`);
  }

  async getIssues(appId: number): Promise<KonveyorInsight[]> {
    return this.request<KonveyorInsight[]>(`/applications/${appId}/issues`);
  }

  async getIncidents(insightId: number): Promise<KonveyorIncident[]> {
    return this.request<KonveyorIncident[]>(
      `/insights/${insightId}/incidents`,
    );
  }
}
