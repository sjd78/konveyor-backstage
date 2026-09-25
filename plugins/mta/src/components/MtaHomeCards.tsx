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
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import Link from '@material-ui/core/Link';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import Skeleton from '@material-ui/lab/Skeleton';
import AddIcon from '@material-ui/icons/Add';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import SearchIcon from '@material-ui/icons/Search';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import { makeStyles, alpha, useTheme } from '@material-ui/core/styles';
import {
  EmptyState,
  InfoCard,
  StatusError,
  StatusOK,
  StatusPending,
  StatusWarning,
  WarningPanel,
} from '@backstage/core-components';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { readDemoApplications } from '../store/MtaStore';
import {
  MTA_REGISTER_TEMPLATE_PATH,
  DEVELOPER_PHASE_CONFIG,
  DEFAULT_DEVELOPER_PHASE,
} from '../utils';
import type { PhaseIconKey, PhaseTone } from '../utils';
import type { MigrationStatus, MtaApplication } from '../types';

interface MtaAppInfo {
  name: string;
  title?: string;
  namespace: string;
  status: MigrationStatus;
  issuesCount: number;
  criticalIssues: number;
}

function StatusIndicator({ status }: { status: MigrationStatus }) {
  switch (status) {
    case 'Not Started':
      return <StatusPending>Not started</StatusPending>;
    case 'Discovery':
      return <StatusPending>Discovery in progress</StatusPending>;
    case 'Path Selection':
      return <StatusWarning>Path selection needed</StatusWarning>;
    case 'Analysis':
      return <StatusPending>Analysis in progress</StatusPending>;
    case 'Active':
    case 'Post-remediation':
      return <StatusWarning>Issues found</StatusWarning>;
    case 'Completed':
      return <StatusOK>Migration complete</StatusOK>;
    case 'Failed':
      return <StatusError>Failed - view details</StatusError>;
    default:
      return <StatusPending>{String(status)}</StatusPending>;
  }
}

const useStyles = makeStyles(theme => ({
  appRow: {
    borderRadius: theme.spacing(0.75),
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  chips: {
    display: 'flex',
    gap: theme.spacing(0.75),
    flexWrap: 'wrap' as const,
    marginTop: theme.spacing(0.5),
  },
  criticalChip: {
    backgroundColor: alpha(
      theme.palette.error.main,
      theme.palette.type === 'dark' ? 0.15 : 0.08,
    ),
    color: theme.palette.error.main,
  },
  neutralChip: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  cardPinnedFooter: {
    '& [class*="MuiCardContent-root"]': {
      overflow: 'hidden !important' as any,
      display: 'flex !important' as any,
      flexDirection: 'column !important' as any,
    },
  },
  cardCentered: {
    '& [class*="MuiCardContent-root"]': {
      display: 'flex !important' as any,
      flexDirection: 'column !important' as any,
      flex: '1 !important' as any,
    },
  },
  scrollList: {
    flex: 1,
    overflowY: 'auto' as const,
    minHeight: 0,
  },
  footer: {
    flexShrink: 0,
    padding: theme.spacing(1.5, 2, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  devStatusRoot: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    flex: 1,
    minHeight: 160,
    padding: theme.spacing(3, 2),
  },
  devIconRing: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1.5),
  },
  devIcon: {
    fontSize: 24,
  },
  devTitle: {
    fontWeight: 600,
    fontSize: '0.9rem',
    marginBottom: theme.spacing(0.5),
  },
  devDescription: {
    maxWidth: 340,
    lineHeight: 1.45,
    fontSize: '0.8rem',
  },
}));

const CARD_ICON_MAP: Record<
  PhaseIconKey,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  hourglass: HourglassEmptyIcon,
  search: SearchIcon,
  swap: SwapHorizIcon,
  autorenew: AutorenewIcon,
  warning: ReportProblemOutlinedIcon,
};

interface RawEntity {
  name: string;
  title?: string;
  namespace: string;
  annotations: Record<string, string>;
}

const MTA_ASSIGNED_DEVELOPER = 'mta.konveyor.io/assigned-developer';

const MIGRATION_STATUSES: readonly string[] = [
  'Not Started',
  'Discovery',
  'Path Selection',
  'Analysis',
  'Active',
  'Post-remediation',
  'Completed',
  'Failed',
];

