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
import { StatusTag, type StatusTone } from './shared/MtaUi';
import type { MigrationStatus } from '../types';

const STATUS_TONE: Record<MigrationStatus, StatusTone> = {
  'Not Started': 'neutral',
  Discovery: 'info',
  'Path Selection': 'info',
  Analysis: 'info',
  'Analysis Unavailable': 'danger',
  Active: 'success',
  Failed: 'danger',
};

export function MigrationStatusChip({ status }: { status: MigrationStatus }) {
  return <StatusTag tone={STATUS_TONE[status]}>{status}</StatusTag>;
}
