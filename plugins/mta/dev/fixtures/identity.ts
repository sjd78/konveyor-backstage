/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
