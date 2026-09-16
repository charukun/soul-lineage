import { WEAPONS, ARMORS, spendStamina, skillEffects } from './domain.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const TAU=Math.PI*2,ARENA={minX:-6.75,maxX:6.75,minZ:-5.85,maxZ:5.65};

function wrapAngle(value){
  value=Number(value)||0;while(value>Math.PI)value-=TAU;while(value<-Math.PI)value+=TAU;return value;
}
function angleDelta(from,to){return wrapAngle(to-from);}
function turnToward(from,to,maxStep){return wrapAngle(from+clamp(angleDelta(from,to),-maxStep,maxStep));}
function angleTo(from,to){return Math.atan2(to.x-from.x,to.z-from.z);}
function hash01(value){
  const text=String(value);let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0)/4294967295;
}
function enemyDefaults(id,x,z){
  return{yaw:angleTo({x,z},{x:0,z:5.2}),attackWindow:0,moving:false};
}

export function createFront(stage=0,seed=1){
  const boss=stage>=5,count=boss?1:3+Math.min(2,stage),rows=[];
  for(let i=0;i<count;i++){
    const angle=(i/(Math.max(1,count)))*Math.PI*1.5+.3,ring=boss?2:2.5+(i%2)*1.2,x=Math.sin(angle)*ring,z=-1.2-Math.cos(angle)*ring;
    rows.push({id:`front-${stage}-${i}`,x,z,hp:boss?180:42+stage*9,maxHp:boss?180:42+stage*9,dead:false,cooldown:.4+i*.18,flash:0,...enemyDefaults(`front-${stage}-${i}`,x,z)});
  }
  return{stage,enemies:rows,cleared:false,clearSeconds:0};
}

export function normalizeFront(raw,stage=0,seed=1){
  if(!raw)return createFront(stage,seed);
  if(!Number.isInteger(raw.stage)||raw.stage<0||raw.stage>5||raw.stage!==stage||!Array.isArray(raw.enemies)||raw.enemies.length<1||raw.enemies.length>6)throw Error('前線の保存データが不正です。');
  const ids=new Set(),enemies=raw.enemies.map(e=>{
    if(!e||typeof e.id!=='string'||e.id.length>80||ids.has(e.id)||!finite(e.x,-20,20)||!finite(e.z,-20,20)||!finite(e.maxHp,1,1000)||!finite(e.hp,0,e.maxHp)||typeof e.dead!=='boolean'||!finite(e.cooldown,-30,30))throw Error('前線の敵データが不正です。');
    ids.add(e.id);const fallback=enemyDefaults(e.id,e.x,e.z);
    return{id:e.id,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,dead:e.dead,cooldown:e.cooldown,flash:finite(e.flash,0,1)?e.flash:0,yaw:Number.isFinite(e.yaw)?wrapAngle(e.yaw):fallback.yaw,attackWindow:finite(e.attackWindow,0,3)?e.attackWindow:0,moving:false};
  });
  const allDead=enemies.every(e=>e.dead);
  if(raw.cleared===true&&!allDead)throw Error('前線の撃破状態が不正です。');
  const cleared=allDead,clearSeconds=finite(raw.clearSeconds,0,3600)?raw.clearSeconds:0;
  return{stage,enemies,cleared,clearSeconds};
}

function chooseSkill(state,phase){
  const weights=state.skillWeights?.[phase]||{},valid=Object.entries(weights).filter(([,w])=>Number(w)>0).sort((a,b)=>b[1]-a[1]);
  if(valid.length)return valid[0][0];
  return WEAPONS[state.equipment.weapon]?.skill||'basic.fist';
}

function nearestEnemy(position,enemies){
  let best=null,bestDistance=Infinity;
  for(const enemy of enemies){const d=dist(position,enemy);if(d<bestDistance){best=enemy;bestDistance=d;}}
  return{enemy:best,distance:bestDistance};
}

