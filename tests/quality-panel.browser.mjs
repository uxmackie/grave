// Run against a local dev server with Playwright installed:
// node --experimental-strip-types tests/quality-panel.browser.mjs
// All API traffic is mocked; no authored content is changed or published.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {seed,initialWorkspace} from '../lib/model.ts';
const product=seed();product.pages=product.pages.slice(0,2);
product.pages[0].description='';
product.pages[0].source='## Setup\n\n## Setup\n\n#### Deep\n\n[Broken](/grave/missing)\n\n<Snippet name="shared" />';
product.snippets.shared='<Image src="/test.png" />';
const fixture={workspace:initialWorkspace,revision:1,products:[{id:product.id,draft:product,published:null,revision:1}]};
const browser=await launchBrowser();
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname;
 return route.fulfill({json:path==='/api/auth'?{authenticated:true,configured:true}:path==='/api/workspace'?fixture:{revision:2}});
});
const publish=()=>page.getByRole('button',{name:'Publish',exact:true}).click();
const selected=locator=>locator.evaluate(el=>({focused:document.activeElement===el,text:el.value.slice(el.selectionStart,el.selectionEnd)}));
const quality=()=>page.locator('section[aria-labelledby="quality-title"]');
try{
 await page.goto((process.env.QUALITY_BASE_URL||'http://127.0.0.1:5173')+'/editor/grave');
 await publish();await page.getByRole('heading',{name:'Content quality'}).waitFor();
 assert.equal(await quality().getByRole('listitem').count(),5);
 assert.equal(await page.getByRole('button',{name:'Publish Grave',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Warnings',exact:true}).click();assert.equal(await quality().getByRole('listitem').count(),1);
 await page.getByRole('button',{name:'Open source for Introduction, missing-page'}).click();
 const source=page.getByRole('textbox',{name:'MDX source',exact:true});await source.waitFor();
 assert.deepEqual(await selected(source),{focused:true,text:'[Broken](/grave/missing)'});
 await publish();await page.getByRole('button',{name:'Open source for Introduction, snippet shared, image-alt'}).click();
 const snippet=page.getByRole('textbox',{name:'Snippet source'});await snippet.waitFor();
 assert.deepEqual(await selected(snippet),{focused:true,text:'<Image src="/test.png" />'});
 await page.getByRole('button',{name:'Close dialog'}).click();await publish();
 await page.getByRole('button',{name:'Open page settings for Introduction, missing-description'}).click();
 const description=page.getByRole('dialog').getByRole('textbox',{name:'Description',exact:true});
 assert.equal(await description.evaluate(el=>el===document.activeElement),true);
 await description.fill('A useful introduction.');await page.getByRole('button',{name:'Close dialog'}).click();await publish();
 await page.getByRole('button',{name:'Recheck',exact:true}).click();assert.match(await quality().getByRole('status').innerText(),/1 warning · 3 suggestions/);
 await page.getByRole('button',{name:'Recheck',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await page.getByRole('button',{name:'All',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal(await quality().getByRole('listitem').count(),1);
 await page.getByRole('button',{name:'All',exact:true}).click();
 await mkdir('.playwright',{recursive:true});
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.screenshot({path:'.playwright/quality-'+theme+'.png'});
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:320,height:740});
 assert.equal(await quality().evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 for(const button of await quality().getByRole('button').all()){
  await button.focus();assert.equal(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
 }
 await page.screenshot({path:'.playwright/quality-mobile.png'});
 await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('tab',{name:'Source',exact:true}).click();await source.fill('## Ready\n\nContent is ready.');await publish();
 assert.match(await quality().getByRole('status').innerText(),/No issues found/);
 assert.equal(await quality().getByRole('listitem').count(),0);
 assert.deepEqual(errors,[]);console.log('Quality panel browser checks passed: source/snippet/settings focus, filters, recheck, keyboard, both themes, 320px, reduced motion, and clean state.');
}finally{await browser.close();}
