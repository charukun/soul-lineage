import test from 'node:test';
import assert from 'node:assert/strict';
import {createImpactDirector,impactEnergyForEvent,impactProfile,weaponAnchor} from '../src/rebuild/impact-director.js';
import {createAuthoredEffectPlayer} from '../src/rebuild/authored-effect-player.js';

function hero({weapon='sword',attack='slash',progress=.72}={}){return{id:'hero-life',zone:'frontier',phase:'living',position:{x:1,z:2},yaw:0,equipment:{weapon},maxHp:100,hp:100,combat:{tidebreakPose:{attack,progress,skill:'basic.sword',slot:'jo',pose:{hand:[0,1,.1],tip:[0,1,1.1]}}}};}
function foe({id='e1',x=1,z=3,attack='slash',progress=.7}={}){return{id,x,z,yaw:Math.PI,weapon:'sword',maxHp:100,hp:100,dead:false,tidebreakPose:{attack,progress,skill:'enemy',slot:'jo',pose:{hand:[0,1,.1],tip:[0,1,1.1]}}};}

test('Impact Energy reflects weapon and attack commitment rather than damage alone',()=>{
  const light=hero({weapon:'sword',attack:'slash'}),heavy=hero({weapon:'great',attack:'heavy'}),front={stage:0,enemies:[foe()]},event={type:'player-hit',targetId:'e1',damage:14};
  const a=impactEnergyForEvent({...event,phase:'jo'},{state:light,front}),b=impactEnergyForEvent({...event,phase:'kyu'},{state:heavy,front});
  assert.ok(b>a);assert.ok(b>.7);
});

test('reduced motion disables hit stop and slow while retaining a bounded camera cue',()=>{
  const profile=impactProfile(.95,{reduced:true});assert.equal(profile.stop,0);assert.equal(profile.slow,0);assert.equal(profile.scale,1);assert.ok(profile.camera>0);
});

test('medium impacts still expose one visible hit-stop frame at 60fps',()=>{
  const state=hero({weapon:'dagger',attack:'slash'}),front={stage:0,enemies:[foe()]},director=createImpactDirector();
  director.present([{type:'player-hit',targetId:'e1',damage:2,phase:'jo'}],{state,front});const frame=director.frame(.016);
  assert.equal(frame.timeScale,.002);assert.ok(director.snapshot().timeScale>.002);
});

test('impact presentation never mutates simulation state or enemy health',()=>{
  const state=hero({weapon:'great',attack:'heavy'}),front={stage:5,enemies:[foe()]},before=structuredClone({state,front}),director=createImpactDirector();
  const result=director.present([{type:'player-hit',targetId:'e1',damage:25,phase:'kyu'}],{state,front});
  assert.ok(result.strongest);assert.ok(director.snapshot().timeScale<1);assert.deepEqual({state,front},before);
  const shared=createImpactDirector();shared.present([{type:'player-hit',targetId:'e1',damage:25,phase:'kyu',feel:{hitstopRemaining:.02,slowRemaining:.09,slowScale:.38},impact:{yaw:Math.PI/2}}],{state,front});
  const sharedSnapshot=shared.snapshot();assert.equal(sharedSnapshot.timeScale,1);assert.ok(sharedSnapshot.camera.strength>0);assert.ok(sharedSnapshot.camera.x>.9);
});

test('enemy hits always target the local hero presentation reaction',()=>{
  const state=hero(),enemy=foe({attack:'heavy'}),front={stage:0,enemies:[enemy]},director=createImpactDirector();
  director.present([{type:'enemy-hit',sourceId:'e1',damage:20,part:'leftArm',sector:'flank'}],{state,front});
  const [reaction]=director.snapshot().reactions;assert.equal(reaction.actorKey,'hero');assert.equal(reaction.part,'leftArm');
});

test('weapon anchors follow Tidebreak hand and tip in world space',()=>{
  const state=hero();state.position={x:4,z:7};state.yaw=Math.PI/2;const anchor=weaponAnchor(state);
  assert.ok(anchor);assert.ok(Math.abs(anchor.hand.x-4.1)<1e-6);assert.ok(Math.abs(anchor.tip.x-5.1)<1e-6);assert.ok(Math.abs(anchor.tip.z-7)<1e-6);
});

test('anticipation trail fires once per attack cycle and rearms after progress resets',()=>{
  const state=hero({progress:.45}),front={stage:0,enemies:[]},director=createImpactDirector();
  assert.equal(director.anticipation(state,front).length,1);assert.equal(director.anticipation(state,front).length,0);
  state.combat.tidebreakPose.progress=.1;assert.equal(director.anticipation(state,front).length,0);
  state.combat.tidebreakPose.progress=.46;assert.equal(director.anticipation(state,front).length,1);
});

test('local micro slow swaps only displayed Tidebreak pose and restores the exact simulation snapshot',()=>{
  const state=hero({attack:'slash',progress:.2}),front={stage:0,enemies:[foe()]},director=createImpactDirector();director.applyPoseLag(state,front,.016)();
  const exact={attack:'heavy',progress:.9,skill:'basic.great',slot:'kyu',pose:{hand:[0,1,0],tip:[1,1,1]}};state.combat.tidebreakPose=exact;
  director.present([{type:'player-hit',targetId:'e1',damage:28,phase:'kyu'}],{state,front});const frame=director.frame(.016),restore=director.applyPoseLag(state,front,.016,frame.timeScale);
  assert.notEqual(state.combat.tidebreakPose,exact);restore();assert.equal(state.combat.tidebreakPose,exact);
});

test('weapon-following VFX updates one existing handle without replaying it',()=>{
  const calls={played:0,locations:[]},backend={play(){calls.played++;return{exists:true,setLocation(x,y,z){calls.locations.push([x,y,z]);},setRotation(){},stop(){this.exists=false;}};},update(){},draw(){},clear(){},dispose(){}};
  const player=createAuthoredEffectPlayer();player.attach(backend);player.presentCues([{effect:'slash',position:{x:0,y:1,z:0},rotation:{x:0,y:0,z:0},scale:1,lifetime:.5,color:[255,255,255,255],priority:1,followKey:'hero'}]);
  player.frame(hero(),{stage:0},.016,{anchors:{hero:{position:{x:1,y:2,z:3},rotation:{x:0,y:.3,z:0}}}});player.frame(hero(),{stage:0},.016,{anchors:{hero:{position:{x:2,y:2,z:3},rotation:{x:0,y:.4,z:0}}}});
  assert.equal(calls.played,1);assert.deepEqual(calls.locations,[[1,2,3],[2,2,3]]);player.dispose();
});
