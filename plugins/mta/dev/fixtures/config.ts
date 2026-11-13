import type { ConfigApi } from '@backstage/core-plugin-api';
import { mockApis } from '@backstage/frontend-test-utils';

/**
 * The configuration a tile renders with when it does not provide its own.
 * Empty, so UI that a host must configure stays at its default and no tile
 * reads configuration another tile set.
 */
export const DEFAULT_CONFIG: ConfigApi = mockApis.config();
