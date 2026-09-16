/*
 * PROTOTYPE ONLY — Persona switcher state (architect vs developer).
 *
 * Real MTA has no persona concept — role-based views would come from
 * RBAC / group membership. This exists solely for the prototype switcher
 * to let stakeholders preview both experiences.
 */
import { useSyncExternalStore } from 'react';
import type { Persona } from '../types';

const STORAGE_KEY = 'mta-persona';

function getSnapshot(): Persona {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'architect' || val === 'developer') return val;
  } catch { /* noop */ }
  return 'architect';
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

export function usePersona(): Persona {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'architect' as Persona);
}

export function setPersona(p: Persona): void {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch { /* noop */ }
  window.dispatchEvent(
    new StorageEvent('storage', { key: STORAGE_KEY, newValue: p }),
  );
}
