/***/
/**
 * The dev-users frontend plugin for Backstage.
 *
 * @packageDocumentation
 */

export {
  authDevUsersModule,
  authDevUsersModule as default,
  authDevUsersModule as authDevUsersPlugin,
} from './module';
export { DevUserSignInPage } from './components/DevUserSignInPage';
export type { DevUser } from './components/DevUserSignInPage';
export { signInPageExtension } from './extensions';
