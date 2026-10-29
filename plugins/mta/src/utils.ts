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
import type { IssueSeverity } from './types';

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

export const MTA_REGISTER_TEMPLATE_PATH =
  '/create/templates/default/mta-register-application';
