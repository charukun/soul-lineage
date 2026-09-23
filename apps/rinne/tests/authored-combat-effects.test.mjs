import test from 'node:test';
import assert from 'node:assert/strict';
import {combatEffectCues,combatEffectBudget,combatEffectScope,createCombatEffectGate,inspirationAfterimageCue} from '../src/rebuild/combat-effect-cues.js';
import {createAuthoredEffectPlayer} from '../src/rebuild/authored-effect-player.js';
import {installCombatEffects} from '../src/rebuild/combat-effects-stage.js';

const state={id:'life-1',zone:'frontier',phase:'life',position:{x:2,z:3}};
const front={stage:0,enemies:[{id:'e1',x:4,z:3},{id:'e2',x:1,z:5}]};
const hit={type:'player-hit',targetId:'e1',damage:12,phase:'jo',engine:'tidebreak'};
const context={state,front};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function backend(){
  const calls={played:[],updates:[],draws:[],clears:0,disposed:0};
  return {calls,play(cue){const handle={exists:true,stopped:0,stop(){this.stopped++;this.exists=false;}};calls.played.push({cue,handle});return handle;},
    update(dt){calls.updates.push(dt);},draw(camera){calls.draws.push(camera);},clear(){calls.clears++;},dispose(){calls.disposed++;}};
}