function advanceEnemyFormation(state,living,dt,stage){
  if(!living.length||dt<=0)return;
  const snapshot=living.map(enemy=>({id:enemy.id,x:enemy.x,z:enemy.z,cooldown:enemy.cooldown,attackWindow:enemy.attackWindow||0}));
  const planned=snapshot.map(row=>{
    const dx=row.x-state.position.x,dz=row.z-state.position.z,d=Math.max(.001,Math.hypot(dx,dz)),ox=dx/d,oz=dz/d;
    const orbit=hash01(`${row.id}:orbit`)<.5?-1:1,ready=row.cooldown<=.12,committed=row.attackWindow>0;
    const preferred=(stage>=5?1.65:ready?1.48:1.86+hash01(`${row.id}:ring`)*.42),radial=clamp((d-preferred)*(d>3.2?1.15:.82),-.75,1.45);
    const tx=-oz*orbit,tz=ox*orbit,orbitSpeed=d>3.35?.12:(ready?.24:.48+hash01(`${row.id}:pace`)*.2);
    let vx=-ox*radial+tx*orbitSpeed,vz=-oz*radial+tz*orbitSpeed;
    for(const other of snapshot){
      if(other.id===row.id)continue;const sx=row.x-other.x,sz=row.z-other.z,separation=Math.hypot(sx,sz);
      if(separation>0&&separation<1.08){const push=(1-separation/1.08)*1.55;vx+=sx/separation*push;vz+=sz/separation*push;}
    }
    if(committed){vx*=.22;vz*=.22;}
    const magnitude=Math.hypot(vx,vz),speed=1.02+Math.min(.28,stage*.045)+(d>3.2?.5:0),scale=magnitude>speed?speed/magnitude:1;
    return{id:row.id,vx:vx*scale,vz:vz*scale};
  });
  for(const move of planned){
    const enemy=living.find(row=>row.id===move.id);if(!enemy)continue;
    const beforeX=enemy.x,beforeZ=enemy.z;enemy.x=clamp(enemy.x+move.vx*dt,ARENA.minX,ARENA.maxX);enemy.z=clamp(enemy.z+move.vz*dt,ARENA.minZ,ARENA.maxZ);
    enemy.yaw=turnToward(enemy.yaw,angleTo(enemy,state.position),dt*5.4);enemy.moving=Math.hypot(enemy.x-beforeX,enemy.z-beforeZ)>.002;
  }
}

function targetScore(state,enemy,currentId,phase,weapon){
  const d=dist(state.position,enemy),facing=Math.abs(angleDelta(state.yaw,angleTo(state.position,enemy)));
  let score=d+facing*.18+(enemy.cooldown<=.12?-.5:0)+(enemy.attackWindow>0?-.22:0)+(d<=weapon.reach+.45?-.24:0);
  if(enemy.id===currentId)score+=phase==='jo'?-.32:phase==='ha'?-.04:.1;
  else score+=phase==='kyu'?-.28:phase==='ha'?-.14:.02;
  return score+(hash01(`${enemy.id}:${phase}`)-.5)*.03;
}
function selectPlayerTarget(state,living,weapon){
  const currentId=state.combat?.targetId||null,phase=state.combat?.phase||'jo';
  return [...living].sort((a,b)=>targetScore(state,a,currentId,phase,weapon)-targetScore(state,b,currentId,phase,weapon))[0]||null;
}

function widestEscapeLane(state,enemies){
  const angles=enemies.map(enemy=>angleTo(state.position,enemy)).sort((a,b)=>a-b);if(angles.length<2)return null;
  let widest=-1,start=0;
  for(let i=0;i<angles.length;i++){
    const a=angles[i],b=i===angles.length-1?angles[0]+TAU:angles[i+1],gap=b-a;
    if(gap>widest){widest=gap;start=a;}
  }
  const angle=wrapAngle(start+widest/2);return{x:Math.sin(angle),z:Math.cos(angle),gap:widest};
}
function movePlayer(state,vx,vz,speed,dt){
  const magnitude=Math.hypot(vx,vz);if(magnitude<.001)return false;
  const scale=speed*dt/magnitude,beforeX=state.position.x,beforeZ=state.position.z;
  state.position.x=clamp(state.position.x+vx*scale,ARENA.minX,ARENA.maxX);state.position.z=clamp(state.position.z+vz*scale,ARENA.minZ,ARENA.maxZ);
  return Math.hypot(state.position.x-beforeX,state.position.z-beforeZ)>.001;
}
function automaticFootwork(state,living,target,weapon,dt){
  if(state.moving||!target||dt<=0)return false;
  const nearby=living.filter(enemy=>dist(state.position,enemy)<=2.45);
  if(nearby.length>=2){const lane=widestEscapeLane(state,nearby);if(lane&&lane.gap>1.05)return movePlayer(state,lane.x,lane.z,.72,dt);}
  const dx=target.x-state.position.x,dz=target.z-state.position.z,d=Math.max(.001,Math.hypot(dx,dz));
  if(d>weapon.reach+.32&&d<3.5)return movePlayer(state,dx,dz,.62,dt);
  if(d<Math.max(.72,weapon.reach*.62))return movePlayer(state,-dx,-dz,.5,dt);
  if(living.length>1){const orbit=hash01(`${target.id}:hero-orbit`)<.5?-1:1;return movePlayer(state,-dz*orbit,dx*orbit,.22,dt);}
  return false;
}

