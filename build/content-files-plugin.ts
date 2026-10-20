import type {Plugin} from 'vite';
import {resolve} from 'node:path';
import {writeContentSnapshot,type ContentSnapshot} from './content-files';

export function contentFilesPlugin(token:string):Plugin{
 let queue=Promise.resolve();
 return {name:'grave-content-files',apply:'serve',configureServer(server){
  const root=resolve(server.config.root,'content');
  server.watcher.unwatch(root);
  server.middlewares.use('/__grave_files',async(req,res)=>{
   if(req.method!=='POST'||req.headers.authorization!=='Bearer '+token){res.statusCode=403;res.end();return;}
   try{
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>50*1024*1024)throw new Error('Content snapshot exceeds 50 MB');chunks.push(Buffer.from(chunk));}
    const snapshot=JSON.parse(Buffer.concat(chunks).toString('utf8')) as ContentSnapshot;
    const task=queue.then(()=>writeContentSnapshot(root,snapshot));queue=task.catch(()=>{});
    await task;res.statusCode=204;res.end();
   }catch(e){server.config.logger.error('Grave folder sync: '+(e as Error).message);res.statusCode=500;res.end('Folder sync failed');}
  });
 }};
}
