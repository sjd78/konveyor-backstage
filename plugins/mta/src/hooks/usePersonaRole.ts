import { useEffect, useState } from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';

export type PersonaRole = 'architect' | 'developer' | 'unknown';

export interface PersonaRoleState {
  role: PersonaRole;
  loading: boolean;
}

export function usePersonaRole(): PersonaRoleState {
  const identityApi = useApi(identityApiRef);
  const [state, setState] = useState<PersonaRoleState>({
    role: 'unknown',
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        if (cancelled) return;
        const groups = identity.ownershipEntityRefs;
        if (groups.includes('group:default/mta-architects')) {
          setState({ role: 'architect', loading: false });
        } else if (groups.includes('group:default/mta-developers')) {
          setState({ role: 'developer', loading: false });
        } else {
          setState({ role: 'unknown', loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ role: 'unknown', loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [identityApi]);

  return state;
}
