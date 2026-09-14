import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const hooksUrl=new URL('../public/simulator/src/game-hooks.inc.js',import.meta.url);

async function productionWarp(){
  const source=await readFile(hooksUrl,'utf8');
  const block=source.match(/\/\/ SLASH_MOTION_WARP_PURE_BEGIN([\s\S]*?)\/\/ SLASH_MOTION_WARP_PURE_END/)?.[1];
  assert.ok(block,'production motion-warp block missing');
  return new Function(`${block};return {RINNE_SLASH_MOTION_WARP_VERSION,RINNE_SLASH_MOTION_WARP_DEFAULTS,validSlashMotionWarpTarget,chooseSlashMotionWarpTarget,createSlashMotionWarpPlan,sampleSlashMotionWarpPlan};`)();
}

async function productionController({candidates,progress}){
  const source=await readFile(hooksUrl,'utf8');
  const pure=source.match(/\/\/ SLASH_MOTION_WARP_PURE_BEGIN([\s\S]*?)\/\/ SLASH_MOTION_WARP_PURE_END/)?.[1];
  const controller=source.match(/\/\/ SLASH_MOTION_WARP_CONTROLLER_BEGIN([\s\S]*?)\/\/ SLASH_MOTION_WARP_CONTROLLER_END/)?.[1];
  assert.ok(pure&&controller,'production controller block missing');
  return new Function('enemies','POSE_CLIPS','attackProgress',`${pure}\n${controller}\nreturn {advanceControllerSlashMotionWarp,clearSlashMotionWarp,slashMotionWarpStates};`)(candidates,{slash:{contact:.5}},progress);
}

test('already-close targets never make the slash step backward',async()=>{
  const {createSlashMotionWarpPlan,sampleSlashMotionWarpPlan}=await productionWarp();
  const plan=createSlashMotionWarpPlan({actor:{x:0,z:0,yaw:0},target:{x:0,z:.72},contact:.5});
  assert.equal(plan.travel,0);
  for(const phase of [0,.14,.18,.35,.5,1]){
    const sample=sampleSlashMotionWarpPlan(plan,phase);
    assert.deepEqual([sample.x,sample.z],[0,0]);
  }
});

test('far targets are bounded and the approach starts only after the turn window',async()=>{
  const {createSlashMotionWarpPlan,sampleSlashMotionWarpPlan}=await productionWarp();
  const plan=createSlashMotionWarpPlan({actor:{x:0,z:0,yaw:Math.PI/2},target:{x:0,z:3},contact:.5});
  assert.equal(plan.travel,.55);
  const turned=sampleSlashMotionWarpPlan(plan,.14),start=sampleSlashMotionWarpPlan(plan,.18),mid=sampleSlashMotionWarpPlan(plan,.34),contact=sampleSlashMotionWarpPlan(plan,.5),late=sampleSlashMotionWarpPlan(plan,.9);
  assert.ok(Math.abs(turned.yaw)<1e-9,'face target before approach');
  assert.equal(start.z,0);
  assert.ok(mid.z>0&&mid.z<.55);
  assert.ok(Math.abs(contact.z-.55)<1e-9);
  assert.deepEqual({x:late.x,z:late.z},{x:contact.x,z:contact.z});
  assert.equal(contact.contactReached,true);
});

test('target position is snapshotted once and later target movement does not home the attack',async()=>{
  const {createSlashMotionWarpPlan,sampleSlashMotionWarpPlan}=await productionWarp();
  const actor={x:1,z:-1,yaw:.2},target={x:2,z:1};
  const plan=createSlashMotionWarpPlan({actor,target,contact:.5}),before=sampleSlashMotionWarpPlan(plan,.4);
  target.x=20;target.z=-12;
  assert.deepEqual(sampleSlashMotionWarpPlan(plan,.4),before);
  assert.deepEqual(plan.target,{x:2,z:1});
  assert.deepEqual(createSlashMotionWarpPlan({actor:{x:1,z:-1,yaw:.2},target:{x:2,z:1},contact:.5}),plan,'same input must be deterministic');
});

