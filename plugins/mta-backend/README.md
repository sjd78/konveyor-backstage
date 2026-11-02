# mta

This plugin backend was templated using the Backstage CLI. You should replace this text with a description of your plugin backend.

## Installation

This plugin is installed via the `@internal/backstage-plugin-mta-backend` package. This repository's development host already registers it in `dev-host/backend`. To install it to a backend package, run the following command:

```bash
# From your root directory (in this repository the backend package is dev-host/backend)
yarn --cwd dev-host/backend add @internal/backstage-plugin-mta-backend
```

Then add the plugin to your backend in `dev-host/backend/src/index.ts` (or your own backend's `src/index.ts`):

```ts
const backend = createBackend();
// ...
backend.add(import('@internal/backstage-plugin-mta-backend'));
```

## Development

This plugin backend can be started in a standalone mode from directly in this
package with `yarn start`. It is a limited setup that is most convenient when
developing the plugin backend itself.

If you want to run the entire project, including the frontend, run `yarn start` from the root directory.
