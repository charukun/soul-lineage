import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {PREY,makeVillage,random,hash} from './world.js';
import {advanceDevour,cancelDevour} from './devour.js';
const COPY_MOVE={
 traveller:{id:'dancer',name:'旅歩の返し'},bellkeeper:{id:'calm',name:'鐘待ちの間'},smith:{id:'stone',name:'鍛打の踏ん張り'},hunter:{id:'ember',name:'猟りの詰め'},gravekeeper:{id:'calm',name:'墓守の間'},acolyte:{id:'dancer',name:'祈りの外し'},arcanist:{id:'shadow',name:'影渡りの足'},knight:{id:'stone',name:'守護の受け'}
};
export const TRAIT_LEARN_CHANCE=.28;
export const MOVE_LEARN_CHANCE=.22;
export function feedingGrowth(meals=0){const n=Math.max(0,Math.floor(Number(meals)||0));return{scale:Math.min(1.28,.78+n*.075),hpScale:Math.min(1.04,.72+n*.055),powerScale:Math.min(1.08,.72+n*.06)};}
export class RaidSession {
 constructor(village,profile,ports={}){this.village=makeVillage(village);this.profile=profile;this.ports=ports;this.rng=random(hash(village.id));this.time=0;this.eaten=0;this.targetEaten=false;this.finished=false;this.fight=null;this.devour=null;this.events=[];this.scent=0;this.scentCooldown=0;this.shadowCooldown=0;this.wardCooldown=0;this.escapeHold=0;this.gatePush=0;this.safeTime=0;this.idleFor=0;this.roamAngle=this.rng()*Math.PI*2;this.roamTurn=2.5+this.rng()*2;const growth=feedingGrowth(0);this.maxhp=Math.round(this.getMaxHP()*growth.hpScale);this.player={x:this.village.entry.x,z:this.village.entry.z,yaw:Math.PI,hp:this.maxhp,maxhp:this.maxhp,growthScale:growth.scale,powerScale:growth.powerScale,speed:0,walk:0,pose:null,autoRoam:false};}
 getMaxHP(){return 230+(this.has('smith')?65:0)+(this.profile.form==='brute'?75:0);}
 has(k){return this.profile.unlocked.includes(k);}
 growth(){return feedingGrowth(this.eaten);}
 syncGrowth(healGain=true){if(!this.player)return;const old=this.player.maxhp||0,g=this.growth(),next=Math.round(this.getMaxHP()*g.hpScale);this.maxhp=next;this.player.maxhp=next;this.player.growthScale=g.scale;this.player.powerScale=g.powerScale;if(healGain)this.player.hp=Math.min(next,this.player.hp+Math.max(0,next-old));else this.player.hp=Math.min(next,this.player.hp);}
 resetIdle(){this.idleFor=0;if(this.player.autoRoam)this.player.speed=0;this.player.autoRoam=false;}
 escapePoints(){const w=this.village,points=[{id:'entry',label:'村口',x:w.entry.x,z:w.entry.z}];if(this.has('gravekeeper'))points.push({id:'graveway',label:'墓道',x:-7,z:-25});return points;}
 nearestEscape(){const p=this.player;return this.escapePoints().map(point=>({...point,distance:Math.hypot(p.x-point.x,p.z-point.z)})).sort((a,b)=>a.distance-b.distance)[0];}
 refreshProfile(p){this.profile=p;this.syncGrowth(true);}
 emit(type,data={}){const e={type,...data};this.events.push(e);if(this.events.length>64)this.events.shift();this.ports.event?.(e);}
 walkActor(a,dx,dz,ignoreGate=false){const w=this.village,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));let moved=0;for(let i=0;i<n;i++){let x=Math.max(-w.bounds,Math.min(w.bounds,a.x+dx/n)),z=Math.max(-w.bounds,Math.min(w.bounds,a.z+dz/n));for(const c of w.colliders){const dd=Math.hypot(x-c.x,z-c.z),rad=c.r+.36;if(dd<rad){if(dd<.001){x=c.x+rad;}else{x=c.x+(x-c.x)/dd*rad;z=c.z+(z-c.z)/dd*rad;}}}
 if(!ignoreGate&&!w.gate.broken&&Math.abs(x-w.gate.x)<2.5&&Math.abs(z-w.gate.z)<.52){z=a.z>=w.gate.z?w.gate.z+.53:w.gate.z-.53;}
 const sh=w.shelter;if(a===this.player&&!this.has('acolyte')&&Math.hypot(x-sh.x,z-sh.z)<sh.r){const d=Math.hypot(x-sh.x,z-sh.z)||1;x=sh.x+(x-sh.x)/d*sh.r;z=sh.z+(z-sh.z)/d*sh.r;if(this.wardCooldown<=0){this.wardCooldown=3;this.emit('ward',{text:'祈りの結界。祈祷師の特能で踏み込める。'});}}
 moved+=Math.hypot(x-a.x,z-a.z);a.x=x;a.z=z;}return moved;}
 sense(){if(this.scentCooldown>0||this.finished)return;this.scent=9;this.scentCooldown=16;this.emit('scent');}
 shadowStep(v){if(!this.has('arcanist')&&this.profile.form!=='wraith'||this.shadowCooldown>0||this.fight||this.finished)return;const x=this.player.x,z=this.player.z;this.walkActor(this.player,v.x*3.4,v.z*3.4);this.shadowCooldown=7;this.emit('shadow',{x,z,tx:this.player.x,tz:this.player.z});}
 learnedMoves(){const rows=Object.values(this.profile.adaptations||{}).slice().sort((a,b)=>(b.encounters||0)-(a.encounters||0)),out=[];for(const a of rows)for(const move of a.moves||[])if(!out.includes(move))out.push(move);return out;}
 skillSet(npc){const t=this.templates??=createTidebreakRuntime().templates(),pick=(id,name)=>({...(t.find(r=>r.id===id)||t[0]),name});const learned=this.learnedMoves();let weapon=this.has('knight')?'katana':this.profile.form==='brute'?'great':'fist';const ha=learned[0]||(this.has('arcanist')?'shadow':'dancer'),kyu=learned[1]||(this.has('smith')?'stone':'calm');const label=id=>Object.values(COPY_MOVE).find(m=>m.id===id)?.name||'人の身捌き';return{weapon,loadout:{jo:pick('ember','飢爪・裂肉'),ha:pick(ha,learned[0]?`写し・${label(ha)}`:this.has('arcanist')?'影牙・潜り':'屍爪・返し'),kyu:pick(kyu,learned[1]?`写し・${label(kyu)}`:this.has('smith')?'骸腕・粉砕':'喰顎・断ち')}};}
 rememberFight(f){if(!f||f.learned)return;f.learned=true;this.ports.battle?.(f.npc.role);}
 engage(npc){if(this.finished||npc.dead||npc.eaten)return;const p=this.player,ox=p.x,oz=p.z,d=PREY[npc.role];this.fight={npc,ox,oz,core:null,lastHp:p.hp,lastEnemyHp:npc.hp,events:0,retreat:0,learned:false};const c=createTidebreakRuntime({seed:hash(npc.id),onImpact:e=>this.emit('impact',{...e,x:e.x+ox,z:e.z+oz})});this.fight.core=c;
 const skill=this.skillSet(npc);c.configure({...skill,hp:p.hp,maxhp:p.maxhp,enemyHp:npc.hp,enemyWeapon:npc.echo?.weapon||d.weapon,enemyStyle:npc.role==='knight'?'counter':['traveller','bellkeeper','gravekeeper'].includes(npc.role)?'cautious':'balanced',mindset:this.profile.form==='stalker'?'elusive':this.profile.form==='brute'?'steadfast':'balanced',positions:{hero:{x:0,z:0},enemy:{x:npc.x-ox,z:npc.z-oz}},enemyLoadout:npc.echo?.loadout,colliders:[...this.village.colliders,...(!this.village.gate.broken?[-1.7,0,1.7].map(x=>({x,z:this.village.gate.z,r:.7})):[]),...(!this.has('acolyte')?[{...this.village.shelter}]:[])].filter(o=>Math.hypot(o.x-ox,o.z-oz)<11).map(o=>({...o,x:o.x-ox,z:o.z-oz}))});
 npc.state='combat';this.idleFor=0;this.player.autoRoam=false;this.emit('engage',{npc});}
 consume(n){
  if(n.eaten)return;
  const before={hp:this.player.hp,maxhp:this.player.maxhp,unlocked:this.profile.unlocked.length,known:this.profile.unlocked.includes(n.role)};
  n.eaten=true;n.dead=true;this.eaten++;this.targetEaten||=n.marked;
  const learnTrait=this.rng()<TRAIT_LEARN_CHANCE,traitFirst=this.ports.consume?.(n.role,{learnTrait})??false;
  this.syncGrowth(true);
  this.player.hp=Math.min(this.player.maxhp,this.player.hp+(this.has('traveller')?75:42));
  let learnedMove=null,moveFirst=false;
  if(this.rng()<MOVE_LEARN_CHANCE){learnedMove=COPY_MOVE[n.role]||{id:'dancer',name:'生存の身捌き'};moveFirst=this.ports.learn?.(n.role,learnedMove.id,learnedMove.name)??false;this.emit('learn',{npc:n,role:n.role,move:learnedMove.id,name:learnedMove.name,first:moveFirst,source:'devour'});}
  this.emit('consume',{npc:n,role:n.role,goal:!!n.marked,at:this.time,reward:{
   healed:Math.max(0,this.player.hp-before.hp),maxHpGain:Math.max(0,this.player.maxhp-before.maxhp),
   memoryNew:traitFirst||(!before.known&&this.profile.unlocked.includes(n.role)),equipped:this.has(n.role),
   learnedMove:learnedMove?.id||null,moveNew:moveFirst,growthScale:this.player.growthScale,
   unlockedBefore:before.unlocked,unlockedCount:this.profile.unlocked.length
  }});
 }

 finish(status){if(this.finished)return;this.finished=true;if(this.fight)this.rememberFight(this.fight);cancelDevour(this);this.player.speed=0;this.player.autoRoam=false;this.ports.finish?.(status,this.eaten);this.emit('finish',{status,eaten:this.eaten,target:this.targetEaten});}
 tick(dt,input){if(this.finished)return;dt=Math.min(dt,1/30);this.time+=dt;for(const k of ['scent','scentCooldown','shadowCooldown','wardCooldown','safeTime'])this[k]=Math.max(0,this[k]-dt);const p=this.player,w=this.village;let v=input||{x:0,z:0,amount:0,screenX:0,screenY:0};
 if(this.fight||this.devour||v.active||v.amount>.05)this.resetIdle();
 else{
  this.idleFor+=dt;p.autoRoam=false;
  const fallenNear=w.npcs.some(n=>n.dead&&!n.eaten&&Math.hypot(n.x-p.x,n.z-p.z)<2.7);
  const returning=this.eaten>0&&this.nearestEscape().distance<2.8;
  if(this.idleFor>4.5&&!fallenNear&&!returning){
   this.roamTurn-=dt;if(this.roamTurn<=0){this.roamAngle+=(this.rng()-.5)*1.8;this.roamTurn=2.7+this.rng()*3.8;}
   v={...v,x:Math.sin(this.roamAngle),z:Math.cos(this.roamAngle),amount:.22,dash:false,autoRoam:true};p.autoRoam=true;
  }
 }
 if(this.fight){const f=this.fight;f.core.input(v.x||0,v.z||0,v.amount,0);const s=f.core.step(dt);p.x=f.ox+s.hero.x;p.z=f.oz+s.hero.z;p.yaw=s.hero.yaw;p.hp=s.hero.hp;p.pose=s.hero.pose;p.slot=s.hero.slot;p.skill=s.hero.skill;p.progress=s.hero.progress;p.speed=s.hero.moveSpeed;f.npc.x=f.ox+s.enemy.x;f.npc.z=f.oz+s.enemy.z;f.npc.yaw=s.enemy.yaw;f.npc.hp=s.enemy.hp;f.npc.pose=s.enemy.pose;
 if(p.hp<f.lastHp){this.emit('hurt',{amount:f.lastHp-p.hp});f.lastHp=p.hp;}
 if(s.hero.dead){this.rememberFight(f);this.finish('defeated');return;}
 if(s.enemy.dead){this.rememberFight(f);f.npc.dead=true;f.npc.pose=null;f.npc.state='down';this.devour={npc:f.npc,t:0};p.pose=null;p.skill=null;this.fight=null;this.emit('down',{npc:f.npc});}
 else{const d=Math.hypot(p.x-f.npc.x,p.z-f.npc.z),ix=v.x||0,iz=v.z||0,im=Math.hypot(ix,iz),ax=(p.x-f.npc.x)/(d||1),az=(p.z-f.npc.z)/(d||1),away=im>.001?(ix*ax+iz*az)/im:0;if(v.amount>.05&&away>.32&&d>3.8)f.retreat=Math.min(2,f.retreat+dt);else f.retreat=Math.max(0,f.retreat-dt*1.35);if(f.retreat>.9&&d>4.6){this.rememberFight(f);f.npc.state='pursue';f.npc.pose=null;this.fight=null;p.pose=null;p.skill=null;this.safeTime=2.1;this.emit('disengage');}}
 }else if(this.devour){advanceDevour(this,dt,v.amount);}
 else{
 const speed=v.dash?4.65:2.85,formBoost=this.profile.form==='stalker'?1.15:1,growthMove=.9+.1*(p.powerScale||1);
 const dx=v.x*v.amount*speed*formBoost*growthMove*dt,dz=v.z*v.amount*speed*formBoost*growthMove*dt;const moved=this.walkActor(p,dx,dz);p.speed=moved/dt;p.walk+=moved*3.8;if(v.amount>.05){const target=Math.atan2(v.x,v.z);p.yaw+=Math.atan2(Math.sin(target-p.yaw),Math.cos(target-p.yaw))*Math.min(1,dt*(v.autoRoam?3.4:12));}
 if(!w.gate.broken&&this.has('smith')&&v.amount>.1&&Math.hypot(p.x-w.gate.x,p.z-w.gate.z)<2.7){this.gatePush+=dt;if(this.gatePush>.75){w.gate.broken=true;this.emit('gate',{x:w.gate.x,z:w.gate.z});}}else this.gatePush=0;
 for(const n of w.npcs){if(n.eaten)continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(n.dead){if(d<2.5&&v.amount<.05){this.devour={npc:n,t:0};this.resetIdle();break;}}else if(d<3.9&&this.safeTime<=0&&!this.lineBlocked(p,n)){this.engage(n);break;}}
 }
 for(const n of w.npcs){if(n.dead||n.eaten||n.state==='combat')continue;n.clock+=dt;const dx=p.x-n.x,dz=p.z-n.z,d=Math.hypot(dx,dz);let vx=0,vz=0,s=0;
 const noticeRange=this.has('bellkeeper')?5.5:8;if(d<noticeRange&&!this.lineBlocked(p,n))n.fear=Math.max(n.fear||0,3);
 n.fear=Math.max(0,(n.fear||0)-dt);
 if(n.role==='knight'&&d<10||n.state==='pursue'){n.state='pursue';vx=dx;vz=dz;s=1.72;}
 else if(n.fear>0){n.state='flee';vx=-dx;vz=-dz;s=1.6;}
 else{n.state='idle';if(Math.sin(n.clock*.45)>.35){vx=n.homeX+Math.sin(n.clock*.2)*2-n.x;vz=n.homeZ+Math.cos(n.clock*.2)*2-n.z;s=.38;}}
 const norm=Math.hypot(vx,vz)||1;if(s){this.walkActor(n,vx/norm*s*dt,vz/norm*s*dt,true);n.walk+=dt*s*5;const yy=Math.atan2(vx,vz);n.yaw+=Math.atan2(Math.sin(yy-n.yaw),Math.cos(yy-n.yaw))*Math.min(1,dt*8);}
 }
 const nearExit=this.escapePoints().some(point=>Math.hypot(p.x-point.x,p.z-point.z)<2.8);
 if(nearExit&&this.eaten>0&&!this.fight&&!this.devour&&v.amount<.05){this.escapeHold+=dt;if(this.escapeHold>1.6)this.finish(this.targetEaten?'completed':'escaped');}else this.escapeHold=0;
 }
 lineBlocked(a,b){const w=this.village;if(!this.has('acolyte')&&Math.hypot(b.x-w.shelter.x,b.z-w.shelter.z)<w.shelter.r)return true;const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;if(!l2)return false;if(!w.gate.broken&&Math.abs(dz)>.001){const t=(w.gate.z-a.z)/dz;if(t>0&&t<1&&Math.abs(a.x+dx*t)<2.5)return true;}for(const c of this.village.colliders){const t=Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/l2));if(Math.hypot(a.x+dx*t-c.x,a.z+dz*t-c.z)<c.r*.92)return true;}return false;}
}
