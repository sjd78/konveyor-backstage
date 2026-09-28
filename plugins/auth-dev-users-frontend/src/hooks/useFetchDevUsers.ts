import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  useApi,
} from '@backstage/core-plugin-api';

export interface DevUser {
  userEntityRef: string;
  displayName: string;
}

/**
 * Fetches the list of selectable dev users from the `auth` backend plugin's
 * `/dev-users` endpoint, falling back to `defaultUsers` until the request
 * resolves (or if it fails).
 */
export function useFetchDevUsers(
  defaultUsers: DevUser[],
) {
  const discoveryApi = useApi(discoveryApiRef);
  const [error, setError] = useState<string>();
  const [users, setUsers] = useState<DevUser[]>(defaultUsers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const base = await discoveryApi.getBaseUrl('auth');
        const res = await fetch(`${base}/dev-users`);
        if (!res.ok) {
          throw new Error(`Failed to load dev users: ${res.statusText}`);
        }
        const data: { users: DevUser[] } = await res.json();
        if (!cancelled && data.users?.length > 0) {
          setUsers(data.users);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [discoveryApi]);

  return { users, error, loading };
}
