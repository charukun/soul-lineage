import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('resident-dialog rebinding reaches a fixed point instead of starving the browser event loop',()=>{
  const source=readFileSync(new URL('../src/mura-director-polish.js',import.meta.url),'utf8');
  const functionSource=source.match(/function bindPersonDialog\(\)\{[\s\S]*?\n\}/)[0];
  const pending=[],observations=[],camera={dataset:{camera:'front'}};
  let text='追従',writes=0,bind;
  const follow={get textContent(){return text;},set textContent(value){text=value;writes++;pending.push(()=>bind());}};
  const host={querySelector:selector=>selector==='h2'?{textContent:'Shino'}:selector==='#followPerson'?follow:null,querySelectorAll:()=>[camera]};
  bind=runInNewContext(`${functionSource};bindPersonDialog`,{$:()=>host,world:{people:[{id:'resident-1',name:'Shino',dead:false}]},beginObservation:(...args)=>observations.push(args)});
  bind();
  for(let turn=0;pending.length&&turn<4;turn++)pending.shift()();
  assert.equal(pending.length,0,'childList mutations must stop after the label is normalized');
  assert.equal(writes,1);assert.equal(text,'追従して見る');
  camera.onclick();follow.onclick();
  assert.deepEqual(observations,[['resident-1','front'],['resident-1','top']]);
});
