import {requireEditor,handle,json} from '@/lib/server';
import {syncContentFiles} from '@/lib/content-files';
export async function POST(req:Request){return handle(async()=>{await requireEditor(req);await syncContentFiles(req);return json({ok:true});});}
