// `yarn start` entry point for the development host.
//
//   yarn start [--scenario <id>] [app|backend]
//
// Picks a data scenario (prompting on a TTY, preselecting the last choice),
// writes the generated catalog, then runs `backstage-cli repo start`.
// Frontend-only runs skip scenario preparation: the catalog is backend data.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { scenarios } from './scenarios.mjs';
import { writeCatalog } from './catalog.mjs';

const root = new URL('../../', import.meta.url);
const hostConfig = fileURLToPath(new URL('dev-host/app-config.yaml', root));
const localConfig = fileURLToPath(
  new URL('dev-host/app-config.local.yaml', root),
);
const envFile = fileURLToPath(new URL('.env', root));
const lastScenarioFile = new URL('dev-host/.generated/last-scenario', root);
const TARGETS = ['app', 'backend'];

async function readLastScenario() {
  try {
    const id = (await readFile(lastScenarioFile, 'utf8')).trim();
    return scenarios.find(scenario => scenario.id === id);
  } catch {
    return undefined;
  }
}

async function promptScenario(preselected) {
  console.log('\nSelect development data for this run:\n');
  scenarios.forEach((scenario, index) => {
    const marker = scenario === preselected ? '>' : ' ';
    console.log(`${marker} ${index + 1}) ${scenario.label}  [${scenario.id}]`);
    console.log(`     ${scenario.description}`);
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const fallback = scenarios.indexOf(preselected) + 1;
      const answer = (await rl.question(`\nChoice [${fallback}]: `)).trim();
      if (!answer) return preselected;
      const chosen =
        scenarios[Number(answer) - 1] ?? scenarios.find(s => s.id === answer);
      if (chosen) return chosen;
      console.log(`Enter 1-${scenarios.length} or a scenario id.`);
    }
  } finally {
    rl.close();
  }
}

async function selectScenario(requested) {
  if (requested) {
    const scenario = scenarios.find(s => s.id === requested);
    if (!scenario) {
      throw new Error(
        `Unknown scenario "${requested}". Choose one of: ${scenarios
          .map(s => s.id)
          .join(', ')}.`,
      );
    }
    return scenario;
  }
  const preselected = (await readLastScenario()) ?? scenarios[0];
  return process.stdin.isTTY ? promptScenario(preselected) : preselected;
}

async function main() {
  const { values, positionals } = parseArgs({
    options: { scenario: { type: 'string', short: 's' } },
    allowPositionals: true,
  });
  const unknown = positionals.filter(target => !TARGETS.includes(target));
  if (unknown.length) {
    throw new Error(
      `Unknown start target(s): ${unknown.join(', ')}. Use app and/or backend.`,
    );
  }
  const targets = positionals.length ? positionals : TARGETS;

  if (existsSync(envFile)) process.loadEnvFile(envFile);

  if (targets.includes('backend')) {
    const scenario = await selectScenario(values.scenario);
    await mkdir(new URL('.', lastScenarioFile), { recursive: true });
    await writeFile(lastScenarioFile, `${scenario.id}\n`);
    console.log(`\nPreparing scenario "${scenario.id}" (${scenario.label})`);
    const components = await scenario.prepare(message => console.log(message));
    const path = await writeCatalog(components);
    console.log(`Wrote ${components.length} Components to ${path}`);
    for (const component of components) {
      const connected =
        component.metadata.annotations['konveyor.io/application-id'];
      console.log(
        `  ${component.metadata.title} -> component:default/${component.metadata.name}` +
          (connected ? ` (Hub id ${connected})` : ' (not connected)'),
      );
    }
    console.log();
  }

  const configs = [
    hostConfig,
    ...(existsSync(localConfig) ? [localConfig] : []),
  ];
  const cwd = fileURLToPath(root);
  const command = [
    'yarn',
    [
      'backstage-cli',
      'repo',
      'start',
      ...configs.flatMap(config => ['--config', config]),
      ...(positionals.length ? targets : []),
    ],
  ];
  console.log(`cwd: ${cwd}`);
  console.log(`command: ${command.flat().join(' ')}`);
  console.log('');

  // Don't open a browser tab on start; set BROWSER (shell or .env) to opt back in.
  const env = { ...process.env, BROWSER: process.env.BROWSER ?? 'none' };
  const child = spawn(...command, { cwd, env, stdio: 'inherit' });

  // The terminal delivers Ctrl+C to the whole process group; let the child shut down.
  process.on('SIGINT', () => {});
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

main().catch(error => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
