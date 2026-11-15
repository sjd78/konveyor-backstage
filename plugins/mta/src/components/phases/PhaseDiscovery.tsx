import { Text } from '@backstage/ui';
import type { KonveyorApplication, KonveyorTask } from '../../api/types';
import { DetailList, DetailRow, Section, TaskProgress } from '../shared/MtaUi';
import styles from './PhaseProgress.module.css';

export function PhaseDiscovery({
  app,
  task,
}: {
  app: KonveyorApplication;
  task: KonveyorTask | null;
}) {
  const repository = app.repository;
  const ref = repository?.branch || repository?.tag;
  return (
    <Section
      title="Repository discovery"
      description={`Task ${task?.id ?? ''} · ${task?.state ?? 'Loading'}`}
    >
      <TaskProgress
        label={
          task?.activity?.[task.activity.length - 1] ||
          'Waiting for Hub discovery results.'
        }
      />
      <DetailList>
        <DetailRow label="Repository">
          <Text as="span" className={styles.mono}>
            {repository?.url || 'Not configured in Hub'}
          </Text>
        </DetailRow>
        {ref && (
          <DetailRow label="Ref">
            <Text as="span">{ref}</Text>
          </DetailRow>
        )}
        {repository?.path && (
          <DetailRow label="Path">
            <Text as="span" className={styles.mono}>
              {repository.path}
            </Text>
          </DetailRow>
        )}
      </DetailList>
      <Text as="p" color="secondary">
        You can leave this page. Discovery status is restored from Hub tasks
        when you return.
      </Text>
    </Section>
  );
}
