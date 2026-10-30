# AGENTS.md

Guidance and context for AI agents working in `/home/sdickers/projects/static-backstage`.

---

## 1. Operating Principles

Adopted from [Andrej Karpathy's LLM coding guidelines](https://github.com/multica-ai/andrej-karpathy-skills):

### Think Before Coding

- **State assumptions explicitly:** When requirements are ambiguous, clarify before generating large diffs.
- **Surface tradeoffs:** Present concrete options (e.g. legacy vs new frontend system extensions) before implementing.
- **Stop when blocked:** If a package export or type contract is mismatched, locate the exact symbol in `node_modules` or official docs rather than guessing.

### Simplicity First

- **Minimal code:** Implement the exact requested feature or fix. No speculative configurability or unused abstraction layers.
- **Backstage conventions:** Follow standard Backstage Blueprint patterns (`EntityContentBlueprint`, `HomePageWidgetBlueprint`, `PageBlueprint`, `createBackendPlugin`, `createBackendModule`).
- **Clean removals:** When deleting obsolete files, remove their imports, package declarations, and test fixtures.

### Surgical Changes

- **Touch only what is necessary:** Do not reformat untouched files or rewrite working legacy code (e.g., prototype Material-UI v4 components).
- **Match existing style:** Follow the monorepo's ESLint and Prettier rules.
- **Traceability:** Every edited line must trace directly to a verifiable goal.

### Goal-Driven Execution

- **Verify at each step:** State a clear check before writing code and run it immediately after.
  ```
  1. Update package.json -> verify: yarn install --no-immutable
  2. Modify TypeScript source -> verify: yarn tsc
  3. Update router/plugin -> verify: yarn backstage-cli repo test plugins/<plugin>
  4. Build check -> verify: yarn build:backend
  5. Dev check -> verify: hub start / browser verification
  ```

---

## 2. Project Genesis & Origin

This repository was created to run the **mainline version of Backstage** with the Konveyor / MTA (Migration Toolkit for Applications) plugins migrated from the dynamic plugin prototype in `/home/sdickers/projects/uxd_mta-for-rhdh`.

### How it was scaffolded:

1. Created via `npx @backstage/create-app --path . --skip-install` under `/home/sdickers/projects/static-backstage`.
2. Package manager: Yarn Modern (v4) with PnP/node-modules workspace.
3. Plugins scaffolded with `backstage-cli new` (`yarn new`):
   - `frontend-plugin` -> `plugins/mta`
   - `backend-plugin` -> `plugins/mta-backend`
   - `backend-plugin` -> `plugins/mta-mock-hub-backend`
   - `backend-plugin-module` -> `plugins/catalog-backend-module-mta-entity-provider`
   - `backend-plugin-module` -> `plugins/scaffolder-backend-module-mta-actions`
4. Code migrated from `uxd_mta-for-rhdh`:
   - Frontend UI, store, prototype switcher, and styles from `dynamic-plugins-root/red-hat-developer-hub-backstage-plugin-mta/src/`.
   - Backend logic from `local-plugins/mta-backend/`, `local-plugins/mta-mock-hub/`, `local-plugins/mta-entity-provider/`, `local-plugins/mta-scaffolder-actions/`.
   - Seeded components from `configs/catalog-entities/components.override.yaml` -> `examples/mta-components.yaml`.
   - Scaffolder template from `configs/templates/mta-register/template.yaml` -> `examples/mta-template/template.yaml`.
5. Later restructuring: Phase 1 removed the prototype switcher; Phase 2 replaced the frontend store with live Hub data. The create-app `packages/` host moved to `dev-host/`, `examples/` moved to `dev-host/data/catalog/`, and the production config/Dockerfile were deleted.

---

## 2a. Development Host Only — No Production Install

- **This repository never deploys Backstage.** The deliverables are the packages in `plugins/`. `dev-host/` (app, backend, config, data, start scripts) only wraps them so they look and behave as in a real installation.
- There is exactly one host config: `dev-host/app-config.yaml` (plus optional gitignored `dev-host/app-config.local.yaml`). Do not add `app-config.production.yaml`, Dockerfiles, external databases, or "production vs dev" branches to the host. Production concerns (auth, RBAC, packaging) belong in the plugins and the RHDH export phases of the implementation plan.
- `yarn start` runs `dev-host/start/index.mjs`: a scenario selector (`live`, `live-seeded`, `live-unconnected`, `offline`) that writes `dev-host/.generated/catalog.yaml` before `backstage-cli repo start`. Non-interactive runs use `yarn start --scenario <id>` (or the last saved choice). Add scenarios in `dev-host/start/scenarios.mjs`. `live-seeded` writes to the Hub; never pick it without the user's intent.
- `yarn new` does not auto-wire plugins (it expects `packages/app` and `packages/backend`). Register new plugins manually in `dev-host/app` and `dev-host/backend`; see `dev-host/README.md`.

---

## 3. Architecture & Invariants

### Backend Architecture: New Backend System

- **Entry point:** `dev-host/backend/src/index.ts`.
- All backend extensions use `backend.add(import('<package>'))`.
- **Plugins** use `createBackendPlugin` from `@backstage/backend-plugin-api`.
- **Modules** use `createBackendModule` from `@backstage/backend-plugin-api`:
  - `catalogModuleMtaEntityProvider`: Extends `catalogProcessingExtensionPoint` from `@backstage/plugin-catalog-node`.
  - `scaffolderModuleMtaActions`: Extends `scaffolderActionsExtensionPoint` from `@backstage/plugin-scaffolder-node/alpha`.
- Routes are mounted at `/api/<pluginId>`:
  - `/api/mta-backend/entity/:name`
  - `/api/mta-mock-hub/*` (`/register`, `/applications`, `/support-contact`, `/entity/:id`)

### Frontend Architecture: New Frontend System

- **Entry point:** `dev-host/app/src/App.tsx`.
- Defined using `createApp({ features: [catalogPlugin, mtaPlugin, navModule, homeModule, settingsModule, authDevUsersModule] })`.
- **`plugins/mta/src/alpha.tsx`** exports the frontend plugin with extensions:
  - `mtaApiExtension`: `ApiBlueprint.make` providing `MtaApiClient` (calls `mta-backend` via `DiscoveryApi`).
  - `mtaEntityContent`: `EntityContentBlueprint.makeWithOverrides` mounting `/migration` on `Component` entities.
  - `mtaHomeWidget`: `HomePageWidgetBlueprint.make` mounting `mta-migration-cards` on the home page.
  - `mtaPage`: `PageBlueprint.make` mounting `/mta`.

---

## 4. Plugin Inventory

| Plugin                                                                  | Path                                                 | Role                                            | Key Files                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@internal/backstage-plugin-mta`                                        | `plugins/mta`                                        | Live migration tab, home cards, `/mta` page     | `src/alpha.tsx`, `src/components/MigrationTab.tsx`, `src/hooks/useKonveyorMigration.ts`, `src/api/MtaApiClient.ts` |
| `@internal/backstage-plugin-mta-backend`                                | `plugins/mta-backend`                                | Konveyor Hub proxy (`KonveyorClient`)           | `src/plugin.ts`, `src/router.ts`, `src/service/KonveyorClient.ts`                                                  |
| `@internal/backstage-plugin-mta-mock-hub-backend`                       | `plugins/mta-mock-hub-backend`                       | In-memory MTA Hub simulator                     | `src/plugin.ts`, `src/router.ts`                                                                                   |
| `@internal/backstage-plugin-catalog-backend-module-mta-entity-provider` | `plugins/catalog-backend-module-mta-entity-provider` | Ingests MTA apps into Software Catalog          | `src/module.ts`                                                                                                    |
| `@internal/backstage-plugin-scaffolder-backend-module-mta-actions`      | `plugins/scaffolder-backend-module-mta-actions`      | Custom `mta:register-application` action        | `src/module.ts`                                                                                                    |
| `@internal/backstage-plugin-auth-backend-module-dev-users`              | `plugins/auth-backend-module-dev-users`              | Backend auth module for selectable dev personas | `src/index.ts`, `src/module.ts`                                                                                    |
| `@internal/backstage-plugin-auth-dev-users-frontend`                    | `plugins/auth-dev-users-frontend`                    | Frontend sign-in page plugin for dev personas   | `src/index.ts`, `src/plugin.ts`, `src/components/DevUserSignInPage.tsx`                                            |

---

## 5. Verification Commands

Always run these checks when modifying code in this repository:

```sh
# 1. Typecheck, lint, format, spell check, and verify knip reports for the entire monorepo
yarn check

# 2. Run unit and integration tests for all plugins
yarn backstage-cli repo test plugins/

# 3. Build and package backend and frontend assets
yarn build:backend

# 4. Start the dev host (frontend on :3000, backend on :7007); pick a data scenario
yarn start            # or: yarn start --scenario offline   (no Hub needed)
```

A Husky pre-commit hook runs lint-staged (ESLint `--fix`, Prettier, cspell) on staged files. Never bypass it with `--no-verify`; fix the reported problem, or add a genuine project term to `cspell.json`.

Each package's `knip-report.md` is committed. After changing dependencies or exports, run `yarn build:knip-reports` and commit the regenerated reports; `yarn check` and CI fail on stale reports.

---

## 6. Common Pitfalls & Edge Cases

1. **Yarn Lockfile Immutability:**
   Yarn v4 blocks lockfile modifications by default in non-interactive/CI shells. When adding or updating dependencies in any `package.json`, run:

   ```sh
   yarn install --no-immutable
   ```

2. **Scaffolder Extension Point Location:**
   `scaffolderActionsExtensionPoint` is exported from `@backstage/plugin-scaffolder-node/alpha`, NOT from the root `@backstage/plugin-scaffolder-node`. `createTemplateAction` is exported from `@backstage/plugin-scaffolder-node`.

3. **Catalog Entity Provider Mutations:**
   `MtaEntityProvider` uses `{ type: 'full', entities }` mutations. This ensures existing catalog entities receive status updates when applications transition from `registering` to `discovered` or `failed`.

4. **Development Host Paths:**
   Catalog file locations in `dev-host/app-config.yaml` are relative to the backend process working directory, `dev-host/backend` (e.g. `../data/catalog/org.yaml`). MTA Components come only from the generated `dev-host/.generated/catalog.yaml`; edit `dev-host/start/` or `dev-host/data/`, never the generated file.
