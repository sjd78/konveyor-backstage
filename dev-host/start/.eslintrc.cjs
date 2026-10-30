// Plain Node ESM scripts, outside the Backstage packages linted by `backstage-cli repo lint`.
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  env: { node: true, es2024: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
};
