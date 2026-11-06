# MTA state gallery (development only)

Every state in the state catalog, rendered through the real plugin components
with fixture Hub, catalog and identity APIs. No Hub and no backend are needed.

```sh
cd plugins/mta
yarn start
```

`dev/index.tsx` redirects `/` to `/gallery`.

## URLs

- `/gallery` renders every tile, grouped as in the state catalog.
- `/gallery?state=<id>` renders one tile, for example
  `/gallery?state=tab-findings-architect`.
- `/gallery?theme=dark` or `/gallery?theme=light` switches the app theme.

Each tile is a `<section data-gallery-state="<id>">` with the ID, the state
name, the trigger and the component. Screenshots for a pull request use the
same ID.

## Layout

- `fixtures/hub.ts`: Hub data kept from real responses of a local Konveyor Hub
  captured on 2026-11-04, plus the shapes that capture did not contain.
- `fixtures/mtaApi.ts`: the fixture `MtaApi`, configured per tile.
- `fixtures/scenarios.ts`: the fixture configuration for every state.
- `fixtures/config.ts`: the empty configuration every tile gets by default.
- `gallery/states.ts`: the state catalog, with IDs, names and triggers.
- `gallery/features/index.ts`: the tiles that feature pull requests add.
- `gallery/GalleryPage.tsx`, `gallery/GalleryTile.tsx`: the page and its tiles.

## Tiles a feature adds

A feature keeps its tiles in `gallery/features/<name>.tsx` and lists them in
`gallery/features/index.ts`. Its states use `kind: 'custom'`: `render` returns
the component, and `apis` replaces the APIs that component reads, including
the configuration, so fixtures stay with the feature.

```tsx
const state: GalleryState = {
  id: 'feature-example',
  name: 'Example',
  trigger: 'What produces the state.',
  kind: 'custom',
  apis: {
    identity: createIdentity('architect'),
    config: mockApis.config({ data: { mta: { supportContact: '...' } } }),
  },
  render: () => <ExampleComponent />,
};
```

Any tile, of any kind, can set `apis.config` to render with host
configuration. Without it a tile reads an empty config, so configuration-driven
UI stays hidden as it does in a host that does not set it.

Interactive tiles render their start state. `tab-action-error` shows the
rejection after **Start discovery**, and `tab-choose-profile` opens profile
selection after **Run analysis**.

Tests under `dev/` are not picked up by `backstage-cli repo test`, which uses
`src` as the package root, so this gallery has no automated tile test.
