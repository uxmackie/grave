import test from 'node:test';
import assert from 'node:assert/strict';
import {continueList} from '../lib/authoring.ts';
import {parse} from '../lib/mdx.ts';
test('ordered and nested task lists continue without damaging following content',()=>{
 for(const [source,find,expected] of [
 ['3. Three\n4. Four',t=>t.children[0].children[0],'3. Three\n4. \n4. Four'],
 ['- Parent\n  - [x] Child\n\nTail',t=>t.children[0].children[0].children[1].children[0],'- Parent\n  - [x] Child\n  - [ ] \n\nTail']
 ]){const result=continueList(source,find(parse(source).tree));assert.equal(result.source,expected);assert.equal(parse(result.source).error,undefined);}
});
