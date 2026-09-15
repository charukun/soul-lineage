import { createLife, validateLife, tickLife, setMoving, setClockRate, canDepart, depart, advanceFront, returnHome, rebirth } from './domain.js';
import { createFront, normalizeFront, tickSharedFront } from './combat.js';
import { buildStations, nearestStation } from './locations.js';
import { validateMuraLayout, safeMuraPosition, muraBlocked } from '@soul/world/mura';

export const COOP_LIMIT=30;
export const COOP_PROTOCOL='rinne-coop-dev-1';
const clone=value=>structuredClone(value),identifier=value=>typeof value==='string'&&/^[\w:.-]{1,120}$/.test(value);
const seedOf=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const speed=age=>age<4?1.2:age<7?2.15:age<65?4.15:Math.max(2.3,4.15-(age-65)*.035);
const visibleLife=s=>({id:s.id,name:s.name,seed:s.seed,birthVillageId:s.birthVillageId,ageSeconds:s.ageSeconds,ageYears:s.ageYears,phase:s.phase,zone:s.zone,front:s.front,position:clone(s.position),yaw:s.yaw,moving:s.moving,equipment:clone(s.equipment),combat:Boolean(s.combat),ended:s.ended});

export class CoopWorld {
  constructor({worldId,ownerId,name,layout,saved=null}){
    if(!identifier(worldId)||!identifier(ownerId))throw Error('村の識別情報が不正です。');
    this.layout=validateMuraLayout(clone(layout));this.stations=buildStations(this.layout);this.inputs=new Map();this.events=new Map();this.dirtyHistory=false;
    this.data={version:1,worldId,ownerId,epoch:1,tick:0,worldSeconds:0,clockRate:1,players:{},fronts:{}};
    if(saved){
      if(saved.version!==1||saved.worldId!==worldId||saved.ownerId!==ownerId||!Number.isSafeInteger(saved.epoch)||saved.epoch<1||!Number.isSafeInteger(saved.tick)||saved.tick<0||!Number.isFinite(saved.worldSeconds)||saved.worldSeconds<0)throw Error('試遊の保存形式が不正です。');
      if(!saved.players||Object.keys(saved.players).length>COOP_LIMIT||!Object.hasOwn(saved.players,ownerId))throw Error('試遊の参加者が不正です。');
      for(const [id,row]of Object.entries(saved.players)){if(!identifier(id)||typeof row.token!=='string'||row.token.length>120)throw Error('参加者の記録が不正です。');validateLife(row.life);}
      for(const [stage,front]of Object.entries(saved.fronts||{}))normalizeFront(front,Number(stage));
      this.data=clone(saved);this.data.epoch++;this.setRate(ownerId,saved.clockRate);
    }else this.addPlayer(ownerId,name,'owner');
  }
  addPlayer(id,name,token){
    if(!identifier(id)||Object.hasOwn(this.data.players,id)||Object.keys(this.data.players).length>=COOP_LIMIT)throw Error('この村にはこれ以上参加できません。');
    const life=createLife({name,seed:seedOf(`${this.data.worldId}:${id}`),villageIds:[this.layout.id]});
    const slot=Object.keys(this.data.players).length,radius=1.6+Math.floor(slot/6)*.7;
    if(slot)life.position={x:life.position.x+Math.cos(slot*2.4)*radius,z:life.position.z+Math.sin(slot*2.4)*radius};
    life.id=`${id}:1`;life.position=safeMuraPosition(this.layout,life.position);life.clockRate=this.data.clockRate;
    this.data.players[id]={life,token,portDwell:0};this.dirtyHistory=true;return life;
  }
  setRate(id,rate){if(id!==this.data.ownerId)throw Error('世界時計は村を開いた人が操作します。');for(const row of Object.values(this.data.players))setClockRate(row.life,rate);this.data.clockRate=Number(rate);}
  acceptInput(id,input){
    if(!Object.hasOwn(this.data.players,id)||!input||!Number.isSafeInteger(input.seq)||input.seq<0||input.seq<=(this.inputs.get(id)?.seq??-1))return false;
    if(!Number.isFinite(input.x)||!Number.isFinite(input.z)||Math.hypot(input.x,input.z)>1.001)return false;
    this.inputs.set(id,{seq:input.seq,x:input.x,z:input.z,until:this.data.tick+10});return true;
  }
  clearInput(id){this.inputs.delete(id);}
  rebirth(id,villageId){const row=this.data.players[id];if(!row||!row.life.ended)return false;row.life=rebirth(row.life,{villageId:villageId||null,villageIds:[this.layout.id]});row.life.id=`${id}:${row.life.generation}`;row.life.clockRate=this.data.clockRate;row.life.position=safeMuraPosition(this.layout,row.life.position);row.portDwell=0;this.dirtyHistory=true;return true;}
  advance(dt=.05){
    if(!Number.isFinite(dt)||dt<=0||dt>.05)throw Error('共有時計の刻みが不正です。');
    this.data.tick++;this.data.worldSeconds+=dt*this.data.clockRate;
    const rows=Object.entries(this.data.players).sort(([a],[b])=>a.localeCompare(b));
    for(const [id,row]of rows){
      const life=row.life,input=this.inputs.get(id),beforeEnded=life.ended;let moved=false;
      if(input&&input.until>=this.data.tick&&!life.ended&&!life.down){
        const step=speed(life.ageYears)*(life.combat?.72:1)*dt,nx=life.position.x+input.x*step,nz=life.position.z+input.z*step;
        const allowed=life.zone==='frontier'?Math.abs(nx)<6.82&&nz> -6.12&&nz<5.77:!muraBlocked(this.layout,nx,nz,.32);
        if(allowed&&Math.hypot(input.x,input.z)>.08){life.position={x:nx,z:nz};life.yaw=Math.atan2(input.x,input.z);moved=true;}
      }
      row.carrierMoving=moved&&life.phase==='birth';setMoving(life,moved&&life.phase!=='birth',life.yaw);
      const station=life.zone==='village'?nearestStation(this.stations,life.position):null;
      this.events.set(id,[...(this.events.get(id)||[]),...tickLife(life,{realDelta:dt,station})].slice(-100));if(!beforeEnded&&life.ended)this.dirtyHistory=true;
      if(station?.port&&canDepart(life)&&!moved){row.portDwell+=dt;if(row.portDwell>=1.5){
        if(!rows.some(([,r])=>r.life.zone==='frontier'))this.data.fronts={};
        if(depart(life)){this.events.get(id).push({type:'depart'});row.portDwell=0;}
      }}else row.portDwell=0;
    }
    const groups=Array.from({length:6},(_,stage)=>rows.filter(([,r])=>r.life.zone==='frontier'&&r.life.front===stage&&!r.life.ended));
    for(let stage=0;stage<=5;stage++){
      const fighters=groups[stage];if(!fighters.length)continue;
      const front=this.data.fronts[stage]??=createFront(stage,seedOf(this.data.worldId));
      const events=tickSharedFront(fighters.map(([,r])=>r.life),front,dt);
      for(const [id,row]of fighters){
        const life=row.life;this.events.get(id).push(...(events.get(life.id)||[]));
        if(life.zone==='village'){life.position=safeMuraPosition(this.layout,{x:0,z:0});continue;}
        if(front.cleared&&life.position.z<=-5.85&&stage<5)advanceFront(life);
        else if(front.cleared&&stage===5&&life.position.z>=4.8&&returnHome(life))life.position=safeMuraPosition(this.layout,{x:166,z:0});
      }
    }
  }
  view(id){
    const own=this.data.players[id]?.life;if(!own)return null;
    const peers=Object.entries(this.data.players).filter(([other,row])=>other!==id&&row.life.zone===own.zone&&(own.zone!=='frontier'||row.life.front===own.front)&&Math.hypot(row.life.position.x-own.position.x,row.life.position.z-own.position.z)<=60).map(([playerId,row])=>({playerId,...visibleLife(row.life),moving:row.life.moving||Boolean(row.carrierMoving)}));
    const me=clone(own);me.frontState=null;
    return{worldId:this.data.worldId,epoch:this.data.epoch,tick:this.data.tick,worldSeconds:this.data.worldSeconds,count:Object.keys(this.data.players).length,me,peers,front:own.zone==='frontier'?clone(this.data.fronts[own.front]||createFront(own.front)):null,events:clone(this.events.get(id)||[])};
  }
  save(){return{layout:clone(this.layout),world:clone(this.data)};}
}
