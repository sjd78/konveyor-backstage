/**
 * The MTA configuration contract.
 *
 * Deployment values (the Dev Spaces dashboard URL and the support contact)
 * come from app-config under `mta`, so a deployment changes them without a
 * rebuild. Plain TypeScript on purpose: no React and no CSS, so the reader can
 * be unit tested.
 */

import { safeWebHref } from '../repository';

/** Values the plugin reads from the `mta` section of app-config. */
export interface MtaConfig {
  /** Dev Spaces dashboard URL. Undefined when the deployment has none. */
  devSpacesUrl?: string;
  /** Support contact name shown on a failure. Undefined when not set. */
  supportName?: string;
  /** Support contact email shown on a failure. Undefined when not set. */
  supportEmail?: string;
}

/**
 * The subset of a config reader this module needs. Keeping it structural means
 * the reader can be the host ConfigApi or a plain fixture.
 */
export interface MtaConfigReader {
  getOptionalString(key: string): string | undefined;
}

const CONFIG_PREFIX = 'mta';

function readString(reader: MtaConfigReader, key: string): string | undefined {
  try {
    const value = reader.getOptionalString(`${CONFIG_PREFIX}.${key}`);
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  } catch {
    // A value of the wrong type is treated as missing, not fatal.
    return undefined;
  }
}

/**
 * A support address needs one local part and one domain around a single `@`.
 * Otherwise it is not an address, so it counts as not configured and never
 * becomes a `mailto:` target.
 */
function safeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return /^[^\s@]+@[^\s@]+$/.test(email) ? email : undefined;
}

/**
 * Resolve the app-config values. There are deliberately no defaults: a
 * deployment that sets nothing shows no external links and no support contact.
 */
export function readMtaConfig(reader: MtaConfigReader | undefined): MtaConfig {
  const config: MtaConfig = {};
  if (!reader) return config;

  // An invalid URL counts as not configured, so the UI never links to it.
  const devSpacesUrl = safeWebHref(readString(reader, 'devSpaces.url'));
  if (devSpacesUrl) config.devSpacesUrl = devSpacesUrl;
  const supportName = readString(reader, 'support.name');
  if (supportName) config.supportName = supportName;
  const supportEmail = safeEmail(readString(reader, 'support.email'));
  if (supportEmail) config.supportEmail = supportEmail;

  return config;
}
