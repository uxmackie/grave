import type {Product} from './model.ts';
import {safeUrl} from './mdx.ts';
export function readerLink(product:Product,href:string){const url=safeUrl(href);const prefix='/'+product.slug+'/';const sourcePrefix='/'+(product.readerSourceSlug||product.slug)+'/';const match=url.startsWith(prefix)?prefix:url.startsWith(sourcePrefix)?sourcePrefix:'';if(product.readerVersion&&match&&!url.slice(match.length).startsWith('v/'))return prefix+'v/'+encodeURIComponent(product.readerVersion)+'/'+url.slice(match.length);return url;}
