# Backstage MTA (Migration Toolkit for Applications)

Mainline Backstage instance integrating Konveyor / MTA migration plugins, modules, and workflows. Built on Backstage's New Backend System and New Frontend System.

## Summary

This repository hosts static Backstage plugins that connect application migration and modernization workflows to Backstage:
- Application technology discovery and archetype classification.
- Interactive **Migration** tab per component with phase tracking and issue inspection.
- Persona-based migration views for Architects and Developers.
- Self-service application registration template via Backstage Scaffolder.
- In-memory MTA Hub simulator with periodic catalog synchronization.

---

## Repository Layout

```
static-backstage/
├── app-config.yaml                                        # Backstage configuration (ports, catalog locations)
├── packages/
│   ├── app/                                               # Frontend application (New Frontend System)
│   │   └── src/App.tsx                                    # Feature registry (mtaPlugin, catalogPlugin)
│   └── backend/                                           # Backend service (New Backend System)
│       └── src/index.ts                                   # Backend plugin and module registrations
├── plugins/
│   ├── mta/                                               # Frontend plugin (@internal/backstage-plugin-mta)
│   │   ├── src/alpha.tsx                                  # New frontend system plugin & extension definitions
│   │   ├── src/components/                                # MigrationTab, MtaHomeCards, Dialogs
│   │   ├── src/components/phases/                         # 7 migration lifecycle phase views
│   │   ├── src/prototype/                                 # PrototypeScopeSwitcher (toolbar & persona state)
│   │   └── src/store/                                     # MtaStore and mock migration data
│   ├── mta-backend/                                       # Backend plugin (@internal/backstage-plugin-mta-backend)
│   │   └── src/router.ts                                  # Dynamic Component YAML generator (/entity/:name)
│   ├── mta-mock-hub-backend/                              # Backend plugin (@internal/backstage-plugin-mta-mock-hub-backend)
│   │   └── src/router.ts                                  # MTA Hub API simulator (/register, /applications)
│   ├── catalog-backend-module-mta-entity-provider/        # Catalog module (@internal/backstage-plugin-catalog-backend-module-mta-entity-provider)
│   │   └── src/module.ts                                  # MtaEntityProvider polling hub and mutating catalog
│   └── scaffolder-backend-module-mta-actions/             # Scaffolder module (@internal/backstage-plugin-scaffolder-backend-module-mta-actions)
│       └── src/module.ts                                  # Custom action: mta:register-application
└── examples/
    ├── mta-components.yaml                                # Seeded MTA components (inventory-service, etc.)
    └── mta-template/template.yaml                         # Software Template: mta-register-application
```

---

## Plugin Details

| Plugin / Module | Type | System Role | Primary APIs & Extension Points |
|---|---|---|---|
| `plugins/mta` | Frontend Plugin | Migration UI | `EntityContentBlueprint` (`/migration`), `HomePageWidgetBlueprint` (`mta-migration-cards`), `PageBlueprint` (`/mta`), `PrototypeScopeSwitcher` |
| `plugins/mta-backend` | Backend Plugin | YAML Server | `GET /api/mta-backend/entity/:name` (generates Component YAML with MTA annotations) |
| `plugins/mta-mock-hub-backend` | Backend Plugin | Hub Simulator | `POST /api/mta-mock-hub/register`<br>`GET /api/mta-mock-hub/applications`<br>`GET /api/mta-mock-hub/applications/:id`<br>`GET /api/mta-mock-hub/support-contact` |
| `plugins/catalog-backend-module-mta-entity-provider` | Backend Module | Catalog Ingestion | Extends `catalogProcessingExtensionPoint`; polls `mta-mock-hub` every 10s and applies `full` catalog mutations |
| `plugins/scaffolder-backend-module-mta-actions` | Backend Module | Scaffolder Action | Extends `scaffolderActionsExtensionPoint`; registers `mta:register-application` action |

### Annotations

- `konveyor.io/application-id`: MTA Hub application identifier.
- `mta.konveyor.io/repo-url`: Git repository URL analyzed by MTA.
- `mta.konveyor.io/discovered-tags`: Discovered technologies JSON string (e.g. `["JPA entities", "Java EE JSON-P"]`).
- `mta.konveyor.io/assigned-developer`: Assigned developer user entity reference.
- `mta.konveyor.io/root-path`: Subdirectory path for monorepo applications.

---

## Quick Start

### 1. Prerequisites
- **Node.js:** `^22` or `^24`
- **Yarn:** Yarn Modern (v4) or Classic (1.22.x)

### 2. Install Dependencies
```sh
yarn install
```

### 3. Verify Types & Run Tests
```sh
yarn tsc
yarn backstage-cli repo test plugins/
```

### 4. Start Development Servers
```sh
yarn start
```
Starts:
- Frontend on `http://localhost:3000`
- Backend on `http://localhost:7007`

### 5. Verify In Browser
1. Open `http://localhost:3000`.
2. Click **ENTER** on the Guest authentication prompt.
3. **Migration Tab:** Navigate to **Catalog** -> `inventory-service` -> click the **Migration** tab (`/catalog/default/component/inventory-service/migration`).
4. **Prototype Scope Bar:** Use the top bar to switch personas (`Application Architect` / `Corporate Developer`) or override migration lifecycle state (`Not Started`, `Discovery`, `Path Selection`, `Analysis`, `Active`, `Completed`, `Failed`).
5. **Software Templates:** Navigate to **Create** (`/create`) to view and run the **Register application for migration** template.
