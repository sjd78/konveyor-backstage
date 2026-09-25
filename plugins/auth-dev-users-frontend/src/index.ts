/***/
/**
 * The dev-users frontend plugin for Backstage.
 *
 * @packageDocumentation
 */

export { authDevUsersPlugin, authDevUsersPlugin as default } from './plugin';
export { DevUserSignInPage } from './components/DevUserSignInPage';
export type { DevUser } from './components/DevUserSignInPage';
export { signInPageExtension } from './extensions';
