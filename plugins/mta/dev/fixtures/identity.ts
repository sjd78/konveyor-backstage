import type {
  BackstageUserIdentity,
  IdentityApi,
} from '@backstage/core-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';
import type { PersonaRole } from '../../src/hooks/usePersonaRole';

/** Persona groups `usePersonaRole` checks, in its order of precedence. */
const PERSONA_GROUPS: Record<PersonaRole, string | undefined> = {
  architect: 'group:default/mta-architects',
  developer: 'group:default/mta-developers',
  unknown: undefined,
};

/** User refs the home card queries for when the persona is a developer. */
export const PERSONA_USER_REFS: Record<PersonaRole, string> = {
  architect: 'user:default/mta-architect',
  developer: 'user:default/mta-developer',
  unknown: 'user:default/mta-guest',
};

/** An identity in exactly one persona group, or in neither for unknown. */
export function createIdentity(persona: PersonaRole): IdentityApi {
  const userEntityRef = PERSONA_USER_REFS[persona];
  const group = PERSONA_GROUPS[persona];
  return mockApis.identity({
    userEntityRef,
    ownershipEntityRefs: group ? [userEntityRef, group] : [userEntityRef],
  });
}

/** An identity whose first request never resolves, for the loading state. */
export function createPendingIdentity(): IdentityApi {
  return {
    getBackstageIdentity: () => new Promise<BackstageUserIdentity>(() => {}),
    getCredentials: async () => ({}),
    getProfileInfo: async () => ({}),
    signOut: async () => {},
  };
}
