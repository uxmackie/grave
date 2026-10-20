import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingWorkspace} from '../lib/workspace-state.ts';

const product={id:'grave',pages:[{id:'intro'}]};
const reader={mode:'reader',value:{products:[product]}};
const editor={mode:'editor',value:{products:[{id:'grave',draft:product,published:product}]}};

test('reader to editor navigation gates the published payload before loading effects run',()=>{
 assert.equal(matchingWorkspace(reader,'editor'),null);
 assert.equal(matchingWorkspace(null,'editor'),null);
 assert.equal(matchingWorkspace(editor,'editor').value.products[0].draft.pages[0].id,'intro');
});
test('editor to reader navigation never renders private draft records as published products',()=>{
 assert.equal(matchingWorkspace(editor,'reader'),null);
 assert.equal(matchingWorkspace(null,'reader'),null);
 assert.equal(matchingWorkspace(reader,'reader').value.products[0].pages[0].id,'intro');
});
test('same-mode navigation keeps its correctly shaped workspace',()=>{
 assert.equal(matchingWorkspace(editor,'editor'),editor);
 assert.equal(matchingWorkspace(reader,'reader'),reader);
});
