// Run against a local dev server with Playwright installed:
// node --experimental-strip-types tests/link-formatting.browser.mjs
// All API traffic is mocked; no authored content is changed or published.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {seed,initialWorkspace} from '../lib/model.ts';
const product=seed();product.pages=product.pages.slice(0,2);
product.pages[0].description='';
product.pages[0].source='Before middle after.';
product.snippets.shared='<Image src="/test.png" />';
const fixture={workspace:initialWorkspace,revision:1,products:[{id:product.id,draft:product,published:null,revision:1}]};
const browser=await chromium.launch({headless:true,...(process.env.QUALITY_BROWSER_PATH?{executablePath:process.env.QUALITY_BROWSER_PATH}:{channel:'chrome'})});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**',route=>{
 const path=new URL(route.request().url()).pathname;
 return route.fulfill({json:path==='/api/auth'?{authenticated:true,configured:true}:path==='/api/workspace'?fixture:{revision:2}});
});
try{
 await page.goto((process.env.QUALITY_BASE_URL||'http://127.0.0.1:5173')+'/editor/grave');
 const cases=[
  {source:'Before bold text after.',text:'bold text',makeBold:true,expected:'Before [**bold text**](https://example.com/) after.'},
  {source:'Before **bold text** after.',text:'bold text',expected:'Before [**bold text**](https://example.com/) after.'},
  {source:'**bold text**',text:'bold text',expected:'[**bold text**](https://example.com/)'},
  {source:'Before *italic text* after.',text:'italic text',expected:'Before [*italic text*](https://example.com/) after.'},
  {source:'Before **[bold text](https://old.example/)** after.',text:'bold text',expected:'Before [**bold text**](https://example.com/) after.'},
  {source:'## **bold text**',text:'bold text',expected:'## [**bold text**](https://example.com/)'},
  {source:'- **bold text**',text:'bold text',expected:'- [**bold text**](https://example.com/)'},
  {source:'Before **bold text** after.',text:'bold text',wholeElement:true,expected:'Before [**bold text**](https://example.com/) after.'}
 ];
 for(const item of cases){
  await page.getByRole('tab',{name:'Source',exact:true}).click();await page.getByRole('textbox',{name:'MDX source',exact:true}).fill(item.source);await page.getByRole('tab',{name:'Visual',exact:true}).click();
  const editable=page.locator('.visual-canvas [contenteditable=true][data-start]').filter({hasText:item.text}).first();
  await editable.evaluate((el,item)=>{el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){if(text.textContent.includes(item.text)){const r=document.createRange();if(item.wholeElement)r.selectNode(text.parentElement);else{const start=text.textContent.indexOf(item.text);r.setStart(text,start);r.setEnd(text,start+item.text.length);}const selection=getSelection();selection.removeAllRanges();selection.addRange(r);return;}}throw Error('Text not found');},item);
  if(item.makeBold){await page.getByRole('button',{name:'Bold',exact:true}).click();await editable.locator('strong').waitFor();await editable.evaluate(el=>{el.focus();const text=el.querySelector('strong').firstChild;const r=document.createRange();r.setStart(text,0);r.setEnd(text,text.length);getSelection().removeAllRanges();getSelection().addRange(r);});}
  await page.getByRole('button',{name:'Insert link',exact:true}).click();await page.getByRole('textbox',{name:'Link URL or page search'}).fill('https://example.com/');await page.getByRole('button',{name:'Use this link',exact:true}).click();
  await page.getByRole('tab',{name:'Source',exact:true}).click();const actual=await page.getByRole('textbox',{name:'MDX source',exact:true}).inputValue();assert.equal(actual,item.expected);assert.ok(!actual.includes('****'));
  await page.getByRole('tab',{name:'Preview',exact:true}).click();await page.locator('.prose a[href="https://example.com/"]').waitFor();if(item.source.includes('**'))assert.equal(await page.locator('.prose a strong').textContent(),item.text);
 }
 assert.deepEqual(errors,[]);console.log('Link formatting passed for bold, italic, existing links, headings, lists, and element selections.');
}finally{await browser.close();}
