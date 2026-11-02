import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import Typography from '@material-ui/core/Typography';
import { InfoCard } from '@backstage/core-components';
import type {
  KonveyorAnalysisProfile,
  KonveyorApplication,
} from '../../api/types';

export interface PhasePathSelectionProps {
  app: KonveyorApplication;
  profiles: KonveyorAnalysisProfile[];
  isExecuting?: boolean;
  onStartAnalysis: (profileId: number) => void;
  onStartDiscovery: () => void;
  onRefresh: () => void;
  onCancel?: () => void;
}

export function PhasePathSelection({
  app,
  profiles,
  isExecuting = false,
  onStartAnalysis,
  onStartDiscovery,
  onRefresh,
  onCancel,
}: PhasePathSelectionProps) {
  const [selectedId, setSelectedId] = useState('');
  const selectedProfile = profiles.find(
    profile => String(profile.id) === selectedId,
  );

  return (
    <Box mb={2}>
      <InfoCard title="Select an analysis profile">
        <Box mb={2}>
          <Typography variant="body2">
            Repository: {app.repository?.url || 'Not configured in Hub'}
          </Typography>
          {(app.repository?.branch || app.repository?.tag) && (
            <Typography variant="body2">
              Ref: {app.repository.branch || app.repository.tag}
            </Typography>
          )}
          {app.repository?.path && (
            <Typography variant="body2">Path: {app.repository.path}</Typography>
          )}
        </Box>
        {(app.tags ?? []).map(tag => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            style={{ marginRight: 4, marginBottom: 8 }}
          />
        ))}
        {profiles.length === 0 ? (
          <Typography variant="body2">
            No effective analysis profiles are available. In Hub, match this
            application's tags to an archetype with an analysis profile, then
            refresh.
          </Typography>
        ) : (
          <RadioGroup
            aria-label="Analysis profile"
            value={selectedId}
            onChange={event => setSelectedId(event.target.value)}
          >
            {profiles.map(profile => (
              <FormControlLabel
                key={profile.id}
                value={String(profile.id)}
                disabled={isExecuting}
                control={<Radio color="primary" />}
                label={
                  <Box my={1}>
                    <Typography variant="body1">{profile.name}</Typography>
                    {profile.description && (
                      <Typography variant="body2" color="textSecondary">
                        {profile.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="textSecondary">
                      Profile ID: {profile.id}
                      {(profile.rules.targets?.length ?? 0) > 0 &&
                        ` · Targets: ${profile.rules.targets
                          ?.map(target => target.name || target.id)
                          .join(', ')}`}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        )}
        <Box display="flex" mt={2} style={{ gap: 8 }}>
          <Button
            variant="contained"
            color="primary"
            disabled={!selectedProfile || isExecuting}
            onClick={() =>
              selectedProfile && onStartAnalysis(selectedProfile.id)
            }
          >
            Start analysis
          </Button>
          <Button
            disabled={isExecuting || !app.repository?.url}
            onClick={onStartDiscovery}
          >
            Run discovery
          </Button>
          <Button disabled={isExecuting} onClick={onRefresh}>
            Refresh profiles
          </Button>
          {onCancel && (
            <Button disabled={isExecuting} onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Box>
      </InfoCard>
    </Box>
  );
}
