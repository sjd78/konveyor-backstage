import { Alert, Button, Flex, Text } from '@backstage/ui';
import type { KonveyorTask } from '../../api/types';
import { DetailList, DetailRow, Section } from '../shared/MtaUi';
import styles from './PhaseFailed.module.css';

export interface PhaseFailedProps {
  task: KonveyorTask | null;
  error?: Error | null;
  canRetry?: boolean;
  isExecuting?: boolean;
  onRetry: () => void;
  onSelectProfile?: () => void;
}

export function PhaseFailed({
  task,
  error,
  canRetry = true,
  isExecuting = false,
  onRetry,
  onSelectProfile,
}: PhaseFailedProps) {
  const details =
    task?.errors?.map(item => item.description).filter(Boolean) ?? [];
  return (
    <Flex direction="column" gap="4">
      <Alert
        status="danger"
        icon
        title={`Hub task ${task?.state === 'Canceled' ? 'canceled' : 'failed'}`}
        description={
          <Text as="p" className={styles.message}>
            {error?.message ||
              details.join('\n') ||
              'Hub did not provide failure details. Check the task in Hub, correct its configuration, then retry.'}
          </Text>
        }
      />
      <Section title="Task details">
        <DetailList>
          <DetailRow label="Task ID">{task?.id ?? 'Unavailable'}</DetailRow>
          <DetailRow label="Addon">{task?.addon ?? 'Unavailable'}</DetailRow>
          <DetailRow label="Status">{task?.state ?? 'Unavailable'}</DetailRow>
        </DetailList>
      </Section>
      <Flex align="center" gap="3" className={styles.actions}>
        {canRetry && (
          <Button variant="primary" isDisabled={isExecuting} onPress={onRetry}>
            Retry task
          </Button>
        )}
        {onSelectProfile && (
          <Button
            variant="tertiary"
            isDisabled={isExecuting}
            onPress={onSelectProfile}
          >
            Select analysis profile
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
