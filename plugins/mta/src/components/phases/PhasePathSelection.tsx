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
import type { KonveyorApplication, KonveyorArchetype } from '../../api/types';

export interface PhasePathSelectionProps {
  app: KonveyorApplication;
  archetypes: KonveyorArchetype[];
  onStartAnalysis: (targets: string[]) => void;
}

export function PhasePathSelection({
  app,
  archetypes,
  onStartAnalysis,
}: PhasePathSelectionProps) {
  const theme = useTheme();

  const tags = (app.tags ?? []).map(tag =>
    typeof tag === 'string' ? tag : tag.name,
  );

  const [selectedId, setSelectedId] = useState<string>(
    archetypes.length > 0 ? String(archetypes[0].id) : '',
  );

  const handleStartAnalysis = () => {
    if (!selectedId) return;
    const selected = archetypes.find(a => String(a.id) === selectedId);
    const targets =
      selected?.tags?.map(t => t.name) ??
      (selected ? [selected.name] : ['quarkus']);
    onStartAnalysis(targets);
  };

  const matchedArchetype = archetypes.find(a => String(a.id) === selectedId);

  return (
    <Box mb={2}>
      <InfoCard title="Technologies discovered">
        {tags.length > 0 && (
          <Box mb={2}>
            {tags.map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                style={{ marginRight: 4, marginBottom: 4 }}
              />
            ))}
          </Box>
        )}
        {matchedArchetype && (
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              Matched archetype
            </Typography>
            <Typography variant="body1" style={{ fontWeight: 600 }}>
              {matchedArchetype.name}
            </Typography>
            {matchedArchetype.description && (
              <Typography variant="body2" color="textSecondary">
                {matchedArchetype.description}
              </Typography>
            )}
          </Box>
        )}
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>
            Available migration paths
          </Typography>
          <RadioGroup
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {archetypes.map(archetype => (
              <Paper
                key={archetype.id}
                variant="outlined"
                style={{
                  padding: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                  borderColor:
                    selectedId === String(archetype.id)
                      ? theme.palette.primary.main
                      : undefined,
                  backgroundColor:
                    selectedId === String(archetype.id)
                      ? alpha(theme.palette.primary.main, 0.04)
                      : undefined,
                }}
                onClick={() => setSelectedId(String(archetype.id))}
              >
                <FormControlLabel
                  value={String(archetype.id)}
                  control={<Radio color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body1" style={{ fontWeight: 600 }}>
                        {archetype.name}
                      </Typography>
                      {archetype.description && (
                        <Typography variant="body2" color="textSecondary">
                          {archetype.description}
                        </Typography>
                      )}
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
            disabled={!selectedId}
            onClick={handleStartAnalysis}
          >
            Start analysis
          </Button>
        </Box>
      </InfoCard>
    </Box>
  );
}
