import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebAudioActivation } from '../src/audio-activation.js';

function fakeDocument(){
  const listeners=new Map();
  return {
    addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},
    removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
    fire(type){for(const listener of [...(listeners.get(type)||[])])listener({type});},
    count(type){return listeners.get(type)?.size||0;},
  };
}

test('first trusted gesture unlocks all registered browser audio consumers', async()=>{
  const documentRef=fakeDocument();
  const activation=createWebAudioActivation({documentRef});
  const calls=[];
  activation.subscribeUnlock(()=>{calls.push('music');});
  activation.subscribeUnlock(()=>{calls.push('effects');});
  assert.equal(documentRef.count('pointerdown'),1);
  documentRef.fire('pointerdown');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(activation.unlocked,true);
  assert.deepEqual(calls.sort(),['effects','music']);
  assert.equal(documentRef.count('pointerdown'),0);
});

test('late consumers run without requiring a second gesture', async()=>{
  const documentRef=fakeDocument();
  const activation=createWebAudioActivation({documentRef});
  await activation.unlock();
  let calls=0;
  activation.subscribeUnlock(()=>{calls+=1;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);
  assert.equal(documentRef.count('pointerdown'),0);
});

test('platform audio activation can be disposed cleanly', ()=>{
  const documentRef=fakeDocument();
  const activation=createWebAudioActivation({documentRef});
  activation.subscribeUnlock(()=>{});
  assert.equal(documentRef.count('keydown'),1);
  activation.dispose();
  assert.equal(documentRef.count('keydown'),0);
});