function useMtaEntities(persona: 'architect' | 'developer'): {
  apps: MtaAppInfo[];
  loading: boolean;
  error: boolean;
} {
  const catalogApi = useApi(catalogApiRef);
  const identityApi = useApi(identityApiRef);
  const [rawEntities, setRawEntities] = useState<RawEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const filter: Record<string, string> =
          persona === 'architect'
            ? {
                kind: 'Component',
                'relations.ownedBy': 'group:default/mta-architects',
              }
            : {
                kind: 'Component',
                [`metadata.annotations.${MTA_ASSIGNED_DEVELOPER}`]: (
                  await identityApi.getBackstageIdentity()
                ).userEntityRef,
              };
        const response = await catalogApi.getEntities({
          filter,
          fields: [
            'metadata.name',
            'metadata.title',
            'metadata.namespace',
            'metadata.annotations',
          ],
        });
        if (cancelled) return;
        setRawEntities(
          response.items.map(e => ({
            name: e.metadata.name,
            title: e.metadata.title,
            namespace: e.metadata.namespace ?? 'default',
            annotations: e.metadata.annotations ?? {},
          })),
        );
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [catalogApi, identityApi, persona]);

  const apps = useMemo(() => {
    const demoByRef = new Map<string, MtaApplication>();
    for (const app of readDemoApplications()) {
      if (app.entityRef) demoByRef.set(app.entityRef, app);
    }
    return rawEntities.map(e => {
      const demo = demoByRef.get(`component:${e.namespace}/${e.name}`);
      const annotation = e.annotations['mta.konveyor.io/status'];
      let status: MigrationStatus = 'Not Started';
      if (annotation === 'registering') status = 'Discovery';
      else if (annotation === 'discovered') status = 'Path Selection';
      else if (annotation === 'failed') status = 'Failed';
      else if (annotation && MIGRATION_STATUSES.includes(annotation)) {
        status = annotation as MigrationStatus;
      }
      const mockId = e.annotations['konveyor.io/application-id'];
      const demoIsPending =
        demo?.status === 'Not Started' || demo?.status === 'Discovery';
      return {
        name: e.name,
        title: e.title,
        namespace: e.namespace,
        status: demo && (!mockId || !demoIsPending) ? demo.status : status,
        issuesCount:
          demo?.issuesCount ??
          Number(e.annotations['mta.konveyor.io/issues-count'] || 0),
        criticalIssues:
          demo?.criticalIssues ??
          Number(e.annotations['mta.konveyor.io/critical-issues'] || 0),
      };
    });
  }, [rawEntities]);

  return { apps, loading, error };
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ListItem key={i}>
          <ListItemText
            primary={
              <Skeleton variant="rect" height={14} width={`${55 + i * 15}%`} />
            }
            secondary={
              <Box display="flex" alignItems="center" gridGap={6} mt={0.75}>
                <Skeleton variant="circle" width={8} height={8} />
                <Skeleton variant="rect" height={10} width="40%" />
              </Box>
            }
          />
          <Skeleton variant="circle" width={18} height={18} />
        </ListItem>
      ))}
    </>
  );
}

