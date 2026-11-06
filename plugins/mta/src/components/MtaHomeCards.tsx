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
import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Link,
  Skeleton,
  Text,
} from '@backstage/ui';
import {
  RiAlertLine,
  RiArrowRightLine,
  RiCloseCircleLine,
  RiInformationLine,
  RiRefreshLine,
  RiRouteLine,
  RiSearchLine,
  RiTimeLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useMtaHomeData } from '../hooks/useMtaHomeData';
import type { MtaAppInfo } from '../hooks/useMtaHomeData';
import { MTA_REGISTER_TEMPLATE_PATH } from '../utils';
import { EmptyState, StatusTag, type StatusTone } from './shared/MtaUi';
import styles from './MtaHomeCards.module.css';

/** The home card only uses the four tones the reference shows as icon colors. */
type StatusToneName = Exclude<StatusTone, 'success' | 'warning-emphasis'>;

interface ApplicationStatusInfo {
  label: string;
  icon: RemixiconComponentType;
  tone: StatusToneName;
}

const TONE_CLASS: Record<StatusToneName, string> = {
  neutral: styles.statusNeutral,
  info: styles.statusInfo,
  warning: styles.statusWarning,
  danger: styles.statusDanger,
};

function applicationStatus(app: MtaAppInfo): ApplicationStatusInfo {
  if (app.connection === 'disconnected') {
    return {
      label: 'Not connected to Hub',
      icon: RiAlertLine,
      tone: 'warning',
    };
  }
  if (app.connection === 'missing') {
    return {
      label: 'Linked Hub application is missing or unavailable',
      icon: RiCloseCircleLine,
      tone: 'danger',
    };
  }
  if (app.error) {
    return {
      label: app.error.message,
      icon: RiCloseCircleLine,
      tone: 'danger',
    };
  }
  switch (app.status) {
    case 'Discovery':
      return {
        label: 'Discovery in progress',
        icon: RiSearchLine,
        tone: 'info',
      };
    case 'Path Selection':
      return {
        label: 'Path selection needed',
        icon: RiRouteLine,
        tone: 'warning',
      };
    case 'Analysis':
      return {
        label: 'Analysis in progress',
        icon: RiRefreshLine,
        tone: 'info',
      };
    case 'Analysis Unavailable':
      return {
        label: 'Analysis results unavailable — refresh or run analysis',
        icon: RiAlertLine,
        tone: 'warning',
      };
    case 'Active':
      return app.issuesCount === 0
        ? {
            label: 'No findings reported',
            icon: RiInformationLine,
            tone: 'neutral',
          }
        : {
            label: 'Analysis findings',
            icon: RiAlertLine,
            tone: 'warning',
          };
    case 'Failed':
      return {
        label: 'Task failed — view details',
        icon: RiCloseCircleLine,
        tone: 'danger',
      };
    default:
      return { label: 'Not started', icon: RiTimeLine, tone: 'neutral' };
  }
}

function ApplicationStatus({ app }: { app: MtaAppInfo }) {
  const { label, icon: Icon, tone } = applicationStatus(app);
  return (
    <span className={styles.status}>
      <Icon
        size={16}
        aria-hidden
        className={`${styles.statusIcon} ${TONE_CLASS[tone]}`}
      />
      <Text as="span" variant="body-medium" color="secondary">
        {label}
      </Text>
    </span>
  );
}

function AppRow({ app }: { app: MtaAppInfo }) {
  return (
    <li>
      <Link
        className={styles.appLink}
        href={`/catalog/${app.namespace}/component/${app.name}/migration`}
        aria-label={`Open ${app.name} migration tab`}
      >
        <span className={styles.appText}>
          <Text
            as="span"
            variant="body-medium"
            weight="bold"
            className={styles.appName}
          >
            {app.title ?? app.name}
          </Text>
          <ApplicationStatus app={app} />
          {!app.error && app.issuesCount !== undefined && (
            <span className={styles.appCounts}>
              {(app.criticalIssues ?? 0) > 0 && (
                <StatusTag>{`${app.criticalIssues} critical`}</StatusTag>
              )}
              <StatusTag>{`${app.issuesCount} total findings`}</StatusTag>
            </span>
          )}
        </span>
        <RiArrowRightLine size={16} aria-hidden className={styles.appArrow} />
      </Link>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li>
      <span className={styles.skeletonRow}>
        <span className={styles.skeletonText}>
          <Skeleton width="45%" height={16} />
          <span className={styles.skeletonStatus}>
            <Skeleton
              width={16}
              height={16}
              rounded
              className={styles.skeletonIcon}
            />
            <Skeleton width="30%" height={14} />
          </span>
        </span>
        <Skeleton width={16} height={16} className={styles.skeletonArrow} />
      </span>
    </li>
  );
}

