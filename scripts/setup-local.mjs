import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {migrateLocal} from './migrate-local.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
if(!existsSync('node_modules/wrangler/bin/wrangler.js'))throw new Error('Install dependencies with npm install before running setup.');
if(!existsSync('.dev.vars')){writeFileSync('.dev.vars','EDITOR_PASSWORD='+randomBytes(24).toString('base64url')+'\n',{mode:0o600});console.log('A unique local editor password was saved in .dev.vars.');}
migrateLocal();
console.log('Local database is ready. Run npm run dev and open its printed URL. The editor is at /editor.');
