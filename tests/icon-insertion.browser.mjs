// Run against a local dev server with Playwright installed:
// node --experimental-strip-types tests/icon-insertion.browser.mjs
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
  {source:'Before middle after.',text:'Before middle after.',offset:7,expected:/^Before <Icon[^>]*\/>middle after\.$/},
  {source:'Before **bold text** after.',text:'bold text',offset:5,expected:/Before \*\*bold \*\*<Icon[^>]*\/>\*\*text\*\* after\./},
  {source:'- Before middle after.',text:'Before middle after.',offset:7,expected:/^- Before <Icon[^>]*\/>middle after\.$/},
  {source:'Before middle after.',text:'Before middle after.',offset:7,blockPicker:true,expected:/^Before <Icon[^>]*\/>middle after\.$/},
  {source:'Repeated text. Repeated text.',text:'Repeated text. Repeated text.',offset:15,expected:/^Repeated text\. <Icon[^>]*\/>Repeated text\.$/}
 ];
 for(const item of cases){
  await page.getByRole('tab',{name:'Source',exact:true}).click();
  await page.getByRole('textbox',{name:'MDX source',exact:true}).fill(item.source);
  await page.getByRole('tab',{name:'Visual',exact:true}).click();
  const editable=page.locator('.visual-canvas [contenteditable=true][data-start]').filter({hasText:item.text}).first();
  await editable.evaluate((el,item)=>{el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let text;while(text=walker.nextNode()){if(text.textContent===item.text){const r=document.createRange();r.setStart(text,item.offset);r.collapse(true);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);return;}}throw Error('Text node not found');},item);
  if(item.blockPicker){await page.getByRole('button',{name:'Add a block'}).click();await page.getByRole('dialog').getByRole('button',{name:'Icon',exact:true}).click();}else await page.getByRole('button',{name:'Insert icon at cursor'}).click();
  await page.getByRole('textbox',{name:'Tooltip content (MDX)'}).fill('Two lines\n\nMore details.');
  await page.getByRole('button',{name:'Insert icon',exact:true}).click();
  await page.getByRole('tab',{name:'Source',exact:true}).click();
  const actual=await page.getByRole('textbox',{name:'MDX source',exact:true}).inputValue();
  assert.match(actual,item.expected);assert.equal((actual.match(/<Icon /g)||[]).length,1);
 }
 assert.deepEqual(errors,[]);console.log('Icon caret insertion passed for paragraphs, bold text, lists, and repeated text.');
}finally{await browser.close();}
