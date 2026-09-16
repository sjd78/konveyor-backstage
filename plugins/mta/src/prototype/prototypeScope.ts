/*
 * PROTOTYPE ONLY — Scope selector state (core / agentic / experience / enhancements).
 *
 * Controls which DTUX ticket scope the prototype is previewing.
 * Has no production equivalent — remove when the prototype is promoted.
 */
import { useSyncExternalStore } from 'react';

export type PrototypeScopeId =
  | 'core'
  | 'agentic'
  | 'experience'
  | 'enhancements';

const STORAGE_KEY = 'mta-prototype-view';
const VALID_IDS: readonly string[] = [
  'core',
  'agentic',
  'experience',
  'enhancements',
];

function getSnapshot(): PrototypeScopeId {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && VALID_IDS.includes(val)) return val as PrototypeScopeId;
  } catch {
    /* noop */
  }
  return 'core';
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

export function usePrototypeScope(): PrototypeScopeId {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => 'core' as PrototypeScopeId,
  );
}

export function setPrototypeScope(id: PrototypeScopeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* noop */
  }
  window.dispatchEvent(
    new StorageEvent('storage', { key: STORAGE_KEY, newValue: id }),
  );
}
