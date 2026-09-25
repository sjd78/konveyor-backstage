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
import {
  StatusOK,
  StatusError,
  StatusPending,
} from '@backstage/core-components';
import type { MigrationStatus } from '../types';

export function MigrationStatusChip({ status }: { status: MigrationStatus }) {
  switch (status) {
    case 'Completed':
      return <StatusOK>{status}</StatusOK>;
    case 'Failed':
      return <StatusError>{status}</StatusError>;
    case 'Active':
    case 'Post-remediation':
      return <StatusOK>{status}</StatusOK>;
    case 'Discovery':
    case 'Path Selection':
    case 'Analysis':
      return <StatusPending>{status}</StatusPending>;
    case 'Not Started':
    default:
      return <StatusPending>{status}</StatusPending>;
  }
}
