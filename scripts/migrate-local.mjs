import './sites-env.mjs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function migrateLocal(){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const result=spawnSync(process.execPath,[
    '--import','./scripts/sites-env.mjs',
    'node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB',
    '--local','--config','wrangler.local.json','--persist-to','.wrangler/state',
  ],{cwd:root,stdio:'inherit',env:process.env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Local database migrations failed. Fix the error above before starting Grave.');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))migrateLocal();
