import {versionProduct} from './releases.ts';
import {InvalidDraft,type Database} from './store.ts';
export type FeedbackInput={pageId:string;version?:string;helpful:boolean;comment?:string;visitor:string};
export function feedbackInput(value:unknown):FeedbackInput{
 if(!value||typeof value!=='object')throw new InvalidDraft('Choose a rating and keep feedback under 1,000 characters.');
 const body=value as FeedbackInput;
 if(typeof body.helpful!=='boolean'||typeof body.pageId!=='string'||typeof body.visitor!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.visitor)||typeof (body.comment??'')!=='string'||(body.comment?.length||0)>1000||typeof (body.version??'')!=='string')throw new InvalidDraft('Choose a rating and keep feedback under 1,000 characters.');
 return body;
}
export async function saveFeedback(db:Database,productId:string,body:FeedbackInput,visitorHash:string,rateKey:string,now=Date.now()){
 const product=await versionProduct(db,productId,body.version||'');
 if(!product?.pages.some(page=>page.id===body.pageId))throw Object.assign(new Error('This page is no longer available for feedback.'),{status:404});
 if(product.reader?.feedback===false)throw new InvalidDraft('Feedback is disabled for this documentation.');
 await db.prepare('DELETE FROM feedback_limits WHERE reset<?').bind(now).run();
 const limit=await db.prepare('INSERT INTO feedback_limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<50').bind(rateKey,now+86400000).run();
 if(!limit.meta.changes)throw Object.assign(new Error('Feedback limit reached. Try again tomorrow.'),{status:429});
 await db.prepare('INSERT INTO feedback(id,product_id,page_id,version,helpful,comment,visitor,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(product_id,page_id,version,visitor) DO UPDATE SET helpful=excluded.helpful,comment=excluded.comment,created=excluded.created').bind(crypto.randomUUID(),productId,body.pageId,body.version||'',body.helpful?1:0,(body.comment||'').trim(),visitorHash,new Date(now).toISOString()).run();
}
