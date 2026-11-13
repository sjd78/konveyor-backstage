import { useEffect } from 'react';
import { appThemeApiRef, useApi } from '@backstage/core-plugin-api';
import { useSearchParams } from 'react-router-dom';
import { GalleryTile } from './GalleryTile';
import { findGalleryState, GALLERY_GROUPS, GALLERY_STATE_IDS } from './states';
import styles from './GalleryPage.module.css';

function themeHref(mode: 'light' | 'dark', stateId: string | null): string {
  const params = new URLSearchParams();
  if (stateId) {
    params.set('state', stateId);
  }
  params.set('theme', mode);
  return `/gallery?${params.toString()}`;
}

/**
 * Development gallery of every plugin state, rendered through the real
 * components with fixture APIs. `/gallery?state=<id>` renders one tile and
 * `?theme=dark` or `?theme=light` switches the app theme.
 */
export function GalleryPage() {
  const [searchParams] = useSearchParams();
  const stateId = searchParams.get('state');
  const theme = searchParams.get('theme');
  const appThemeApi = useApi(appThemeApiRef);

  useEffect(() => {
    if (theme !== 'light' && theme !== 'dark') {
      return;
    }
    appThemeApi.setActiveThemeId(theme);
    // BUI reads its CSS tokens from this attribute. The dev app has no theme
    // bridge between the Backstage app theme and BUI.
    document.documentElement.dataset.themeMode = theme;
  }, [appThemeApi, theme]);

  const groups = stateId
    ? GALLERY_GROUPS.map(group => ({
        ...group,
        states: group.states.filter(state => state.id === stateId),
      })).filter(group => group.states.length > 0)
    : GALLERY_GROUPS;
  const stateCount = groups.reduce(
    (total, group) => total + group.states.length,
    0,
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>MTA state gallery</h1>
        <p className={styles.lead}>
          Every state in the state catalog, rendered through the real plugin
          components with fixture Hub, catalog and identity APIs. Add{' '}
          <code>?state=&lt;id&gt;</code> to render one tile, and{' '}
          <code>?theme=dark</code> or <code>?theme=light</code> to switch the
          app theme.
        </p>
        <div className={styles.controls}>
          <span>Theme</span>
          <a href={themeHref('light', stateId)}>light</a>
          <a href={themeHref('dark', stateId)}>dark</a>
          <span aria-hidden="true">|</span>
          <a href="/gallery">all states</a>
          <span>
            {stateCount} {stateCount === 1 ? 'state' : 'states'} shown
          </span>
        </div>
      </header>
      {stateId && !findGalleryState(stateId) && (
        <p className={styles.missing}>
          No gallery state matches {stateId}. Known states:{' '}
          {GALLERY_STATE_IDS.join(', ')}.
        </p>
      )}
      {groups.map(group => (
        <section
          className={styles.group}
          key={group.id}
          aria-labelledby={`group-${group.id}`}
        >
          <h2 className={styles.groupTitle} id={`group-${group.id}`}>
            {group.title}
          </h2>
          <p className={styles.groupDescription}>{group.description}</p>
          {group.states.map(state => (
            <GalleryTile key={state.id} state={state} />
          ))}
        </section>
      ))}
    </div>
  );
}
