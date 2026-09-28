import { useState } from 'react';
import { discoveryApiRef, useApi } from '@backstage/core-plugin-api';
import type { SignInPageProps } from '@backstage/plugin-app-react';
import { signInDevUser } from '../utils/user-identity';
import { useFetchDevUsers, DevUser } from '../hooks/useFetchDevUsers';

const DEFAULT_USERS: DevUser[] = [
  { userEntityRef: 'user:default/guest', displayName: 'Guest' },
];

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 24,
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      background: '#f5f5f5',
    }}>
      <h2 style={{ margin: 0 }}>Sign in as a dev user</h2>
      <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
        Select a persona to explore the app with different roles.
      </p>

      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {users.map(user => (
          <button
            key={user.userEntityRef}
            disabled={signingIn}
            onClick={() => handleSelect(user)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 32px',
              border: '1px solid #ddd',
              borderRadius: 8,
              background: '#fff',
              cursor: signingIn ? 'wait' : 'pointer',
              opacity: signingIn ? 0.7 : 1,
              minWidth: 180,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              transition: 'box-shadow 0.2s, transform 0.2s',
              fontSize: 14,
            }}
            onMouseOver={e => {
              if (!signingIn) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
            }}
            onFocus={e => {
              if (!signingIn) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }
            }}
            onBlur={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'none';
            }}
          >
            <span style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#1976d2',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 600,
            }}>
              {user.displayName.charAt(0).toUpperCase()}
            </span>
            <span style={{ fontWeight: 500 }}>{user.displayName}</span>
            <span style={{ fontSize: 12, color: '#999' }}>
              {user.userEntityRef}
            </span>
          </button>
        ))}
      </div>

      {(error || fetchError) && (
        <p style={{ color: '#d32f2f', fontSize: 14 }}>{error || fetchError}</p>
      )}
    </div>
  );
}
