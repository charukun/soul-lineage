import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createLife } from '../src/rebuild/domain.js';
import { isVillageLife } from '../src/rebuild/village-walk-input.js';

// Execute the production adapter, replacing only browser/audio/render ports.
// This is a focused input test, not a rendered-browser or visual-approval receipt.
function harness(){
  const source=readFileSync(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export function installRinneGameplayUpgrade','function installRinneGameplayUpgrade');
  const canvas=new EventTarget(),document=new EventTarget(),window=new EventTarget(),gameScreen={dataset:{}};
  canvas.dataset={};document.hidden=false;document.querySelector=()=>null;
  const target={hidden:false,textContent:''},toast={hidden:true,textContent:''};
  document.getElementById=id=>id==='objective-target'?target:id==='toast'?toast:null;
  const noop=()=>{},timers=new Map();let now=0,serial=0,summary=null;
  const ui={dash:new EventTarget(),bindState:noop,setGuidance:noop,setContextAnchor:noop,refresh:noop,open:noop,dispose:noop,summary:(state,value)=>{summary=value;}};
  const audio=Object.fromEntries(['unlock','combat','item','step','dash','rest','ui','dispose'].map(k=>[k,noop]));
  const world={armors:[],pickups:[],nearestDummy:()=>null,setZone:noop,dispose:noop};
  const view={scene:{getObjectByName:()=>null},cameraVector:()=>({multiplyScalar:noop}),canMoveTo:()=>true,renderState:noop};
  const install=vm.runInNewContext(`${source}\ninstallRinneGameplayUpgrade`,{
    document,window,performance:{now:()=>now},AbortController,console,
    setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),
    createRinneAudio:()=>audio,createGameplayWorld:()=>world,createGameplayUI:()=>ui,
    createCombatPoseRuntime:()=>({apply:noop,restore:noop}),createTidebreakRuntime:()=>({weapons:()=>['fist'],sourceVersion:'test-port'}),
    ARMOR_LABELS:{},WEAPON_LABELS:{},distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),ensureProgression:noop,
    guidanceFor:()=>({target:null}),objectiveNavigation:()=>null,requestEquipmentChange:noop,practiceDummy:()=>[],isVillageLife,
  });
  const handle=install({prepared:{view,canvas,gameScreen,stations:[],layout:{}}});
  const state=Object.assign(createLife({seed:1552}),{phase:'living',ageYears:5,ageSeconds:300,stamina:50});
  const frame=()=>{view.renderState(state,.016);return summary;};
  frame();
  const send=(type,extra={})=>canvas.dispatchEvent(Object.assign(new Event(type),{button:0,pointerId:1,clientX:10,clientY:10,...extra}));
  const advance=ms=>{now+=ms;for(let limit=0;limit<20;limit++){const due=[...timers].find(([,t])=>t.at<=now);if(!due)return;timers.delete(due[0]);due[1].fn();}throw Error('Unexpected timer loop');};
  return {state,frame,send,advance,document,window,dispose:()=>handle.dispose()};
}

test('480ms village hold remains seated after release, and a new drag stands up',()=>{
  const h=harness();try{
    h.send('pointerdown');h.advance(479);assert.equal(h.frame().resting,false);
    h.advance(1);assert.equal(h.frame().resting,true);
    h.send('pointerup');assert.equal(h.frame().resting,true);h.advance(1000);assert.equal(h.frame().resting,true);
    h.send('pointerdown');h.send('pointermove',{clientX:35});h.send('pointerup',{clientX:35});assert.equal(h.frame().resting,false);
  }finally{h.dispose();}
});

test('latched village rest ends on keyboard movement or combat entry',()=>{
  const h=harness();try{
    const sit=()=>{h.send('pointerdown');h.advance(480);h.send('pointerup');assert.equal(h.frame().resting,true);};
    sit();h.window.dispatchEvent(Object.assign(new Event('keydown'),{code:'KeyW'}));assert.equal(h.frame().resting,false);
    sit();h.state.combat={targetId:'unchanged-battle',phase:'ha'};assert.equal(h.frame().resting,false);assert.equal(h.state.combat.targetId,'unchanged-battle');assert.equal(h.state.combat.phase,'ha');
  }finally{h.dispose();}
});

test('birth cannot latch rest; cancellation and visibility loss discard a pending hold',()=>{
  const h=harness();try{
    h.state.phase='birth';h.frame();h.send('pointerdown');h.advance(500);h.send('pointerup');assert.equal(h.frame().resting,false);
    h.state.phase='living';h.send('pointerdown');h.advance(480);h.send('pointercancel');assert.equal(h.frame().resting,false);
    h.send('pointerdown');h.document.hidden=true;h.document.dispatchEvent(new Event('visibilitychange'));h.advance(500);h.document.hidden=false;assert.equal(h.frame().resting,false);
  }finally{h.dispose();}
});

test('frontier keeps its existing hold-only behavior rather than inheriting village rest',()=>{
  const h=harness();try{
    h.state.zone='frontier';h.frame();h.send('pointerdown');h.advance(480);assert.equal(h.frame().resting,true);
    h.send('pointerup');assert.equal(h.frame().resting,false);
  }finally{h.dispose();}
});