function enemyAttackCandidates(state,living){
  const candidates=living.filter(enemy=>!enemy.dead&&enemy.cooldown<=0&&dist(state.position,enemy)<=1.58).map(enemy=>({enemy,distance:dist(state.position,enemy),angle:angleTo(state.position,enemy)}));
  for(const row of candidates)row.score=-row.enemy.cooldown+(1.58-row.distance)*.7+hash01(`${row.enemy.id}:attack`)*.035;
  return candidates.filter(row=>!candidates.some(other=>{
    if(other.enemy.id===row.enemy.id||Math.abs(angleDelta(row.angle,other.angle))>=.78)return false;
    return other.score>row.score||(other.score===row.score&&other.enemy.id<row.enemy.id);
  }));
}

export function tickFront(state,front,dt,{advanceEnemies=true,incomingEnemyIds=null}={}){
  const events=[];if(state.zone!=='frontier'||state.ended)return events;
  if(advanceEnemies)advanceEnemyClock(front,dt);
  let living=front.enemies.filter(enemy=>!enemy.dead);
  if(!living.length){front.cleared=true;if(advanceEnemies)front.clearSeconds+=dt;state.combat=null;return[{type:'front-cleared',stage:front.stage}];}
  if(state.down){
    if(advanceEnemies)for(const enemy of living)enemy.moving=false;
    state.down.elapsed+=dt;if(state.down.elapsed>=40){state.down=null;state.zone='village';state.front=0;state.hp=Math.max(30,state.maxHp*.3);state.stamina=state.staminaCap*.6;state.combat=null;events.push({type:'rescued'});}return events;
  }

  const effects=skillEffects(state);
  if(advanceEnemies)advanceEnemyFormation(state,living,dt,front.stage);
  let nearest=nearestEnemy(state.position,living);
  if(!state.combat&&nearest.distance<=3.25)state.combat={targetId:nearest.enemy.id,phase:'jo',attackCooldown:0};
  if(state.combat&&nearest.distance>4.6){state.combat=null;events.push({type:'disengage'});}

  if(state.combat){
    const baseWeapon=WEAPONS[state.equipment.weapon]||WEAPONS.fist,weapon={...baseWeapon,reach:baseWeapon.reach*(1+effects.reach)};
    state.combat.phase=['jo','ha','kyu'].includes(state.combat.phase)?state.combat.phase:'jo';
    state.combat.attackCooldown=Number.isFinite(state.combat.attackCooldown)?state.combat.attackCooldown-dt:-dt;
    let target=living.find(enemy=>enemy.id===state.combat.targetId&&!enemy.dead)||selectPlayerTarget(state,living,weapon);
    if(state.combat.attackCooldown<=0||!target||dist(state.position,target)>3.6)target=selectPlayerTarget(state,living,weapon);
    if(target){
      state.combat.targetId=target.id;const autoMoved=automaticFootwork(state,living,target,weapon,dt);if(autoMoved)state.moving=true;
      const desiredYaw=angleTo(state.position,target);state.yaw=turnToward(state.yaw,desiredYaw,dt*6.2);
      const d=dist(state.position,target),facing=Math.abs(angleDelta(state.yaw,desiredYaw));
      if(state.combat.attackCooldown<=0){
        const phase=state.combat.phase,skill=chooseSkill(state,phase),cost=baseWeapon.stamina*(phase==='kyu'?1.25:phase==='ha'?1.08:1);
        if(d<=weapon.reach+.35&&facing<=.68&&spendStamina(state,cost)){
          const mult=phase==='kyu'?1.28:phase==='ha'?1.12:1,damage=baseWeapon.power*mult*(1+effects.damage);target.hp-=damage;target.flash=1;
          state.combat.attackCooldown=.62+(baseWeapon.stamina/25);events.push({type:'player-hit',targetId:target.id,skill,phase,damage});
          if(target.hp<=0){target.hp=0;target.dead=true;target.moving=false;state.defeats++;const row=state.experiences.combat||{count:0,score:0,last:0};state.experiences.combat={count:row.count+1,score:row.score+1,last:state.ageSeconds};events.push({type:'enemy-down',targetId:target.id});}
          state.combat.phase=phase==='jo'?'ha':phase==='ha'?'kyu':'jo';
        }else state.combat.attackCooldown=.12;
      }
    }
  }

  living=front.enemies.filter(enemy=>!enemy.dead);nearest=nearestEnemy(state.position,living);
  if(state.combat&&living.length){
    const target=living.find(enemy=>enemy.id===state.combat.targetId);
    if(!target)state.combat.targetId=nearest.enemy?.id||null;
  }
  if(!living.length){front.cleared=true;state.combat=null;return events;}

  const attackers=enemyAttackCandidates(state,incomingEnemyIds?living.filter(enemy=>incomingEnemyIds.has(enemy.id)):living),armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,simultaneousScale=attackers.length>1?1/Math.sqrt(attackers.length):1;
  for(const row of attackers){
    if(state.hp<=0)break;const enemy=row.enemy,roll=hash01(`${state.id}:${enemy.id}:${Math.floor(state.ageSeconds*4)}:${state.defeats}`);
    if(roll<effects.evasion){enemy.cooldown=.82+hash01(`${enemy.id}:evade-recovery`)*.2;enemy.attackWindow=.2;events.push({type:'evaded',sourceId:enemy.id});continue;}
    const damage=(13+front.stage*2.2)*(1-armor.guard-shield)*(1-effects.mitigation)*simultaneousScale;
    state.hp=clamp(state.hp-damage,0,state.maxHp);enemy.cooldown=1.05+front.stage*.04+hash01(`${enemy.id}:recovery`)*.22;enemy.attackWindow=.32;events.push({type:'enemy-hit',sourceId:enemy.id,damage});
    if(!state.combat)state.combat={targetId:enemy.id,phase:'jo',attackCooldown:0};
    if(state.hp<=0){state.down={elapsed:0};state.combat=null;events.push({type:'downed'});break;}
  }
  return events;
}

