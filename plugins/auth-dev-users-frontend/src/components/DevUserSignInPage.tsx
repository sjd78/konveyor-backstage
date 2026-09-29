import { useState } from 'react';
import { Header, Content, Page, WarningPanel } from '@backstage/core-components';
import { discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import type { SignInPageProps } from '@backstage/plugin-app-react';
import { Card, CardHeader, CardBody, Flex, Text } from "@backstage/ui";

import { signInDevUser } from '../utils/user-identity';
import { useFetchDevUsers, DevUser } from '../hooks/useFetchDevUsers';

const DEFAULT_USERS: DevUser[] = [
  { userEntityRef: 'user:default/guest', displayName: 'Guest' },
];

const DevUserCard = ({ user, signingIn, onSelect }: { user: DevUser, signingIn: boolean, onSelect: () => void }) => {
  return (
    <Card style={{ width: "350px" }} onPress={signingIn ? ()=>{} : onSelect} label={`Login as user ${user.displayName}`}>
        <CardHeader>
          <Text variant="title-small">{user.displayName}</Text>
        </CardHeader>
        <CardBody>
          <Text variant="body-medium">{user.userEntityRef}</Text>
        </CardBody>
    </Card>
  );
};

export function DevUserSignInPage({ onSignInSuccess }: SignInPageProps) {
  const discoveryApi = useApi(discoveryApiRef);
  const [error, setError] = useState<string>();
  const [signingIn, setSigningIn] = useState(false);
  const { users, error: fetchError, loading } = useFetchDevUsers(DEFAULT_USERS);

  const handleSelect = async (user: DevUser) => {
    setSigningIn(true);
    setError(undefined);
    try {
      const identity = await signInDevUser(user, discoveryApi);
      onSignInSuccess(identity);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSigningIn(false);
    }
  };

  const showError = error || fetchError || false;

  return (
    <Page themeId="tool">
      <Header title="Select a dev user for testing" />

      {showError && (
        <WarningPanel title={`Error: ${showError}`} />
      )}

      {loading ? (
        <Content>
          <Flex direction="column">
            <Flex align="center" justify="center">
              <Text>Loading...</Text>
            </Flex>
          </Flex>
        </Content>
      ) : (
      <Content>
        <Flex align="center" justify="center">
        {users.map(user => (
          <DevUserCard key={user.userEntityRef} user={user} signingIn={signingIn} onSelect={() => handleSelect(user)} />
        ))}
        </Flex>
      </Content>
      )}
    </Page>
  );
}