test('confirmed damage maps to target impact and authored source-to-target slash without state mutation',()=>{
  const before=JSON.stringify(context),cues=combatEffectCues([hit],context);
  assert.deepEqual(cues.map(c=>c.effect),['impact','slash']);assert.deepEqual(cues[0].position,{x:4,y:1,z:3});
  assert.deepEqual(cues[1].position,{x:3,y:1,z:3});assert.equal(cues[0].rotation.y,Math.PI/2);
  const exact=combatEffectCues([{...hit,impact:{point:[3.6,1.22,3.1]}}],context);assert.deepEqual(exact[0].position,{x:3.6,y:1.22,z:3.1});
  assert.equal(JSON.stringify(context),before);
});
test('first inspiration has a visible world burst and movement echo without inventing contact',()=>{
  const profile={effect:'finisher',trail:'slash'},start={type:'inspiration-start',sourceId:state.id,targetId:'e1',position:{x:2,z:3},firstInspirationPresentation:profile};
  const cues=combatEffectCues([start],context);
  assert.deepEqual(cues.map(c=>c.kind),['inspiration-world','inspiration-trail']);
  assert.equal(cues[0].position.x,2);
  assert.equal(combatEffectCues([{...start,sourceId:'ally',position:{x:1,z:4}}],context)[0].position.z,4);
  assert.equal(inspirationAfterimageCue({x:2,z:3},{x:2.2,z:3},profile).kind,'inspiration-afterimage');
  assert.equal(inspirationAfterimageCue({x:2,z:3},{x:2,z:3},profile),null);
});
test('evade, block, zero damage, nonfinite damage and unresolved target never invent impacts',()=>{
  const events=[{type:'evaded',damage:10,sourceId:'e1'},{...hit,type:'blocked'},{...hit,damage:0},{...hit,damage:NaN},{...hit,damage:Infinity},{...hit,targetId:'missing'}];
  assert.deepEqual(combatEffectCues(events,context),[]);
});
test('enemy impact is at the player, not the attacking enemy',()=>{
  const [cue]=combatEffectCues([{type:'enemy-hit',sourceId:'e2',damage:2}],context);
  assert.deepEqual(cue.position,{x:2,y:1,z:3});assert.deepEqual(cue.color,[255,126,96,255]);
});
test('paired one-motion and player-hit produce one dedicated authored finisher',()=>{
  const cues=combatEffectCues([{type:'one-motion',targetId:'e1',damage:12},{...hit,manual:true,phase:'one'}],context);
  assert.equal(cues.length,2);assert.equal(cues[0].kind,'finisher');assert.equal(cues[0].effect,'finisher');assert.equal(cues[0].scale,1.15);assert.equal(cues[0].lifetime,1.8);
  const kyu=combatEffectCues([{...hit,phase:'kyu'}],context)[0];assert.equal(kyu.kind,'finisher');assert.equal(kyu.effect,'finisher');
});
test('multiple real contacts in the same batch are retained; a standalone manual event works',()=>{
  assert.equal(combatEffectCues([hit,{...hit,targetId:'e2'},hit],context).filter(c=>c.effect==='impact').length,3);
  assert.equal(combatEffectCues([{type:'one-motion',damage:3,targetId:'e2'}],context)[0].kind,'finisher');
});
test('birth, interiors, invalid positions and null input are not battle effects',()=>{
  assert.deepEqual(combatEffectCues(null,context),[]);
  for(const patch of [{phase:'birth'},{interior:{buildingId:'home'}},{position:{x:Infinity,z:0}}]){
    assert.deepEqual(combatEffectCues([hit],{...context,state:{...state,...patch}}),[]);
  }
});
test('quality budgets degrade monotonically and reduced motion suppresses trails',()=>{
  assert.deepEqual([0,1,2,3].map(l=>combatEffectBudget(l,true).maxActive),[4,3,2,1]);
  assert.equal(combatEffectBudget(0,false,true).maxActive,1);assert.equal(combatEffectBudget(0,false,true).trails,false);
  assert.equal(combatEffectBudget(NaN).maxActive,1);
});
test('bounded replay gate accepts different ticks and clears only on life/space/stage change',()=>{
  const gate=createCombatEffectGate(3),scope=combatEffectScope(state,front);
  assert.equal(gate.enter(scope,'epoch1:tick1').accept,true);assert.equal(gate.enter(scope,'epoch1:tick1').accept,false);
  for(let i=2;i<10;i++)assert.equal(gate.enter(scope,`epoch1:tick${i}`).accept,true);
  assert.equal(gate.size(),3);assert.equal(gate.enter(`${scope}:newlife`,'epoch1:tick9').accept,true);
});
test('loading drops old cues instead of replaying them at a later position',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();p.present([hit],context);p.attach(b);
  p.frame(state,front,.016);assert.equal(b.calls.played.length,0);assert.equal(p.snapshot().dropped,2);
  p.present([hit],context);assert.equal(b.calls.played.length,2);p.dispose();
});
test('same co-op batch is ignored but the next tick is shown',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();p.attach(b);
  p.present([hit],{...context,eventKey:'world:1:2'});p.present([hit],{...context,eventKey:'world:1:2'});
  assert.equal(b.calls.played.length,2);assert.equal(p.snapshot().replayed,1);
  p.present([hit],{...context,eventKey:'world:1:3'});assert.equal(b.calls.played.length,4);p.dispose();
});
test('handles are bounded, priority replaces trails, and quality reduction immediately trims active count',()=>{
  const p=createAuthoredEffectPlayer({mobile:true}),b=backend();p.attach(b);
  for(let i=0;i<10;i++)p.present([hit],context);
  assert.ok(p.snapshot().active<=4);assert.ok(p.snapshot().dropped>0);
  p.present([{...hit,phase:'kyu'}],context);assert.ok(b.calls.played.some(c=>c.cue.kind==='finisher'));
  p.frame(state,front,.016,{level:3});assert.equal(p.snapshot().active,1);p.dispose();
});
test('zero dt does not advance native time, ended/hidden/changed scenes stop handles',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();p.attach(b);p.present([hit],context);
  p.frame(state,front,0);assert.deepEqual(b.calls.updates,[]);
  p.frame(state,front,.016);assert.deepEqual(b.calls.updates,[.016]);
  p.frame(state,front,.016,{hidden:true});assert.equal(p.snapshot().active,0);
  p.present([hit],context);p.frame({...state,id:'new-life'},front,.016);assert.equal(p.snapshot().active,0);p.dispose();
});
test('lifetime and native completion release effects, without an unlimited loop',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();p.attach(b);p.present([hit],context);
  b.calls.played[0].handle.exists=false;p.frame(state,front,.01);assert.equal(p.snapshot().active,1);
  p.frame(state,front,1);assert.equal(p.snapshot().active,0);assert.equal(b.calls.played[1].handle.stopped,1);p.dispose();
});
test('failed optional backend is contained, including broken stop/dispose methods',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();b.draw=()=>{throw Error('GPU failure');};b.dispose=()=>{throw Error('lost context');};p.attach(b);
  p.present([hit],context);b.calls.played[0].handle.stop=()=>{throw Error('bad handle');};
  assert.doesNotThrow(()=>p.draw({}));assert.equal(p.snapshot().phase,'failed');assert.equal(p.snapshot().active,0);
  assert.doesNotThrow(()=>p.frame(state,front,.016));assert.doesNotThrow(()=>p.dispose());
});
test('late backend completion after disposal is disposed once, never attached',()=>{
  const p=createAuthoredEffectPlayer(),b=backend();p.dispose();assert.equal(p.attach(b),false);assert.equal(b.calls.disposed,1);
});

