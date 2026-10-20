import {mkdir,readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {ProductRecord,Workspace,Product} from '../lib/model';

export type ContentSnapshot={workspace:Workspace;products:ProductRecord[];versions?:{product_id:string;label:string;slug:string;created:string;snapshot:Product}[]};
const segment=(value:string)=>{
 if(typeof value!=='string'||!value||value.length>150)throw new Error('Invalid content identity');
 return encodeURIComponent(value).replace(/\./g,'%2E');
};
export function contentFiles(snapshot:ContentSnapshot){
 const files=new Map<string,string>();
 files.set('workspace.json',JSON.stringify(snapshot.workspace,null,2)+'\n');
 for(const record of snapshot.products){
  const base='products/product-'+segment(record.id);
  const modes=[{mode:'draft',product:record.draft},{mode:'published',product:record.published},...(snapshot.versions||[]).filter(v=>v.product_id===record.id).map(v=>{const mode='versions/'+segment(v.slug);files.set(base+'/'+mode+'/version.json',JSON.stringify({label:v.label,slug:v.slug,created:v.created},null,2));return {mode,product:v.snapshot};})];
  for(const {mode,product} of modes){
   if(!product)continue;
   const {pages,snippets,templates,...settings}=product;
   const folder=base+'/'+mode;
   const metadata=pages.map(({source,...page})=>{
    const file='pages/page-'+segment(page.id)+'.mdx';
    files.set(folder+'/'+file,source);
    return {...page,file};
   });
   files.set(folder+'/product.json',JSON.stringify({...settings,revision:record.revision,pages:metadata},null,2)+'\n');
   for(const [name,source] of Object.entries(snippets))files.set(folder+'/snippets/snippet-'+segment(name)+'.mdx',source);
   files.set(folder+'/templates.json',JSON.stringify(templates.map(({name,source},i)=>{
    const file='templates/template-'+i+'.mdx';files.set(folder+'/'+file,source);return {name,file};
   }),null,2)+'\n');
  }
 }
 return files;
}

export async function writeContentSnapshot(root:string,snapshot:ContentSnapshot){
 root=resolve(root);
 async function checked(file:string){
  const target=resolve(root,file),rel=relative(root,target);
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Unsafe content path');
  // Do not follow user-created symlinks/junctions outside the content folder.
  let current=root;
  for(const part of ['',...rel.split(/[\\/]/)]){
   if(part)current=resolve(current,part);
   try{if((await lstat(current)).isSymbolicLink())throw new Error('Content paths cannot be symbolic links');}
   catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  }
  return target;
 }
 async function atomic(file:string,value:string){
  const target=await checked(file);await mkdir(dirname(target),{recursive:true});
  try{if(await readFile(target,'utf8')===value)return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const temp=target+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,value,'utf8');await rename(temp,target);}finally{await unlink(temp).catch(()=>{});}
 }
 const manifest='.grave-files.json';
 let previous:string[]=[];
 try{previous=JSON.parse(await readFile(await checked(manifest),'utf8'));if(!Array.isArray(previous)||previous.some(x=>typeof x!=='string'))throw new Error('Invalid content manifest');}
 catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const files=contentFiles(snapshot);
 for(const [file,value]of files)await atomic(file,value);
 for(const file of previous)if(!files.has(file))await unlink(await checked(file)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await atomic(manifest,JSON.stringify([...files.keys()],null,2)+'\n');
}
