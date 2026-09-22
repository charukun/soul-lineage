import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter25DDraft,assertCharacter25D,migrateCharacter25D,CHARACTER25D_ACTIONS} from '../packages/assets/src/character25d-schema.js';
import {createShinoDraft} from '../packages/assets/src/sprite25d-manifest.js';
import {createHumanoidRig,analyzeSilhouette,buildInfluenceMeshes} from '../packages/assets/src/character25d-rig.js';
import {createMotionState,sampleMotion,stepSpring} from '../packages/assets/src/character25d-motion.js';
import {createCharacter25DProxy,selectAppearance} from '../packages/assets/src/character25d-proxy.js';

test('generic draft accepts independent identities, keeps provenance pending and rejects promotion',()=>{
  for(const id of ['character.one','character.two']){const d=createCharacter25DDraft({id,name:'独立キャラ'});assert.equal(assertCharacter25D(d).id,id);assert.equal(d.rig.bones.length,18);assert.equal(d.review.productionApproved,false);d.review.productionApproved=true;assert.throws(()=>assertCharacter25D(d));}
  for(const change of [d=>d.rig.bones[2].parent='head',d=>d.gameplayProxy.radius=20,d=>d.secondaryMotion.hair.limit=2,d=>d.provenance.generated=true,d=>d.motion.actions=['walk'],d=>d.id='../external']){const d=createCharacter25DDraft();change(d);assert.throws(()=>assertCharacter25D(d));}
});
test('v1 migration is immutable, lossless for original sprite clips, and idempotent',()=>{
  const v1=createShinoDraft(),original=structuredClone(v1),v2=migrateCharacter25D(v1);
  assert.deepEqual(v1,original);assert.equal(v2.schema,'rinne.character25d/v2');assert.deepEqual(v2.compatibility.animations,v1.animations);assert.deepEqual(migrateCharacter25D(v2),v2);
});
test('silhouette establishes feet bounds, generated weights sum to one, all regions use same bone space',()=>{
  const w=80,h=120,data=new Uint8ClampedArray(w*h*4);for(let y=10;y<110;y++)for(let x=15;x<65;x++)data[(y*w+x)*4+3]=255;
  const analysis=analyzeSilhouette(data,w,h);assert.deepEqual(analysis.bounds,[15,10,65,110]);
  const rig=createHumanoidRig(analysis.proportions),meshes=buildInfluenceMeshes(rig,{bounds:analysis.bounds,width:w,height:h});
  assert.ok(meshes.length>=6);let triangles=0;for(const mesh of meshes){triangles+=mesh.indices.length/3;for(let i=0;i<mesh.skinWeights.length;i+=4){assert.ok(Math.abs(mesh.skinWeights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-6);assert.ok(mesh.skinIndices.slice(i,i+4).every(n=>n>=0&&n<rig.bones.length));}assert.ok(mesh.uvs.every(n=>n>=0&&n<=1));}
  assert.ok(triangles<=1500);assert.throws(()=>analyzeSilhouette(new Uint8ClampedArray(40*40*4),40,40));
});
test('camera yaw selects front, side, back with boundary hysteresis and no fabricated mirrors',()=>{
  const views={front:{mirror:false},side:{mirror:false},back:{mirror:false}};
  assert.equal(selectAppearance(views,0),'front');assert.equal(selectAppearance(views,Math.PI/2),'side');assert.equal(selectAppearance(views,-Math.PI/2),'side');assert.equal(selectAppearance(views,Math.PI),'back');
  assert.equal(selectAppearance(views,Math.PI/4+.02,'front'),'front');assert.equal(selectAppearance(views,Math.PI/4+.2,'front'),'side');
  assert.equal(selectAppearance({front:views.front},Math.PI),'front');assert.equal(views.side.mirror,false);
});
test('all actions sample bounded reusable motion, attack differs from hit and one-shots return to locomotion',()=>{
  const rig=createHumanoidRig(),a=new Float32Array(54),p=new Float32Array(54),poses={};
  for(const name of CHARACTER25D_ACTIONS){const state=createMotionState();state.play(name);for(let i=0;i<6;i++)state.step(.05,1);sampleMotion(state,rig,a,p);assert.ok([...a,...p].every(Number.isFinite));assert.ok([...a].every(n=>Math.abs(n)<=.341));poses[name]=[...a];}
  assert.notDeepEqual(poses.attack,poses.hit);assert.notDeepEqual(poses.walk,poses.run);assert.notDeepEqual(poses.walk,poses.idle);
  const state=createMotionState();state.play('attack');state.step(.05);const t=state.time;state.play('attack',{restart:false});assert.equal(state.time,t);for(let i=0;i<30;i++)state.step(.05,3);assert.equal(state.action,'run');assert.throws(()=>state.play('unknown'));
});
test('secondary springs lag and remain bounded under a paused/long frame',()=>{
  const s={value:0,velocity:0},cfg={stiffness:48,damping:12,limit:.075};stepSpring(s,.06,.016,cfg);assert.ok(s.value>0&&s.value<.06);
  for(let i=0;i<500;i++)stepSpring(s,i%2?100:-100,i===3?10:.016,cfg);assert.ok(Number.isFinite(s.value)&&Math.abs(s.value)<=cfg.limit);
  for(let i=0;i<200;i++)stepSpring(s,0,.016,cfg);assert.ok(Math.abs(s.value)<.0001);
});
test('proxy sweeps blockers, follows a slope, rejects steep ground and clamps stalled travel',()=>{
  const cfg=createCharacter25DDraft().gameplayProxy;
  const sampleGround=(x,z,out)=>{out.height=x*.1;out.normal.x=-.0995;out.normal.y=.995;out.normal.z=0;out.valid=true;return out;};
  const proxy=createCharacter25DProxy(cfg,{sampleGround,canMoveTo:(x,z,r)=>x+r<1});proxy.setTransform({x:0,y:0,z:0});proxy.setVelocity({x:4,z:0});
  for(let i=0;i<30;i++)proxy.step(.05);assert.ok(proxy.position.x<.76);assert.ok(proxy.blocked);assert.ok(Math.abs(proxy.position.y-proxy.position.x*.1)<1e-8);assert.ok(proxy.grounded);
  assert.ok(proxy.yaw>1);const before=proxy.position.x;proxy.step(200);assert.ok(proxy.position.x-before<=.3);assert.throws(()=>proxy.setVelocity({x:NaN,z:0}));
  const steep=createCharacter25DProxy(cfg,{sampleGround:(x,z,out)=>{out.height=0;out.normal.y=.3;out.normal.x=.95;out.normal.z=0;out.valid=true;return out;}});steep.setTransform({x:0,z:0});steep.setVelocity({x:1,z:0});steep.step(.05);assert.equal(steep.position.x,0);
});
