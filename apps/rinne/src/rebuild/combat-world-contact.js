import { WEAPONS } from './domain.js';
import { ensureCombatInjuryState } from './combat-injury.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const TAU=Math.PI*2;
const SWEEP_ATTACKS=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const STOP_ON_FIRST=new Set(['thrust','pierce','dash','jab','straight','oneinch','katanaThrust']);
function wrap(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}
function dist(a,b){return Math.hypot((a.x||0)-(b.x||0),(a.z||0)-(b.z||0));}
function segmentDistance(ax,az,bx,bz,px,pz){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;if(l2<1e-8)return Math.hypot(px-ax,pz-az);const t=clamp(((px-ax)*dx+(pz-az)*dz)/l2,0,1),x=ax+dx*t,z=az+dz*t;return Math.hypot(px-x,pz-z);}

export function ensureCombatTerrain(front){
  if(front.terrain?.version===1)return front.terrain;const stage=Number(front.stage)||0,shift=(stage%2?1:-1)*.35;
  front.terrain={version:1,obstacles:[
    {id:'cover-left',x:-3.25,z:-.9+shift,w:.75,d:1.9,h:1.1},
    {id:'cover-right',x:3.25,z:1.05-shift,w:.75,d:1.9,h:1.1},
    ...(stage>=3?[{id:'broken-center',x:0,z:-2.55,w:1.85,d:.55,h:.65}]:[]),
  ]};return front.terrain;
}

function lineIntersectsRect(a,b,r){const steps=Math.max(3,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.22));for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2)return true;}return false;}
export function lineBlocked(front,a,b){return ensureCombatTerrain(front).obstacles.some(row=>lineIntersectsRect(a,b,row));}

function localWeaponDirection(state){
  const pose=state.combat?.tidebreakPose?.pose,hand=pose?.hand,tip=pose?.tip;if(!Array.isArray(hand)||!Array.isArray(tip))return{yaw:state.yaw||0,reach:(WEAPONS[state.equipment?.weapon]||WEAPONS.fist).reach};
  const lx=Number(tip[0])-Number(hand[0]),lz=Number(tip[2])-Number(hand[2]),localYaw=Math.atan2(Number.isFinite(lx)?lx:0,Number.isFinite(lz)?lz:1),poseReach=Math.hypot(Number(tip[0])-Number(hand[0]),Number(tip[1])-Number(hand[1]),Number(tip[2])-Number(hand[2]));
  return{yaw:(state.yaw||0)+localYaw,reach:clamp(Number.isFinite(poseReach)?poseReach:1,.45,(WEAPONS[state.equipment?.weapon]||WEAPONS.fist).reach+1.1)};
}

export function worldContactCandidates(state,front,event){
  const attack=String(state.combat?.tidebreakPose?.attack||''),profile=localWeaponDirection(state),base=WEAPONS[state.equipment?.weapon]||WEAPONS.fist;if(STOP_ON_FIRST.has(attack))return[];
  const broad=SWEEP_ATTACKS.has(attack),radius=Math.max(base.reach,profile.reach)+(broad ? .52 : .18),halfArc=broad ? ((attack==='spin'||attack==='round'||attack==='barrage') ? Math.PI : .95) : .38,origin=state.position;
  return front.enemies.filter(enemy=>!enemy.dead&&!enemy.downed&&enemy.id!==event.targetId&&dist(origin,enemy)<=radius).filter(enemy=>{const angle=Math.atan2(enemy.x-origin.x,enemy.z-origin.z);return Math.abs(wrap(angle-profile.yaw))<=halfArc&&!lineBlocked(front,origin,enemy);}).sort((a,b)=>dist(origin,a)-dist(origin,b));
}

export function enemySweepTargets(attacker,states,primaryId,front){
  const attack=String(attacker?.tidebreakPose?.attack||'');if(!SWEEP_ATTACKS.has(attack)||STOP_ON_FIRST.has(attack))return[];const full=attack==='spin'||attack==='round'||attack==='barrage',radius=full?2.35:1.95,halfArc=full?Math.PI:1.02,origin=attacker,yaw=Number(attacker.yaw)||0;
  return(states||[]).filter(state=>state.id!==primaryId&&!state.down&&!state.ended&&dist(origin,state.position)<=radius).filter(state=>{const angle=Math.atan2(state.position.x-origin.x,state.position.z-origin.z);return Math.abs(wrap(angle-yaw))<=halfArc&&!lineBlocked(front,origin,state.position);}).sort((a,b)=>dist(origin,a.position)-dist(origin,b.position));
}

