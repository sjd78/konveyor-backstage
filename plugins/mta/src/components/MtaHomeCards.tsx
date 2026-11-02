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
import { Fragment } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Typography from '@material-ui/core/Typography';
import Skeleton from '@material-ui/lab/Skeleton';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import {
  EmptyState,
  InfoCard,
  StatusError,
  StatusPending,
  StatusWarning,
  WarningPanel,
} from '@backstage/core-components';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { useMtaHomeData } from '../hooks/useMtaHomeData';
import type { MtaAppInfo } from '../hooks/useMtaHomeData';
import { MTA_REGISTER_TEMPLATE_PATH } from '../utils';

function ApplicationStatus({ app }: { app: MtaAppInfo }) {
  if (app.connection === 'disconnected') {
    return <StatusWarning>Not connected to Hub</StatusWarning>;
  }
  if (app.connection === 'missing') {
    return (
      <StatusError>
        Linked Hub application is missing or unavailable
      </StatusError>
    );
  }
  if (app.error) return <StatusError>{app.error.message}</StatusError>;
  switch (app.status) {
    case 'Discovery':
      return <StatusPending>Discovery in progress</StatusPending>;
    case 'Path Selection':
      return <StatusWarning>Path selection needed</StatusWarning>;
    case 'Analysis':
      return <StatusPending>Analysis in progress</StatusPending>;
    case 'Analysis Unavailable':
      return (
        <StatusWarning>
          Analysis results unavailable — refresh or run analysis
        </StatusWarning>
      );
    case 'Active':
      return app.issuesCount === 0 ? (
        <StatusPending>No findings reported</StatusPending>
      ) : (
        <StatusWarning>Analysis findings</StatusWarning>
      );
    case 'Failed':
      return <StatusError>Task failed — view details</StatusError>;
    default:
      return <StatusPending>Not started</StatusPending>;
  }
}

function AppRow({ app }: { app: MtaAppInfo }) {
  const navigate = useNavigate();
  return (
    <ListItem
      button
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
        }}
        secondary={
          <>
            <ApplicationStatus app={app} />
            {!app.error && app.issuesCount !== undefined && (
              <Box component="span" display="flex" gridGap={6} mt={0.5}>
                {(app.criticalIssues ?? 0) > 0 && (
                  <Chip label={`${app.criticalIssues} critical`} size="small" />
                )}
                <Chip
                  label={`${app.issuesCount} total findings`}
                  size="small"
                />
              </Box>
            )}
          </>
        }
        secondaryTypographyProps={{ component: 'div' }}
      />
      <ArrowForwardIcon fontSize="small" color="action" aria-hidden="true" />
    </ListItem>
  );
}

function PortfolioCard({ persona }: { persona: 'architect' | 'developer' }) {
  const { apps, loading, error, refetch } = useMtaHomeData(persona);
  const title =
    persona === 'architect'
      ? 'Migration Toolkit for Applications'
      : 'Your Migration';
  return (
    <InfoCard title={title}>
      {loading && <Skeleton variant="rect" height={48} />}
      {!loading && error && (
        <WarningPanel
          severity="error"
          title="Could not load migration data"
          message={error.message}
        />
      )}
      {!loading && !error && apps.length === 0 && (
        <EmptyState
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
          missing="content"
          action={
            persona === 'architect' ? (
              <Button
                component={RouterLink}
                to={MTA_REGISTER_TEMPLATE_PATH}
                variant="outlined"
                color="primary"
              >
                Register for migration
              </Button>
            ) : undefined
          }
        />
      )}
      {!loading && !error && apps.length > 0 && (
        <List dense disablePadding>
          {apps.map((app, index) => (
            <Fragment key={`${app.namespace}/${app.name}`}>
              {index > 0 && <Divider />}
              <AppRow app={app} />
            </Fragment>
          ))}
        </List>
      )}
      {!loading && (error || apps.length > 0) && (
        <Box mt={1}>
          <Button
            size="small"
            onClick={() => {
              void refetch();
            }}
          >
            Refresh Hub data
          </Button>
        </Box>
      )}
      {!loading &&
        apps.some(app => app.status === 'Active' && app.issuesCount === 0) && (
          <Typography variant="caption" color="textSecondary">
            Zero findings does not mark a migration complete.
          </Typography>
        )}
    </InfoCard>
  );
}

export function MtaHomeSection() {
  const { role: persona, loading } = usePersonaRole();
  if (loading) {
    return (
      <InfoCard title="Migration Toolkit for Applications">
        <Skeleton variant="rect" height={48} />
      </InfoCard>
    );
  }
  if (persona === 'architect' || persona === 'developer')
    return <PortfolioCard persona={persona} />;
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
