import Grid from '@material-ui/core/Grid';
import { Content } from '@backstage/core-components';
import {
  UserSettingsProfileCard,
  UserSettingsAppearanceCard,
} from '@backstage/plugin-user-settings';
import { UserSettingsIdentityCardWithPersona } from './UserSettingsIdentityCardWithPersona';
import { MtaPersonaCard } from '@internal/backstage-plugin-mta';

export function UserSettingsGeneralWithMta() {
  return (
    <Content>
      <Grid container direction="row" spacing={3}>
        <Grid item xs={12} md={6}>
          <UserSettingsProfileCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <UserSettingsAppearanceCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <UserSettingsIdentityCardWithPersona />
        </Grid>
        <Grid item xs={12} md={6}>
          <MtaPersonaCard />
        </Grid>
      </Grid>
    </Content>
  );
}
