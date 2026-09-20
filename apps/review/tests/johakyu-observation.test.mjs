import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBattleObservation} from '../../../packages/shared-ui/src/johakyu-observation.js';
const root=new URL('../../../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const current=read('apps/review/src/nocturne/runtime.js');
const original=read('apps/review/src/nocturne-bk/runtime.js');

// Execute the real native simulation with actual Three math and mixers. No GPU is
// used here; exact-source rendering preservation is tested separately. This is
// causal gameplay evidence, not a browser/visual or real-device FPS claim.
function simulation(source){
  const names=['Idle','Running_A','Walking_D_Skeletons','Spawn_Ground_Skeletons','Spellcast_Shoot',
    '2H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal',
    '1H_Melee_Attack_Chop','Death_A','Death_C_Skeletons','Cheer'];
  const hook=`return {
    observe(epoch=1){return typeof inspectBattle==='function'?inspectBattle(epoch):null;},
    init(){scene=new THREE.Scene();for(const key of ['adventurers/Knight','skeletons/Skeleton_Mage','skeletons/Skeleton_Minion','skeletons/Skeleton_Warrior'])models.set(key,{scene:new THREE.Group(),animations:names.map(name=>new THREE.AnimationClip(name,1,[]))});game.ready=true;start();},
    step(dt){simulate(dt);},
    unavailable(){game.ready=false;},
    digest(){return {seed,rounds,allKills,game:{...game,boss:game.boss?.kind??null},trace:structuredClone(trace),
      actors:actors.map(a=>({kind:a.kind,boss:a.boss,hp:a.hp,maxHp:a.maxHp,dead:a.dead,position:a.pos.toArray(),yaw:a.object.rotation.y,combo:a.combo,cd:a.cd,spawn:a.spawn,animation:a.actionName,animationTime:a.action?.time,
        attack:a.attack?{time:a.attack.time,duration:a.attack.duration,hit:a.attack.hit,heavy:a.attack.heavy,big:a.attack.big,targetIndex:actors.indexOf(a.attack.target)}:null})),
      particles:particles.map(p=>({position:p.pos.toArray(),velocity:p.vel.toArray(),life:p.life})),
      projectiles:projectiles.map(p=>({position:p.pos.toArray(),velocity:p.vel.toArray(),life:p.life}))};}
  };`;
  const pattern=/return Object\.freeze\(\{prepare,resize,metrics,inspectActors,(?:inspectBattle,)?advance,destroy,fail,trace\}\);/;
  assert.match(source,pattern);
  const executable=source.replace(/^import .*;\n/gm,'').replace('export function createBattleRuntime','function createBattleRuntime').replace(pattern,hook);
  const factory=new Function('THREE','cloneSkeleton','createBattleObservation','devicePixelRatio','names',executable+'\nreturn createBattleRuntime;')(THREE,root=>root.clone(true),createBattleObservation,1,names);
  const audio=[];
  const engine=factory({world:null,effects:{getContext:()=>({})},stage:{clientWidth:900,clientHeight:600},
    sound:{note:(...values)=>audio.push(['note',...values]),hit:(...values)=>audio.push(['hit',...values])},notify:()=>{},signal:{aborted:false}});
  return {...engine,audio};
}

test('disabled and frequently read bridges preserve 120 seconds of actual combat and RNG',()=>{
  const baseline=simulation(original),disabled=simulation(current),observed=simulation(current);
  for(const engine of [baseline,disabled,observed])engine.init();
  const stable=new Map();let reads=0;
  for(let tick=0;tick<7200;tick++){
    for(const engine of [baseline,disabled,observed])engine.step(1/60);
    if(tick%13===0){
      const before=observed.digest(),a=observed.observe(),b=observed.observe();
      assert.deepEqual(a,b);assert.deepEqual(observed.digest(),before);reads++;
      for(const row of a.actors){const known=stable.get(row.id);if(known)assert.equal(row.side,known);else stable.set(row.id,row.side);}
      assert.equal(a.authority,'native-demo');assert.deepEqual(a.events,[]);
      assert.ok(a.actors.every(row=>row.phase===null));
    }
    if(tick%60===0){assert.deepEqual(disabled.digest(),baseline.digest());assert.deepEqual(observed.digest(),baseline.digest());}
  }
  assert.ok(reads>500);assert.ok(baseline.digest().allKills>0);assert.ok(baseline.audio.length>0);
  assert.deepEqual(observed.audio,baseline.audio);assert.deepEqual(disabled.audio,baseline.audio);
  assert.deepEqual(observed.digest(),baseline.digest());
});

test('snapshot is detached, uses existing actor UUIDs, and resets battle identity with boot epoch',()=>{
  const engine=simulation(current);assert.equal(engine.observe(),null);engine.init();
  const a=engine.observe(1);assert.match(a.actors[0].id,/^[0-9a-f-]{36}$/i);
  assert.notEqual(engine.observe(2).battleId,a.battleId);
  assert.throws(()=>{a.actors[0].hp=0;},TypeError);assert.equal(engine.observe().actors[0].hp,220);
  const id=a.actors[0].id;engine.step(1/60);assert.equal(engine.observe().actors[0].id,id);
  engine.unavailable();assert.equal(engine.observe(),null);
});

test('stage exposes only a lazy read and does not schedule observation work',()=>{
  const stage=read('apps/review/src/nocturne-stage.js');
  assert.match(stage,/get observation\(\)\{return prepared\?runtime\?\.inspectBattle\(sequence\)\?\?null:null;\}/);
  assert.equal((stage.match(/inspectBattle/g)||[]).length,1);
  assert.doesNotMatch(read('packages/shared-ui/src/johakyu-observation.js'),/Math\.random|localStorage|Date\.now|setInterval|requestAnimationFrame|\.advance\(/);
});
