import test from 'node:test';
import assert from 'node:assert/strict';
import {installSceneInput} from '../src/web/pointer-input.js';

function fixture(pending=null){
 const canvas=new EventTarget(),ui={pending,drawer:false},calls={pan:[],zoom:[],tap:[]};let now=0,id=0;const frames=new Map();
 const view={pan:(x,y)=>calls.pan.push([x,y]),zoom:f=>calls.zoom.push(f),updateCamera(){},yaw:0};
 const input=installSceneInput(canvas,{view,ui,tap:(x,y)=>calls.tap.push([x,y]),activity(){},now:()=>now,raf:fn=>{frames.set(++id,fn);return id;},caf:i=>frames.delete(i)});
 const send=(type,x=100,y=100,pointerId=1)=>{now+=16;const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y,pointerId,button:0});canvas.dispatchEvent(e);};
 return{ui,calls,input,send,frames,advance(){now+=16;const f=[...frames.values()][0];frames.clear();f?.(now);}};
}
test('placement drag and release preserve the candidate and never dispatch a tap',()=>{
 const pending={kind:'chair',x:7,z:-3,rot:1.2,roomId:'b1'},f=fixture(pending),before={...pending};
 f.send('pointerdown');f.send('pointermove',130,125);f.send('pointermove',170,155);f.send('pointerup',170,155);
 assert.deepEqual(pending,before);assert.equal(f.calls.tap.length,0);assert.equal(f.calls.pan.length,2);assert.equal(f.frames.size,0);assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('a short tap chooses a candidate once; cancellation is never a tap',()=>{
 const f=fixture({kind:'chair'});f.send('pointerdown',101,102);f.send('pointerup',102,103);assert.deepEqual(f.calls.tap,[[102,103]]);
 f.send('pointerdown');f.send('pointercancel');assert.equal(f.calls.tap.length,1);assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('two-finger zoom and staggered release do not cause placement or one-finger taps',()=>{
 const pending={x:4,z:5},f=fixture(pending);f.send('pointerdown',80,100,1);f.send('pointerdown',140,100,2);f.send('pointermove',160,115,2);f.send('pointerup',80,100,1);f.send('pointerup',160,115,2);
 assert.equal(f.calls.tap.length,0);assert.ok(f.calls.zoom.length);assert.deepEqual(pending,{x:4,z:5});assert.equal(f.input.pointers.size,0);f.input.dispose();
});
test('normal pan retains inertia, but placement and menus cancel coasting',()=>{
 const f=fixture();f.send('pointerdown');f.send('pointermove',170,160);f.send('pointerup',170,160);assert.ok(f.frames.size);
 const count=f.calls.pan.length;f.advance();assert.ok(f.calls.pan.length>count);
 f.ui.pending={x:1,z:2};f.advance();assert.equal(f.frames.size,0);f.input.dispose();
});
