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

---

## 3. Architecture & Invariants

### Backend Architecture: New Backend System
- **Entry point:** `packages/backend/src/index.ts`.
- All backend extensions use `backend.add(import('<package>'))`.
- **Plugins** use `createBackendPlugin` from `@backstage/backend-plugin-api`.
- **Modules** use `createBackendModule` from `@backstage/backend-plugin-api`:
  - `catalogModuleMtaEntityProvider`: Extends `catalogProcessingExtensionPoint` from `@backstage/plugin-catalog-node`.
  - `scaffolderModuleMtaActions`: Extends `scaffolderActionsExtensionPoint` from `@backstage/plugin-scaffolder-node/alpha`.
- Routes are mounted at `/api/<pluginId>`:
  - `/api/mta-backend/entity/:name`
  - `/api/mta-mock-hub/*` (`/register`, `/applications`, `/support-contact`, `/entity/:id`)

### Frontend Architecture: New Frontend System
- **Entry point:** `packages/app/src/App.tsx`.
- Defined using `createApp({ features: [catalogPlugin, mtaPlugin, navModule, homeModule] })`.
- **`plugins/mta/src/alpha.tsx`** exports the frontend plugin with extensions:
  - `mtaEntityContent`: `EntityContentBlueprint.makeWithOverrides` mounting `/migration` on `Component` entities.
  - `mtaHomeWidget`: `HomePageWidgetBlueprint.make` mounting `mta-migration-cards` on the home page.
  - `mtaPage`: `PageBlueprint.make` mounting `/mta`.
  - `mountGlobalScopeBar()`: Invoked at module load to mount `#mta-scope-bar-root` in `document.body` for prototype state switching.

---

## 4. Plugin Inventory

| Plugin | Path | Role | Key Files |
|---|---|---|---|
| `@internal/backstage-plugin-mta` | `plugins/mta` | Frontend migration tab, cards, and prototype bar | `src/alpha.tsx`, `src/components/MigrationTab.tsx`, `src/prototype/PrototypeScopeSwitcher.tsx` |
| `@internal/backstage-plugin-mta-backend` | `plugins/mta-backend` | Dynamic Component YAML generation | `src/plugin.ts`, `src/router.ts` |
| `@internal/backstage-plugin-mta-mock-hub-backend` | `plugins/mta-mock-hub-backend` | In-memory MTA Hub simulator | `src/plugin.ts`, `src/router.ts` |
| `@internal/backstage-plugin-catalog-backend-module-mta-entity-provider` | `plugins/catalog-backend-module-mta-entity-provider` | Ingests MTA apps into Software Catalog | `src/module.ts` |
| `@internal/backstage-plugin-scaffolder-backend-module-mta-actions` | `plugins/scaffolder-backend-module-mta-actions` | Custom `mta:register-application` action | `src/module.ts` |

---

## 5. Verification Commands

Always run these checks when modifying code in this repository:

```sh
# 1. Typecheck the entire monorepo
yarn tsc

# 2. Run unit and integration tests for all plugins
yarn backstage-cli repo test plugins/

# 3. Build and package backend and frontend assets
yarn build:backend

# 4. Start the dev server (frontend on :3000, backend on :7007)
yarn start
```

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

4. **Prototype Scope Switcher React Root:**
   `PrototypeScopeSwitcher` mounts as a secondary React root directly to `document.body` (`#mta-scope-bar-root`). It communicates with the Backstage app tree via browser `localStorage` events and React state hooks in `plugins/mta/src/prototype/`.
