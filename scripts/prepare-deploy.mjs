import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const templatePath = resolve(root, 'wrangler.production.example.json');
const configPath = resolve(root, 'wrangler.production.json');
if (!existsSync(resolve(root, 'dist/server/index.js')) || !existsSync(resolve(root, 'dist/client'))) {
  throw new Error('Build first with `npm run build`.');
}

const databaseId = process.env.D1_DATABASE_ID?.trim();
if (!databaseId) {
  throw new Error('Set D1_DATABASE_ID to the production D1 UUID before preparing a deploy.');
}
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error('D1_DATABASE_ID must be a D1 database UUID, not a name or placeholder.');
}

const config = JSON.parse(readFileSync(templatePath, 'utf8'));
const databaseName = process.env.D1_DATABASE_NAME?.trim() || 'grave-production';
const bucketName = process.env.R2_BUCKET_NAME?.trim() || 'grave-media';
const workerName = process.env.WORKER_NAME?.trim() || 'grave';
const commit = process.env.GRAVE_COMMIT?.trim()
  || spawnSync('git', ['rev-parse', '--short', 'HEAD'], {cwd:root, encoding:'utf8'}).stdout?.trim()
  || 'unknown';

config.name = workerName;
config.vars = {...(config.vars || {}), GRAVE_COMMIT: commit};
config.d1_databases = [{
  binding: 'DB',
  database_name: databaseName,
  database_id: databaseId,
  migrations_dir: 'drizzle',
}];
config.r2_buckets = [{binding:'BUCKET', bucket_name:bucketName}];

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Prepared ${configPath}`);
console.log(`Worker: ${workerName}`);
console.log(`D1: ${databaseName} (${databaseId})`);
console.log(`R2: ${bucketName}`);
console.log(`Commit: ${commit}`);
console.log('Next: apply migrations, set EDITOR_PASSWORD as a Worker secret, then deploy.');
