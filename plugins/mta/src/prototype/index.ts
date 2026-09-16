/*
 * PROTOTYPE ONLY — barrel export for all prototype infrastructure.
 *
 * Everything under src/prototype/ exists solely for the stakeholder
 * prototype's scope switcher, persona toggle, and phase override system.
 * None of this code has a production equivalent in real MTA.
 *
 * To remove the prototype overlay:
 *   1. Delete this entire src/prototype/ directory
 *   2. Remove prototype imports from MigrationTab, MtaHomeCards,
 *      PhaseDiscovery, PhasePathSelection, PhaseActive, MigrationStatusChip
 *   3. Remove mountGlobalScopeBar() from plugin.ts
 *   4. Replace usePersona() calls with real RBAC
 *   5. Replace useGlobalPhase()/advancePhase() with real MTA API status
 */

export {
  useGlobalPhase,
  setGlobalPhase,
  getPhaseGeneration,
  resetPhaseGeneration,
  getEntityPhase,
  setEntityPhase,
  clearEntityPhases,
  useEntityPhasesVersion,
  resolveEntityPhase,
  advancePhase,
} from './prototypePhaseState';
export type { PhaseResolution } from './prototypePhaseState';

export {
  usePersona,
  setPersona,
} from './prototypePersona';

export {
  usePrototypeScope,
  setPrototypeScope,
} from './prototypeScope';
export type { PrototypeScopeId } from './prototypeScope';
