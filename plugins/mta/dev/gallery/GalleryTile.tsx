import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  configApiRef,
  identityApiRef,
  type ConfigApi,
  type IdentityApi,
} from '@backstage/core-plugin-api';
import { TestApiProvider } from '@backstage/frontend-test-utils';
import { catalogApiRef, EntityProvider } from '@backstage/plugin-catalog-react';
import { mtaApiRef, type MtaApi } from '../../src/api';
import { MigrationTab } from '../../src/components/MigrationTab';
import { MtaHomeSection } from '../../src/components/MtaHomeCards';
import { MtaPersonaCard } from '../../src/components/MtaPersonaCard';
import { MigrationStatusChip } from '../../src/components/MigrationStatusChip';
import { SeverityChip } from '../../src/components/shared/SeverityChip';
import type { IssueSeverity, MigrationStatus } from '../../src/types';
import {
  createCatalog,
  createFailingCatalog,
  createMigrationEntity,
  type CatalogApi,
} from '../fixtures/catalog';
import { DEFAULT_CONFIG } from '../fixtures/config';
import { createIdentity, createPendingIdentity } from '../fixtures/identity';
import { createMtaApi } from '../fixtures/mtaApi';
import type {
  CustomGalleryState,
  GalleryApiOverrides,
  GalleryState,
  HomeGalleryState,
  MigrationGalleryState,
  PersonaGalleryState,
} from './states';
import styles from './GalleryPage.module.css';

const STATUS_VALUES: MigrationStatus[] = [
  'Not Started',
  'Discovery',
  'Path Selection',
  'Analysis',
  'Analysis Unavailable',
  'Active',
  'Failed',
];

const SEVERITY_VALUES: IssueSeverity[] = ['critical', 'major', 'minor', 'info'];

/** The API pair shape `TestApiProvider` takes, for a list built at runtime. */
type TileApiPairs = ComponentProps<typeof TestApiProvider>['apis'];

type TileApiPair =
  | readonly [typeof configApiRef, ConfigApi]
  | readonly [typeof mtaApiRef, MtaApi]
  | readonly [typeof identityApiRef, IdentityApi]
  | readonly [typeof catalogApiRef, CatalogApi];

/**
 * Applies a tile's API overrides inside the providers its kind sets up, so an
 * override replaces the API it names and leaves the rest alone. Every tile
 * gets a configuration here: its own, or the empty default.
 */
function ApiOverrides({
  apis,
  children,
}: {
  apis?: GalleryApiOverrides;
  children: ReactNode;
}) {
  const pairs: TileApiPair[] = [[configApiRef, apis?.config ?? DEFAULT_CONFIG]];
  if (apis?.mtaApi) {
    pairs.push([mtaApiRef, apis.mtaApi]);
  }
  if (apis?.identity) {
    pairs.push([identityApiRef, apis.identity]);
  }
  if (apis?.catalogApi) {
    pairs.push([catalogApiRef, apis.catalogApi]);
  }
  return (
    // `TestApiProvider` takes a variadic tuple; this list is built at runtime.
    <TestApiProvider apis={pairs as unknown as TileApiPairs}>
      {children}
    </TestApiProvider>
  );
}

function MigrationState({ state }: { state: MigrationGalleryState }) {
  const [api] = useState(() => createMtaApi(state.scenario.api));
  const [identity] = useState(() => createIdentity(state.scenario.persona));
  const [entity] = useState(() =>
    createMigrationEntity(state.scenario.annotation),
  );
  return (
    <EntityProvider entity={entity}>
      <TestApiProvider
        apis={[
          [mtaApiRef, api],
          [identityApiRef, identity],
        ]}
      >
        <ApiOverrides apis={state.apis}>
          <MigrationTab />
        </ApiOverrides>
      </TestApiProvider>
    </EntityProvider>
  );
}

function HomeState({ state }: { state: HomeGalleryState }) {
  const [api] = useState(() => createMtaApi(state.scenario.api));
  const [identity] = useState(() =>
    state.scenario.pendingIdentity
      ? createPendingIdentity()
      : createIdentity(state.scenario.persona),
  );
  const [catalog] = useState(() =>
    state.scenario.catalogError
      ? createFailingCatalog(state.scenario.catalogError)
      : createCatalog(state.scenario.entities),
  );
  return (
    <TestApiProvider
      apis={[
        [mtaApiRef, api],
        [identityApiRef, identity],
        [catalogApiRef, catalog],
      ]}
    >
      <ApiOverrides apis={state.apis}>
        <MtaHomeSection />
      </ApiOverrides>
    </TestApiProvider>
  );
}

function PersonaState({ state }: { state: PersonaGalleryState }) {
  const [identity] = useState(() => createIdentity(state.persona));
  return (
    <TestApiProvider apis={[[identityApiRef, identity]]}>
      <ApiOverrides apis={state.apis}>
        <MtaPersonaCard />
      </ApiOverrides>
    </TestApiProvider>
  );
}

function CustomState({ state }: { state: CustomGalleryState }) {
  return <ApiOverrides apis={state.apis}>{state.render()}</ApiOverrides>;
}

function StatusChips() {
  return (
    <div className={styles.chips}>
      {STATUS_VALUES.map(status => (
        <MigrationStatusChip key={status} status={status} />
      ))}
    </div>
  );
}

function SeverityChips() {
  return (
    <div className={styles.chips}>
      {SEVERITY_VALUES.map(severity => (
        <SeverityChip key={severity} severity={severity} />
      ))}
      <SeverityChip severity="minor" label="Custom label" />
    </div>
  );
}

function StateBody({ state }: { state: GalleryState }) {
  switch (state.kind) {
    case 'migration':
      return <MigrationState state={state} />;
    case 'home':
      return <HomeState state={state} />;
    case 'persona':
      return <PersonaState state={state} />;
    case 'custom':
      return <CustomState state={state} />;
    case 'status-chips':
      return <StatusChips />;
    case 'severity-chips':
      return <SeverityChips />;
    default:
      return null;
  }
}

/** One state tile: ID, name, trigger and the real component. */
export function GalleryTile({ state }: { state: GalleryState }) {
  return (
    <section
      className={styles.tile}
      id={state.id}
      data-gallery-state={state.id}
    >
      <h3 className={styles.tileTitle}>
        <code className={styles.tileId}>{state.id}</code>
        <span>{state.name}</span>
      </h3>
      <p className={styles.tileTrigger}>{state.trigger}</p>
      <div className={styles.tileBody}>
        <StateBody state={state} />
      </div>
    </section>
  );
}
