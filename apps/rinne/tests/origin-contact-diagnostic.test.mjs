import test from 'node:test';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {tidebreakLoadoutFor,tidebreakMindsetFor} from '../src/rebuild/tidebreak-loadout.js';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
const setup=()=>{const s=createLife({seed:6});Object.assign(s,{phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0}});s.equipment.weapon='sword';s.knownSkills.push('basic.sword');s.skillWeights.jo={'basic.sword':100};const f=createFront(0,6);Object.assign(f.enemies[0],{x:.5,z:.5});return{s,f};};
test('diagnose contact setup without replacing the regression assertion',()=>{
  for(const scenario of ['core','core-facing','core-single','direct']){
    const {s,f}=setup();if(scenario==='core-facing')s.yaw=Math.PI/4;if(scenario==='core-single')for(const e of f.enemies.slice(1))e.dead=true;
    const snapshots=[],runtime=scenario==='direct'?createTidebreakRuntime({seed:6,weapon:'sword'}):null;
    if(runtime)runtime.configure({weapon:'sword',loadout:tidebreakLoadoutFor(s,null,f.enemies[0]),mindset:tidebreakMindsetFor(s),hp:100,enemyHp:42,positions:{hero:{x:0,z:0,yaw:s.yaw},enemy:{x:.5,z:.5,yaw:f.enemies[0].yaw}}});
    let previousRecipe='',recipeChanges=0,events=[];
    for(let i=0;i<120;i++){
      let snap;if(runtime)snap=runtime.step(1/60);else events.push(...tickFront(s,f,1/60));
      const recipe=JSON.stringify(tidebreakLoadoutFor(s,s.combat?.comboId,f.enemies[0]));if(recipe!==previousRecipe){recipeChanges++;previousRecipe=recipe;}
      if(i%20===19)snapshots.push(runtime?{time:snap.time,stats:snap.stats,hero:snap.hero,enemy:snap.enemy}:{frame:i+1,attack:s.combat?.tidebreakPose?.attack,progress:s.combat?.tidebreakPose?.progress,intent:s.combat?.bodyIntent,yaw:s.yaw,position:s.position,stamina:s.stamina,hp:s.hp,enemy:{x:f.enemies[0].x,z:f.enemies[0].z,hp:f.enemies[0].hp},recipeChanges,events:events.map(e=>e.type)});
    }
    console.log('CONTACT_DIAGNOSTIC',JSON.stringify({scenario,snapshots,finalRecipe:JSON.parse(previousRecipe)}));
  }
});
