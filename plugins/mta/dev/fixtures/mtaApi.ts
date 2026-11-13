import type {
  KonveyorAnalysis,
  KonveyorAnalysisProfile,
  KonveyorApplication,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
  MtaApi,
} from '../../src/api';

/** One Hub application and everything the plugin reads for it. */
export interface MtaAppFixture {
  application: KonveyorApplication;
  tasks?: KonveyorTask[];
  profiles?: KonveyorAnalysisProfile[];
  analysis?: KonveyorAnalysis | null;
  insights?: KonveyorInsight[];
  incidents?: Record<number, KonveyorIncident[]>;
  /** Rejects `getApplicationTasks` for this application, as a Hub proxy error does. */
  tasksError?: Error;
  /** Rejects `getIssues` for this application, as a Hub proxy error does. */
  issuesError?: Error;
}

export interface MtaApiFixtureOptions {
  apps: MtaAppFixture[];
  /** Resolves `getApplication` only when the Hub responds again. */
  pendingApplication?: boolean;
  /** Rejects `getApplication` for every ID, as a Hub proxy error does. */
  applicationError?: Error;
  /** Rejects `triggerDiscovery`, as a Hub proxy error does. */
  discoveryError?: Error;
  /** Rejects `triggerAnalysis`, as a Hub proxy error does. */
  analysisError?: Error;
  /** Task returned by `triggerDiscovery` and `triggerAnalysis`. */
  submittedTask?: KonveyorTask;
}

const NOT_FOUND_APPLICATION: KonveyorApplication = {
  id: 0,
  name: 'Application not found',
};

function createSubmittedTask(): KonveyorTask {
  return {
    id: 900,
    name: 'application-1-language-discovery',
    kind: 'language-discovery',
    addon: 'language-discovery',
    state: 'Pending',
    application: { id: 1, name: 'Backstage Phase 2 Spring' },
    data: { source: 'language-discovery' },
  };
}

/**
 * A Hub API answered from an in-memory fixture. Every method resolves or
 * rejects straight away unless the fixture is configured to hang or fail, so
 * the real hooks and components drive the gallery state.
 */
export function createMtaApi(options: MtaApiFixtureOptions): MtaApi {
  const findApp = (appId: number) =>
    options.apps.find(app => app.application.id === appId);
  const allTasks = options.apps.flatMap(app => app.tasks ?? []);

  return {
    async getApplications() {
      return options.apps.map(app => app.application);
    },
    async getApplication(appId) {
      if (options.pendingApplication) {
        return new Promise<KonveyorApplication>(() => {});
      }
      if (options.applicationError) {
        throw options.applicationError;
      }
      return findApp(appId)?.application ?? NOT_FOUND_APPLICATION;
    },
    async createApplication(app) {
      return { id: 0, name: 'Created application', ...app };
    },
    async getArchetypes() {
      return [];
    },
    async getApplicationTasks(appId) {
      const app = findApp(appId);
      if (app?.tasksError) {
        throw app.tasksError;
      }
      return app?.tasks ?? [];
    },
    async getAnalysis(appId) {
      return findApp(appId)?.analysis ?? null;
    },
    async getAnalysisProfiles(appId) {
      return findApp(appId)?.profiles ?? [];
    },
    async getTargets() {
      return [];
    },
    async triggerDiscovery() {
      if (options.discoveryError) {
        throw options.discoveryError;
      }
      return options.submittedTask ?? createSubmittedTask();
    },
    async triggerAnalysis() {
      if (options.analysisError) {
        throw options.analysisError;
      }
      return (
        options.submittedTask ?? {
          ...createSubmittedTask(),
          id: 901,
          name: 'application-1-analyzer',
          kind: 'analyzer',
          addon: 'analyzer',
          state: 'Running',
          data: { profile: { id: 1 } },
        }
      );
    },
    async getTask(taskId) {
      const task = allTasks.find(candidate => candidate.id === taskId);
      if (!task) {
        throw new Error(`Hub task ${taskId} was not found.`);
      }
      return task;
    },
    async getIssues(appId) {
      const app = findApp(appId);
      if (app?.issuesError) {
        throw app.issuesError;
      }
      return app?.insights ?? [];
    },
    async getIncidents(insightId) {
      const owner = options.apps.find(app =>
        app.insights?.some(insight => insight.id === insightId),
      );
      return owner?.incidents?.[insightId] ?? [];
    },
  };
}