function stageHarness(factory){
  class Resource {constructor(options){this.options=options;this.disposed=0;}dispose(){this.disposed++;}}
  class Mesh {constructor(geometry,material){Object.assign(this,{geometry,material,visible:true});}removeFromParent(){this.parent.children=this.parent.children.filter(c=>c!==this);}}
  const scene={children:[],add(child){child.parent=this;this.children.push(child);}},canvas=new EventTarget();
  const document={baseURI:'https://game.test/dev/rinne/',hidden:false,defaultView:{matchMedia:()=>({matches:false})}};
  const frames=[],renderer={},camera={};let ended=0;
  const view={THREE:{Mesh,PlaneGeometry:Resource,MeshBasicMaterial:Resource},scene,camera,
    syncFront(){},updateFront(){},visualSnapshot:()=>({focus:{level:0}}),
    renderState(s,dt){frames.push([s,dt]);for(const child of scene.children)if(child.visible)child.onAfterRender(renderer,scene,camera);},
    dispose(){ended++;}};
  installCombatEffects(view,{document,canvas,backendFactory:factory});view.syncFront(front);
  return {view,canvas,document,scene,frames,renderer,camera,ended:()=>ended};
}
test('effect draw is inside the existing source scene pass and no extra canvas/renderer is created',async()=>{
  const b=backend();let args;
  const h=stageHarness(async options=>{args=options;return b;});
  h.view.renderState(state,.016);await flush();assert.equal(args.renderer,h.renderer);
  assert.equal(args.baseUrl.href,'https://game.test/dev/rinne/simulator/assets/effekseer/');
  h.view.presentCombatEvents([hit],context);h.view.renderState(state,.016);
  assert.deepEqual(b.calls.draws,[h.camera]);assert.equal(h.scene.children.length,1);
  const mesh=h.scene.children[0];assert.equal(mesh.material.options.colorWrite,false);assert.equal(mesh.material.options.depthWrite,false);
  h.view.dispose();h.view.dispose();assert.equal(h.ended(),1);assert.equal(mesh.geometry.disposed,1);assert.equal(mesh.material.disposed,1);
});
test('context loss disables optional effects but base rendering keeps running',async()=>{
  const b=backend(),h=stageHarness(async()=>b);h.view.renderState(state,.016);await flush();
  h.view.presentCombatEvents([hit],context);h.canvas.dispatchEvent(new Event('webglcontextlost'));
  assert.doesNotThrow(()=>h.view.renderState(state,.016));assert.equal(h.frames.length,2);
  assert.equal(h.view.visualSnapshot().combatEffects.phase,'failed');assert.equal(b.calls.disposed,1);h.view.dispose();
});
test('asynchronous preparation failure never interrupts original renderState',async()=>{
  const h=stageHarness(async()=>{throw Error('asset missing');});h.view.renderState(state,.016);await flush();
  assert.equal(h.view.visualSnapshot().combatEffects.phase,'failed');assert.doesNotThrow(()=>h.view.renderState(state,.016));h.view.dispose();
});
