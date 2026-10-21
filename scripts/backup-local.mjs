import {spawnSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = resolve(root, 'backups', stamp);
const sqlFile = resolve(destination, 'd1.sql');
mkdirSync(destination, {recursive:true});

const exportResult = spawnSync(process.execPath, [
  '--import', './scripts/sites-env.mjs',
  'node_modules/wrangler/bin/wrangler.js',
  'd1', 'export', 'DB',
  '--local',
  '--config', 'wrangler.local.json',
  '--output', sqlFile,
  '--skip-confirmation',
], {cwd:root, stdio:'inherit', env:process.env});

if (exportResult.status !== 0) {
  rmSync(destination, {recursive:true, force:true});
  throw new Error('D1 export failed. Is the local database available?');
}

const r2Source = resolve(root, '.wrangler/state/v3/r2');
if (existsSync(r2Source)) cpSync(r2Source, resolve(destination, 'r2'), {recursive:true});

const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {cwd:root, encoding:'utf8'});
const manifest = {
  createdAt: new Date().toISOString(),
  database: 'local D1 (wrangler.local.json)',
  databaseBytes: statSync(sqlFile).size,
  r2Included: existsSync(resolve(destination, 'r2')),
  commit: git.status === 0 ? git.stdout.trim() : null,
};
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Backup written to ${destination}`);
console.log('Stop the dev server before restoring this snapshot.');
