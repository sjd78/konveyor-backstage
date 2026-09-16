/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export type MigrationStatus =
  | 'Not Started'
  | 'Discovery'
  | 'Path Selection'
  | 'Analysis'
  | 'Active'
  | 'Post-remediation'
  | 'Completed'
  | 'Failed';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'info';

export type IssueCategory =
  | 'api-change'
  | 'dependency'
  | 'configuration'
  | 'code-pattern'
  | 'deployment';

export type ActionType =
  | 'generate-deployment-assets'
  | 'trigger-ai-remediator'
  | 'run-analysis'
  | 'launch-workspace'
  | 'view-issues'
  | 'apply-quick-fixes';

export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Persona = 'architect' | 'developer';

export type DeliveryMethod = 'commit-branch' | 'create-pr' | 'download';

export interface Archetype {
  id: string;
  name: string;
  description: string;
  criteriaTags: string[];
  icon: string;
}

export interface TargetProfile {
  id: string;
  name: string;
  description: string;
  platform: string;
  analysisProfileName: string;
  analysisTargets: string[];
  generatorName?: string;
}

export interface MtaApplication {
  id: string;
  name: string;
  repoUrl: string;
  discoveredTags: string[];
  archetypeId: string;
  targetProfileId: string;
  status: MigrationStatus;
  issuesCount: number;
  criticalIssues: number;
  storyPoints: number;
  filesAffected: number;
  totalIssuesDiscovered: number;
  entityRef?: string;
  devSpacesAvailable?: boolean;
  devSpacesActive?: boolean;
  devSpacesUser?: string;
  devSpacesStartedAt?: string;
}

export interface MigrationIssue {
  id: string;
  appId: string;
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  file: string;
  line: number;
  aiFixAvailable: boolean;
  problem?: string;
  impact?: string;
  fixGuidance?: string;
  resolved?: boolean;
}

export interface DeploymentAsset {
  name: string;
  path: string;
  type: 'container' | 'ci-cd' | 'kubernetes' | 'openshift';
}

export interface DevSpacesConfig {
  namespace: string;
  memory: string;
  storage: string;
  idleTimeout: string;
  extensions: string[];
  features: string[];
}

export interface ActionHistoryEntry {
  id: string;
  appId: string;
  action: ActionType;
  timestamp: string;
  status: ActionStatus;
  triggeredBy: 'architect' | 'developer';
}

export interface SupportContact {
  name: string;
  email: string;
}
