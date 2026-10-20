import {db,json,handle,requireEditor,sameOrigin,digest} from '@/lib/server';
import {feedbackInput,saveFeedback} from '@/lib/feedback';
import type {Database} from '@/lib/store';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{await requireEditor(req);const {id}=await params;const summary=await db().prepare('SELECT page_id,version,SUM(helpful) AS helpful,COUNT(*)-SUM(helpful) AS unhelpful FROM feedback WHERE product_id=? GROUP BY page_id,version ORDER BY unhelpful DESC').bind(id).all();const comments=await db().prepare("SELECT id,page_id,version,helpful,comment,created FROM feedback WHERE product_id=? AND comment<>'' ORDER BY created DESC LIMIT 200").bind(id).all();return json({summary:summary.results,comments:comments.results});});}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{
 if(!sameOrigin(req))return json({error:'Invalid request origin.'},403);
 const {id}=await params;const raw=await req.text();if(raw.length>5000)return json({error:'Keep feedback under 1,000 characters.'},413);
 let value:unknown;try{value=JSON.parse(raw);}catch{return json({error:'Send valid feedback and retry.'},400);}const body=feedbackInput(value);
 const key=await digest((req.headers.get('cf-connecting-ip')||'local')+':'+new Date().toISOString().slice(0,10));
 await saveFeedback(db() as unknown as Database,id,body,await digest(body.visitor),key);return json({ok:true});
});}
