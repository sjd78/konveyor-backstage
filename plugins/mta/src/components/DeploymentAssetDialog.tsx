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
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Collapse from '@material-ui/core/Collapse';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import LinearProgress from '@material-ui/core/LinearProgress';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import Typography from '@material-ui/core/Typography';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import DescriptionIcon from '@material-ui/icons/Description';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import type { Palette } from '@material-ui/core/styles/createPalette';
import type { DeliveryMethod, DeploymentAsset } from '../types';

const useStyles = makeStyles(theme => ({
  assetRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': { borderBottom: 'none' },
  },
  assetName: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  fileIcon: {
    color: theme.palette.text.secondary,
    fontSize: '1.1rem',
  },
  assetPath: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: theme.palette.text.secondary,
  },
  typeChip: {
    textTransform: 'capitalize' as const,
  },
  previewToggle: {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.palette.primary.main,
    fontSize: '0.8rem',
    marginTop: theme.spacing(0.5),
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: 'inherit',
  },
  previewBlock: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    whiteSpace: 'pre-wrap' as const,
    backgroundColor: theme.palette.background.default,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    padding: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    maxHeight: 200,
    overflow: 'auto',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  successBox: {
    textAlign: 'center' as const,
    padding: theme.spacing(3, 0),
  },
  successIcon: {
    fontSize: '3rem',
    color: theme.palette.status?.ok ?? theme.palette.success.main,
    marginBottom: theme.spacing(1),
  },
  nextStepsList: {
    listStyle: 'decimal',
    paddingLeft: theme.spacing(3),
    marginTop: theme.spacing(2),
    '& li': {
      padding: theme.spacing(0.5, 0),
      fontSize: '0.875rem',
    },
  },
}));

function typeColor(palette: Palette, assetType: string): string {
  const map: Record<string, string> = {
    container: palette.primary.main,
    'ci-cd': palette.secondary.main,
    kubernetes: palette.info.main,
    openshift: palette.error.main,
  };
  return map[assetType] ?? palette.action.disabled;
}

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  'commit-branch': 'Commit to a new branch',
  'create-pr': 'Create a pull request',
  download: 'Download as archive',
};

interface DeploymentAssetDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: () => void;
  appName: string;
  assets: DeploymentAsset[];
  previews: Record<string, string>;
  generatorName?: string;
}

export function DeploymentAssetDialog({
  open,
  onClose,
  onGenerate,
  appName,
  assets,
  previews,
  generatorName,
}: DeploymentAssetDialogProps) {
  const classes = useStyles();
  const theme = useTheme();
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>('commit-branch');
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setDone(true);
      onGenerate();
    }, 2500);
  };

  const handleClose = () => {
    setDone(false);
    setGenerating(false);
    setExpandedAsset(null);
    onClose();
  };

  const togglePreview = (name: string) => {
    setExpandedAsset(prev => (prev === name ? null : name));
  };

  if (done) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Deployment assets generated</DialogTitle>
        <DialogContent>
          <div className={classes.successBox}>
            <CheckCircleIcon className={classes.successIcon} />
            <Typography variant="h6" gutterBottom>
              {assets.length} files generated
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {deliveryMethod === 'commit-branch' &&
                `Files committed to branch deploy/${appName}.`}
              {deliveryMethod === 'create-pr' &&
                'Pull request created for review.'}
              {deliveryMethod === 'download' && 'Archive ready for download.'}
            </Typography>
          </div>

          <Typography className={classes.sectionTitle}>Next steps</Typography>
          <ol className={classes.nextStepsList}>
            <li>Review the generated deployment files</li>
            <li>Test in a staging environment</li>
            <li>Merge to main when verified</li>
            <li>Deploy to production</li>
          </ol>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary" variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Generate deployment assets
        {generatorName && (
          <Typography variant="body2" color="textSecondary">
            Using {generatorName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {generating && <LinearProgress style={{ marginBottom: 16 }} />}

        <Typography className={classes.sectionTitle}>
          Files to generate
        </Typography>
        <Box mb={3}>
          {assets.map(asset => (
            <div key={asset.name}>
              <div className={classes.assetRow}>
                <div className={classes.assetName}>
                  <DescriptionIcon className={classes.fileIcon} />
                  <div>
                    <Typography variant="body2">{asset.name}</Typography>
                    <Typography className={classes.assetPath}>
                      {asset.path}
                      {asset.name}
                    </Typography>
                    {previews[asset.name] && (
                      <Button
                        className={classes.previewToggle}
                        onClick={() => togglePreview(asset.name)}
                        size="small"
                        disableRipple
                      >
                        {expandedAsset === asset.name ? (
                          <>
                            <ExpandLessIcon fontSize="small" /> Hide preview
                          </>
                        ) : (
                          <>
                            <ExpandMoreIcon fontSize="small" /> Show preview
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <Chip
                  label={asset.type}
                  size="small"
                  className={classes.typeChip}
                  style={{
                    backgroundColor: typeColor(theme.palette, asset.type),
                    color: theme.palette.getContrastText(
                      typeColor(theme.palette, asset.type),
                    ),
                  }}
                />
              </div>
              <Collapse in={expandedAsset === asset.name}>
                {previews[asset.name] && (
                  <div className={classes.previewBlock}>
                    {previews[asset.name]}
                  </div>
                )}
              </Collapse>
            </div>
          ))}
        </Box>

        <Typography className={classes.sectionTitle}>
          Delivery method
        </Typography>
        <RadioGroup
          value={deliveryMethod}
          onChange={e => setDeliveryMethod(e.target.value as DeliveryMethod)}
        >
          {(Object.entries(DELIVERY_LABELS) as [DeliveryMethod, string][]).map(
            ([value, label]) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio size="small" />}
                label={label}
                disabled={generating}
              />
            ),
          )}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          color="primary"
          variant="contained"
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
