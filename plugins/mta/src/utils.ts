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
import type { Palette } from '@material-ui/core/styles/createPalette';
import type { ActionType, IssueSeverity } from './types';

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

export const DISCOVERY_DELAY_MS = 3000;
export const ACTION_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Shared label / color maps
// ---------------------------------------------------------------------------

export const ACTION_LABELS: Record<ActionType, string> = {
  'run-analysis': 'Run analysis',
  'trigger-ai-remediator': 'Fix with AI',
  'apply-quick-fixes': 'Apply quick fixes',
  'generate-deployment-assets': 'Generate deployment assets',
  'launch-workspace': 'Open in Dev Spaces',
  'view-issues': 'View issues',
};

export function severityColor(
  severity: IssueSeverity,
  palette: Palette,
): string {
  return (
    {
      critical: palette.error.main,
      major: palette.warning.main,
      minor: palette.warning.light,
      info: palette.info.main,
    } as Record<IssueSeverity, string>
  )[severity];
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Home card – developer phase configuration
// ---------------------------------------------------------------------------

export const MTA_REGISTER_TEMPLATE_PATH =
  '/create/templates/default/mta-register-application';

export type PhaseIconKey = 'hourglass' | 'search' | 'swap' | 'autorenew' | 'warning';
export type PhaseTone = 'neutral' | 'active' | 'warning';

export interface DeveloperPhaseInfo {
  icon: PhaseIconKey;
  tone: PhaseTone;
  title: string;
  description: string;
}

export const DEVELOPER_PHASE_CONFIG: Record<string, DeveloperPhaseInfo> = {
  'Not Started': {
    icon: 'hourglass',
    tone: 'neutral',
    title: 'Migration not started',
    description:
      'Your application hasn’t been registered for migration yet. Contact your application architect to get started.',
  },
  Discovery: {
    icon: 'search',
    tone: 'active',
    title: 'Discovery in progress',
    description:
      'Your application architect is scanning your application’s codebase to identify technologies and dependencies.',
  },
  'Path Selection': {
    icon: 'swap',
    tone: 'active',
    title: 'Path selection in progress',
    description:
      'Your application architect is selecting a migration path for this application.',
  },
  Analysis: {
    icon: 'autorenew',
    tone: 'active',
    title: 'Analysis in progress',
    description:
      'MTA is analyzing your application against the selected migration path. This may take a few minutes.',
  },
  Failed: {
    icon: 'warning',
    tone: 'warning',
    title: 'Migration failed',
    description:
      'Something went wrong during migration. Contact your application architect for next steps.',
  },
  Completed: {
    icon: 'hourglass',
    tone: 'neutral',
    title: 'Migration complete',
    description:
      'This application has been successfully migrated. No further action is needed.',
  },
};

export const DEFAULT_DEVELOPER_PHASE: DeveloperPhaseInfo =
  DEVELOPER_PHASE_CONFIG['Not Started'];

