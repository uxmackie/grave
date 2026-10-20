import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionToolbarPosition as position} from '../lib/selection-toolbar.ts';
const viewport={left:0,top:0,width:1000,height:700},box={width:200,height:40};
test('formatting toolbar sits above the selection',()=>{
 assert.deepEqual(position({left:400,top:300,bottom:320,width:100},box,viewport),{left:350,top:252,visible:true});
});
test('toolbar flips below selection at the top and stays within horizontal edges',()=>{
 assert.deepEqual(position({left:0,top:5,bottom:25,width:20},box,viewport),{left:8,top:33,visible:true});
 assert.equal(position({left:990,top:300,bottom:320,width:10},box,viewport).left,792);
});
test('toolbar follows the visual viewport and hides for scrolled-out text',()=>{
 const mobile={left:0,top:100,width:375,height:400};
 const result=position({left:300,top:450,bottom:470,width:50},{width:320,height:150},mobile);
 assert.equal(result.left,47);assert.equal(result.top,292);
 assert.equal(position({left:10,top:20,bottom:40,width:50},box,mobile).visible,false);
});
