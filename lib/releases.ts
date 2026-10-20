import {publicProduct,slugify,type Product} from './model.ts';
import {readProduct,Conflict,InvalidDraft,type Database} from './store.ts';
export async function createVersion(db:Database,productId:string,label:string,revision:number){
 label=label.trim();const slug=slugify(label);
 if(!label||label.length>60||!slug||slug==='latest')throw new InvalidDraft('Use a version name of 1–60 characters, such as v1.0. Latest is reserved.');
 const current=await readProduct(db,productId);if(!current?.published)throw new InvalidDraft('Publish this product before saving a version.');
 if(current.revision!==revision)throw new Conflict('The product changed. Reload before saving a version.');
 if(await db.prepare('SELECT id FROM versions WHERE product_id=? AND slug=?').bind(productId,slug).first())throw new InvalidDraft('This version already exists. Choose a different name.');
 const snapshot=publicProduct(current.published);if(!snapshot)throw new InvalidDraft('Make the published product visible before saving a version.');
 const id=crypto.randomUUID(),created=new Date().toISOString();
 const result=await db.prepare('INSERT INTO versions(id,product_id,label,slug,snapshot,created) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM products WHERE id=? AND revision=?)').bind(id,productId,label,slug,JSON.stringify(snapshot),created,productId,revision).run();
 if(!result.meta.changes)throw new Conflict('The product changed. Reload before saving a version.');return {id,label,slug,created};
}
export async function versionProduct(db:Database,productId:string,version=''):Promise<Product|null>{
 const current=await readProduct(db,productId);if(!current?.published?.visible)return null;
 if(!version)return publicProduct(current.published);
 const row=await db.prepare('SELECT snapshot FROM versions WHERE product_id=? AND slug=?').bind(productId,version).first<{snapshot:string}>();
 if(!row)return null;const snapshot=JSON.parse(row.snapshot) as Product;return publicProduct({...snapshot,readerSourceSlug:snapshot.slug,slug:current.published.slug});
}
