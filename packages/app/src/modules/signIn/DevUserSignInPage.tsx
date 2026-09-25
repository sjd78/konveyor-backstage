import { useState } from 'react';
import {
  discoveryApiRef,
  useApi,
  configApiRef,
} from '@backstage/core-plugin-api';
import type { SignInPageProps } from '@backstage/plugin-app-react';
import type { IdentityApi, ProfileInfo, BackstageUserIdentity } from '@backstage/core-plugin-api';

// ── Types ──────────────────────────────────────────────────────────────
interface DevUser {
  userEntityRef: string;
  displayName: string;
}

interface SessionResponse {
  profile: ProfileInfo;
  backstageIdentity: {
    token: string;
    identity: BackstageUserIdentity;
  };
}

// ── Lightweight IdentityApi backed by the guest /refresh endpoint ─────
class DevUserIdentity implements IdentityApi {
  private session: SessionResponse;
  private refreshPromise: Promise<SessionResponse> | null = null;
  private readonly discoveryBaseUrl: Promise<string>;
  private readonly userEntityRef: string;

  constructor(
    session: SessionResponse,
    discoveryBaseUrl: Promise<string>,
    userEntityRef: string,
  ) {
    this.session = session;
    this.discoveryBaseUrl = discoveryBaseUrl;
    this.userEntityRef = userEntityRef;
  }

  getUserId(): string {
    const ref = this.session.backstageIdentity.identity.userEntityRef;
    const match = /^([^:/]+:)?([^:/]+\/)?([^:/]+)$/.exec(ref);
    if (!match) throw new TypeError(`Invalid user entity reference "${ref}"`);
    return match[3];
  }

  async getIdToken(): Promise<string | undefined> {
    const s = await this.ensureFresh();
    return s.backstageIdentity.token;
  }

  getProfile(): ProfileInfo {
    return this.session.profile;
  }

  async getProfileInfo(): Promise<ProfileInfo> {
    const s = await this.ensureFresh();
    return s.profile;
  }

  async getBackstageIdentity(): Promise<BackstageUserIdentity> {
    const s = await this.ensureFresh();
    return s.backstageIdentity.identity;
  }

  async getCredentials(): Promise<{ token?: string }> {
    const s = await this.ensureFresh();
    return { token: s.backstageIdentity.token };
  }

  async signOut(): Promise<void> {
    /* dev-only: no-op */
  }

  private async ensureFresh(): Promise<SessionResponse> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.fetchSession().then(s => {
      this.session = s;
      this.refreshPromise = null;
      return s;
    });
    return this.refreshPromise;
  }

  private async fetchSession(): Promise<SessionResponse> {
    const base = await this.discoveryBaseUrl;
    const res = await fetch(`${base}/guest/refresh`, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-User-Entity-Ref': this.userEntityRef,
      },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Auth refresh failed: ${res.statusText}`);
    return res.json();
  }
}

// ── Sign-in page component ────────────────────────────────────────────
export function DevUserSignInPage({ onSignInSuccess }: SignInPageProps) {
  const discoveryApi = useApi(discoveryApiRef);
  const configApi = useApi(configApiRef);
  const [error, setError] = useState<string>();
  const [signingIn, setSigningIn] = useState(false);

  const usersConfig = configApi.getOptionalConfigArray('auth.providers.guest.users') ?? [];
  const users: DevUser[] = usersConfig.map(c => ({
    userEntityRef: c.getString('userEntityRef'),
    displayName: c.getOptionalString('displayName') ?? c.getString('userEntityRef'),
  }));

  if (users.length === 0) {
    users.push(
      { userEntityRef: 'user:default/guest', displayName: 'Guest' },
    );
  }

  const handleSelect = async (user: DevUser) => {
    setSigningIn(true);
    setError(undefined);
    try {
      const baseUrlPromise = discoveryApi.getBaseUrl('auth');
      const base = await baseUrlPromise;
      const res = await fetch(`${base}/guest/refresh`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-User-Entity-Ref': user.userEntityRef,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Sign-in failed: ${res.statusText}`);
      const session: SessionResponse = await res.json();

      const identity = new DevUserIdentity(
        session,
        discoveryApi.getBaseUrl('auth'),
        user.userEntityRef,
      );
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

      {error && (
        <p style={{ color: '#d32f2f', fontSize: 14 }}>{error}</p>
      )}
    </div>
  );
}
