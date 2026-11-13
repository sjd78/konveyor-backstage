import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { GalleryPage } from './GalleryPage';

/** Development-only plugin that serves the state gallery at `/gallery`. */
export const galleryPlugin = createFrontendPlugin({
  pluginId: 'mta-gallery',
  extensions: [
    PageBlueprint.make({
      params: {
        path: '/gallery',
        title: 'MTA state gallery',
        loader: async () => <GalleryPage />,
      },
    }),
  ],
});

export default galleryPlugin;
