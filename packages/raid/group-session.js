import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {RaidSession as SingleRaidSession} from './session.js';
import {PREY,hash,villagerBehavior} from './world.js';

const AGGRO_DISTANCE=9.2;
const RALLY_DISTANCE=8.0;
const JOIN_DISTANCE=6.4;
const LEAVE_DISTANCE=5.8;
const HARD_LEAVE_DISTANCE=8.2;
const MAX_SIMULTANEOUS=6;
const RETREAT_AWAY_DOT=.32;
const GROUP_ESCAPE_DOT=.18;

export class RaidSession extends SingleRaidSession {
 constructor(village,profile,ports={}){
  super(village,profile,ports);
  this.combatants=[];
  this._promoting=false;
  this.combatInputLatched=false;
 }
 emit(type,data={}){
  if(type==='engage'&&this._promoting)return;
  if(type==='disengage'&&this.combatants.length)return;
  return super.emit(type,data);
 }
 isAggressive(npc){return (npc?.behavior||villagerBehavior(npc?.role))==='fight';}
 combatantCount(){return (this.fight?1:0)+this.combatants.filter(f=>!f.npc.dead&&!f.npc.eaten).length;}
 isCombatant(npc){return this.fight?.npc===npc||this.combatants.some(f=>f.npc===npc);}
 _inputHeld(input={}){return !!input.active||Math.max(0,Number(input.amount)||0)>.05;}
 _heldEscapeIntent(input={}){
  const p=this.player;if(!p||!this._inputHeld(input))return false;
  const ix=Number(input.x)||0,iz=Number(input.z)||0,im=Math.hypot(ix,iz);if(im<.001)return false;
  const threats=[this.fight?.npc,...this.combatants.map(record=>record.npc)].filter(n=>n&&!n.dead&&!n.eaten);
  if(!threats.length)return false;
  let ax=0,az=0,total=0,nearest=null,near=Infinity;
  for(const n of threats){const dx=p.x-n.x,dz=p.z-n.z,d=Math.hypot(dx,dz)||.001,w=1/Math.max(1,d);ax+=dx/d*w;az+=dz/d*w;total+=w;if(d<near){near=d;nearest={dx:dx/d,dz:dz/d};}}
  ax/=total||1;az/=total||1;let am=Math.hypot(ax,az);
  if(am<.08&&nearest){ax=nearest.dx;az=nearest.dz;am=1;}
  const away=(ix*ax+iz*az)/(im*(am||1));
  return away>(threats.length>1?GROUP_ESCAPE_DOT:RETREAT_AWAY_DOT);
 }
 _combatInput(input={}){
  if(!this.fight||!this.combatInputLatched)return input;
  if(!this._inputHeld(input)){this.combatInputLatched=false;return input;}
  if(this._heldEscapeIntent(input)){this.combatInputLatched=false;return input;}
  return{...input,x:0,z:0,amount:0,active:false,dash:false};
 }
 engage(npc){
  if(this.finished||npc.dead||npc.eaten||this.isCombatant(npc))return;
  if(!this.fight){super.engage(npc);return;}
  if(this.combatantCount()>=MAX_SIMULTANEOUS){npc.state=this.isAggressive(npc)?'pursue':'flee';return;}
  const record={npc,retreat:0,learned:false,core:null,ox:this.player.x,oz:this.player.z};
  this.combatants.push(record);npc.state='combat';npc.pose=null;npc.speed=0;
  this.resetIdle();this.emit('engage',{npc,group:true,count:this.combatantCount()});
 }
 _rallyAggressors(){
  if(this.finished||this.devour)return;
  const p=this.player,focus=this.fight?.npc;
  for(const n of this.village.npcs){
   if(n.dead||n.eaten||this.isCombatant(n)||!this.isAggressive(n))continue;
   const playerDistance=Math.hypot(n.x-p.x,n.z-p.z);
   const sees=playerDistance<AGGRO_DISTANCE&&!this.lineBlocked(p,n);
   const hears=!!focus&&Math.hypot(n.x-focus.x,n.z-focus.z)<RALLY_DISTANCE;
   if(sees||hears){n.fear=0;n.state='pursue';}
  }
 }
 _joinNearby(){
  if(this.finished||this.devour||(!this.fight&&this.safeTime>0))return;
  const p=this.player,radius=this.fight?JOIN_DISTANCE:4.8;
  const candidates=this.village.npcs
   .filter(n=>!n.dead&&!n.eaten&&!this.isCombatant(n)&&this.isAggressive(n))
   .map(n=>({n,d:Math.hypot(n.x-p.x,n.z-p.z)}))
   .filter(({n,d})=>d<radius&&!this.lineBlocked(p,n))
   .sort((a,b)=>a.d-b.d);
  for(const {n} of candidates){if(this.combatantCount()>=MAX_SIMULTANEOUS)break;this.engage(n);}
 }
 _releaseSecondary(record){
  const i=this.combatants.indexOf(record);if(i<0)return;
  this.rememberFight(record);record.npc.state=this.isAggressive(record.npc)?'pursue':'flee';record.npc.pose=null;record.npc.speed=0;
  this.combatants.splice(i,1);this.emit('combatant-disengage',{npc:record.npc,count:this.combatantCount()});
 }
 _secondaryCore(record){
  if(record.core)return record.core;
  const p=this.player,n=record.npc,d=PREY[n.role],ox=record.ox=p.x,oz=record.oz=p.z;
  const colliders=[...this.village.colliders,...(!this.village.gate.broken?[-1.7,0,1.7].map(x=>({x,z:this.village.gate.z,r:.7})):[]),...(!this.has('acolyte')?[{...this.village.shelter}]:[])]
   .filter(o=>Math.hypot(o.x-ox,o.z-oz)<11).map(o=>({...o,x:o.x-ox,z:o.z-oz}));
  const core=createTidebreakRuntime({seed:hash(`${n.id}:group`),onImpact:e=>this.emit('impact',{...e,x:e.x+ox,z:e.z+oz,point:Array.isArray(e.point)?[e.point[0]+ox,e.point[1],e.point[2]+oz]:e.point,group:true,npc:n})});
  core.configure({weapon:'fist',heroPassive:true,hp:p.hp,maxhp:p.maxhp,enemyHp:n.hp,enemyWeapon:n.echo?.weapon||d.weapon,enemyStyle:n.role==='knight'?'counter':['traveller','bellkeeper','gravekeeper'].includes(n.role)?'cautious':'balanced',positions:{hero:{x:0,z:0,yaw:p.yaw||0},enemy:{x:n.x-ox,z:n.z-oz,yaw:n.yaw||0}},enemyLoadout:n.echo?.loadout,colliders});
  record.core=core;return core;
 }
 _tickSecondaries(dt,input={}){
  if(!this.combatants.length||this.finished||this.devour)return;
  const p=this.player;
  for(const record of [...this.combatants]){
   const n=record.npc;if(n.dead||n.eaten){this.combatants.splice(this.combatants.indexOf(record),1);continue;}
   const blocked=this.lineBlocked(p,n),distance=Math.hypot(p.x-n.x,p.z-n.z),far=distance>LEAVE_DISTANCE||blocked;
   record.retreat=far?Math.min(2,record.retreat+dt):Math.max(0,record.retreat-dt*1.8);
   if(distance>HARD_LEAVE_DISTANCE||record.retreat>.85){this._releaseSecondary(record);continue;}
   const core=this._secondaryCore(record),hx=p.x-record.ox,hz=p.z-record.oz,ex=n.x-record.ox,ez=n.z-record.oz;
   core.syncActors({hero:{x:hx,z:hz,yaw:p.yaw||0,hp:p.hp,maxhp:p.maxhp},enemy:{x:ex,z:ez,yaw:n.yaw||0,hp:n.hp,maxhp:n.maxhp||n.hp}});
   core.input(0,0,0,0);const before=core.state(),state=core.step(dt),damage=Math.max(0,before.hero.hp-state.hero.hp);
   const heroDx=state.hero.x-hx,heroDz=state.hero.z-hz;if(damage>0&&Math.hypot(heroDx,heroDz)>.0001)this.walkActor(p,heroDx,heroDz,true);
   p.hp=Math.min(p.hp,state.hero.hp);n.x=record.ox+state.enemy.x;n.z=record.oz+state.enemy.z;n.yaw=state.enemy.yaw;n.hp=state.enemy.hp;n.pose=state.enemy.pose;n.speed=state.enemy.moveSpeed||0;n.walk=(n.walk||0)+n.speed*dt*3.8;
   if(damage>0){const impact=[...(state.impacts||[])].reverse().find(row=>row?.targetHero)||state.impact||null;this.emit('hurt',{amount:damage,npc:n,group:true,impact,feel:state.feel});if(this.fight){this.fight.lastHp=p.hp;this.fight.core?.syncActors?.({hero:{x:p.x-this.fight.ox,z:p.z-this.fight.oz,yaw:p.yaw||0,hp:p.hp,maxhp:p.maxhp}});}}
   if(p.hp<=0){this.finish('defeated');return;}
  }
 }
 promoteNextCombatant(){
  if(this.fight||!this.combatants.length||this.finished||this.devour)return false;
  const live=this.combatants.filter(f=>!f.npc.dead&&!f.npc.eaten);
  if(!live.length){this.combatants=[];return false;}
  const p=this.player,record=live.sort((a,b)=>Math.hypot(a.npc.x-p.x,a.npc.z-p.z)-Math.hypot(b.npc.x-p.x,b.npc.z-p.z))[0];
  this.combatants.splice(this.combatants.indexOf(record),1);
  this._promoting=true;
  try{super.engage(record.npc);}finally{this._promoting=false;}
  this.safeTime=0;
  if(this.fight){this.fight.learned=record.learned;this.fight.retreat=Math.min(.35,record.retreat||0);}
  this.emit('retarget',{npc:record.npc,count:this.combatantCount()});
  return !!this.fight;
 }
 shadowStep(v){if(this.combatants.length)return;return super.shadowStep(v);}
 finish(status){this.combatInputLatched=false;for(const record of this.combatants)this.rememberFight(record);return super.finish(status);}
 clearCombat(){
  if(this.fight){this.fight.npc.state=this.isAggressive(this.fight.npc)?'pursue':'flee';this.fight.npc.pose=null;}
  for(const record of this.combatants){record.npc.state=this.isAggressive(record.npc)?'pursue':'flee';record.npc.pose=null;record.npc.speed=0;}
  this.fight=null;this.combatants=[];this.combatInputLatched=false;
 }
 tick(dt,input){
  if(this.finished)return;
  const rawInput=input||{};
  if(this.devour){
   super.tick(dt,rawInput);
   this.combatInputLatched=false;
   return;
  }
  const fightAtStart=!!this.fight;
  this._rallyAggressors();
  this._joinNearby();
  const fightBeforeCore=!!this.fight;
  if(!fightAtStart&&fightBeforeCore&&this._inputHeld(rawInput))this.combatInputLatched=true;
  const combatInput=this._combatInput(rawInput);
  const primary=this.fight?.npc||null;
  super.tick(dt,combatInput);
  if(!fightBeforeCore&&this.fight&&this._inputHeld(rawInput))this.combatInputLatched=true;
  if(this.finished)return;
  if(this.devour){this.combatInputLatched=false;return;}
  const released=primary&&!this.fight&&!primary.dead&&!primary.eaten;
  if(released&&!this.isAggressive(primary)){primary.state='flee';primary.fear=Math.max(primary.fear||0,3);}
  if(primary&&!this.fight&&this.combatants.length)this.promoteNextCombatant();
  this._rallyAggressors();
  if(this.fight)this._joinNearby();
  this._tickSecondaries(Math.min(Math.max(Number(dt)||0,0),1/30),combatInput);
  if(!this.fight&&this.combatants.length)this.promoteNextCombatant();
  if(!this.fight)this.combatInputLatched=false;
 }
}
