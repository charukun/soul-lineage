import test from 'node:test';
import assert from 'node:assert/strict';
import {installSceneInput,installCatalogDrop} from '../src/web/pointer-input.js';

function fixture(pending=null){
 const canvas=new EventTarget(),ui={pending,drawer:false},calls={pan:[],zoom:[],tap:[],commit:0};let now=0,id=0;const frames=new Map();
 const view={pan:(x,y)=>calls.pan.push([x,y]),zoom:f=>calls.zoom.push(f),updateCamera(){},yaw:0};
 const input=installSceneInput(canvas,{view,ui,tap:(x,y)=>calls.tap.push([x,y]),commit:()=>{throw Error('drag-release commit must stay retired');},activity(){},now:()=>now,raf:fn=>{frames.set(++id,fn);return id;},caf:i=>frames.delete(i)});
 const send=(type,x=100,y=100,pointerId=1,prevent=false)=>{now+=16;const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId,button:0});if(prevent)e.preventDefault();canvas.dispatchEvent(e);};
 return{ui,calls,input,send,frames,advance(){now+=16;const f=[...frames.values()][0];frames.clear();f?.(now);}};
}
test('placement drag adjusts the camera, leaves the candidate pending, and never commits on release',()=>{
 const pending={kind:'chair',x:7,z:-3,rot:1.2,roomId:'b1'},f=fixture(pending),before={...pending};
 f.ui.placementInput={tap:()=>f.calls.commit++};
 f.send('pointerdown');f.send('pointermove',130,125);f.send('pointermove',170,155);f.send('pointerup',170,155);
 assert.deepEqual(pending,before);assert.equal(f.ui.pending,pending);assert.equal(f.calls.commit,0);
 assert.equal(f.calls.tap.length,0);assert.equal(f.calls.pan.length,2);assert.equal(f.frames.size,0);assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('short placement tap routes once to the displayed-candidate owner, not a fresh raycast',()=>{
 const pending={x:7,z:9,rot:.8,roomId:'room'},f=fixture(pending),before={...pending};
 f.ui.placementInput={tap:()=>f.calls.commit++};
 f.send('pointerdown',101,102);f.send('pointerup',102,103);f.send('lostpointercapture',102,103);
 assert.equal(f.calls.commit,1);assert.deepEqual(f.calls.tap,[]);assert.deepEqual(pending,before);f.input.dispose();
});
test('ordinary scene taps still use the base handler, and cancellation is never a tap',()=>{
 const f=fixture();f.send('pointerdown',101,102);f.send('pointerup',102,103);assert.deepEqual(f.calls.tap,[[102,103]]);
 f.send('pointerdown');f.send('pointercancel');assert.equal(f.calls.tap.length,1);assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('guide-prevented taps clean pointer state and cannot poison the next gesture',()=>{
 const f=fixture({kind:'tent'});f.ui.placementInput={tap:()=>f.calls.commit++};
 f.send('pointerdown');f.send('pointerup',100,100,1,true);
 assert.equal(f.calls.commit,0);assert.equal(f.input.pointers.size,0);
 f.send('pointerdown');f.send('pointerup');assert.equal(f.calls.commit,1);f.input.dispose();
});
test('two-finger zoom and staggered release cannot become placement taps or one-finger drags',()=>{
 const pending={x:4,z:5},f=fixture(pending);f.ui.placementInput={tap:()=>f.calls.commit++};
 f.send('pointerdown',80,100,1);f.send('pointerdown',140,100,2);f.send('pointermove',160,115,2);f.send('pointerup',80,100,1);
 const pans=f.calls.pan.length;f.send('pointermove',190,140,2);f.send('pointerup',190,140,2);
 assert.equal(f.calls.commit,0);assert.equal(f.calls.tap.length,0);assert.equal(f.calls.pan.length,pans);
 assert.ok(f.calls.zoom.length);assert.deepEqual(pending,{x:4,z:5});assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('normal pan retains inertia, but placement and menus cancel coasting',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',170,160);f.send('pointerup',170,160);assert.ok(f.frames.size);
 const count=f.calls.pan.length;f.advance();assert.ok(f.calls.pan.length>count);
 f.ui.pending={x:1,z:2};f.advance();assert.equal(f.frames.size,0);f.input.dispose();
});
test('catalog release chooses a preview without silently building or discarding it',()=>{
 const doc=new EventTarget(),ui={drag:{id:1},pending:{x:1,z:2}},calls=[];
 const view={canvas:{getBoundingClientRect:()=>({left:0,top:0,right:390,bottom:844})},ground:(x,y)=>({x,z:y})};
 const dispose=installCatalogDrop({ui,view,preview:(x,z)=>calls.push([x,z]),commit:()=>{throw Error('unexpected catalog build');},activity(){},cancel(){ui.pending=null;}},doc);
 for(const type of ['pointermove','pointerup']){const e=new Event(type);Object.assign(e,{pointerId:1,clientX:120,clientY:300});doc.dispatchEvent(e);}
 assert.deepEqual(calls,[[120,300]]);assert.equal(ui.drag,null);assert.deepEqual(ui.pending,{x:1,z:2});dispose();
});
