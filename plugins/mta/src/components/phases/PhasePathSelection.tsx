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
import { useState } from 'react';
import { Button, Flex, Radio, RadioGroup, Text } from '@backstage/ui';
import { DetailList, DetailRow, Section } from '../shared/MtaUi';
import type {
  KonveyorAnalysisProfile,
  KonveyorApplication,
} from '../../api/types';
import styles from './PhasePathSelection.module.css';

export interface PhasePathSelectionProps {
  app: KonveyorApplication;
  profiles: KonveyorAnalysisProfile[];
  isExecuting?: boolean;
  onStartAnalysis: (profileId: number) => void;
  onStartDiscovery: () => void;
  onRefresh: () => void;
  onCancel?: () => void;
}

export function PhasePathSelection({
  app,
  profiles,
  isExecuting = false,
  onStartAnalysis,
  onStartDiscovery,
  onRefresh,
  onCancel,
}: PhasePathSelectionProps) {
  const [selectedId, setSelectedId] = useState('');
  const selectedProfile = profiles.find(
    profile => String(profile.id) === selectedId,
  );
  const tags = app.tags ?? [];

  return (
    <Section title="Select an analysis profile">
      <DetailList>
        <DetailRow label="Repository">
          <Text>{app.repository?.url || 'Not configured in Hub'}</Text>
        </DetailRow>
        {(app.repository?.branch || app.repository?.tag) && (
          <DetailRow label="Ref">
            <Text>{app.repository.branch || app.repository.tag}</Text>
          </DetailRow>
        )}
        {app.repository?.path && (
          <DetailRow label="Path">
            <Text>{app.repository.path}</Text>
          </DetailRow>
        )}
      </DetailList>
      {tags.length > 0 && (
        <ul className={styles.tagList} aria-label="Tags">
          {tags.map(tag => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      )}
      {profiles.length === 0 ? (
        <Text as="p">
          No effective analysis profiles are available. In Hub, match this
          application's tags to an archetype with an analysis profile, then
          refresh.
        </Text>
      ) : (
        <RadioGroup
          aria-label="Analysis profile"
          value={selectedId || null}
          onChange={setSelectedId}
        >
          {profiles.map(profile => (
            <Radio
              key={profile.id}
              value={String(profile.id)}
              isDisabled={isExecuting}
              className={styles.pathOption}
            >
              <Flex direction="column" gap="1">
                <Text variant="body-large" weight="bold">
                  {profile.name}
                </Text>
                {profile.description && (
                  <Text color="secondary">{profile.description}</Text>
                )}
                <Text variant="body-small" color="secondary">
                  Profile ID: {profile.id}
                  {(profile.rules.targets?.length ?? 0) > 0 &&
                    ` · Targets: ${profile.rules.targets
                      ?.map(target => target.name || target.id)
                      .join(', ')}`}
                </Text>
              </Flex>
            </Radio>
          ))}
        </RadioGroup>
      )}
      <Flex gap="2">
        <Button
          variant="primary"
          isDisabled={!selectedProfile || isExecuting}
          onPress={() => {
            if (selectedProfile) onStartAnalysis(selectedProfile.id);
          }}
        >
          Start analysis
        </Button>
        <Button
          variant="tertiary"
          isDisabled={isExecuting || !app.repository?.url}
          onPress={onStartDiscovery}
        >
          Run discovery
        </Button>
        <Button variant="tertiary" isDisabled={isExecuting} onPress={onRefresh}>
          Refresh profiles
        </Button>
        {onCancel && (
          <Button
            variant="tertiary"
            isDisabled={isExecuting}
            onPress={onCancel}
          >
            Cancel
          </Button>
        )}
      </Flex>
    </Section>
  );
}
