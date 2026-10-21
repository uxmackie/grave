import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {contentFiles,writeContentSnapshot} from '../build/content-files.ts';
import {seed,initialWorkspace} from '../lib/model.ts';

test('Markdown copies preserve exact MDX and keep drafts separate from publication',()=>{
 const published=seed(),draft=structuredClone(published);
 draft.pages[0].source='---\ncustom: keep\n---\n\n{/* comment */}\n<Unknown x={1} />\n';
 const files=contentFiles({workspace:initialWorkspace,products:[{id:draft.id,draft,published,revision:3}]});
 assert.equal(files.get('products/product-grave/draft/pages/page-page-0.mdx'),draft.pages[0].source);
 assert.equal(files.get('products/product-grave/published/pages/page-page-0.mdx'),published.pages[0].source);
 const config=JSON.parse(files.get('products/product-grave/draft/product.json'));
 assert.deepEqual(config.nav,draft.nav);
 assert.equal(config.pages[0].title,draft.pages[0].title);
 assert.equal(config.pages[0].source,undefined);
});

test('snapshot writes update pages, remove only managed files and preserve unrelated files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'grave-content-test-'));
 try{
  const draft=seed();const snapshot={workspace:initialWorkspace,products:[{id:draft.id,draft,published:null,revision:1}]};
  await writeContentSnapshot(root,snapshot);
  await writeFile(join(root,'notes.txt'),'Keep my notes');
  const pageFile=join(root,'products/product-grave/draft/pages/page-page-0.mdx');
  draft.pages[0].source='Updated **Markdown**.\n';
  await writeContentSnapshot(root,snapshot);
  assert.equal(await readFile(pageFile,'utf8'),draft.pages[0].source);
  draft.pages.shift();await writeContentSnapshot(root,snapshot);
  await assert.rejects(access(pageFile),{code:'ENOENT'});
  snapshot.products=[];await writeContentSnapshot(root,snapshot);
  assert.equal(await readFile(join(root,'notes.txt'),'utf8'),'Keep my notes');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('content identities cannot create paths outside their folder',()=>{
 const draft=seed();draft.id='../escape';draft.pages[0].id='../../outside';
 const files=contentFiles({workspace:initialWorkspace,products:[{id:draft.id,draft,published:null,revision:1}]});
 assert.ok([...files.keys()].every(p=>!p.split('/').includes('..')));
 assert.ok([...files.keys()].some(p=>p.includes('%2E%2E%2F')));
});

test('tampered manifests cannot delete files outside content',async()=>{
 const root=await mkdtemp(join(tmpdir(),'grave-content-test-'));
 try{
  await writeFile(join(root,'.grave-files.json'),'["../outside.txt"]');
  await assert.rejects(writeContentSnapshot(root,{workspace:initialWorkspace,products:[]}),/Unsafe content path/);
 }finally{await rm(root,{recursive:true,force:true});}
});
