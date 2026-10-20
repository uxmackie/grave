import type {Metadata} from 'next';
import type {Product,Page} from './model';
import {readerPath} from './reader-tools.ts';
export function documentMetadata(product:Product,page:Page|undefined,version='',origin=''):Metadata{const title=(page?page.title+' · ':'')+product.name+(version?' · '+version:'');const description=page?.description||product.description;const path=readerPath(product,page,version);const url=origin+path;return {title,description,alternates:{canonical:url},robots:{index:!version,follow:true},openGraph:{type:'website',title,description,url,siteName:product.name,images:[{url:origin+'/share.png',width:1200,height:630,alt:'Grave documentation'}]},twitter:{card:'summary_large_image',title,description,images:[origin+'/share.png']}};}
