# Backstage MTA (Migration Toolkit for Applications)

Mainline Backstage instance integrating Konveyor / MTA migration plugins, modules, and workflows. Built on Backstage's New Backend System and New Frontend System.

## Summary

This monorepo wraps reusable Backstage MTA plugins in a local development host:

- Live application, archetype/profile, task, and analysis reads through the Konveyor UI's `/hub` proxy.
- Real technology discovery and profile-based analysis submission, polling, and reload recovery.
- Migration findings with incident locations, snippets, messages, and documentation links.
- Catalog-backed architect/developer views; persona selection is not authorization.
- A development host whose `yarn start` selector chooses the catalog/Hub data for each run.

Phase 2 is unauthenticated and requires an isolated Hub configured for anonymous access. OIDC is not implemented. Production scaffolder registration and continuous catalog ingestion remain separate Phase 4 work; their existing mock-Hub consumers are retained, not used to connect the live development catalog.

## Repository Layout

This repository is a **development host only**: there is no production Backstage install, deployment config, or container image. The deliverables are the packages in `plugins/`; `dev-host/` wraps them in a realistic local Backstage.

```text
plugins/mta/                   Reusable live migration frontend
plugins/mta-backend/           Hub transport, proxy routes, legacy entity YAML endpoint
plugins/mta-mock-hub-backend/   Retained legacy registration demo simulator
plugins/catalog-backend-module-mta-entity-provider/   Mock catalog consumer (Phase 4 cutover)
plugins/scaffolder-backend-module-mta-actions/        Mock scaffolder consumer (Phase 4 cutover)
plugins/auth-*-dev-users*/     Development persona sign-in (frontend + backend module)
dev-host/app/, dev-host/backend/   Host frontend/backend packages
dev-host/app-config.yaml       The single host config
dev-host/data/                 Static catalog files, Hub seed bodies, developer assignments
dev-host/start/                `yarn start` scenario selector and catalog generation
docs/                          Phase 2 user stories, RHDH comparison, demo recordings
```

See [`dev-host/README.md`](dev-host/README.md) for host details, scenarios, and adding plugins.

## Plugin Details

| Plugin / module                | Role                                            | Interfaces                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/mta`                  | Live migration tab, home cards, and `/mta` page | `EntityContentBlueprint`, `HomePageWidgetBlueprint`, `PageBlueprint`, `MtaApiClient`                                                                        |
| `plugins/mta-backend`          | Hub REST client/proxy                           | `/api/mta-backend/applications`, per-application tasks/analysis/profiles/discovery/analyze, tasks, incidents, targets, archetypes; `/entity/:name` retained |
| `plugins/mta-mock-hub-backend` | Legacy demo only                                | Simulated registration/discovery; not the live Hub                                                                                                          |
| Catalog entity-provider module | Legacy mock ingestion                           | Scheduled mock-Hub reads, not the development startup snapshot                                                                                              |
| Scaffolder actions module      | Legacy mock registration                        | `mta:register-application`; not live production registration yet                                                                                            |

### Catalog connections

- `konveyor.io/application-id`: positive numeric ID of the actual Hub application. No implicit name-based connection.
- `mta.konveyor.io/repo-url`: repository URL.
- `mta.konveyor.io/root-path`: repository subdirectory.
- `mta.konveyor.io/repo-branch`: repository ref.
- `mta.konveyor.io/assigned-developer`: developer user entity reference.

Live task state and finding counts come from Hub, never seeded status/count annotations. An absent connection, deleted application, denied request, absent analysis, and successful analysis with no findings have distinct outcomes. No findings does not mean migration completion.

## Quick Start

### 1. Prerequisites and installation

- Node.js 22 or 24; Yarn 4 (the repository pins Yarn 4.13.0).
- A running Konveyor UI endpoint whose `/hub` route is reachable from the development host.
- Existing Hub applications, or the `live-seeded` scenario to create the sample applications from `dev-host/data/seeds/`.
- For analysis, matching archetypes with effective analysis profiles and a runnable analyzer addon.

```sh
yarn install
cp .env.example .env   # set MTA_HUB_BASE_URL to your Konveyor UI origin
yarn start
```

Do **not** include `/hub` in `MTA_HUB_BASE_URL`; the client adds it. No port-forward is required. `yarn start` loads `.env` itself; an exported shell variable takes precedence.

### 2. Startup behavior

`yarn start` asks which data scenario to prepare (Enter keeps the last choice), writes the gitignored `dev-host/.generated/catalog.yaml`, then launches the frontend on `http://localhost:3000` and backend on `http://localhost:7007`. Skip the prompt with `yarn start --scenario <id>`.

