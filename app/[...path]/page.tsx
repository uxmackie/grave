import {headers} from 'next/headers';
import {publicDocument} from '@/lib/public-documents';
import {documentMetadata} from '@/lib/seo';
import GraveApp from '@/components/grave-app';
import {permanentRedirect} from 'next/navigation';
import {db} from '@/lib/server';
import {publicProduct,type Product} from '@/lib/model';
import {resolveRedirect,readerPath} from '@/lib/reader-tools';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{path:string[]}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {path}=await params;let destination:string|undefined;
 if(path[0]!=='editor'){
  let row:{published:string}|undefined|null;
  try { row=await db().prepare("SELECT published FROM products WHERE json_extract(published,'$.slug')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(published,'$.aliases')) WHERE value=?)").bind(path[0],path[0]).first<{published:string}>(); } catch { row=undefined; }
  const product=row?publicProduct(JSON.parse(row.published) as Product):null;
  if(product){if(product.slug!==path[0])destination='/'+product.slug+(path.length>1?'/'+path.slice(1).map(encodeURIComponent).join('/'):'');if(path.length===2){const page=resolveRedirect(product,path[1]);if(page)destination=readerPath(product,page);}}
 }
 if(destination){const query=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams||{})){for(const item of Array.isArray(value)?value:value===undefined?[]:[value])query.append(key,item);}permanentRedirect(destination+(query.size?'?'+query.toString():''));}
 return <GraveApp/>;
}

export async function generateMetadata({params}:{params:Promise<{path:string[]}>}){try{const {path}=await params;const doc=await publicDocument(path);if(!doc)return {title:path[0]==='editor'?'Editor · Grave':'Page not found · Grave',robots:{index:false,follow:false}};const h=await headers();const host=h.get('host')||'localhost';const origin=(host.startsWith('localhost')||host.startsWith('127.0.0.1')?'http://':'https://')+host;return documentMetadata(doc.product,doc.page,doc.version,origin);}catch{return {title:'Grave documentation',robots:{index:false,follow:false}};}}
