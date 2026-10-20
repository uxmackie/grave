import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,newPage} from '../lib/model.ts';
import {movePage} from '../lib/navigation.ts';
import {publishChecks} from '../lib/publish-checks.ts';
import {flatten} from '../lib/model.ts';
test('moving a page preserves content and metadata and assigns exactly once',()=>{
 const product=seed();const page=product.pages[0];
 const moved=movePage(product,page.id,'api-basics','page-6');
 assert.deepEqual(moved.pages,product.pages);
 assert.equal(flatten(moved.nav).filter(n=>n.pageId===page.id).length,1);
 assert.equal(flatten(moved.nav).find(n=>n.id==='api-basics').children[0].pageId,page.id);
 assert.equal(flatten(product.nav).find(n=>n.id==='get-started').children[0].pageId,page.id);
 const unassigned=movePage(moved,page.id,null,'page-1');
 assert.ok(!flatten(unassigned.nav).some(n=>n.pageId===page.id));
 assert.equal(unassigned.pages[0].id,page.id);
 assert.equal(movePage(product,page.id,'missing'),product);
});
test('publish review catches unavailable destinations, missing headings and image descriptions',()=>{
 const product=seed();product.pages[1].draft=true;
 product.pages[0].source='[Excluded](/grave/quickstart) [Broken](/grave/missing) [Heading](#missing)\n\n![ ](/image.png)\n\n<Icon name="circle-info" href="/grave/missing" />';
 const result=publishChecks(product);
 assert.equal(result.issues.filter(issue=>['missing-page','missing-anchor'].includes(issue.code)).length,4);
 assert.equal(result.issues.filter(issue=>issue.code==='image-alt').length,1);
 assert.deepEqual(result.excluded,[{title:'Quickstart',reason:'Draft'}]);
});
test('publish review follows snippets and ignores external destinations and private content',()=>{
 const product=seed();product.pages=product.pages.slice(0,1);product.pages[0].source='## Valid\n\n[Here](#valid) [External](https://example.com)\n\n<Snippet name="shared" />';
 product.snippets.shared='<Image src="/x" />';product.pages.push(newPage('Private','[Bad](/grave/missing)'));
 const result=publishChecks(product);assert.equal(result.issues.length,1);assert.match(result.issues[0].message,/alternative text/);assert.equal(result.issues[0].snippet,'shared');
});
