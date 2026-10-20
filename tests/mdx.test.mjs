import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,raw,quoteAttribute,setAttribute,setAttributes,attributes,metadata,updateMetadata,replacement,headings,safeUrl,blocks} from '../lib/mdx.ts';
const fixture=`---
title: Preserve this
custom:
  nested: [one, two]
---

{/* keep this comment */}

<Callout type="warning" custom={{ deep: true }}>
## A heading

Some **bold** text and an <Unknown value={doNotExecute()} />.
</Callout>

<Unsupported data={{nested: ['a', 'b']}}>
Keep all of this.
</Unsupported>
`;
test('parsing MDX preserves original ranges, custom props, frontmatter and comments',()=>{const {tree,error}=parse(fixture);assert.equal(error,undefined);for(const n of tree.children)assert.equal(raw(n,fixture),fixture.slice(n.position.start.offset,n.position.end.offset));assert.deepEqual(metadata(fixture).custom,{nested:['one','two']});});
test('editing one component property preserves all unrelated source bytes',()=>{const node=parse(fixture).tree.children.find(n=>n.name==='Callout');const next=setAttribute(fixture,node,'type','tip');assert.equal(next,fixture.replace('type="warning"','type="tip"'));assert.ok(next.includes('custom={{ deep: true }}'));assert.ok(next.includes('{/* keep this comment */}'));});
test('quoted attributes remain valid MDX, and shared icon styles persist',()=>{let source='<Card title="Before">\nContent.\n</Card>';let node=parse(source).tree.children[0];source=setAttributes(source,node,{title:'A "quoted" title & more',icon:'github',iconStyle:'brands',iconColor:'#123456'});const result=parse(source);assert.equal(result.error,undefined);const a=attributes(result.tree.children[0]);assert.equal(a.title,'A "quoted" title & more');assert.equal(a.iconStyle,'brands');assert.equal(a.iconColor,'#123456');});
test('frontmatter edits retain unknown metadata',()=>{const next=updateMetadata(fixture,{title:'Changed'});assert.equal(metadata(next).title,'Changed');assert.deepEqual(metadata(next).custom,{nested:['one','two']});assert.ok(next.includes('<Unsupported'));});
test('prose-only replacement skips code, properties, comments and metadata',()=>{const source='---\ntitle: apple\n---\n\n<Callout title="apple">\napple **apple**\n</Callout>\n\n```js\napple\n```\n\n{/* apple */}';const r=replacement(source,'apple','pear',false,true);assert.equal(r.count,2);assert.ok(r.source.includes('title="apple"'));assert.ok(r.source.includes('title: apple'));assert.ok(r.source.includes('```js\napple'));assert.ok(r.source.includes('{/* apple */}'));});
test('headings have stable distinct anchors and readable inline text',()=>{assert.deepEqual(headings('## Hello **world**\n\n## Hello **world**').map(x=>x.id),['hello-world','hello-world-1']);});
test('arbitrary MDX expressions are parsed without execution',()=>{globalThis.graveExecuted=false;const r=parse('{globalThis.graveExecuted = true}');assert.equal(r.error,undefined);assert.equal(globalThis.graveExecuted,false);delete globalThis.graveExecuted;});
test('all insertion templates are valid MDX',()=>{for(const[name,source]of Object.entries(blocks))assert.equal(parse(source).error,undefined,name);});
test('unsafe destinations are rejected',()=>{for(const url of ['javascript:alert(1)','data:text/html,<script>','//evil.example','/\\evil.example'])assert.equal(safeUrl(url),'#');assert.equal(safeUrl('/grave/intro#section'),'/grave/intro#section');});

test('multiline icon tooltips survive list insertion and successive property edits',()=>{
 const tooltip='**First line**\n\nA [link](/guide) & "quoted" text.';
 let source='- Before <Icon name="circle-info" tooltip='+quoteAttribute(tooltip)+' /> after\n- Next item';
 const find=node=>node.name==='Icon'?node:node.children?.map(find).find(Boolean);
 let result=parse(source);assert.equal(result.error,undefined);
 let icon=find(result.tree);assert.equal(attributes(icon).tooltip,tooltip);
 source=setAttributes(source,icon,{accent:true,name:'book-open'});
 icon=find(parse(source).tree);
 source=setAttributes(source,icon,{accent:false,tooltip:tooltip+'\nFinal line'});
 result=parse(source);assert.equal(result.error,undefined);
 assert.equal(attributes(find(result.tree)).accent,'false');
 assert.equal(attributes(find(result.tree)).tooltip,tooltip+'\nFinal line');
 assert.ok(source.endsWith(' after\n- Next item'));
});
