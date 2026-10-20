import {env} from 'cloudflare:workers';
import {db} from './server';

let queue:Promise<unknown>=Promise.resolve();
export function syncContentFiles(req:Request){
 const token=(env as unknown as Record<string,string>).GRAVE_FILES_TOKEN;
 if(!token)return Promise.resolve();
 const task=queue.then(async()=>{
  const url=new URL('/__grave_files',req.url);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Folder sync requires the local development server.');
  const workspace=await db().prepare("SELECT value FROM settings WHERE id='workspace'").first<{value:string}>();
  const {results}=await db().prepare('SELECT id,draft,published,revision FROM products').all<{id:string;draft:string;published:string|null;revision:number}>();
  const versions=await db().prepare('SELECT product_id,label,slug,snapshot,created FROM versions').all<{product_id:string;label:string;slug:string;snapshot:string;created:string}>();
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({versions:versions.results.map(v=>({...v,snapshot:JSON.parse(v.snapshot)})),workspace:JSON.parse(workspace!.value),products:results.map(r=>({...r,draft:JSON.parse(r.draft),published:r.published?JSON.parse(r.published):null}))})});
  if(!response.ok)throw new Error('Could not write content files to the project folder.');
 });
 queue=task.catch(()=>{});return task;
}
export async function withContentFiles(req:Request,response:Response){
 try{await syncContentFiles(req);}catch(e){console.error((e as Error).message);response.headers.set('X-Grave-Files-Error','1');}
 return response;
}
