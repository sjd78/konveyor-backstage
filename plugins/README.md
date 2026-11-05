# Plugins

Each folder contains a Backstage plugin or backend module:

| Folder                                       | Functionality                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `mta`                                        | Frontend migration tab, home-page migration cards, and `/mta` page backed by live Hub data.        |
| `mta-backend`                                | Backend proxy for accessing the Konveyor / MTA Hub API.                                            |
| `catalog-backend-module-mta-entity-provider` | Catalog module that imports Hub applications as entities and synchronizes their migration status.  |
| `scaffolder-backend-module-mta-actions`      | Scaffolder module providing the `mta:register-application` action to register applications in Hub. |
| `mta-mock-hub-backend`                       | In-memory Hub simulator for development without a live Hub.                                        |
| `auth-backend-module-dev-users`              | Development-only auth module that lists catalog users and signs in as a selected persona.          |
| `auth-dev-users-frontend`                    | Development-only sign-in page for choosing a catalog-user persona.                                 |

The mock Hub and dev-user authentication packages support the development host;
they are not intended for production installations.
