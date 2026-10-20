import {withContentFiles} from '@/lib/content-files';
import {db,json,handle,requireEditor} from '@/lib/server';
import {saveDraft,type Database} from '@/lib/store';
import type {Product} from '@/lib/model';
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{await requireEditor(req);const {id}=await params;const {draft,revision}=await req.json() as {draft:Product;revision:number};if(draft.id!==id)return json({error:'Product identity does not match.'},400);const next=await saveDraft(db() as unknown as Database,id,draft,revision);return withContentFiles(req,json({revision:next}));});}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){return handle(async()=>{await requireEditor(req);const {id}=await params;const revision=Number(new URL(req.url).searchParams.get('revision'));const result=await db().prepare('DELETE FROM products WHERE id=? AND revision=?').bind(id,revision).run();if(!result.meta.changes)return json({error:'Product changed in another session. Reload before deleting.'},409);return withContentFiles(req,json({ok:true}));});}
