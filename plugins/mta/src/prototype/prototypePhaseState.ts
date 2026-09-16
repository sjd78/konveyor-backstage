/*
 * PROTOTYPE ONLY — Scope-switcher phase state management.
 *
 * Manages the global phase, per-entity phase overrides, and the generation
 * counter that lets components distinguish "page loaded with default phase"
 * from "user explicitly changed the phase via the switcher."
 *
 * Everything in src/prototype/ exists solely for the stakeholder prototype
 * and should be removed (or replaced with real MTA API calls) when the
 * prototype is promoted to production.
 */
import { useSyncExternalStore } from 'react';
import type { MigrationStatus, MtaApplication } from '../types';

const STORAGE_KEY = 'mta-global-phase';
const ENTITY_PHASES_KEY = 'mta-entity-phases';
const GENERATION_KEY = 'mta-phase-generation';
const VALID: readonly string[] = [
  'Not Started', 'Discovery', 'Path Selection', 'Analysis', 'Active', 'Post-remediation', 'Completed', 'Failed',
];

// ---------------------------------------------------------------------------
// Global phase — reactive hook + setter
// ---------------------------------------------------------------------------

function getSnapshot(): MigrationStatus {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && VALID.includes(val)) return val as MigrationStatus;
  } catch { /* noop */ }
  return 'Not Started';
}

function subscribe(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener('storage', handler);
  const interval = setInterval(cb, 500);
  return () => {
    window.removeEventListener('storage', handler);
    clearInterval(interval);
  };
}

export function useGlobalPhase(): MigrationStatus {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'Not Started' as MigrationStatus);
}

export function setGlobalPhase(s: MigrationStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, s);
  } catch { /* noop */ }
  try {
    const gen = (parseInt(localStorage.getItem(GENERATION_KEY) || '0', 10) || 0) + 1;
    localStorage.setItem(GENERATION_KEY, String(gen));
  } catch { /* noop */ }
  window.dispatchEvent(
    new StorageEvent('storage', { key: STORAGE_KEY, newValue: s }),
  );
}

// ---------------------------------------------------------------------------
// Generation counter — distinguishes default from user-explicit changes
// ---------------------------------------------------------------------------

export function getPhaseGeneration(): number {
  try {
    return parseInt(localStorage.getItem(GENERATION_KEY) || '0', 10) || 0;
  } catch { return 0; }
}

export function resetPhaseGeneration(): void {
  try {
    localStorage.removeItem(GENERATION_KEY);
  } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Per-entity phase overrides
// ---------------------------------------------------------------------------

export function getEntityPhase(entityRef: string): MigrationStatus | null {
  try {
    const raw = localStorage.getItem(ENTITY_PHASES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const val = map[entityRef];
    if (val && VALID.includes(val)) return val as MigrationStatus;
  } catch { /* noop */ }
  return null;
}

export function setEntityPhase(entityRef: string, status: MigrationStatus): void {
  try {
    const raw = localStorage.getItem(ENTITY_PHASES_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[entityRef] = status;
    localStorage.setItem(ENTITY_PHASES_KEY, JSON.stringify(map));
  } catch { /* noop */ }
  window.dispatchEvent(
    new StorageEvent('storage', { key: ENTITY_PHASES_KEY }),
  );
}

export function clearEntityPhases(): void {
  try {
    localStorage.removeItem(ENTITY_PHASES_KEY);
  } catch { /* noop */ }
  window.dispatchEvent(
    new StorageEvent('storage', { key: ENTITY_PHASES_KEY }),
  );
}

// ---------------------------------------------------------------------------
// Reactive entity-phases hook (PrototypeScopeSwitcher re-renders on changes)
// ---------------------------------------------------------------------------

function getEntityPhasesSnapshot(): string {
  return localStorage.getItem(ENTITY_PHASES_KEY) || '{}';
}

function subscribeEntityPhases(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === ENTITY_PHASES_KEY) cb();
  };
  window.addEventListener('storage', handler);
  const interval = setInterval(cb, 500);
  return () => {
    window.removeEventListener('storage', handler);
    clearInterval(interval);
  };
}

export function useEntityPhasesVersion(): string {
  return useSyncExternalStore(subscribeEntityPhases, getEntityPhasesSnapshot, () => '{}');
}

// ---------------------------------------------------------------------------
// High-level helpers for production components
// ---------------------------------------------------------------------------

export interface PhaseResolution {
  shouldUpdate: boolean;
  phase: MigrationStatus;
  nextGen: number;
}

/**
 * Decides whether to override an entity's stored phase with the switcher's
 * globalPhase. Call from MigrationTab's mount effect.
 *
 * @param entityRef   - the entity being viewed
 * @param existingApp - null if the entity was just created by ensureApplication
 * @param globalPhase - current switcher value
 * @param lastGen     - the generation value from the previous render (pass -1 on first mount)
 */
export function resolveEntityPhase(
  entityRef: string,
  existingApp: MtaApplication | undefined,
  globalPhase: MigrationStatus,
  lastGen: number,
): PhaseResolution {
  const isNewApp = !existingApp;
  const gen = getPhaseGeneration();
  const isFirstMount = lastGen === -1;
  const isUserDriven = gen > 0 && gen !== lastGen;

  if (isNewApp || isFirstMount || isUserDriven) {
    setEntityPhase(entityRef, globalPhase);
    return { shouldUpdate: true, phase: globalPhase, nextGen: gen };
  }

  if (getEntityPhase(entityRef) === null && existingApp) {
    setEntityPhase(entityRef, existingApp.status);
  }

  return { shouldUpdate: false, phase: globalPhase, nextGen: gen };
}

/**
 * Advances an entity to a new phase — updates both the per-entity override
 * and the global switcher value. Call from phase CTA handlers
 * (e.g. "Start discovery", "Run analysis").
 */
export function advancePhase(entityRef: string, phase: MigrationStatus): void {
  setEntityPhase(entityRef, phase);
  setGlobalPhase(phase);
}
