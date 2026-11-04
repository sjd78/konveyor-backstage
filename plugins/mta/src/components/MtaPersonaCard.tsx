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
import { ButtonLink, Card, CardBody, CardHeader, Text } from '@backstage/ui';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { StatusTag, type StatusTone } from './shared/MtaUi';
import styles from './MtaPersonaCard.module.css';

const ROLE_LABELS: Record<string, string> = {
  architect: 'Architect',
  developer: 'Developer',
};

/*
 * BUI has no secondary accent tone, so the developer persona keeps the neutral
 * tag instead of borrowing a status color that would imply a result.
 */
const ROLE_TONES: Record<string, StatusTone> = {
  architect: 'info',
  developer: 'neutral',
};

const ROLE_GROUPS: Record<string, string> = {
  architect: 'group:default/mta-architects',
  developer: 'group:default/mta-developers',
};

export function MtaPersonaCard() {
  const { role, loading } = usePersonaRole();

  const isArchitect = role === 'architect';
  const isDeveloper = role === 'developer';
  const roleLabel = ROLE_LABELS[role] ?? 'Unassigned';
  const roleTone = ROLE_TONES[role] ?? 'neutral';
  const groupLabel = ROLE_GROUPS[role] ?? 'No group';

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <Text as="h2" variant="title-x-small" weight="bold">
          MTA Persona
        </Text>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <div className={styles.content}>
          <div className={styles.personaRow}>
            <div className={styles.personaName}>
              <Text as="span" weight="bold">
                Active Persona:
              </Text>
              {loading ? (
                <StatusTag>Loading...</StatusTag>
              ) : (
                <StatusTag tone={roleTone}>{roleLabel}</StatusTag>
              )}
            </div>
            <Text as="span" variant="body-small" color="secondary">
              {groupLabel}
            </Text>
          </div>

          <div className={styles.divider} />

          <Text as="p" color="secondary">
            {isArchitect &&
              'As an MTA Architect, you have full access to discover applications, define target profiles, run repository analysis, and select migration paths for the team.'}
            {isDeveloper &&
              'As an MTA Developer, you have focused access to assigned applications, code-level migration issues, AI-assisted remediation, and DevSpaces cloud environments.'}
            {!isArchitect &&
              !isDeveloper &&
              'This user is not currently mapped to an MTA persona group. Switch user using the log out button in the navigation bar to test Architect or Developer perspectives.'}
          </Text>

          <div className={styles.links}>
            <ButtonLink href="/mta" variant="secondary" size="small">
              Migration Dashboard
            </ButtonLink>
            <ButtonLink
              href="/catalog?filters%5Bkind%5D=component"
              variant="secondary"
              size="small"
            >
              Software Catalog
            </ButtonLink>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
