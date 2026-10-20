import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,newPage} from '../lib/model.ts';
import {publishChecks} from '../lib/publish-checks.ts';
const fixture=source=>{const product=seed();product.pages=product.pages.slice(0,1);product.pages[0].source=source;return product;};
test('quality checks identify source spans, severity, and metadata targets',()=>{
 const product=fixture('## Setup\n\n## Setup\n\n#### Deep\n\n[Empty]()\n\n<Icon name="book" href="https://example.com" />');
 product.pages[0].description='';
 const result=publishChecks(product);assert.equal(result.issues[0].severity,'warning');const issues=['missing-description','duplicate-heading','heading-level','empty-link','icon-name'].map(code=>result.issues.find(issue=>issue.code===code));
 assert.deepEqual(issues.map(i=>i.code),['missing-description','duplicate-heading','heading-level','empty-link','icon-name']);
 assert.equal(issues[0].target,'settings');assert.equal(issues[0].severity,'suggestion');
 assert.equal(issues[1].line,3);assert.equal(product.pages[0].source.slice(issues[1].start,issues[1].end),'## Setup');
 assert.equal(issues[3].severity,'warning');assert.equal(issues[3].pageId,product.pages[0].id);
});
test('snippet issues target the snippet and tooltip issues target the containing icon',()=>{
 const product=fixture('<Snippet name="outer" />');
 product.snippets.outer='<Snippet name="inner" />';
 product.snippets.inner='<Icon name="book" tooltip="[Broken](/grave/missing)" />\n\n<Snippet name="outer" />';
 const issues=publishChecks(product).issues;
 assert.equal(issues.length,1);assert.equal(issues[0].snippet,'inner');assert.equal(issues[0].code,'missing-page');
 assert.equal(product.snippets.inner.slice(issues[0].start,issues[0].end),'<Icon name="book" tooltip="[Broken](/grave/missing)" />');
});
test('private pages are excluded; rechecking reflects repairs without mutating content',()=>{
 const product=fixture('[Broken](#missing)');product.pages.push(newPage('Private','[Missing](/grave/nope)'));
 const before=JSON.stringify(product);assert.equal(publishChecks(product).warnings.length,1);assert.equal(JSON.stringify(product),before);
 product.pages[0].source='## Present\n\n[Working](#present)';assert.equal(publishChecks(product).issues.length,0);
});
test('descriptive linked icons pass; decorative images receive suggestions rather than errors',()=>{
 const product=fixture('<Icon href="https://example.com" label="Read the guide" />\n\n<Icon href="https://example.com" tooltip="Read **the guide**" />\n\n![ ](/decorative.png)');
 const issues=publishChecks(product).issues;assert.equal(issues.length,1);assert.equal(issues[0].code,'image-alt');assert.equal(issues[0].severity,'suggestion');
});
