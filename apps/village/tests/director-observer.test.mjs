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

test('resident-relative observation yaw follows current facing without framing lag',()=>{
  const source=readFileSync(new URL('../src/mura-director-polish.js',import.meta.url),'utf8');
  const shortest=source.match(/const shortestAngle=[^;]+;/)[0];
  const target=source.match(/function targetFor\(p,mode\)\{[\s\S]*?\n\}/)[0];
  const applySource=source.match(/function applyObservation\(dt\)\{[\s\S]*?\n\}/)[0];
  const observation={active:true,mode:'front'};
  const person={id:'resident-1',x:8,z:-4,angle:.35};
  const view={target:{x:0,y:0,z:0},span:30,pitch:.7,yaw:-2,cameraGoal:{},followId:'resident-1',lastInteraction:0};
  const apply=runInNewContext(`${shortest}\n${target}\n${applySource};applyObservation`,{
    Math,observation,view,resident:()=>person,stopObservation:()=>{},performance:{now:()=>1000},
  });
  const angleError=(actual,expected)=>Math.abs(Math.atan2(Math.sin(actual-expected),Math.cos(actual-expected)));

  apply(.016);
  assert.ok(angleError(view.yaw,person.angle+Math.PI)<1e-12,'front yaw must match the resident on the same frame');
  assert.ok(view.span>9&&view.span<30,'framing still eases instead of snapping');

  person.angle=-1.1;
  apply(.016);
  assert.ok(angleError(view.yaw,person.angle+Math.PI)<1e-12,'turning residents must not outrun the authored front view');

  observation.mode='side';person.angle=.8;
  apply(.016);
  assert.ok(angleError(view.yaw,person.angle+Math.PI/2)<1e-12,'side yaw must stay resident-relative');

  observation.mode='top';view.yaw=-2;
  apply(.016);
  assert.notEqual(view.yaw,.63,'top view keeps its existing eased yaw transition');
});
