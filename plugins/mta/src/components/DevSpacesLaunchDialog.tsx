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
import { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import { makeStyles, alpha } from '@material-ui/core/styles';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import LaunchIcon from '@material-ui/icons/Launch';
import WarningIcon from '@material-ui/icons/Warning';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import type { DevSpacesConfig } from '../types';

const useStyles = makeStyles(theme => ({
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  configRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 0),
    fontSize: '0.875rem',
    '&:not(:last-child)': {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  configLabel: {
    color: theme.palette.text.secondary,
  },
  configValue: {
    fontWeight: 500,
  },
  extensionChips: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(2),
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
    fontSize: '0.875rem',
  },
  checkIcon: {
    color: theme.palette.status?.ok ?? theme.palette.success.main,
    fontSize: '1.1rem',
  },
  infoCallout: {
    display: 'flex',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    backgroundColor: alpha(
      theme.palette.info.main,
      theme.palette.type === 'dark' ? 0.12 : 0.08,
    ),
    borderRadius: 4,
    marginTop: theme.spacing(2),
    alignItems: 'flex-start',
  },
  infoIcon: {
    color: theme.palette.info.main,
    fontSize: '1.25rem',
    marginTop: 2,
    flexShrink: 0,
  },
  warningBox: {
    display: 'flex',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    backgroundColor: alpha(
      theme.palette.warning.main,
      theme.palette.type === 'dark' ? 0.12 : 0.08,
    ),
    border: `1px solid ${theme.palette.warning.main}`,
    borderRadius: 4,
  },
  warningIcon: {
    color: theme.palette.warning.main,
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  urlBlock: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    wordBreak: 'break-all' as const,
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
}));

interface DevSpacesLaunchDialogProps {
  open: boolean;
  onClose: () => void;
  onLaunch: () => void;
  appName: string;
  repoUrl: string;
  config: DevSpacesConfig;
  available: boolean;
}

export function DevSpacesLaunchDialog({
  open,
  onClose,
  onLaunch,
  appName,
  repoUrl,
  config,
  available,
}: DevSpacesLaunchDialogProps) {
  const classes = useStyles();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const devSpacesUrl = `https://devspaces.apps.cluster.example.com/#${encodeURIComponent(
    repoUrl,
  )}`;

  const handleCopy = () => {
    window.navigator.clipboard.writeText(devSpacesUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => { console.warn('Clipboard write failed'); },
    );
  };

  const handleLaunch = () => {
    window.open(devSpacesUrl, '_blank', 'noopener');
    onLaunch();
    onClose();
  };

  if (!available) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="devspaces-confirm-title">
        <DialogTitle id="devspaces-confirm-title">Dev Spaces unavailable</DialogTitle>
        <DialogContent>
          <div className={classes.warningBox}>
            <WarningIcon className={classes.warningIcon} />
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Dev Spaces is not available</strong> on this cluster.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Clone the repository locally and apply fixes manually. Use the
                MTA CLI for local analysis results.
              </Typography>
              <Box mt={2}>
                <Typography
                  variant="body2"
                  style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
                >
                  git clone {repoUrl}
                </Typography>
              </Box>
            </Box>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="devspaces-launch-title">
      <DialogTitle id="devspaces-launch-title">Launch Dev Spaces for {appName}</DialogTitle>
      <DialogContent>
        {/* Workspace Configuration */}
        <Typography className={classes.sectionTitle}>
          Workspace configuration
        </Typography>
        <Box mb={2.5}>
          <div className={classes.configRow}>
            <span className={classes.configLabel}>Namespace</span>
            <span className={classes.configValue}>{config.namespace}</span>
          </div>
          <div className={classes.configRow}>
            <span className={classes.configLabel}>Memory</span>
            <span className={classes.configValue}>{config.memory}</span>
          </div>
          <div className={classes.configRow}>
            <span className={classes.configLabel}>Storage</span>
            <span className={classes.configValue}>{config.storage}</span>
          </div>
          <div className={classes.configRow}>
            <span className={classes.configLabel}>Idle timeout</span>
            <span className={classes.configValue}>{config.idleTimeout}</span>
          </div>
        </Box>

        <Divider />

        {/* Pre-installed Tooling */}
        <Box mt={2.5} mb={2.5}>
          <Typography className={classes.sectionTitle}>
            Pre-installed extensions
          </Typography>
          <div className={classes.extensionChips}>
            {config.extensions.map(ext => (
              <Chip key={ext} label={ext} size="small" variant="outlined" />
            ))}
          </div>

          <Typography className={classes.sectionTitle}>
            Included configuration
          </Typography>
          {config.features.map(feature => (
            <div key={feature} className={classes.checkItem}>
              <CheckCircleOutlineIcon className={classes.checkIcon} />
              <span>{feature}</span>
            </div>
          ))}
        </Box>

        <Divider />

        {/* Return guidance */}
        <div className={classes.infoCallout}>
          <InfoOutlinedIcon className={classes.infoIcon} />
          <Typography variant="body2" color="textSecondary">
            When finished, return to Developer Hub and re-run analysis to see updated results.
          </Typography>
        </div>

        <div className={classes.urlBlock}>{devSpacesUrl}</div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          startIcon={<FileCopyIcon />}
          onClick={handleCopy}
          variant="outlined"
        >
          {copied ? 'Copied' : 'Copy URL'}
        </Button>
        <Button
          startIcon={<LaunchIcon />}
          onClick={handleLaunch}
          color="primary"
          variant="contained"
        >
          Launch workspace
        </Button>
      </DialogActions>
    </Dialog>
  );
}
