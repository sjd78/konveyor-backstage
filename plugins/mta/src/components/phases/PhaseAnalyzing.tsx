import { Text } from '@backstage/ui';
import type { KonveyorApplication, KonveyorTask } from '../../api/types';
import { DetailList, DetailRow, Section, TaskProgress } from '../shared/MtaUi';
import styles from './PhaseProgress.module.css';

export interface PhaseAnalyzingProps {
  task: KonveyorTask | null;
  app: KonveyorApplication;
  profileName?: string;
}

export function PhaseAnalyzing({
  task,
  app,
  profileName,
}: PhaseAnalyzingProps) {
  const ref = app.repository?.branch || app.repository?.tag;
  return (
    <Section
      title="Analysis task"
      description={`Task ${task?.id ?? ''} · ${task?.state ?? 'Loading'}`}
    >
      <TaskProgress
        label={
          task?.activity?.[task.activity.length - 1] ||
          'Waiting for Hub analysis results.'
        }
      />
      <DetailList>
        {profileName && (
          <DetailRow label="Analysis profile">
            <Text as="span">{profileName}</Text>
          </DetailRow>
        )}
        <DetailRow label="Repository">
          <Text as="span" className={styles.mono}>
            {app.repository?.url || 'Not configured in Hub'}
          </Text>
        </DetailRow>
        {ref && (
          <DetailRow label="Ref">
            <Text as="span">{ref}</Text>
          </DetailRow>
        )}
        {app.repository?.path && (
          <DetailRow label="Path">
            <Text as="span" className={styles.mono}>
              {app.repository.path}
            </Text>
          </DetailRow>
        )}
      </DetailList>
      <Text as="p" color="secondary">
        You can leave this page. Task status and findings are loaded from Hub
        when you return.
      </Text>
    </Section>
  );
}
