import { WEAPONS, ARMORS, spendStamina } from './domain.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function createFront(stage=0,seed=1){
  const boss=stage>=5,count=boss?1:3+Math.min(2,stage),rows=[];
  for(let i=0;i<count;i++){
    const angle=(i/(Math.max(1,count)))*Math.PI*1.5+.3,ring=boss?2:2.5+(i%2)*1.2;
    rows.push({id:`front-${stage}-${i}`,x:Math.sin(angle)*ring,z:-1.2-Math.cos(angle)*ring,hp:boss?180:42+stage*9,maxHp:boss?180:42+stage*9,dead:false,cooldown:.4+i*.18,flash:0});
  }
  return{stage,enemies:rows,cleared:false,clearSeconds:0};
}

function chooseSkill(state,phase){
  const weights=state.skillWeights?.[phase]||{},valid=Object.entries(weights).filter(([,w])=>Number(w)>0).sort((a,b)=>b[1]-a[1]);
  if(valid.length)return valid[0][0];
  return WEAPONS[state.equipment.weapon]?.skill||'basic.fist';
}

export function tickFront(state,front,dt){
  const events=[];if(state.zone!=='frontier'||state.ended)return events;
  for(const e of front.enemies){e.flash=Math.max(0,e.flash-dt*4);if(!e.dead)e.cooldown-=dt;}
  const living=front.enemies.filter(e=>!e.dead);
  if(!living.length){front.cleared=true;front.clearSeconds+=dt;state.combat=null;return[{type:'front-cleared',stage:front.stage}];}
  if(state.down){
    state.down.elapsed+=dt;if(state.down.elapsed>=40){state.down=null;state.zone='village';state.front=0;state.hp=Math.max(30,state.maxHp*.3);state.stamina=state.staminaCap*.6;state.combat=null;events.push({type:'rescued'});}return events;
  }
  let target=state.combat&&living.find(e=>e.id===state.combat.targetId);
  if(!target){target=living.sort((a,b)=>dist(state.position,a)-dist(state.position,b))[0];if(target&&dist(state.position,target)<=2.45)state.combat={targetId:target.id,phase:'jo',attackCooldown:0};else state.combat=null;}
  if(!state.combat)return events;
  target=living.find(e=>e.id===state.combat.targetId);if(!target){state.combat=null;return events;}
  const d=dist(state.position,target);if(d>3.4){state.combat=null;return[{type:'disengage'}];}
  state.moving=false;state.combat.attackCooldown-=dt;
  if(state.combat.attackCooldown<=0){
    const weapon=WEAPONS[state.equipment.weapon]||WEAPONS.fist,phase=state.combat.phase,skill=chooseSkill(state,phase),cost=weapon.stamina*(phase==='kyu'?1.25:phase==='ha'?1.08:1);
    if(d<=weapon.reach+.35&&spendStamina(state,cost)){
      const mult=phase==='kyu'?1.28:phase==='ha'?1.12:1,damage=weapon.power*mult;target.hp-=damage;target.flash=1;
      state.combat.attackCooldown=.62+(weapon.stamina/25);events.push({type:'player-hit',targetId:target.id,skill,phase,damage});
      if(target.hp<=0){target.hp=0;target.dead=true;state.defeats++;const row=state.experiences.combat||{count:0,score:0,last:0};state.experiences.combat={count:row.count+1,score:row.score+1,last:state.ageSeconds};events.push({type:'enemy-down',targetId:target.id});state.combat=null;}
      else state.combat.phase=phase==='jo'?'ha':phase==='ha'?'kyu':'jo';
    }else state.combat.attackCooldown=.18;
  }
  if(!target.dead&&d<=1.55&&target.cooldown<=0){
    const armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,damage=(8+front.stage*1.6)*(1-armor.guard-shield);
    state.hp=clamp(state.hp-damage,0,state.maxHp);target.cooldown=1.05+front.stage*.04;events.push({type:'enemy-hit',damage});
    if(state.hp<=0){state.down={elapsed:0};state.combat=null;events.push({type:'downed'});}
  }
  return events;
}
