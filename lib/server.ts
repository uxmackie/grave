import {env} from 'cloudflare:workers';
import {initialWorkspace,seed,validate,type Product} from './model';
import {parse} from './mdx';
export function db(){if(!env.DB)throw new Error('Storage is unavailable. Please retry.');return env.DB;}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function initialize(){const p=seed();await db().batch([db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind('workspace',JSON.stringify(initialWorkspace)),db().prepare('INSERT OR IGNORE INTO products(id,slug,draft,published) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id=?)').bind(p.id,p.slug,JSON.stringify(p),JSON.stringify(p),'initialized'),db().prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind('initialized','true')]);}
export async function authorized(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)grave_session=([^;]+)/)?.[1];if(!token)return false;const hash=await digest(token);return !!await db().prepare('SELECT token FROM sessions WHERE token=? AND expires>?').bind(hash,Date.now()).first();}
export async function digest(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export async function requireEditor(req:Request){if(!sameOrigin(req))throw Object.assign(new Error('Invalid request origin.'),{status:403});if(!await authorized(req))throw Object.assign(new Error('Sign in to the editor to continue.'),{status:401});}
export async function handle(fn:()=>Promise<Response>){try{return await fn();}catch(e){const error=e as Error&{status?:number};console.error(error.message);return json({error:error.message},error.status||500);}}
export function productErrors(p:Product){return [...validate(p),...p.pages.filter(x=>!x.draft&&!x.hidden).flatMap(x=>{const error=parse(x.source).error;return error?[x.title+': '+error]:[];})];}
