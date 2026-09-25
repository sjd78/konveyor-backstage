import { InfoCard } from '@backstage/core-components';
import { EntityRefLinks } from '@backstage/plugin-catalog-react';
import { useUserProfile } from '@backstage/plugin-user-settings';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { usePersonaRole } from '@internal/backstage-plugin-mta';

const ROLE_LABELS: Record<string, string> = {
  architect: 'Architect',
  developer: 'Developer',
};

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'default'> = {
  architect: 'primary',
  developer: 'secondary',
};

export function UserSettingsIdentityCardWithPersona() {
  const { backstageIdentity, loading: profileLoading } = useUserProfile();
  const { role, loading: roleLoading } = usePersonaRole();

  if (profileLoading) {
    return (
      <InfoCard title="Backstage Identity">
        <Typography>Loading identity...</Typography>
      </InfoCard>
    );
  }

  if (!backstageIdentity) {
    return (
      <InfoCard title="Backstage Identity">
        <Typography>No Backstage Identity</Typography>
      </InfoCard>
    );
  }

  const roleLabel = ROLE_LABELS[role] ?? 'None';
  const roleColor = ROLE_COLORS[role] ?? 'default';

  return (
    <InfoCard title="Backstage Identity">
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            User Entity:{' '}
            <EntityRefLinks entityRefs={[backstageIdentity.userEntityRef]} />
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom>
            Ownership Entities:{' '}
            <EntityRefLinks entityRefs={backstageIdentity.ownershipEntityRefs} />
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" alignItems="center" gridGap={8} mt={0.5}>
            <Typography variant="subtitle1">
              MTA Persona:
            </Typography>
            {roleLoading ? (
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
        </Grid>
      </Grid>
    </InfoCard>
  );
}
