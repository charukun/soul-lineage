import {RaidSession as SingleRaidSession} from './session.js';
import {cancelDevour} from './devour.js';
import {villagerBehavior} from './world.js';

const AGGRO_DISTANCE=9.2;
const RALLY_DISTANCE=8.0;
const JOIN_DISTANCE=6.4;
const LEAVE_DISTANCE=5.8;
const HARD_LEAVE_DISTANCE=8.2;
const MAX_SIMULTANEOUS=6;

export class RaidSession extends SingleRaidSession {
 constructor(village,profile,ports={}){
  super(village,profile,ports);
  this.combatants=[];
  this._promoting=false;
 }
 emit(type,data={}){
  if(type==='engage'&&this._promoting)return;
  if(type==='disengage'&&this.combatants.length)return;
  return super.emit(type,data);
 }
 isAggressive(npc){return (npc?.behavior||villagerBehavior(npc?.role))==='fight';}
 combatantCount(){return (this.fight?1:0)+this.combatants.filter(f=>!f.npc.dead&&!f.npc.eaten).length;}
 isCombatant(npc){return this.fight?.npc===npc||this.combatants.some(f=>f.npc===npc);}
 engage(npc){
  if(this.finished||npc.dead||npc.eaten||this.isCombatant(npc))return;
  if(!this.fight){super.engage(npc);return;}
  if(this.combatantCount()>=MAX_SIMULTANEOUS){npc.state=this.isAggressive(npc)?'pursue':'flee';return;}
  const record={npc,retreat:0,learned:false,attackCooldown:.35+this.rng()*.45};
  this.combatants.push(record);npc.state='combat';npc.pose=null;npc.speed=0;
  this.alarm=Math.min(100,this.alarm+4*(this.has('bellkeeper')?.5:1));
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
 _tickSecondaries(dt,input={}){
  if(!this.combatants.length||this.finished)return;
  const p=this.player,groupSize=Math.max(1,this.combatantCount());
  for(const record of [...this.combatants]){
   const n=record.npc;if(n.dead||n.eaten){this.combatants.splice(this.combatants.indexOf(record),1);continue;}
   let dx=p.x-n.x,dz=p.z-n.z,d=Math.hypot(dx,dz)||.001;
   const blocked=this.lineBlocked(p,n),far=d>LEAVE_DISTANCE||blocked;
   record.retreat=far?Math.min(2,record.retreat+dt):Math.max(0,record.retreat-dt*1.8);
   if(d>HARD_LEAVE_DISTANCE||record.retreat>.85){this._releaseSecondary(record);continue;}
   if(d>2.05&&!blocked){
    const speed=n.role==='knight'?1.8:1.55,moved=this.walkActor(n,dx/d*speed*dt,dz/d*speed*dt,true);
    n.speed=moved/Math.max(dt,.001);n.walk=(n.walk||0)+moved*4.5;const yaw=Math.atan2(dx,dz);n.yaw+=(Math.atan2(Math.sin(yaw-(n.yaw||0)),Math.cos(yaw-(n.yaw||0)))*Math.min(1,dt*9));
   }else n.speed=0;
   record.attackCooldown=Math.max(0,record.attackCooldown-dt);
   dx=p.x-n.x;dz=p.z-n.z;d=Math.hypot(dx,dz);
   if(d<2.5&&!this.lineBlocked(p,n)&&record.attackCooldown<=0){
    record.attackCooldown=1.15+this.rng()*.65;
    const base=n.role==='knight'?9:n.role==='smith'?8:6;
    const damage=Math.max(3,base/Math.sqrt(Math.max(1,groupSize-1)));
    p.hp=Math.max(0,p.hp-damage);
    this.emit('impact',{x:p.x,y:1,z:p.z,yaw:n.yaw||0,guard:false,group:true,npc:n});
    this.emit('hurt',{amount:damage,npc:n,group:true});
    if(this.fight)this.fight.lastHp=p.hp;
    if(p.hp<=0){this.finish('defeated');return;}
   }
  }
 }
 promoteNextCombatant(){
  if(this.fight||!this.combatants.length||this.finished)return false;
  const live=this.combatants.filter(f=>!f.npc.dead&&!f.npc.eaten);
  if(!live.length){this.combatants=[];return false;}
  const p=this.player,record=live.sort((a,b)=>Math.hypot(a.npc.x-p.x,a.npc.z-p.z)-Math.hypot(b.npc.x-p.x,b.npc.z-p.z))[0];
  this.combatants.splice(this.combatants.indexOf(record),1);
  if(this.devour)cancelDevour(this);
  const alarm=this.alarm;this._promoting=true;
  try{super.engage(record.npc);}finally{this._promoting=false;}
  this.alarm=alarm;this.safeTime=0;
  if(this.fight){this.fight.learned=record.learned;this.fight.retreat=Math.min(.35,record.retreat||0);}
  this.emit('retarget',{npc:record.npc,count:this.combatantCount()});
  return !!this.fight;
 }
 shadowStep(v){if(this.combatants.length)return;return super.shadowStep(v);}
 finish(status){for(const record of this.combatants)this.rememberFight(record);return super.finish(status);}
 clearCombat(){
  if(this.fight){this.fight.npc.state=this.isAggressive(this.fight.npc)?'pursue':'flee';this.fight.npc.pose=null;}
  for(const record of this.combatants){record.npc.state=this.isAggressive(record.npc)?'pursue':'flee';record.npc.pose=null;record.npc.speed=0;}
  this.fight=null;this.combatants=[];
 }
 tick(dt,input){
  if(this.finished)return;
  this._rallyAggressors();
  this._joinNearby();
  const primary=this.fight?.npc||null;
  super.tick(dt,input);
  if(this.finished)return;
  const released=primary&&!this.fight&&!primary.dead&&!primary.eaten;
  if(released&&!this.isAggressive(primary)){primary.state='flee';primary.fear=Math.max(primary.fear||0,3);}
  if(primary&&!this.fight&&this.combatants.length)this.promoteNextCombatant();
  this._rallyAggressors();
  if(this.fight&&!this.devour)this._joinNearby();
  this._tickSecondaries(Math.min(Math.max(Number(dt)||0,0),1/30),input||{});
  if(!this.fight&&this.combatants.length)this.promoteNextCombatant();
 }
}
