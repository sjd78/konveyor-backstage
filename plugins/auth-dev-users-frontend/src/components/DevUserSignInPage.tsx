import { useState } from 'react';
import { Header, Content, Page, WarningPanel, ContentHeader } from '@backstage/core-components';
import { configApiRef, discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import type { SignInPageProps } from '@backstage/plugin-app-react';
import { Card, CardHeader, CardBody, Flex, Text, Badge } from "@backstage/ui";

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
          {user.memberOf && user.memberOf.length > 0 && (
            <Flex gap="xs" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
              {user.memberOf.map(group => (
                <Badge key={group.groupEntityRef} size="small">
                  {group.displayName}
                </Badge>
              ))}
            </Flex>
          )}
        </CardBody>
    </Card>
  );
};

export function DevUserSignInPage({ onSignInSuccess }: SignInPageProps) {
  const configApi = useApi(configApiRef);
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
      <Header title={configApi.getString('app.title')} />

      {showError && (
        <WarningPanel title={`Error: ${showError}`} />
      )}

      <Content>
        <ContentHeader title="Select a Dev User" />

        {loading ? (
          <Flex direction="column">
            <Flex align="center" justify="center">
              <Text>Loading...</Text>
            </Flex>
          </Flex>
        ) : (
          <Flex justify="center" style={{ flexWrap: 'wrap', maxWidth: '1150px', margin: '0 auto' }}>
          {users.map(user => (
            <DevUserCard key={user.userEntityRef} user={user} signingIn={signingIn} onSelect={() => handleSelect(user)} />
          ))}
          </Flex>
        )}
      </Content>
    </Page>
  );
}
