import { useState } from 'react';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Paper from '@material-ui/core/Paper';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import Typography from '@material-ui/core/Typography';
import { alpha, useTheme } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import { ACTION_TIMEOUT_MS } from '../../utils';
import { useMtaStore } from '../../store/MtaStore';
import type { MtaApplication } from '../../types';

export function PhasePathSelection({
  app,
  store,
}: {
  app: MtaApplication;
  store: ReturnType<typeof useMtaStore>;
}) {
  const theme = useTheme();
  const archetype = store.getArchetypeById(app.archetypeId);
  const allTargets = archetype
    ? store.getTargetsForArchetype(archetype.id)
    : [];
  const [selectedTargetId, setSelectedTargetId] = useState(
    app.targetProfileId || '',
  );

  const handleStartAnalysis = () => {
    if (!selectedTargetId) return;
    store.updateApplication(app.id, {
      targetProfileId: selectedTargetId,
      status: 'Analysis',
      devSpacesAvailable: true,
    });
    // Let the analysis phase render before the mock action publishes its results.
    setTimeout(
      () => store.executeAction(app.id, 'run-analysis', 'architect'),
      ACTION_TIMEOUT_MS,
    );
  };

  return (
    <Box mb={2}>
      <InfoCard title="Technologies discovered">
        <Box mb={2}>
          {(app.discoveredTags ?? []).map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              style={{ marginRight: 4, marginBottom: 4 }}
            />
          ))}
        </Box>
        {archetype && (
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              Matched archetype
            </Typography>
            <Typography variant="body1" style={{ fontWeight: 600 }}>
              {archetype.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {archetype.description}
            </Typography>
          </Box>
        )}
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Available migration paths
          </Typography>
          <RadioGroup
            value={selectedTargetId}
            onChange={e => setSelectedTargetId(e.target.value)}
          >
            {allTargets.map(target => (
              <Paper
                key={target.id}
                variant="outlined"
                style={{
                  padding: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                  borderColor:
                    selectedTargetId === target.id
                      ? theme.palette.primary.main
                      : undefined,
                  backgroundColor:
                    selectedTargetId === target.id
                      ? alpha(theme.palette.primary.main, 0.04)
                      : undefined,
                }}
                onClick={() => setSelectedTargetId(target.id)}
              >
                <FormControlLabel
                  value={target.id}
                  control={<Radio color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body1" style={{ fontWeight: 600 }}>
                        {target.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {target.description}
                      </Typography>
                    </Box>
                  }
                  style={{ margin: 0, width: '100%' }}
                />
              </Paper>
            ))}
          </RadioGroup>
        </Box>
        <Box display="flex" justifyContent="flex-end" mt={2}>
          <Button
            variant="contained"
            color="primary"
            disabled={!selectedTargetId}
            onClick={handleStartAnalysis}
          >
            Start analysis
          </Button>
        </Box>
      </InfoCard>
    </Box>
  );
}
