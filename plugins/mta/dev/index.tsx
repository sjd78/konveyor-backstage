import { createDevApp } from '@backstage/frontend-dev-utils';

import plugin from '../src';
import galleryPlugin from './gallery/plugin';

// The dev app has no home content of its own, so land on the state gallery.
if (window.location.pathname === '/') {
  window.history.replaceState(
    null,
    '',
    `/gallery${window.location.search}${window.location.hash}`,
  );
}

createDevApp({ features: [plugin, galleryPlugin] });
