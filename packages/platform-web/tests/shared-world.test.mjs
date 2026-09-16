import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedWorldChannel} from '../src/shared-world.js';
function fake(){
  const values=new Map(),events=new EventTarget();
  return{
    localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
    crypto:{getRandomValues(array){for(let i=0;i<array.length;i++)array[i]=i+1;return array;}},
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    send(key,newValue){const e=new Event('storage');Object.assign(e,{key,newValue,storageArea:this.localStorage});events.dispatchEvent(e);},
  };
}
const validate=s=>{if(s.version!==1)throw Error('unsupported schema');return structuredClone(s);};

test('shared village stays hidden from readers until its explicit access code is authorized',()=>{
  const window=fake(),writer=createSharedWorldChannel({environment:'dev',writer:true,validate,window}),reader=createSharedWorldChannel({environment:'dev',validate,window}),prod=createSharedWorldChannel({environment:'prod',validate,window});
  writer.publish({version:1,id:'mura',revision:3});
  const code=writer.accessCode();assert.match(code,/^MURA-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(reader.read(),null);assert.equal(reader.authorize('MURA-WRNG-CODE'),false);assert.equal(reader.read(),null);
  assert.equal(reader.authorize(code),true);const shared=reader.read();assert.equal(shared.revision,3);assert.equal(shared.__sharedWorldCode,true);
  assert.equal(prod.read(),null);assert.throws(()=>reader.publish({version:1}));
  reader.clearAuthorization();assert.equal(reader.read(),null);
});

test('authorized subscriptions handle valid updates and preserve current layout on incompatible versions',()=>{
  const window=fake(),writer=createSharedWorldChannel({environment:'local',writer:true,validate,window}),reader=createSharedWorldChannel({environment:'local',validate,window});
  writer.publish({version:1,id:'mura',revision:3});assert.equal(reader.authorize(writer.accessCode()),true);
  let current=null,error=null;const stop=reader.subscribe(s=>{if(s)current=s;},e=>error=e);
  window.send('soul.local.world.mura.v1',JSON.stringify({version:1,revision:4}));assert.equal(current.revision,4);assert.equal(current.__sharedWorldCode,true);
  window.send('soul.local.world.mura.v1','{"version":2}');assert.equal(current.revision,4);assert.match(error.message,/schema/);
  stop();window.send('soul.local.world.mura.v1',JSON.stringify({version:1,revision:5}));assert.equal(current.revision,4);
});
