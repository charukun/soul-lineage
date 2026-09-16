import { WEAPONS, ARMORS, spendStamina, skillEffects } from './domain.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleTo=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);
const hash01=value=>{let hash=2166136261;for(const c of String(value)){hash^=c.codePointAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;};

export function villageSkirmishAnchor(stations=[]){
  const guard=stations.find(row=>row.enterInterior&&/詰所|駐屯所|見張り/.test(row.label))||stations.find(row=>row.id==='training-dummy')||{x:0,z:-22};
  let dx=Number(guard.x)||0,dz=Number(guard.z)||-1,len=Math.hypot(dx,dz);if(len<2){dx=0;dz=-1;len=1;}
  const ux=dx/len,uz=dz/len;return{x:guard.x+ux*7,z:guard.z+uz*7,angle:Math.atan2(ux,uz)};
}

function guard(id,x,z,index){return{id:`guard-${id}-${index}`,kind:'guard',label:'衛兵',x,z,spawnX:x,spawnZ:z,hp:70,maxHp:70,dead:false,respawn:0,cooldown:.3+index*.18,yaw:0,moving:false,flash:0};}
function hostile(id,kind,label,x,z,index){const stats=kind==='monster'?{hp:74,power:15,speed:1.05}:{hp:48,power:11,speed:1.22};return{id:`${kind}-${id}-${index}`,kind,label,x,z,spawnX:x,spawnZ:z,hp:stats.hp,maxHp:stats.hp,power:stats.power,speed:stats.speed,dead:false,respawn:0,cooldown:.45+index*.16,yaw:Math.PI,moving:false,flash:0};}

export function createVillageSkirmish(anchor={x:0,z:-30},seed=1){
  const ax=Number(anchor.x)||0,az=Number(anchor.z)||-30,angle=Number.isFinite(anchor.angle)?anchor.angle:Math.atan2(ax,az||-1),out={x:Math.sin(angle),z:Math.cos(angle)},side={x:out.z,z:-out.x};
  const at=(forward,lateral)=>({x:ax+out.x*forward+side.x*lateral,z:az+out.z*forward+side.z*lateral});
  const g0=at(-2.2,-1.4),g1=at(-2.3,1.4),rows=[at(2.3,-2.2),at(3.1,.2),at(2.1,2.2),at(4.5,1.2)];
  return{
    seed:Number(seed)||1,anchor:{x:ax,z:az,angle},guards:[guard(seed,g0.x,g0.z,0),guard(seed,g1.x,g1.z,1)],
    hostiles:[hostile(seed,'wildlife','狼',rows[0].x,rows[0].z,0),hostile(seed,'wildlife','猪',rows[1].x,rows[1].z,1),hostile(seed,'wildlife','狼',rows[2].x,rows[2].z,2),hostile(seed,'monster','魔物',rows[3].x,rows[3].z,3)],
    elapsed:0,playerCooldown:0,
  };
}

function nearest(source,rows){let best=null,bestD=Infinity;for(const row of rows){if(row.dead)continue;const d=distance(source,row);if(d<bestD){best=row;bestD=d;}}return{actor:best,distance:bestD};}
function moveToward(actor,target,dt,speed){
  const dx=target.x-actor.x,dz=target.z-actor.z,d=Math.max(.001,Math.hypot(dx,dz));actor.yaw=angleTo(actor,target);
  if(d<=1.35){actor.moving=false;return;}
  const step=Math.min(d-1.2,speed*dt),ox=actor.x,oz=actor.z;actor.x+=dx/d*step;actor.z+=dz/d*step;actor.moving=Math.hypot(actor.x-ox,actor.z-oz)>.002;
}
function resetActor(actor){actor.x=actor.spawnX;actor.z=actor.spawnZ;actor.hp=actor.maxHp;actor.dead=false;actor.respawn=0;actor.cooldown=.55;actor.flash=0;actor.moving=false;}
function downActor(actor,delay){actor.hp=0;actor.dead=true;actor.respawn=delay;actor.moving=false;}

function tickRespawns(skirmish,dt){
  for(const row of [...skirmish.guards,...skirmish.hostiles]){row.flash=Math.max(0,row.flash-dt*4);if(!row.dead){row.cooldown-=dt;continue;}row.respawn-=dt;if(row.respawn<=0)resetActor(row);}
}
function tickNpcBattle(skirmish,dt,events){
  const livingGuards=skirmish.guards.filter(row=>!row.dead),livingHostiles=skirmish.hostiles.filter(row=>!row.dead);
  for(const guard of livingGuards){
    const pick=nearest(guard,livingHostiles);if(!pick.actor)continue;moveToward(guard,pick.actor,dt,1.08);
    if(pick.distance<=1.5&&guard.cooldown<=0){const damage=12+hash01(`${guard.id}:${Math.floor(skirmish.elapsed*2)}`)*5;pick.actor.hp-=damage;pick.actor.flash=1;guard.cooldown=.72;if(pick.actor.hp<=0){downActor(pick.actor,5+hash01(pick.actor.id)*4);events.push({type:'skirmish-hostile-down',sourceId:guard.id,targetId:pick.actor.id});}}
  }
  for(const hostile of livingHostiles){
    const pick=nearest(hostile,livingGuards);if(!pick.actor)continue;moveToward(hostile,pick.actor,dt,hostile.speed);
    if(pick.distance<=1.45&&hostile.cooldown<=0){pick.actor.hp-=hostile.power;pick.actor.flash=1;hostile.cooldown=.8+hash01(`${hostile.id}:cooldown`)*.32;if(pick.actor.hp<=0){downActor(pick.actor,8+hash01(pick.actor.id)*4);events.push({type:'skirmish-guard-down',sourceId:hostile.id,targetId:pick.actor.id});}}
  }
}

function tickPlayer(state,skirmish,dt,events){
  if(state.zone!=='village'||state.interior||state.phase!=='living'||state.ended)return;
  if(state.down?.village){state.down.elapsed+=dt;if(state.down.elapsed>=Number(state.down.rescueSeconds||12)){state.down=null;state.hp=Math.max(28,state.maxHp*.32);state.stamina=Math.max(state.stamina,state.staminaCap*.55);state.position={x:skirmish.anchor.x,z:skirmish.anchor.z};state.combat=null;events.push({type:'rescued'});}return;}
  const living=skirmish.hostiles.filter(row=>!row.dead),pick=nearest(state.position,living),effects=skillEffects(state),weaponBase=WEAPONS[state.equipment.weapon]||WEAPONS.fist,weapon={...weaponBase,reach:weaponBase.reach*(1+effects.reach)};
  skirmish.playerCooldown=Math.max(0,skirmish.playerCooldown-dt);
  if(!pick.actor||pick.distance>4.6){if(state.combat?.villageSkirmish)state.combat=null;return;}
  if(!state.combat||!state.combat.villageSkirmish)state.combat={targetId:pick.actor.id,phase:'jo',attackCooldown:0,villageSkirmish:true};else state.combat.targetId=pick.actor.id;
  const playerTarget=pick.actor,playerDistance=pick.distance;
  if(playerDistance<=weapon.reach+.32&&skirmish.playerCooldown<=0&&spendStamina(state,weaponBase.stamina)){
    const damage=weaponBase.power*(1+effects.damage);playerTarget.hp-=damage;playerTarget.flash=1;skirmish.playerCooldown=.66+weaponBase.stamina/28;events.push({type:'player-hit',targetId:playerTarget.id,skill:weaponBase.skill,phase:'jo',damage});
    if(playerTarget.hp<=0){downActor(playerTarget,5+hash01(playerTarget.id)*4);state.defeats++;const row=state.experiences.combat||{count:0,score:0,last:0};state.experiences.combat={count:row.count+1,score:row.score+1,last:state.ageSeconds};events.push({type:'enemy-down',targetId:playerTarget.id});}
  }
  const threats=living.filter(row=>!row.dead&&distance(row,state.position)<=1.5);
  for(const hostile of threats){
    if(hostile.cooldown>0||state.hp<=0)continue;const roll=hash01(`${state.id}:${hostile.id}:${Math.floor(state.ageSeconds*4)}`);hostile.cooldown=.78+hash01(`${hostile.id}:player-cooldown`)*.3;
    if(roll<effects.evasion){events.push({type:'evaded',sourceId:hostile.id});continue;}
    const armor=ARMORS[state.equipment.armor]||ARMORS.cloth,shield=state.equipment.shield?.12:0,damage=hostile.power*1.25*(1-armor.guard-shield)*(1-effects.mitigation);
    state.hp=clamp(state.hp-damage,0,state.maxHp);events.push({type:'enemy-hit',sourceId:hostile.id,damage});
    if(state.hp<=0){state.down={elapsed:0,rescueSeconds:12,village:true};state.combat=null;events.push({type:'downed'});break;}
  }
}

export function tickVillageSkirmish(state,skirmish,dt){
  const events=[];if(!skirmish||!Number.isFinite(dt)||dt<=0)return events;skirmish.elapsed+=dt;tickRespawns(skirmish,dt);tickNpcBattle(skirmish,dt,events);tickPlayer(state,skirmish,dt,events);return events;
}

export function skirmishAlive(skirmish){return{guards:skirmish.guards.filter(row=>!row.dead).length,hostiles:skirmish.hostiles.filter(row=>!row.dead).length};}
