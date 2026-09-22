import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireSoloPause} from '../src/title/solo-pause.js';
function fixture(initialPaused=false,ready=true){
 const win=new EventTarget();win.location={origin:'https://local.test'};globalThis.window=win;
 let paused=initialPaused,clicks=0;
 const button={isConnected:true,getAttribute:()=>paused?'再開':'一時停止',click(){paused=!paused;clicks++;}};
 const doc=new EventTarget();doc.hidden=false;doc.querySelector=()=>({hidden:ready});doc.getElementById=()=>button;
 const frame=new EventTarget();frame.isConnected=true;frame.contentDocument=doc;frame.contentWindow={};
 return{frame,doc,win,button,get paused(){return paused;},get clicks(){return clicks;}};
}
test('music pauses running simulation and restores exactly once',()=>{const f=fixture();const release=acquireSoloPause(f.frame);assert.equal(f.paused,true);release();release();assert.equal(f.paused,false);assert.equal(f.clicks,2);});
test('pre-paused simulation stays paused',()=>{const f=fixture(true);acquireSoloPause(f.frame)();assert.equal(f.paused,true);assert.equal(f.clicks,0);});
test('closing during load never toggles unready game',()=>{const f=fixture(false,false);acquireSoloPause(f.frame)();assert.equal(f.clicks,0);});
test('opening while loading pauses only matching same-origin ready frame',()=>{
 const f=fixture(false,false),release=acquireSoloPause(f.frame);f.doc.querySelector=()=>({hidden:true});
 const send=(source,origin)=>{const e=new Event('message');Object.assign(e,{source,origin,data:{channel:'rinne-title-v1',type:'ready'}});f.win.dispatchEvent(e);};
 send({},f.win.location.origin);send(f.frame.contentWindow,'https://foreign.test');assert.equal(f.clicks,0);
 send(f.frame.contentWindow,f.win.location.origin);assert.equal(f.paused,true);release();assert.equal(f.paused,false);
});
test('detached iframe is never resumed',()=>{const f=fixture();const release=acquireSoloPause(f.frame);f.frame.isConnected=false;release();assert.equal(f.clicks,1);});
test('hidden document defers restoration until visible',()=>{const f=fixture();const release=acquireSoloPause(f.frame);f.doc.hidden=true;release();assert.equal(f.paused,true);f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.clicks,1);f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(f.paused,false);});
test('no frame cannot affect another world clock',()=>{assert.doesNotThrow(()=>acquireSoloPause(null)());});