/**
 * Loading placeholder that mirrors the row layout, so the card does not jump
 * when the applications arrive.
 */
function LoadingRows({ rows }: { rows: number }) {
  return (
    <div
      role="status"
      aria-label="Loading migration applications"
      aria-busy="true"
    >
      <ul className={styles.skeletonList}>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={index} />
        ))}
      </ul>
    </div>
  );
}

function HomeCard({
  title,
  centered = false,
  children,
}: {
  title: string;
  centered?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.cardHeader}>
        <Text as="h2" variant="title-x-small" weight="bold">
          {title}
        </Text>
      </CardHeader>
      <CardBody className={styles.cardBody}>
        <div
          className={[
            styles.cardContent,
            centered ? styles.cardContentCentered : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </div>
      </CardBody>
    </Card>
  );
}

function PortfolioCard({ persona }: { persona: 'architect' | 'developer' }) {
  const { apps, loading, error, refetch } = useMtaHomeData(persona);
  const title =
    persona === 'architect'
      ? 'Migration Toolkit for Applications'
      : 'Your Migration';
  const centered = !loading && !error && apps.length === 0;
  return (
    <HomeCard title={title} centered={centered}>
      {loading && <LoadingRows rows={persona === 'architect' ? 2 : 1} />}
      {!loading && error && (
        <Alert
          status="danger"
          title="Could not load migration data"
          description={error.message}
        />
      )}
      {!loading && !error && apps.length === 0 && (
        <EmptyState
          compact
          headingLevel={3}
          headingVariant="title-x-small"
          title={
            persona === 'architect'
              ? 'No applications registered for migration'
              : 'No assigned applications'
          }
          description={
            persona === 'architect'
              ? 'Register an application to begin migration.'
              : 'Ask your application architect to assign an application.'
          }
          action={
            persona === 'architect' ? (
              <ButtonLink href={MTA_REGISTER_TEMPLATE_PATH} variant="secondary">
                Register for migration
              </ButtonLink>
            ) : undefined
          }
        />
      )}
      {!loading && !error && apps.length > 0 && (
        <ul className={styles.list}>
          {apps.map(app => (
            <AppRow key={`${app.namespace}/${app.name}`} app={app} />
          ))}
        </ul>
      )}
      {!loading && (error || apps.length > 0) && (
        <div className={styles.cardActions}>
          <Button
            variant="tertiary"
            size="small"
            onPress={() => {
              void refetch();
            }}
          >
            Refresh Hub data
          </Button>
        </div>
      )}
      {!loading &&
        apps.some(app => app.status === 'Active' && app.issuesCount === 0) && (
          <Text as="p" variant="body-small" color="secondary">
            Zero findings does not mark a migration complete.
          </Text>
        )}
    </HomeCard>
  );
}

export function MtaHomeSection() {
  const { role: persona, loading } = usePersonaRole();
  if (loading) {
    return (
      <HomeCard title="Migration Toolkit for Applications">
        <LoadingRows rows={1} />
      </HomeCard>
    );
  }
  if (persona === 'architect' || persona === 'developer')
    return <PortfolioCard persona={persona} />;
  return (
    <HomeCard title="Migration Toolkit for Applications" centered>
      <EmptyState
        compact
        headingLevel={3}
        headingVariant="title-x-small"
        title="Migration access unavailable"
        description="Your account is not assigned a migration role. Contact your administrator for access."
      />
    </HomeCard>
  );
}
