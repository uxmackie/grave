// Focused checks for the source editor. All API traffic is mocked; no authored
// content is changed or published.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser} from './browser-launch.mjs';
import {seed,initialWorkspace} from '../lib/model.ts';

const product=seed();
product.pages=product.pages.slice(0,2);
const editedPage=product.pages[0];
editedPage.source='## Setup\n\nFirst paragraph.\n\n- one\n- two';
const fixture={workspace:initialWorkspace,revision:1,products:[{id:product.id,draft:product,published:null,revision:1}]};
const base=process.env.QUALITY_BASE_URL||'http://127.0.0.1:5173';
const browser=await launchBrowser();
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
const errors=[];
const saves=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**',route=>{
  const request=route.request();
  const path=new URL(request.url()).pathname;
  if(request.method()==='PUT') saves.push(request.postDataJSON());
  return route.fulfill({
    json:path==='/api/auth'
      ? {authenticated:true,configured:true}
      : path==='/api/workspace'
        ? fixture
        : path.endsWith('/versions')
          ? {versions:[]}
          : {revision:2},
  });
});

const source=page.getByRole('textbox',{name:'MDX source',exact:true});
const fill=async(text)=>{
  await source.fill(text);
  await page.waitForTimeout(80);
};
const focusRange=async(start,end)=>{
  await source.evaluate((el,range)=>{
    el.focus();
    el.setSelectionRange(range.start,range.end);
  },{start,end});
};
const value=async()=>{
  await page.waitForTimeout(80);
  return source.inputValue();
};

try{
  await page.goto(base+'/editor/grave');
  await page.getByRole('tab',{name:'Visual',exact:true}).waitFor();
  await page.getByRole('tab',{name:'Source',exact:true}).click();
  await source.waitFor();

  assert.equal(await source.inputValue(),editedPage.source);
  assert.equal(await page.locator('.editor-source-shell .source-line').count(),6);
  assert.equal(await page.locator('.editor-source-shell .source-editor pre').getAttribute('aria-hidden'),'true');
  const describedBy=await source.getAttribute('aria-describedby');
  assert.ok(describedBy,'The source editor should describe its keyboard behavior');
  assert.match(await page.locator(`[id="${describedBy}"]`).innerText(),/Escape, then Tab/);

  const caretSource=Array.from({length:40},(_,index)=>`line ${String(index+1).padStart(2,'0')} content`).join('\n');
  await fill(caretSource);
  const caretOffset=caretSource.indexOf('line 10 ')+'line 10 '.length;
  await focusRange(caretOffset,caretOffset);
  await page.keyboard.type('XYZ',{delay:15});
  const typedLines=await source.inputValue();
  assert.equal(typedLines.split('\n')[9],'line 10 XYZcontent');
  assert.equal(typedLines.split('\n').at(-1),'line 40 content');
  assert.equal(await source.evaluate(el=>el.value.slice(0,el.selectionStart).split('\n').length),10);

  await fill('alpha\nbeta');
  await focusRange(2,2);
  await page.keyboard.press('Tab');
  assert.equal(await value(),'al  pha\nbeta');

  await fill('alpha\nbeta');
  await focusRange(0,5);
  await page.keyboard.press('Tab');
  assert.equal(await value(),'  alpha\nbeta');

  await fill('alpha\n\nbeta');
  await focusRange(0,(await source.inputValue()).length);
  await page.keyboard.press('Tab');
  const indented=await value();
  assert.equal(indented,'  alpha\n\n  beta');

  await focusRange(0,indented.length);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await value(),'alpha\n\nbeta');

  await fill('alpha\nbeta');
  await focusRange(2,2);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await source.evaluate(el=>document.activeElement===el),false);
  await source.focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  assert.equal(await source.evaluate(el=>document.activeElement===el),false);

  const saveResponse=page.waitForResponse(response=>
    response.request().method()==='PUT'&&response.url().endsWith('/api/products/grave')
  );
  await source.focus();
  await fill('## Saved\n\nAutosave check.');
  await saveResponse;
  await page.waitForTimeout(100);
  const savedPage=saves.at(-1)?.draft?.pages?.find(item=>item.id===editedPage.id);
  assert.equal(savedPage?.source,'## Saved\n\nAutosave check.');

  await page.getByRole('tab',{name:'Preview',exact:true}).click();
  await page.getByRole('heading',{name:'Saved'}).waitFor();
  await page.getByRole('tab',{name:'Source',exact:true}).click();
  await source.waitFor();
  assert.equal(await source.inputValue(),'## Saved\n\nAutosave check.');

  const metadataSave=page.waitForResponse(response=>
    response.request().method()==='PUT'&&response.url().endsWith('/api/products/grave')
  );
  await fill('---\ntitle: Renamed page\n---\n\nBody');
  await metadataSave;
  await page.waitForTimeout(100);
  const renamedPage=saves.at(-1)?.draft?.pages?.find(item=>item.id===editedPage.id);
  assert.equal(renamedPage?.title,'Renamed page');

  await page.getByRole('tab',{name:'Visual',exact:true}).click();
  const editable=page.locator('.visual-canvas [contenteditable=true][data-start]').filter({hasText:'Body'}).first();
  await editable.waitFor();
  await editable.evaluate(el=>{
    el.focus();
    const range=document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection=getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.type(' Added in visual mode.',{delay:15});
  await page.waitForTimeout(100);
  assert.equal(await editable.innerText(),'Body Added in visual mode.');
  await page.getByRole('tab',{name:'Source',exact:true}).click();
  assert.match(await source.inputValue(),/Body Added in visual mode\.$/);

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:320,height:740});
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.editor-source-shell').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await source.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return rect.width>0&&rect.left>=0&&rect.right<=innerWidth;
  }),true);
  await mkdir('.playwright',{recursive:true});
  await page.screenshot({path:'.playwright/source-editor-mobile.png'});

  assert.deepEqual(errors,[]);
  console.log('Source editor browser checks passed: source fidelity, selected-line typing, Tab/Shift+Tab indentation, keyboard escape, autosave, metadata, visual typing, preview, and 320px layout.');
}finally{
  await context.close();
  await browser.close();
}
