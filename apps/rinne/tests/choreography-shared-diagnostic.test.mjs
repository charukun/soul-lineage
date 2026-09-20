import test from 'node:test';
import {createLife} from '../src/rebuild/domain.js';
import {tickSharedFront} from '../src/rebuild/combat.js';
import {combatBodySnapshot} from '../src/rebuild/combat-choreography.js';

function combatState(seed,id){
  const state=createLife({seed});state.id=id;state.phase='living';state.ageSeconds=20*60;state.ageYears=20;state.zone='frontier';state.position={x:id==='left'?-.35:.35,z:0};state.yaw=0;state.resting=false;state.hp=state.maxHp=500;state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights={jo:{'basic.sword':100},ha:{'basic.sword':100},kyu:{'basic.sword':100}};return state;
}
function enemy(){return{id:'shared',x:0,z:1.2,hp:1000,maxHp:1000,dead:false,cooldown:0,flash:0,yaw:0,attackWindow:0,moving:false};}

test('diagnose shared choreography participation',()=>{
  const left=combatState(51,'left'),right=combatState(52,'right'),shared=enemy(),front={stage:0,enemies:[shared],cleared:false,clearSeconds:0},hits={left:0,right:0},phases={left:{},right:{}};
  for(let i=0;i<420&&!shared.dead;i++){
    const events=tickSharedFront([right,left],front,1/60);
    for(const [id,rows] of events)for(const row of rows)if(row.type==='player-hit'&&row.targetId==='shared'){hits[id]++;phases[id][row.phase]=(phases[id][row.phase]||0)+1;}
  }
  console.log('SHARED_DIAG',JSON.stringify({
    hits,phases,
    left:{position:left.position,stamina:left.stamina,combat:left.combat&&{bodyIntent:left.combat.bodyIntent,staminaBand:left.combat.staminaBand,targetId:left.combat.targetId}},
    right:{position:right.position,stamina:right.stamina,combat:right.combat&&{bodyIntent:right.combat.bodyIntent,staminaBand:right.combat.staminaBand,targetId:right.combat.targetId}},
    enemy:{hp:shared.hp,dead:shared.dead,downed:shared.downed,attention:shared.attentionTargetId,contributors:shared._combatContributors,body:combatBodySnapshot(shared)}
  }));
});
