import {publishedSnapshot} from './reader-tools.ts';
import type {Product,ProductRecord,Page} from './model';
/** All writes use compare-and-swap revisions; D1 batches commit atomically. */
export type Statement={bind:(...values:unknown[])=>Statement;first:<T>()=>Promise<T|null>;all:<T>()=>Promise<{results:T[]}>;run:()=>Promise<{meta:{changes:number}}>};
export type Database={prepare:(sql:string)=>Statement;batch:(statements:Statement[])=>Promise<{meta:{changes:number}}[]>};
export class Conflict extends Error {status=409;}
export class InvalidDraft extends Error {status=422;}
export async function readProduct(db:Database,id:string):Promise<ProductRecord|null>{const row=await db.prepare('SELECT * FROM products WHERE id=?').bind(id).first<{id:string;draft:string;published:string|null;revision:number}>();return row?{id:row.id,draft:JSON.parse(row.draft),published:row.published?JSON.parse(row.published):null,revision:row.revision}:null;}
export async function saveDraft(db:Database,id:string,draft:Product,revision:number){
 const current=await readProduct(db,id);if(!current)throw new Error('Product no longer exists.');
 if(current.revision!==revision)throw new Conflict('A newer draft was saved in another session. Download your backup, then reload to review it.');
 const collision=await db.prepare("SELECT id FROM products WHERE id<>? AND (slug=? OR json_extract(published,'$.slug')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(published,'$.aliases')) WHERE value=?))").bind(id,draft.slug,draft.slug,draft.slug).first();
 if(collision)throw new InvalidDraft('This product slug is already used by another draft or published product. Choose another slug.');
 const serialized=JSON.stringify(draft);
 const statements=[db.prepare('UPDATE products SET draft=?,slug=?,revision=revision+1 WHERE id=? AND revision=?').bind(serialized,draft.slug,id,revision)];
 for(const page of current.draft.pages){if(JSON.stringify(page)!==JSON.stringify(draft.pages.find(x=>x.id===page.id)))statements.push(db.prepare('INSERT INTO history(id,product_id,page_id,page,created,reason) SELECT ?,?,?,?,?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM products WHERE id=? AND revision=? AND draft=?)').bind(crypto.randomUUID(),id,page.id,JSON.stringify(page),new Date().toISOString(),'Saved draft',id,revision+1,serialized));}
 const result=await db.batch(statements);if(!result[0].meta.changes)throw new Conflict('Draft changed in another session.');return revision+1;
}
export async function publishProduct(db:Database,id:string,revision:number){const current=await readProduct(db,id);if(!current||current.revision!==revision)throw new Conflict('Draft changed during publication. Review again.');const snapshot=publishedSnapshot(current.draft,current.published);const result=await db.prepare('UPDATE products SET published=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(snapshot),id,revision).run();if(!result.meta.changes)throw new Conflict('Draft changed during publication. Review again.');return revision+1;}
export async function pageHistory(db:Database,productId:string,pageId:string){const {results}=await db.prepare('SELECT * FROM history WHERE product_id=? AND page_id=? ORDER BY created DESC LIMIT 100').bind(productId,pageId).all<{page:string;id:string;created:string;reason:string}>();return results.map(r=>({...r,page:JSON.parse(r.page) as Page}));}
