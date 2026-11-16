import { Button, ButtonLink, Text } from '@backstage/ui';
import { RiExternalLinkLine, RiRefreshLine } from '@remixicon/react';
import { EmptyState } from '../shared/MtaUi';
import { FindingsTable } from './FindingsTable';
import { useMtaConfig } from '../../config/useMtaConfig';
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
  const config = useMtaConfig();
  return (
    <div className={styles.stack}>
      <div className={styles.header}>
        <Text as="h2" variant="title-small" className={styles.title}>
          Analysis findings for {app.name}
        </Text>
        {/*
         * The actions keep their own container so the Dev Spaces link can sit
         * beside "Run analysis" without touching the findings table.
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
          {/*
           * Every persona can open the configured dashboard. The link only
           * exists when a deployment sets mta.devSpaces.url.
           */}
          {config.devSpacesUrl && (
            <ButtonLink
              variant="secondary"
              iconStart={<RiExternalLinkLine />}
              href={config.devSpacesUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Dev Spaces
            </ButtonLink>
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