test('selection prefers explicit attack authority then deterministic nearest live fallback',async()=>{
  const {chooseSlashMotionWarpTarget}=await productionWarp();
  const candidates=[{id:'b',x:.2,z:1.25},{id:'a',x:-.2,z:1.25},{id:'dead',x:0,z:.2,dead:true},{id:'far',x:0,z:4}];
  const fallback=chooseSlashMotionWarpTarget({x:0,z:0,yaw:0,attack:{kind:'slash'}},candidates);
  assert.equal(fallback.id,'a','equal distances use stable id rather than array timing');
  const explicit=chooseSlashMotionWarpTarget({x:0,z:0,yaw:0,attack:{kind:'slash',targetId:'b'}},candidates);
  assert.equal(explicit.id,'b');
});

test('controller locks one target, stops writing at contact and clears on cancellation',async()=>{
  let phase=.10;
  const enemy={id:'enemy',x:0,z:2,hp:10},actor={id:'hero',hero:true,weapon:'sword',x:0,z:0,yaw:Math.PI/2,attack:{id:'one',kind:'slash'}};
  const controller=await productionController({candidates:[enemy],progress:()=>phase});
  const plan=controller.advanceControllerSlashMotionWarp(actor);
  assert.equal(plan.target.z,2);
  assert.equal(actor.x,0);assert.equal(actor.z,0);
  phase=.34;controller.advanceControllerSlashMotionWarp(actor);const midZ=actor.z;assert.ok(midZ>0&&midZ<.55);
  enemy.z=20;phase=.40;controller.advanceControllerSlashMotionWarp(actor);assert.ok(actor.z<.55,'later target movement must not become homing');
  phase=.50;controller.advanceControllerSlashMotionWarp(actor);assert.ok(Math.abs(actor.z-.55)<1e-9);
  actor.z=.73;phase=.70;controller.advanceControllerSlashMotionWarp(actor);assert.equal(actor.z,.73,'after contact the controller stops adding warp');
  actor.attack=null;assert.equal(controller.advanceControllerSlashMotionWarp(actor),null);assert.equal(controller.slashMotionWarpStates.has(actor),false);
  actor.attack={id:'two',kind:'slash'};enemy.z=1.4;phase=.20;controller.advanceControllerSlashMotionWarp(actor);assert.equal(controller.slashMotionWarpStates.get(actor).attack,actor.attack);
  enemy.dead=true;assert.equal(controller.advanceControllerSlashMotionWarp(actor),null);assert.equal(controller.slashMotionWarpStates.has(actor),false);
});

test('invalid timing/coordinates fail closed and integration keeps one transform writer',async()=>{
  const {createSlashMotionWarpPlan,chooseSlashMotionWarpTarget}=await productionWarp();
  assert.throws(()=>createSlashMotionWarpPlan({actor:{x:NaN,z:0,yaw:0},target:{x:0,z:1}}));
  assert.throws(()=>createSlashMotionWarpPlan({actor:{x:0,z:0,yaw:0},target:{x:0,z:1},turnEnd:.3,warpStart:.2}));
  assert.throws(()=>chooseSlashMotionWarpTarget({x:0,z:0,yaw:Infinity},[]));
  const source=await readFile(hooksUrl,'utf8');
  assert.match(source,/humanoid\.tick=function\(actor,dt\)\{advanceControllerSlashMotionWarp\(actor\)/);
  assert.match(source,/actor\.yaw=sample\.yaw;actor\.x=sample\.x;actor\.z=sample\.z/);
  assert.match(source,/\(actor\.weapon\|\|'sword'\)==='sword'&&actor\.attack\?\.kind==='slash'/);
  assert.doesNotMatch(source,/humanoid\.current\.root\.position.*motionWarp/);
  const slash=await readFile(new URL('../public/simulator/src/authored-slash.js',import.meta.url),'utf8');
  assert.match(slash,/export const SLASH_SECONDS = \.66;/);
  assert.match(slash,/contact:\.50/);
});
