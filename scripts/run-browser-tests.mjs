import {spawn, spawnSync} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.env.QUALITY_BASE_URL || 'http://127.0.0.1:5173';
const browserTests = readdirSync(new URL('../tests/', import.meta.url))
  .filter((name) => name.endsWith('.browser.mjs'))
  .sort();

if (!browserTests.length) throw new Error('No browser tests found.');

if (!existsSync(resolve(root, '.dev.vars'))) {
  console.log('Creating local editor credentials...');
  const setup = spawnSync(process.execPath, [resolve(root, 'scripts/setup-local.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (setup.status !== 0) throw new Error('Local setup failed.');
}

async function healthy() {
  try {
    const response = await fetch(base + '/api/health', {signal: AbortSignal.timeout(1500)});
    return response.ok;
  } catch {
    return false;
  }
}

let server;
if (!(await healthy())) {
  server = spawn(process.execPath, [resolve(root, 'scripts/run-framework.mjs'), 'dev'], {
    cwd: root,
    env: {...process.env, FORCE_COLOR: '0'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Dev server exited before becoming healthy (${server.exitCode}).`);
    }
    if (await healthy()) break;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  if (!(await healthy())) throw new Error(`Dev server did not become healthy at ${base}.`);
} else {
  console.log(`Using the healthy dev server at ${base}.`);
}

let failed = false;
try {
  for (const test of browserTests) {
    console.log(`\n▶ ${test}`);
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', resolve(root, 'tests', test)],
      {
        cwd: root,
        stdio: 'inherit',
        env: {...process.env, QUALITY_BASE_URL: base, READER_BASE_URL: base},
      },
    );
    if (result.status !== 0) {
      failed = true;
      break;
    }
  }
} finally {
  if (server && server.exitCode === null) {
    await new Promise((resolveExit) => {
      server.once('exit', resolveExit);
      server.kill();
      setTimeout(resolveExit, 5_000).unref();
    });
  }
}

if (failed) process.exitCode = 1;
