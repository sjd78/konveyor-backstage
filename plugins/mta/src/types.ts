export type MigrationStatus =
  | 'Not Started'
  | 'Discovery'
  | 'Path Selection'
  | 'Analysis'
  | 'Analysis Unavailable'
  | 'Active'
  | 'Failed';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'info';

export type IssueCategory =
  | 'api-change'
  | 'dependency'
  | 'configuration'
  | 'code-pattern'
  | 'deployment';

export type Persona = 'architect' | 'developer';

export interface MigrationIssue {
  id: string;
  appId: string;
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  file?: string;
  line?: number;
  problem?: string;
  message?: string;
  codeSnip?: string;
  links?: Array<{ title: string; url: string }>;
  effort?: number;
}
