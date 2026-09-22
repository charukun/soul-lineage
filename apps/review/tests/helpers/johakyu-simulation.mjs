import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBattleObservation} from '../../../../packages/shared-ui/src/johakyu-observation.js';
// Execute the real native simulation with actual Three math and mixers. No GPU is
// used here; exact-source rendering preservation is tested separately. This is
// causal gameplay evidence, not a browser/visual or real-device FPS claim.
export function simulation(source,{rules=null}={}){
  const names=[...new Set(Object.values(JSON.parse(readFileSync(new URL('../../src/nocturne/manifest.json',import.meta.url),'utf8')).models).flatMap(row=>row.animations||[]))];
  const hook=`return {
    observe(epoch=1){return typeof inspectBattle==='function'?inspectBattle(epoch):null;},
    restart(){start();},
    init(){scene=new THREE.Scene();for(const key of ['adventurers/Knight','skeletons/Skeleton_Mage','skeletons/Skeleton_Minion','skeletons/Skeleton_Warrior'])models.set(key,{scene:new THREE.Group(),animations:names.map(name=>new THREE.AnimationClip(name,1,[]))});game.ready=true;start();},
    step(dt){simulate(dt);},
    unavailable(){game.ready=false;},
    digest(){return {seed,rounds,allKills,game:{...game,boss:game.boss?.kind??null},trace:structuredClone(trace),
      actors:actors.map(a=>({kind:a.kind,boss:a.boss,hp:a.hp,maxHp:a.maxHp,dead:a.dead,position:a.pos.toArray(),yaw:a.object.rotation.y,combo:a.combo,cd:a.cd,spawn:a.spawn,animation:a.actionName,animationTime:a.action?.time,
        attack:a.attack?{time:a.attack.time,duration:a.attack.duration,hit:a.attack.hit,heavy:a.attack.heavy,big:a.attack.big,action:a.attack.action?{...a.attack.action}:null,targetIndex:actors.indexOf(a.attack.target)}:null})),
      particles:particles.map(p=>({position:p.pos.toArray(),velocity:p.vel.toArray(),life:p.life})),
      projectiles:projectiles.map(p=>({position:p.pos.toArray(),velocity:p.vel.toArray(),life:p.life}))};}
  };`;
  const pattern=/return Object\.freeze\(\{prepare,resize,metrics,inspectActors,(?:inspectBattle,)?advance,destroy,fail,trace\}\);/;
  assert.match(source,pattern);
  const executable=source.replace(/^import .*;\n/gm,'').replace('export function createBattleRuntime','function createBattleRuntime').replace(pattern,hook);
  const factory=new Function('THREE','cloneSkeleton','createBattleObservation','devicePixelRatio','names',executable+'\nreturn createBattleRuntime;')(THREE,root=>root.clone(true),createBattleObservation,1,names);
  const audio=[];
  const engine=factory({world:null,effects:{getContext:()=>({})},stage:{clientWidth:900,clientHeight:600},
    sound:{note:(...values)=>audio.push(['note',...values]),hit:(...values)=>audio.push(['hit',...values])},notify:()=>{},signal:{aborted:false},rules});
  return {...engine,audio};
}

