import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthoredEffectPlayer} from '../src/rebuild/authored-effect-player.js';
import {installCombatEffects} from '../src/rebuild/combat-effects-stage.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const state={id:'life-1',zone:'frontier',phase:'life',position:{x:2,z:3}};
const front={stage:0,enemies:[{id:'e1',x:4,z:3}]};
const hit={type:'player-hit',targetId:'e1',damage:12,phase:'jo',engine:'tidebreak'};
function backend(){
  const calls={played:[],draws:0,disposed:0};
  return {calls,play(cue){const handle={exists:true,stopped:0,stop(){this.exists=false;this.stopped++;}};calls.played.push({cue,handle});return handle;},
    update(){},draw(){calls.draws++;},clear(){},dispose(){calls.disposed++;}};
}
function stageHarness(factory){
  class Resource {dispose(){}}
  class Mesh {constructor(){this.visible=true;}removeFromParent(){this.parent.children=this.parent.children.filter(row=>row!==this);}}
  const scene={children:[],add(row){row.parent=this;this.children.push(row);}},canvas=new EventTarget();
  const document={baseURI:'https://game.test/dev/rinne/',hidden:false,defaultView:{matchMedia:()=>({matches:false})}};
  const view={THREE:{Mesh,PlaneGeometry:Resource,MeshBasicMaterial:Resource},scene,
    syncFront(){},updateFront(){},visualSnapshot:()=>({focus:{level:0}}),
    renderState(){for(const row of scene.children)if(row.visible)row.onAfterRender({},scene,{});},dispose(){}};
  installCombatEffects(view,{document,canvas,backendFactory:factory});view.syncFront(front);
  return {view,document};
}
test('birth preview and village do not initialize the optional WASM renderer',async()=>{
  let boots=0;const b=backend(),h=stageHarness(async()=>{boots++;return b;});
  h.view.renderState({...state,phase:'birth',zone:'village'},.016);await flush();
  h.view.renderState({...state,zone:'village'},.016);await flush();
  assert.equal(boots,0);
  h.view.renderState(state,.016);await flush();assert.equal(boots,1);
  h.view.renderState(state,.016);await flush();assert.equal(boots,1);
  h.view.dispose();
});
test('a hidden frontier does not trigger optional native initialization',async()=>{
  let boots=0;const h=stageHarness(async()=>{boots++;return backend();});
  h.document.hidden=true;h.view.renderState(state,.016);await flush();assert.equal(boots,0);
  h.document.hidden=false;h.view.renderState(state,.016);await flush();assert.equal(boots,1);h.view.dispose();
});
for(const settings of [{reduced:true},{level:3}]){
  test(`changing effect policy removes an existing trail: ${JSON.stringify(settings)}`,()=>{
    const b=backend(),p=createAuthoredEffectPlayer();p.attach(b);p.present([hit],{state,front});
    const impact=b.calls.played.find(row=>row.cue.effect==='impact'),trail=b.calls.played.find(row=>row.cue.effect==='slash');
    impact.handle.exists=false;p.frame(state,front,.01);assert.equal(p.snapshot().active,1);
    p.frame(state,front,.01,settings);
    assert.equal(p.snapshot().active,0);assert.equal(trail.handle.stopped,1);p.dispose();
  });
}
test('a throwing diagnostic callback never turns an optional rendering failure into a game failure',()=>{
  const b=backend(),p=createAuthoredEffectPlayer({onError(){throw Error('diagnostic unavailable');}});
  b.draw=()=>{throw Error('GPU unavailable');};p.attach(b);p.present([hit],{state,front});
  assert.doesNotThrow(()=>p.draw({}));assert.equal(p.snapshot().phase,'failed');p.dispose();
});
test('a late backend with broken cleanup is contained after view disposal',()=>{
  const p=createAuthoredEffectPlayer();p.dispose();
  assert.doesNotThrow(()=>p.attach({dispose(){throw Error('context already lost');}}));
  assert.equal(p.snapshot().phase,'disposed');
});