| Scenario           | Hub access                                      | MTA Components in the catalog                |
| ------------------ | ----------------------------------------------- | -------------------------------------------- |
| `live`             | Read-only                                       | One connected Component per Hub application  |
| `live-seeded`      | Creates missing seed applications (no analysis) | Same as `live`, after provisioning           |
| `live-unconnected` | Read-only                                       | `live` plus seed Components without a Hub ID |
| `offline`          | None                                            | Seed Components without a Hub ID only        |

Connected entity names are stable `mta-application-<Hub ID>` values, with the real application name as the title. Edit `dev-host/data/assignments.json` (keyed by application name) to assign applications to catalog users; the supplied validation applications belong to Chen. Other applications belong to the architect portfolio without a developer assignment.

After registering a new application in Hub, restart `yarn start` to reload the snapshot. This is a development snapshot, **not** a scheduled catalog provider or the complete Phase 2a sample-data loader. The catalog database is in memory, so each start contains exactly the selected scenario. `yarn start:frontend`, `yarn start:backend`, and `yarn start:tmux` use the same selector; frontend-only starts skip scenario preparation.

### 3. Browser interactions

1. Open `http://localhost:3000` and select **Sarah (Architect)**.
2. Home shows actual connected applications and current Hub status. Use **Refresh Hub data** after work changes elsewhere.
3. Open an application card, then its **Migration** tab. Run discovery for a connected repository, or choose an effective analysis profile and **Start analysis**.
4. Task IDs, activity, repository ref/path, errors, and terminal outcomes come from Hub. Reloading restores task state rather than resetting a demo workflow.
5. Inspect findings and expand a row for incident evidence. Unsupported AI remediation, deployment generation, and migration sign-off are not presented as working actions.
6. Log out and choose **Chen (Developer)** to view assigned applications and findings without architect mutation controls.

Unconnected entities explain how to register/connect in Hub and persist the application-ID annotation. The live Migration tab does not create an application and retain its identity only in browser memory. Dev-user impersonation and the example allow-all permission policy are development-host infrastructure.

### 4. Verification

```sh
yarn tsc
CI=true yarn backstage-cli repo test plugins/ --watch=false --runInBand
yarn build:backend
```

The backend build also builds the bundled frontend. See [Phase 2 user stories](docs/phase-2-user-stories.md) for exercised interactions and future user-versus-system authentication requirements.

For the original prototype requirements, parity gaps, and six recorded walkthroughs, see [RHDH story comparison](docs/rhdh-story-comparison.md). Reusable Hub application request bodies are in [`dev-host/data/seeds/`](dev-host/data/seeds/); only the `live-seeded` scenario provisions them, and nothing analyzes them automatically.

## UI Design System

- [Designing for Backstage](https://backstage.io/docs/dls/design)
- [Backstage components storybook](https://backstage.io/storybook) - `@backstage/core-components`
- Backstage v1.10 design system builds on top of [Material UI](https://material-ui.com/)

## References

- [RHDH v1.10 docs](https://docs.redhat.com/en/documentation/red_hat_developer_hub/1.10)
- [Backstage](https://backstage.io)
