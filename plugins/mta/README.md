# mta

Welcome to the mta plugin!

_This plugin was created through the Backstage CLI_

## Getting started

Your plugin has been added to the app in this repository, meaning you'll be able
to access it by running `yarn start` in the root directory, and then navigating
to [/mta](http://localhost:3000/mta).

This plugin is built with Backstage's [frontend
system](https://backstage.io/docs/frontend-system/architecture/index), and you
can find more information about building plugins in the [plugin builder
documentation](https://backstage.io/docs/frontend-system/building-plugins/index).

You can also serve the plugin in isolation by running `yarn start` in the plugin directory.
This method of serving the plugin provides quicker iteration speed and a faster startup and hot reloads.
It is only meant for local development, and the setup for it can be found inside the [/dev](./dev) directory.

## Configuration

The plugin reads three optional values from the `mta` section of `app-config.yaml`.
None of them is required: without them the Migration tab renders as it does in a deployment that sets no configuration, with no external links and no support contact.
Changing a value changes the screen without a rebuild.

```yaml
mta:
  support:
    # Contact shown on the failed task screen. The name links to the address.
    name: Migration Team
    email: migration-team@example.com
  devSpaces:
    # Adds "Open in Dev Spaces" to the findings screen.
    url: https://devspaces.apps.example.com
```

| Key                 | Type             | Effect                                                                                                                                                           |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mta.support.name`  | string, optional | Adds the sentence "If the problem continues, contact Migration Team." below the failed task actions. With an email, the name is a `mailto:` link to it.          |
| `mta.support.email` | string, optional | Target of that `mailto:` link. On its own, the address becomes the link text. An invalid address counts as not configured.                                       |
| `mta.devSpaces.url` | string, optional | Adds "Open in Dev Spaces" beside the findings actions for every persona, opening a new tab. Only an `http` or `https` URL is accepted; anything else is ignored. |
