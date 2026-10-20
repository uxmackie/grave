import type {Database} from './store';
import {db} from './server';
import {publicProduct,type Product} from './model';
import {versionProduct} from './releases';
export async function publishedProducts(){const {results}=await db().prepare('SELECT published FROM products WHERE published IS NOT NULL').all<{published:string}>();return results.map(r=>publicProduct(JSON.parse(r.published) as Product)).filter((p):p is Product=>!!p);}
export async function publicDocument(path:string[]){if(!path.length||path[0]==='editor')return null;const products=await publishedProducts();const current=products.find(p=>p.slug===path[0]||p.aliases?.includes(path[0]));if(!current)return null;const version=path[1]==='v'?path[2]:'';if(path[1]==='v'&&(!version||path.length>4))return null;if(!version&&path.length>2)return null;const product=version?await versionProduct(db() as unknown as Database,current.id,version):current;if(!product)return null;const slug=version?path[3]:path[1];const page=slug?product.pages.find(p=>p.slug===slug||product.redirects?.some(r=>r.from===slug&&r.pageId===p.id)):undefined;if(slug&&!page)return null;return {product,page,version};}
