import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import Typography from '@material-ui/core/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { InfoCard } from '@backstage/core-components';
import { usePersonaRole } from '../hooks/usePersonaRole';

const ROLE_LABELS: Record<string, string> = {
  architect: 'Architect',
  developer: 'Developer',
};

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'default'> = {
  architect: 'primary',
  developer: 'secondary',
};

const ROLE_GROUPS: Record<string, string> = {
  architect: 'group:default/mta-architects',
  developer: 'group:default/mta-developers',
};

export function MtaPersonaCard() {
  const { role, loading } = usePersonaRole();

  const isArchitect = role === 'architect';
  const isDeveloper = role === 'developer';
  const roleLabel = ROLE_LABELS[role] ?? 'Unassigned';
  const roleColor = ROLE_COLORS[role] ?? 'default';
  const groupLabel = ROLE_GROUPS[role] ?? 'No group';

  return (
    <InfoCard title="MTA Persona">
      <Box display="flex" flexDirection="column" gridGap={16}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gridGap={8}>
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              Active Persona:
            </Typography>
            {loading ? (
              <Chip label="Loading..." size="small" />
            ) : (
              <Chip
                label={roleLabel}
                color={roleColor}
                size="small"
                style={{ fontWeight: 600 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="textSecondary">
            {groupLabel}
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ lineHeight: 1.6 }}
          >
            {isArchitect &&
              'As an MTA Architect, you have full access to discover applications, define target profiles, run repository analysis, and select migration paths for the team.'}
            {isDeveloper &&
              'As an MTA Developer, you have focused access to assigned applications, code-level migration issues, AI-assisted remediation, and DevSpaces cloud environments.'}
            {!isArchitect &&
              !isDeveloper &&
              'This user is not currently mapped to an MTA persona group. Switch user using the log out button in the navigation bar to test Architect or Developer perspectives.'}
          </Typography>
        </Box>

        <Box display="flex" gridGap={8} mt={1}>
          <Button
            variant="outlined"
            size="small"
            color="primary"
            component={RouterLink}
            to="/mta"
          >
            Migration Dashboard
          </Button>
          <Button
            variant="outlined"
            size="small"
            component={RouterLink}
            to="/catalog?filters%5Bkind%5D=component"
          >
            Software Catalog
          </Button>
        </Box>
      </Box>
    </InfoCard>
  );
}
