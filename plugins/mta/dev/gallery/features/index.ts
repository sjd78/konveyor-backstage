import type { GalleryState } from '../states';
import { configStates } from './config';

/**
 * Tiles added by feature pull requests, rendered under the "Features" group.
 * A feature keeps its tiles in its own file in this directory and lists them
 * here.
 */
export const featureStates: GalleryState[] = [...configStates];
