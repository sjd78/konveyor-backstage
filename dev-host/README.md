# Development host

Everything in this folder exists only to run the plugins in `plugins/` inside a
realistic local Backstage. **This repository has no production or deployable
Backstage install.** There is no production config, container image, or external
database; do not add them here. The product is the plugin packages.

```text
dev-host/
  app/                 Frontend host (workspace "app"): navigation, home, dev-user sign-in
  backend/             Backend host (workspace "backend"): plugin/module registrations
  app-config.yaml      The single host config (in-memory SQLite, dev-user auth, catalog locations)
  app-config.local.yaml  Optional, gitignored personal overrides; added by `yarn start` when present
  data/
    catalog/           Static catalog files: Backstage samples, MTA personas, templates
    seeds/             Hub application request bodies used by the seed scenarios
    assignments.json   Hub application name -> assigned developer user ref
  start/               `yarn start` scenario selector and catalog generation
  .generated/          Gitignored: scenario catalog output and last selected scenario
```

## Starting

```sh
cp .env.example .env    # once; set MTA_HUB_BASE_URL to the Konveyor UI origin (no /hub)
yarn start              # pick a scenario; Enter keeps the last one
yarn start --scenario offline
```

`yarn start` loads the repository-root `.env` when present, prepares the selected
scenario, writes `.generated/catalog.yaml`, and runs `backstage-cli repo start`
with `app-config.yaml` (plus `app-config.local.yaml` if it exists). The catalog
database is in memory, so every start reloads exactly the selected scenario.

| Scenario           | Hub access                                                          | Catalog MTA Components                                                          |
| ------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `live`             | Read-only                                                           | One connected `mta-application-<id>` per Hub application                        |
| `live-seeded`      | **Writes**: creates missing `data/seeds` applications (no analysis) | Same as `live`, after provisioning                                              |
| `live-unconnected` | Read-only                                                           | `live` plus Backstage-only seed Components without `konveyor.io/application-id` |
| `offline`          | None                                                                | Seed Components without Hub IDs only                                            |

`live-seeded` matches seeds to Hub applications by name and refuses to adopt a
same-name application whose repository differs. Without a TTY (CI, Playwright),
the `--scenario` flag or the last saved choice is used; the default is `live`.

`yarn start:frontend` starts only the app and skips scenario preparation.
`yarn start:backend` and `yarn start:tmux` prompt like `yarn start`.

No browser tab opens on start. To open one again, set `BROWSER` in your shell or
`.env`: an empty value uses the system default browser, or give a browser name.

## Adding a scenario

Add an entry to `start/scenarios.mjs` with an `id`, `label`, `description`, and a
`prepare(log)` function that returns Component entities (build them with the
helpers in `start/catalog.mjs`). `dev-host/app-config.yaml` already loads the
generated file; scenarios do not need their own config.

## Adding a plugin

`backstage-cli new` (`yarn new`) only auto-wires new plugins into
`packages/app` and `packages/backend`, which do not exist here. After generating
a plugin, add it manually:

- Frontend: add the dependency to `dev-host/app/package.json` and the feature to
  `dev-host/app/src/App.tsx`.
- Backend: add the dependency to `dev-host/backend/package.json` and
  `backend.add(import('<package>'))` to `dev-host/backend/src/index.ts`.

Then run `yarn install`.
