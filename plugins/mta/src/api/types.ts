export interface KonveyorApplication {
  id: number;
  name: string;
  description?: string;
  createTime?: string;
  repository?: {
    kind?: string;
    url: string;
    branch?: string;
    tag?: string;
    path?: string;
  } | null;
  binary?: string;
  tags?: Array<{
    id: number;
    name: string;
    source?: string;
    category?: { id: number; name: string };
  }> | null;
  identities?: Array<{ id: number; name: string }> | null;
  archetypes?: Array<{ id: number; name: string }> | null;
  businessService?: { id: number; name: string } | null;
  migrationWave?: { id: number; name: string } | null;
  comments?: string;
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

export interface KonveyorAnalysisProfile {
  id: number;
  name: string;
  description?: string;
  mode: { withDeps: boolean };
  scope: {
    withKnownLibs: boolean;
    packages?: { included?: string[]; excluded?: string[] };
  };
  rules: {
    targets?: Array<{ id: number; name?: string; selection?: string }>;
    labels?: { included?: string[]; excluded?: string[] };
    repository?: KonveyorApplication['repository'];
    identity?: { id: number; name?: string };
    files?: Array<{ id: number; name?: string }>;
  };
}

export interface KonveyorTarget {
  id: number;
  name: string;
  description?: string;
  provider?: string;
  choice?: boolean;
  custom?: boolean;
  labels: Array<{ name: string; label: string }>;
  image?: { id: number; name?: string };
  ruleset?: { id: number; name?: string };
}

export interface KonveyorTask {
  id: number;
  name?: string;
  kind?: string;
  addon?: string;
  extensions?: string[];
  state:
    | 'Created'
    | 'Ready'
    | 'Postponed'
    | 'QuotaBlocked'
    | 'Pending'
    | 'Running'
    | 'Succeeded'
    | 'Failed'
    | 'Canceled';
  application?: { id: number; name?: string };
  locator?: string;
  createTime?: string;
  started?: string;
  terminated?: string;
  errors?: Array<{ severity: string; description: string }>;
  events?: Array<{
    kind: string;
    count: number;
    reason?: string;
    last: string;
  }>;
  activity?: string[];
  data?: {
    profile?: { id: number; name?: string };
    source?: string;
    targets?: string[];
    sources?: string[];
    mode?: {
      binary?: boolean;
      withDeps?: boolean;
      discovery?: boolean;
    };
    [key: string]: unknown;
  };
}

export interface KonveyorAnalysis {
  id: number;
  application: { id: number; name?: string };
  effort: number;
  createTime?: string;
  commit?: string;
  archived?: boolean;
  insights?: KonveyorInsight[];
  dependencies?: KonveyorDependency[];
}

export interface KonveyorInsight {
  id: number;
  analysis?: number;
  ruleset: string;
  rule: string;
  name: string;
  description?: string;
  category?: string;
  effort?: number;
  incidents?: KonveyorIncident[];
  links?: Array<{ title?: string; url: string }>;
  labels?: string[];
}

export interface KonveyorIncident {
  id: number;
  insight?: number;
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
