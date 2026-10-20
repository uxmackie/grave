import test from 'node:test';
import assert from 'node:assert/strict';
import {singleFlight} from '../lib/save-queue.ts';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('overlapping autosave and navigation wait for edits made during an in-flight save',async()=>{
 let draft='first',saved='',revision=0;
 const requests=[];
 const save=singleFlight(async()=>{
  while(draft!==saved){
   const snapshot=draft,gate=deferred();
   requests.push({snapshot,revision,gate});
   await gate.promise;
   revision++;
   saved=snapshot;
  }
  return true;
 });
 const autosave=save();
 await Promise.resolve();
 draft='second';
 const navigation=save(),shortcut=save();
 assert.equal(navigation,autosave);
 assert.equal(shortcut,autosave);
 assert.equal(requests.length,1);
 requests[0].gate.resolve();
 await Promise.resolve();
 assert.equal(requests.length,2);
 assert.equal(requests[1].revision,1);
 assert.equal(requests[1].snapshot,'second');
 requests[1].gate.resolve();
 assert.deepEqual(await Promise.all([autosave,navigation,shortcut]),[true,true,true]);
 assert.equal(saved,'second');
});

test('a failed operation releases the queue for an explicit retry',async()=>{
 let attempts=0;
 const save=singleFlight(async()=>{if(++attempts===1)throw new Error('Offline');return true;});
 const first=save();
 assert.equal(save(),first);
 await assert.rejects(first,/Offline/);
 assert.equal(await save(),true);
 assert.equal(attempts,2);
});

test('a handled conflict reaches every caller without a duplicate write',async()=>{
 let requests=0;
 const save=singleFlight(async()=>{requests++;return false;});
 assert.deepEqual(await Promise.all([save(),save(),save()]),[false,false,false]);
 assert.equal(requests,1);
});
