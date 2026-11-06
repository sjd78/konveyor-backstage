import { useMemo } from 'react';
import { configApiRef, useApiHolder } from '@backstage/core-plugin-api';
import { readMtaConfig, type MtaConfig } from './mtaConfig';

/**
 * The `mta` config for the current app. A host that does not register the
 * config API, such as a unit test of a single component, falls back to no
 * configuration.
 */
export function useMtaConfig(): MtaConfig {
  const apiHolder = useApiHolder();
  return useMemo(() => readMtaConfig(apiHolder.get(configApiRef)), [apiHolder]);
}