function AppRow({ app }: { app: MtaAppInfo }) {
  const classes = useStyles();
  const navigate = useNavigate();

  const showChips =
    (app.status === 'Active' || app.status === 'Post-remediation') &&
    app.issuesCount > 0;

  return (
    <ListItem
      button
      className={classes.appRow}
      onClick={() =>
        navigate(`/catalog/${app.namespace}/component/${app.name}/migration`)
      }
      aria-label={`Open ${app.name} migration tab`}
    >
      <ListItemText
        primary={app.title ?? app.name}
        primaryTypographyProps={{
          variant: 'body2',
          style: { fontWeight: 600 },
          noWrap: true,
        }}
        secondary={
          <>
            <StatusIndicator status={app.status} />
            {showChips && (
              <span className={classes.chips}>
                {app.criticalIssues > 0 && (
                  <Chip
                    label={`${app.criticalIssues} critical`}
                    size="small"
                    className={classes.criticalChip}
                  />
                )}
                <Chip
                  label={`${app.issuesCount} total issues`}
                  size="small"
                  className={classes.neutralChip}
                />
              </span>
            )}
          </>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />
      <ArrowForwardIcon fontSize="small" color="action" aria-hidden="true" />
    </ListItem>
  );
}

function ArchitectCardContent() {
  const classes = useStyles();
  const { apps, loading, error } = useMtaEntities('architect');

  if (loading) {
    return (
      <InfoCard title="Migration Toolkit for Applications">
        <List dense disablePadding>
          <SkeletonRows count={2} />
        </List>
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="Migration Toolkit for Applications">
        <WarningPanel
          severity="error"
          title="Could not load migration data"
          message="Refresh the page to try again."
        />
      </InfoCard>
    );
  }

  if (apps.length === 0) {
    return (
      <InfoCard title="Migration Toolkit for Applications">
        <EmptyState
          title="No applications registered for migration"
          description="Register an application to begin migration."
          action={
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              component={RouterLink}
              to={MTA_REGISTER_TEMPLATE_PATH}
            >
              Register for migration
            </Button>
          }
          missing="content"
        />
      </InfoCard>
    );
  }

  return (
    <InfoCard
      title="Migration Toolkit for Applications"
      subheader={`${apps.length} application${
        apps.length !== 1 ? 's' : ''
      } registered`}
      className={classes.cardPinnedFooter}
    >
      <Box className={classes.scrollList}>
        <List dense disablePadding>
          {apps.map((app, i) => (
            <Box key={`${app.namespace}/${app.name}`}>
              {i > 0 && <Divider />}
              <AppRow app={app} />
            </Box>
          ))}
        </List>
      </Box>
      <Box className={classes.footer}>
        <Typography variant="body2" color="textSecondary">
          Don&apos;t see your application?{' '}
          <Link component={RouterLink} to={MTA_REGISTER_TEMPLATE_PATH}>
            Register for migration
          </Link>
        </Typography>
      </Box>
    </InfoCard>
  );
}

function useToneColors(tone: PhaseTone) {
  const theme = useTheme();
  const isDark = theme.palette.type === 'dark';
  const colors: Record<PhaseTone, { bg: string; fg: string }> = {
    neutral: {
      bg: theme.palette.action.hover,
      fg: theme.palette.text.disabled,
    },
    active: {
      bg: alpha(theme.palette.info.main, isDark ? 0.1 : 0.06),
      fg: theme.palette.info.main,
    },
    warning: {
      bg: alpha(theme.palette.warning.main, isDark ? 0.12 : 0.06),
      fg: theme.palette.warning.main,
    },
  };
  return colors[tone];
}

function DeveloperStatusMessage({ status }: { status: string }) {
  const classes = useStyles();
  const msg = DEVELOPER_PHASE_CONFIG[status] ?? DEFAULT_DEVELOPER_PHASE;
  const Icon = CARD_ICON_MAP[msg.icon];
  const tone = useToneColors(msg.tone);

  return (
    <Box className={classes.devStatusRoot}>
      <Box className={classes.devIconRing} style={{ backgroundColor: tone.bg }}>
        <Icon className={classes.devIcon} style={{ color: tone.fg }} />
      </Box>
      <Typography variant="body2" className={classes.devTitle}>
        {msg.title}
      </Typography>
      <Typography
        variant="caption"
        color="textSecondary"
        className={classes.devDescription}
      >
        {msg.description}
      </Typography>
    </Box>
  );
}

function DeveloperCardContent() {
  const classes = useStyles();
  const { apps, loading, error } = useMtaEntities('developer');

  if (loading) {
    return (
      <InfoCard title="Your Migration">
        <List dense disablePadding>
          <SkeletonRows count={1} />
        </List>
      </InfoCard>
    );
  }

  if (error) {
    return (
      <InfoCard title="Your Migration">
        <WarningPanel
          severity="error"
          title="Could not load migration data"
          message="Refresh the page to try again."
        />
      </InfoCard>
    );
  }

  if (apps.length === 0) {
    return (
      <InfoCard title="Your Migration" className={classes.cardCentered}>
        <DeveloperStatusMessage status="Not Started" />
      </InfoCard>
    );
  }

  return (
    <InfoCard
      title="Your Migration"
      subheader={`${apps.length} assigned application${
        apps.length !== 1 ? 's' : ''
      }`}
      className={classes.cardPinnedFooter}
    >
      <Box className={classes.scrollList}>
        <List dense disablePadding>
          {apps.map((app, index) => (
            <React.Fragment key={`${app.namespace}/${app.name}`}>
              {index > 0 && <Divider />}
              <AppRow app={app} />
            </React.Fragment>
          ))}
        </List>
      </Box>
    </InfoCard>
  );
}

function HomeCardContent() {
  const persona = usePersonaRole();
  if (persona === 'architect') return <ArchitectCardContent />;
  if (persona === 'developer') return <DeveloperCardContent />;
  return (
    <InfoCard title="Migration Toolkit for Applications">
      <EmptyState
        title="Migration access unavailable"
        description="Your account is not assigned a migration role. Contact your administrator for access."
        missing="content"
      />
    </InfoCard>
  );
}

export function MtaHomeSection() {
  return <HomeCardContent />;
}
