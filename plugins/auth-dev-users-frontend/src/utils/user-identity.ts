import { IdentityApi, ProfileInfo, BackstageUserIdentity, DiscoveryApi } from "@backstage/core-plugin-api";
import { DevUser } from '../hooks/useFetchDevUsers';

export class DevUserIdentity implements IdentityApi {
  private session: SessionResponse;
  private refreshPromise: Promise<SessionResponse> | null = null;
  private readonly discoveryApi: DiscoveryApi;
  private readonly userEntityRef: string;

  constructor(
    session: SessionResponse,
    discoveryApi: DiscoveryApi,
    userEntityRef: string,
  ) {
    this.session = session;
    this.discoveryApi = discoveryApi;
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
    try {
      sessionStorage.clear();
    } catch {
      /* noop */
    }
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
    const base = await this.discoveryApi.getBaseUrl('auth');
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

export interface SessionResponse {
  profile: ProfileInfo;
  backstageIdentity: {
    token: string;
    identity: BackstageUserIdentity;
  };
}

export const signInDevUser = async (user: DevUser, discoveryApi: DiscoveryApi) => {
  let session: SessionResponse | undefined = undefined;

  try {
    const baseUrl = await discoveryApi.getBaseUrl('auth');
    const res = await fetch(`${baseUrl}/guest/refresh`, {
      headers: {
        'X-User-Entity-Ref': user.userEntityRef,
      },
    });
    if (!res.ok) throw new Error(res.statusText);
    session = await res.json();
  } catch (err: unknown) {
    throw new Error(`Sign-in failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!session) throw new Error('Sign-in failed: No session received');

  const identity = new DevUserIdentity(
    session,
    discoveryApi,
    user.userEntityRef,
  );
  return identity;
};