function advanceEnemyClock(front,dt){
  for(const enemy of front.enemies){enemy.flash=Math.max(0,enemy.flash-dt*4);enemy.attackWindow=Math.max(0,(enemy.attackWindow||0)-dt);if(!enemy.dead)enemy.cooldown-=dt;else enemy.moving=false;}
}

/** One shared frontier: enemy clocks/formation run once, with stable character order, never packet order. */
export function tickSharedFront(states,front,dt){
  const ordered=[...states].sort((a,b)=>a.id.localeCompare(b.id)),events=new Map();
  if(ordered.length===1){events.set(ordered[0].id,tickFront(ordered[0],front,dt));return events;}
  if(!ordered.length)return events;
  advanceEnemyClock(front,dt);
  const eligible=ordered.filter(state=>!state.down&&!state.ended),targets=new Map(ordered.map(state=>[state.id,new Set()]));
  for(const enemy of front.enemies.filter(row=>!row.dead)){
    const target=[...eligible].sort((a,b)=>dist(enemy,a.position)-dist(enemy,b.position)||a.id.localeCompare(b.id))[0];
    if(target)targets.get(target.id).add(enemy.id);else enemy.moving=false;
  }
  for(const state of eligible)advanceEnemyFormation(state,front.enemies.filter(enemy=>targets.get(state.id).has(enemy.id)),dt,front.stage);
  if(front.enemies.every(enemy=>enemy.dead))front.clearSeconds+=dt;
  for(const state of ordered)events.set(state.id,tickFront(state,front,dt,{advanceEnemies:false,incomingEnemyIds:targets.get(state.id)}));
  return events;
}
