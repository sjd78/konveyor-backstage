/*
 * PROTOTYPE ONLY — The dark toolbar at the top of the page.
 *
 * Mounts itself as a separate React root (outside the Backstage tree)
 * and communicates with production components via localStorage events.
 * See src/prototype/index.ts for removal instructions.
 */
import React, { useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import {
  usePrototypeScope,
  setPrototypeScope,
  type PrototypeScopeId,
} from './prototypeScope';
import { usePersona, setPersona as setGlobalPersona } from './prototypePersona';
import {
  useGlobalPhase,
  setGlobalPhase,
  getEntityPhase,
  setEntityPhase,
  clearEntityPhases,
  resetPhaseGeneration,
  useEntityPhasesVersion,
} from './prototypePhaseState';
import type { MigrationStatus } from '../types';

export const PROTOTYPE_SCOPE_BAR_HEIGHT = 28;

const DTUX_ISSUE_BASE_URL = 'https://redhat.atlassian.net/browse/DTUX-';

interface ScopeOption {
  id: PrototypeScopeId;
  label: string;
  ticketIds: string[];
}

const SCOPE_OPTIONS: ScopeOption[] = [
  { id: 'core', label: 'MTA 8.3 (Current)', ticketIds: ['2888', '2890', '2901', '2911', '2925', '3071'] },
  { id: 'agentic', label: 'Agentic Workflow', ticketIds: ['2892'] },
  { id: 'experience', label: 'Dev & Architect Experience', ticketIds: ['2906', '2907'] },
  { id: 'enhancements', label: 'Feature Exploration', ticketIds: ['2908'] },
];

const SCOPE_PHASES: Record<PrototypeScopeId, MigrationStatus[]> = {
  core: ['Not Started', 'Discovery', 'Path Selection', 'Analysis', 'Active', 'Failed'],
  agentic: ['Not Started', 'Discovery', 'Path Selection', 'Analysis', 'Active', 'Post-remediation', 'Failed'],
  experience: ['Not Started', 'Discovery', 'Path Selection', 'Analysis', 'Active', 'Post-remediation', 'Failed'],
  enhancements: ['Not Started', 'Discovery', 'Path Selection', 'Analysis', 'Active', 'Post-remediation', 'Completed', 'Failed'],
};

const ERROR_TYPE_OPTIONS = [
  { value: '', label: 'Generic error' },
  { value: 'no-archetype-match', label: 'No matching application type' },
  { value: 'repo-access-denied', label: 'Repository access denied' },
];

const S = {
  bar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    height: PROTOTYPE_SCOPE_BAR_HEIGHT,
    minHeight: PROTOTYPE_SCOPE_BAR_HEIGHT,
    padding: '0 16px',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
    backgroundColor: '#1b1d21',
    color: '#fff',
    flexShrink: 0,
    boxSizing: 'border-box' as const,
    width: '100%',
    zIndex: 10000,
    fontFamily: '"Red Hat Text", "Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 11,
  },
  label: {
    fontSize: 11,
    lineHeight: 1,
    color: 'rgba(255,255,255,0.7)',
    whiteSpace: 'nowrap' as const,
  },
  select: {
    height: 20,
    fontSize: 11,
    lineHeight: 1,
    color: '#fff',
    backgroundColor: '#2b2d31',
    border: '1px solid rgba(255,255,255,0.23)',
    borderRadius: 3,
    padding: '1px 6px',
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  link: {
    color: '#90caf9',
    textDecoration: 'underline' as const,
    textUnderlineOffset: '2px',
    fontSize: 11,
  },
  ticketGroup: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    whiteSpace: 'nowrap' as const,
  },
  resetBtn: {
    marginLeft: 16,
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    backgroundColor: 'transparent',
    fontSize: 11,
    padding: '1px 8px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

function TicketLinks({ ticketIds }: { ticketIds: string[] }) {
  return (
    <span style={S.ticketGroup}>
      {ticketIds.map((id, i) => (
        <React.Fragment key={id}>
          {i > 0 && ', '}
          <a
            href={`${DTUX_ISSUE_BASE_URL}${id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={S.link}
            onClick={e => e.stopPropagation()}
            aria-label={`Open DTUX-${id} in a new tab`}
          >
            {id}
          </a>
        </React.Fragment>
      ))}
    </span>
  );
}

function currentEntityRefFromUrl(): string | null {
  const match = window.location.pathname.match(
    /\/catalog\/([^/]+)\/([^/]+)\/([^/]+)/,
  );
  if (!match) return null;
  const [, namespace, kind, name] = match;
  return `${kind}:${namespace}/${name}`;
}

export function PrototypeScopeSwitcher() {
  const scope = usePrototypeScope();
  const persona = usePersona();
  const globalPhase = useGlobalPhase();
  useEntityPhasesVersion();
  const phaseOptions = SCOPE_PHASES[scope];

  const entityRef = currentEntityRefFromUrl();
  const entityPhase = entityRef ? getEntityPhase(entityRef) : null;
  const displayedPhase = entityRef
    ? entityPhase ?? 'Not Started'
    : globalPhase;

  const handlePhaseChange = useCallback((newPhase: MigrationStatus) => {
    setGlobalPhase(newPhase);
    const entityRef = currentEntityRefFromUrl();
    if (entityRef) {
      setEntityPhase(entityRef, newPhase);
      window.dispatchEvent(
        new CustomEvent('mta-phase-override', {
          detail: { entityRef, phase: newPhase },
        }),
      );
    }
    if (newPhase === 'Failed') {
      window.dispatchEvent(
        new CustomEvent('mta-error-type-override', { detail: { errorType: '', errorMessage: '' } }),
      );
    }
  }, []);

  const handleErrorTypeChange = useCallback((errorType: string) => {
    const messages: Record<string, string> = {
      '': 'The analysis engine encountered an error. Try again or contact your administrator.',
      'no-archetype-match': 'Discovery found technologies that do not match any configured application type. The enterprise architecture team may need to add a new type for this technology stack.',
      'repo-access-denied': 'The migration service cannot access this repository. Verify that the repository URL is correct and the required access tokens are configured.',
    };
    window.dispatchEvent(
      new CustomEvent('mta-error-type-override', {
        detail: { errorType, errorMessage: messages[errorType] ?? messages[''] },
      }),
    );
  }, []);

  const handleReset = useCallback(() => {
    sessionStorage.removeItem('mta-store-state');
    clearEntityPhases();
    resetPhaseGeneration();
    try { localStorage.setItem('mta-global-phase', 'Not Started'); } catch { /* noop */ }
    window.location.reload();
  }, []);

  useEffect(() => {
    const h = PROTOTYPE_SCOPE_BAR_HEIGHT;
    const style = document.createElement('style');
    style.id = 'prototype-scope-bar-offset';
    style.textContent = `#rhdh-above-sidebar-header-container { padding-top: ${h}px !important; }`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const currentOption = SCOPE_OPTIONS.find(o => o.id === scope) ?? SCOPE_OPTIONS[0];

  return (
    <div style={S.bar} role="banner" aria-label="Prototype scope" data-prototype-slot>
      <span style={S.label}>Prototype scope</span>
      <select
        value={scope}
        onChange={e => setPrototypeScope(e.target.value as PrototypeScopeId)}
        style={{ ...S.select, minWidth: 180 }}
        aria-label="Prototype scope view"
      >
        {SCOPE_OPTIONS.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <TicketLinks ticketIds={currentOption.ticketIds} />

      <span style={{ ...S.label, marginLeft: 12 }}>Persona</span>
      <select
        value={persona}
        onChange={e => setGlobalPersona(e.target.value as 'architect' | 'developer')}
        style={{ ...S.select, minWidth: 140 }}
        aria-label="Persona"
      >
        <option value="architect">Application Architect</option>
        <option value="developer">Corporate Developer</option>
      </select>

      <span style={{ ...S.label, marginLeft: 12 }}>State</span>
      <select
        value={phaseOptions.includes(displayedPhase) ? displayedPhase : phaseOptions[0]}
        onChange={e => handlePhaseChange(e.target.value as MigrationStatus)}
        style={{ ...S.select, minWidth: 100 }}
        aria-label="Migration state"
      >
        {phaseOptions.map(phase => (
          <option key={phase} value={phase}>{phase}</option>
        ))}
      </select>

      {displayedPhase === 'Failed' && (
        <>
          <span style={{ ...S.label, marginLeft: 8 }}>Error type</span>
          <select
            onChange={e => handleErrorTypeChange(e.target.value)}
            style={{ ...S.select, minWidth: 160 }}
            aria-label="Error type"
          >
            {ERROR_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </>
      )}

      <button onClick={handleReset} style={S.resetBtn}>Reset demo</button>
    </div>
  );
}

let _mounted = false;
export function mountGlobalScopeBar() {
  if (_mounted) return;
  if (typeof document === 'undefined') return;
  _mounted = true;
  const el = document.createElement('div');
  el.id = 'mta-scope-bar-root';
  document.body.prepend(el);
  ReactDOM.createRoot(el).render(<PrototypeScopeSwitcher />);
}
