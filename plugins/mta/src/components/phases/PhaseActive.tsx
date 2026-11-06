import { Button, Text } from '@backstage/ui';
import { RiRefreshLine } from '@remixicon/react';
import { EmptyState } from '../shared/MtaUi';
import { FindingsTable } from './FindingsTable';
import type { KonveyorApplication } from '../../api/types';
import type { MigrationIssue, Persona } from '../../types';
import styles from './PhaseActive.module.css';

export interface PhaseActiveProps {
  app: KonveyorApplication;
  issues: MigrationIssue[];
  persona: Persona | 'unknown';
  onRunAnalysis?: () => void;
}

export function PhaseActive({
  app,
  issues,
  persona,
  onRunAnalysis,
}: PhaseActiveProps) {
  return (
    <div className={styles.stack}>
      <div className={styles.header}>
        <Text as="h2" variant="title-small" className={styles.title}>
          Analysis findings for {app.name}
        </Text>
        {/*
         * The actions keep their own container so a later change can add an
         * action next to "Run analysis" without touching the findings table.
         */}
        <div className={styles.actions}>
          {persona === 'architect' && onRunAnalysis && (
            <Button
              variant="secondary"
              iconStart={<RiRefreshLine />}
              onPress={onRunAnalysis}
            >
              Run analysis
            </Button>
          )}
        </div>
      </div>
      {issues.length === 0 ? (
        <EmptyState
          title="No findings reported"
          description="The latest Hub analysis reported no findings. This does not mark the migration complete."
        />
      ) : (
        <FindingsTable issues={issues} />
      )}
    </div>
  );
}
