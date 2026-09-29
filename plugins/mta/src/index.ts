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
export {
  mtaPlugin,
  mtaPlugin as default,
} from './alpha';
export { mtaApiRef, MtaApiClient } from './api';
export type { MtaApi } from './api';
export {
  useKonveyorMigration,
} from './hooks/useKonveyorMigration';
export type {
  UseKonveyorMigrationResult,
  UseKonveyorMigrationOptions,
} from './hooks/useKonveyorMigration';
export {
  useKonveyorApplications,
  useKonveyorApplication,
  useKonveyorArchetypes,
  useKonveyorIssues,
} from './hooks/useKonveyorData';
export { useMtaAnalysis } from './hooks/useMtaAnalysis';
export type { UseMtaAnalysisResult } from './hooks/useMtaAnalysis';
export { useKonveyorActions } from './hooks/useKonveyorActions';
export type { UseKonveyorActionsResult } from './hooks/useKonveyorActions';
export { useMtaHomeData } from './hooks/useMtaHomeData';
export type { MtaAppInfo } from './hooks/useMtaHomeData';
export type {
  MtaApplication,
  Archetype,
  TargetProfile,
  MigrationIssue,
  ActionHistoryEntry,
  MigrationStatus,
  IssueSeverity,
  IssueCategory,
  ActionType,
  ActionStatus,
} from './types';
export { MigrationTab } from './components/MigrationTab';
export { MigrationStatusChip } from './components/MigrationStatusChip';
export { MigrationTabPage } from './components/MigrationTabPage';
export { MtaHomeSection } from './components/MtaHomeCards';
export { MtaPersonaCard } from './components/MtaPersonaCard';
export { usePersonaRole } from './hooks/usePersonaRole';
export type { PersonaRole, PersonaRoleState } from './hooks/usePersonaRole';