function markDown(state,enemy,events,source='world-contact'){
  if(enemy.dead||enemy.downed)return;enemy.hp=0;enemy.downed=true;enemy.downedElapsed=0;enemy.moving=false;enemy.attacking=false;events.push({type:'enemy-downed',targetId:enemy.id,engine:source});
}

export function applyMultiTargetContact(state,front,event,events){
  if(event.type!=='player-hit'||event.projectile||event.multiTarget||!(event.damage>0))return[];const attack=String(state.combat?.tidebreakPose?.attack||'');if(STOP_ON_FIRST.has(attack))return[];
  const hits=[],factor=(attack==='spin'||attack==='round'||attack==='barrage') ? .82 : .7;for(const enemy of worldContactCandidates(state,front,event)){const damage=Math.min(enemy.hp,event.damage*factor);if(!(damage>0))continue;enemy.hp=Math.max(0,enemy.hp-damage);enemy.flash=1;const row={type:'player-hit',targetId:enemy.id,skill:event.skill,phase:event.phase,damage,multiTarget:true,engine:'world-contact'};events.push(row);hits.push(row);if(enemy.hp<=.001)markDown(state,enemy,events);}return hits;
}

function projectileState(state){ensureCombatInjuryState(state);state.rangedCombat??={cooldown:0,serial:0,projectiles:[]};if(!Array.isArray(state.rangedCombat.projectiles))state.rangedCombat.projectiles=[];return state.rangedCombat;}
function nearestRangedTarget(state,front){return front.enemies.filter(e=>!e.dead&&!e.downed).map(enemy=>({enemy,distance:dist(state.position,enemy)})).filter(row=>row.distance>1.75&&row.distance<=7.5&&!lineBlocked(front,state.position,row.enemy)).sort((a,b)=>a.distance-b.distance)[0]?.enemy||null;}
function firstProjectileHit(front,a,b){let best=null,bestD=Infinity;for(const enemy of front.enemies){if(enemy.dead||enemy.downed)continue;const d=segmentDistance(a.x,a.z,b.x,b.z,enemy.x,enemy.z);if(d>.42)continue;const along=dist(a,enemy);if(along<bestD){best=enemy;bestD=along;}}return best;}

export function tickRangedProjectiles(state,front,dt,events){
  ensureCombatTerrain(front);const ranged=projectileState(state);ranged.cooldown=Math.max(0,ranged.cooldown-dt);
  if(state.equipment?.weapon==='staff'&&ranged.cooldown<=0&&state.ammo.staffCharges>0&&!state.down&&!state.ended){const target=nearestRangedTarget(state,front);if(target){const dx=target.x-state.position.x,dz=target.z-state.position.z,len=Math.max(.001,Math.hypot(dx,dz));state.ammo.staffCharges--;ranged.cooldown=.82;ranged.projectiles.push({id:`p-${++ranged.serial}`,x:state.position.x,z:state.position.z,vx:dx/len*8.5,vz:dz/len*8.5,ttl:1.25,damage:22,targetId:target.id});events.push({type:'projectile-fired',targetId:target.id,ammo:state.ammo.staffCharges,engine:'world-contact'});}}
  const next=[];for(const p of ranged.projectiles){const a={x:p.x,z:p.z},b={x:p.x+p.vx*dt,z:p.z+p.vz*dt};p.ttl-=dt;if(lineBlocked(front,a,b)){events.push({type:'projectile-blocked',projectileId:p.id,engine:'world-contact'});continue;}const hit=firstProjectileHit(front,a,b);if(hit){const shieldScale=hit.shield ? .55 : 1,damage=Math.min(hit.hp,p.damage*shieldScale);hit.hp=Math.max(0,hit.hp-damage);hit.flash=1;events.push({type:'player-hit',targetId:hit.id,skill:'staff.projectile',phase:'ranged',damage,projectile:true,engine:'world-contact'});if(hit.hp<=.001)markDown(state,hit,events,'world-contact');continue;}p.x=b.x;p.z=b.z;if(p.ttl>0)next.push(p);}ranged.projectiles=next;return events;
}

export function terrainMovementScale(front,from,to,radius=.3){const terrain=ensureCombatTerrain(front);for(const obstacle of terrain.obstacles){if(Math.abs(to.x-obstacle.x)<=obstacle.w/2+radius&&Math.abs(to.z-obstacle.z)<=obstacle.d/2+radius)return 0;if(lineIntersectsRect(from,to,obstacle))return .15;}return 1;}
