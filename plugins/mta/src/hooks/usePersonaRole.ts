import { useEffect, useState } from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';

export type PersonaRole = 'architect' | 'developer' | 'unknown';

export function usePersonaRole(): PersonaRole {
  const identityApi = useApi(identityApiRef);
  const [role, setRole] = useState<PersonaRole>('unknown');

  useEffect(() => {
    let cancelled = false;
    identityApi
      .getBackstageIdentity()
      .then(identity => {
        if (cancelled) return;
        const groups = identity.ownershipEntityRefs;
        if (groups.includes('group:default/mta-architects')) {
          setRole('architect');
        } else if (groups.includes('group:default/mta-developers')) {
          setRole('developer');
        } else {
          setRole('unknown');
        }
      })
      .catch(() => {
        if (!cancelled) setRole('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [identityApi]);

  return role;
}
