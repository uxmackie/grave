// Integration test: creates one temporary product in the LOCAL workspace and deletes it in finally.
// node --experimental-strip-types tests/reader-integration.browser.mjs
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {newPage} from '../lib/model.ts';
const base=process.env.READER_BASE_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('This test only runs locally.');
const vars=await readFile('.dev.vars','utf8');const password=vars.match(/^EDITOR_PASSWORD\s*=\s*(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g,'');
if(!password)throw Error('Local editor password is required.');
const browser=await chromium.launch({headless:true,...(process.env.QUALITY_BROWSER_PATH?{executablePath:process.env.QUALITY_BROWSER_PATH}:{channel:'chrome'})});
const context=await browser.newContext({viewport:{width:1280,height:900}});const request=context.request;
let record;let revision=1;const report={};
const api=async(path,method='GET',data)=>{const response=await request.fetch(base+path,{method,data});const result=await response.json();assert.ok(response.ok(),path+': '+JSON.stringify(result));return result;};
try{
 await api('/api/auth','POST',{password});
 record=await api('/api/products','POST',{name:'Reader test '+Date.now()});const product=record.draft;
 const first={...newPage('Reader test guide','## Blue widget\n\nFind the blue widget here.\n\n[Next guide](/'+product.slug+'/second-guide)\n\n<Accordion title="Extra details">\nAccordion print content.\n</Accordion>\n\n<Tabs>\n<Tab title="First">\nFirst tab content.\n</Tab>\n<Tab title="Second">\nSecond tab print content.\n</Tab>\n</Tabs>'),draft:false,description:'A helpful test guide.'};
 const second={...newPage('Second guide','## Next step\n\nSecond page content.'),draft:false,description:'Another guide.'};
 product.pages=[first,second];product.home.featured=[first.id];product.home.start=first.id;product.redirects=[{from:'old-guide',pageId:first.id}];
 revision=(await api('/api/products/'+product.id,'PUT',{draft:product,revision})).revision;
 revision=(await api('/api/products/'+product.id+'/publish','POST',{revision})).revision;
 await api('/api/products/'+product.id+'/versions','POST',{label:'v1',revision});
 const archived=await api('/api/products/'+product.id+'/versions?version=v1');assert.match(archived.product.pages[0].source,/blue widget/);
 const redirect=await request.get(base+'/'+product.slug+'/old-guide?ref=test',{maxRedirects:0});assert.equal(redirect.status(),308);assert.equal(new URL(redirect.headers().location,base).pathname,'/'+product.slug+'/'+first.slug);assert.equal(new URL(redirect.headers().location,base).search,'?ref=test');
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await page.getByRole('heading',{name:'Find your next answer.'}).waitFor();
 await page.getByRole('button',{name:/Search all documentation/}).click();const search=page.getByRole('combobox',{name:'Search documentation'});await search.fill('blue widget');await page.getByRole('option').first().waitFor();await search.press('Enter');await page.getByRole('heading',{name:'Reader test guide',exact:true}).waitFor();
 assert.match(page.url(),new RegExp(first.slug));await page.getByLabel('Documentation version',{exact:true}).selectOption('v1');await page.waitForURL('**/v/v1/'+first.slug);await page.getByRole('heading',{name:first.title,exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Next guide',exact:true}).getAttribute('href'),'/'+product.slug+'/v/v1/second-guide');
 await page.getByRole('button',{name:'Not really',exact:true}).click();await page.getByRole('textbox',{name:/What could we improve/}).fill('An example would help.');await page.getByRole('button',{name:'Send feedback',exact:true}).click();await page.getByText('Thanks. Your feedback has been saved.').waitFor();
 const feedback=await api('/api/products/'+product.id+'/feedback');assert.equal(feedback.summary[0].version,'v1');assert.equal(feedback.summary[0].unhelpful,1);assert.equal(feedback.comments[0].comment,'An example would help.');
 await mkdir('.playwright',{recursive:true});await page.screenshot({path:'.playwright/reader-desktop.png'});
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await page.getByText('Second tab print content.').isVisible(),true);assert.equal(await page.getByText('Accordion print content.').isVisible(),true);
 await page.emulateMedia({media:'print'});await page.screenshot({path:'.playwright/reader-print.png',fullPage:true});await page.pdf({path:'.playwright/reader-print.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.playwright/reader-mobile.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1280,height:900});await page.getByLabel('Documentation version',{exact:true}).selectOption('');await page.waitForURL('**/'+product.slug+'/'+first.slug);
 // Latest changes leave the archived version untouched.
 product.pages[0].source+='\n\nLatest only content.';revision=(await api('/api/products/'+product.id,'PUT',{draft:product,revision})).revision;revision=(await api('/api/products/'+product.id+'/publish','POST',{revision})).revision;
 assert.ok(!(await api('/api/products/'+product.id+'/versions?version=v1')).product.pages[0].source.includes('Latest only content.'));
 await page.goto(base+'/editor/'+product.id);await page.getByRole('button',{name:'Versions',exact:true}).click();await page.getByRole('dialog').getByRole('link',{name:'v1',exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Reader feedback',exact:true}).click();await page.getByText('An example would help.').waitFor();await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Content freshness',exact:true}).click();await page.getByRole('button',{name:'Mark reviewed',exact:true}).first().click();assert.equal(await page.getByRole('button',{name:'Mark reviewed',exact:true}).count(),1);await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Reader settings',exact:true}).click();await page.getByRole('textbox',{name:'Old page slug'}).fill('another-old-guide');await page.getByRole('button',{name:'Add redirect',exact:true}).click();await page.getByRole('button',{name:'Remove redirect another-old-guide'}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Publish',exact:true}).click();await page.getByRole('heading',{name:'Content quality',exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/products/'+product.id+'/feedback')).status(),401);await anonymous.close();
 report.checks=['workspace home','global search','heading navigation','308 redirect','immutable version','version-aware links','persisted feedback','private dashboard','expanded print content','PDF export','mobile overflow','versions management','feedback dashboard','review dates','redirect management'];report.pageErrors=errors;assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));await writeFile('.playwright/reader-integration-results.json',JSON.stringify(report,null,2));
}finally{
 if(record){const workspace=await api('/api/workspace?editor=1');const current=workspace.products.find(p=>p.id===record.id);if(current){const deleted=await request.delete(base+'/api/products/'+record.id+'?revision='+current.revision);assert.ok(deleted.ok(),'Temporary product cleanup failed');}}
 await request.delete(base+'/api/auth');await browser.close();
}
