export interface KonveyorApplication {
  id: number;
  name: string;
  description?: string;
  repository?: {
    kind?: string;
    url: string;
    branch?: string;
    path?: string;
  };
  tags?: Array<{
    id: number;
    name: string;
    category?: { id: number; name: string };
  }>;
  identities?: Array<{ id: number; name: string }>;
  archetypes?: Array<{ id: number; name: string }>;
  businessService?: { id: number; name: string };
  migrationWave?: { id: number; name: string };
  comments?: string;
  tasks?: number[];
}

export interface KonveyorArchetype {
  id: number;
  name: string;
  description?: string;
  criteria?: Array<{ id: number; name: string }>;
  tags?: Array<{ id: number; name: string }>;
  profiles?: Array<{
    id: number;
    name: string;
    generators?: Array<{ id: number; name: string }>;
    analysisProfile?: { id: number; name: string };
  }>;
}

export interface KonveyorTask {
  id: number;
  name?: string;
  addon: string;
  state: 'Created' | 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Canceled';
  application?: { id: number; name?: string };
  locator?: string;
  started?: string;
  terminated?: string;
  errors?: string[];
  activity?: string[];
  data?: {
    targets?: string[];
    sources?: string[];
    mode?: {
      binary?: boolean;
      withDeps?: boolean;
    };
    [key: string]: unknown;
  };
}

export interface KonveyorInsight {
  id: number;
  ruleset: string;
  rule: string;
  name: string;
  description: string;
  category: string;
  effort: number;
  incidents?: Array<{ id: number }>;
  links?: Array<{ title: string; url: string }>;
  labels?: string[];
}

export interface KonveyorIncident {
  id: number;
  insight?: number | { id: number };
  file: string;
  line: number;
  message: string;
  codeSnip?: string;
  facts?: Record<string, unknown>;
}

export interface KonveyorDependency {
  name: string;
  version: string;
  provider: string;
  indirect?: boolean;
  labels?: string[];
  sha?: string;
}

export interface TriggerAnalysisOptions {
  targets: string[];
  sources?: string[];
}
