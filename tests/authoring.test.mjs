import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../lib/mdx.ts';
import {convertTextBlock,insertBlock} from '../lib/authoring.ts';

test('text conversion preserves inline syntax and unrelated source',()=>{
 const text='**Bold** [link](/guide) `code` {/* comment */} <Custom value={1} />';
 const source='---\ntitle: Keep\n---\n\n## '+text+'\n\nTail.';
 const node=parse(source).tree.children[1];
 for(const prefix of ['', '### ', '> ', '- ']){
  const result=convertTextBlock(source,node,prefix);
  assert.equal(result,source.replace('## '+text,prefix+text));
  assert.equal(parse(result).error,undefined);
 }
});
test('conversion refuses to flatten nested lists',()=>{
 const source='- **First**\n  - Nested\n- Second';
 assert.equal(convertTextBlock(source,parse(source).tree.children[0],'## '),source);
});
test('slash insertion stays inside the current component and preserves following content',()=>{
 const source='<Callout type="info">\nFirst paragraph.\n\nSecond paragraph.\n</Callout>\n\nTail.';
 const next=insertBlock(source,'## Inserted\n',source.indexOf('First paragraph'));
 assert.equal(parse(next).error,undefined);
 const callout=parse(next).tree.children[0];
 assert.equal(callout.children[1].type,'heading');
 assert.ok(next.indexOf('Inserted')<next.indexOf('Second paragraph'));
 assert.ok(next.endsWith('</Callout>\n\nTail.'));
});
test('insertion does not split a list or discard trailing source',()=>{
 const source='- First\n- Second\n\n{/* keep */}\n';
 const next=insertBlock(source,'## Next\n',2);
 assert.equal(parse(next).error,undefined);
 assert.ok(next.startsWith('- First\n- Second\n\n## Next'));
 assert.ok(next.endsWith('\n\n{/* keep */}\n'));
 assert.equal(insertBlock(source,'## End\n'),source+'\n\n## End\n');
});
