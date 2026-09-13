import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {PREY,makeVillage,random,hash} from './world.js';
import {advanceDevour,cancelDevour} from './devour.js';
const COPY_MOVE={
 traveller:{id:'dancer',name:'旅歩の返し'},bellkeeper:{id:'calm',name:'鐘待ちの間'},smith:{id:'stone',name:'鍛打の踏ん張り'},hunter:{id:'ember',name:'猟りの詰め'},gravekeeper:{id:'calm',name:'墓守の間'},acolyte:{id:'dancer',name:'祈りの外し'},arcanist:{id:'shadow',name:'影渡りの足'},knight:{id:'stone',name:'守護の受け'}
};
export class RaidSession {
 constructor(village,profile,ports={}){this.village=makeVillage(village);this.profile=profile;this.ports=ports;this.rng=random(hash(village.id));this.time=0;this.alarm=0;this.eaten=0;this.targetEaten=false;this.finished=false;this.fight=null;this.devour=null;this.events=[];this.scent=0;this.scentCooldown=0;this.shadowCooldown=0;this.wardCooldown=0;this.escapeHold=0;this.guardSent=false;this.gatePush=0;this.safeTime=0;this.idleFor=0;this.roamAngle=this.rng()*Math.PI*2;this.roamTurn=2.5+this.rng()*2;this.maxhp=this.getMaxHP();this.player={x:this.village.entry.x,z:this.village.entry.z,yaw:Math.PI,hp:this.maxhp,maxhp:this.maxhp,speed:0,walk:0,pose:null,autoRoam:false};}
 getMaxHP(){return 230+(this.has('smith')?65:0)+(this.profile.form==='brute'?75:0);}
 has(k){return this.profile.unlocked.includes(k);}
 refreshProfile(p){const old=this.player?.maxhp||230;this.profile=p;this.maxhp=this.getMaxHP();if(this.player){this.player.maxhp=this.maxhp;this.player.hp=Math.min(this.maxhp,this.player.hp+Math.max(0,this.maxhp-old));}}
 emit(type,data={}){const e={type,...data};this.events.push(e);if(this.events.length>64)this.events.shift();this.ports.event?.(e);}
 walkActor(a,dx,dz,ignoreGate=false){const w=this.village,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));let moved=0;for(let i=0;i<n;i++){let x=Math.max(-w.bounds,Math.min(w.bounds,a.x+dx/n)),z=Math.max(-w.bounds,Math.min(w.bounds,a.z+dz/n));for(const c of w.colliders){const dd=Math.hypot(x-c.x,z-c.z),rad=c.r+.36;if(dd<rad){if(dd<.001){x=c.x+rad;}else{x=c.x+(x-c.x)/dd*rad;z=c.z+(z-c.z)/dd*rad;}}}
 if(!ignoreGate&&!w.gate.broken&&Math.abs(x-w.gate.x)<2.5&&Math.abs(z-w.gate.z)<.52){z=a.z>=w.gate.z?w.gate.z+.53:w.gate.z-.53;}
 const sh=w.shelter;if(a===this.player&&!this.has('acolyte')&&Math.hypot(x-sh.x,z-sh.z)<sh.r){const d=Math.hypot(x-sh.x,z-sh.z)||1;x=sh.x+(x-sh.x)/d*sh.r;z=sh.z+(z-sh.z)/d*sh.r;if(this.wardCooldown<=0){this.wardCooldown=3;this.emit('ward',{text:'祈りの結界。祈祷師の特能で踏み込める。'});}}
 moved+=Math.hypot(x-a.x,z-a.z);a.x=x;a.z=z;}return moved;}
 sense(){if(this.scentCooldown>0||this.finished)return;this.scent=9;this.scentCooldown=16;this.emit('scent');}
 shadowStep(v){if(!this.has('arcanist')&&this.profile.form!=='wraith'||this.shadowCooldown>0||this.fight||this.finished)return;const x=this.player.x,z=this.player.z;this.walkActor(this.player,v.x*3.4,v.z*3.4);this.shadowCooldown=7;this.emit('shadow',{x,z,tx:this.player.x,tz:this.player.z});}
 learnedMoves(){const rows=Object.values(this.profile.adaptations||{}).slice().sort((a,b)=>(b.encounters||0)-(a.encounters||0)),out=[];for(const a of rows)for(const move of a.moves||[])if(!out.includes(move))out.push(move);return out;}
 skillSet(npc){const t=this.templates??=createTidebreakRuntime().templates(),pick=(id,name)=>({...(t.find(r=>r.id===id)||t[0]),name});const learned=this.learnedMoves();let weapon=this.has('knight')?'katana':this.profile.form==='brute'?'great':'fist';const ha=learned[0]||(this.has('arcanist')?'shadow':'dancer'),kyu=learned[1]||(this.has('smith')?'stone':'calm');const label=id=>Object.values(COPY_MOVE).find(m=>m.id===id)?.name||'写し取った動き';return{weapon,loadout:{jo:pick('ember','爪牙・裂く'),ha:pick(ha,learned[0]?`写し・${label(ha)}`:this.has('arcanist')?'影爪・穿つ':'屍爪・返す'),kyu:pick(kyu,learned[1]?`写し・${label(kyu)}`:this.has('smith')?'骸腕・砕く':'顎骨・断つ')}};}
 rememberFight(f){if(!f||f.learned)return;f.learned=true;const m=COPY_MOVE[f.npc.role]||{id:'dancer',name:'生存の身捌き'},first=this.ports.learn?.(f.npc.role,m.id,m.name)??false;this.emit('learn',{npc:f.npc,role:f.npc.role,move:m.id,name:m.name,first});}
 engage(npc){if(this.finished||npc.dead||npc.eaten)return;const p=this.player,ox=p.x,oz=p.z,d=PREY[npc.role];this.fight={npc,ox,oz,core:null,lastHp:p.hp,lastEnemyHp:npc.hp,events:0,retreat:0,learned:false};const c=createTidebreakRuntime({seed:hash(npc.id),onImpact:e=>this.emit('impact',{...e,x:e.x+ox,z:e.z+oz})});this.fight.core=c;
 const skill=this.skillSet(npc);c.configure({...skill,hp:p.hp,maxhp:p.maxhp,enemyHp:npc.hp,enemyWeapon:npc.echo?.weapon||d.weapon,enemyStyle:npc.role==='knight'?'counter':['traveller','bellkeeper','gravekeeper'].includes(npc.role)?'cautious':'balanced',mindset:this.profile.form==='stalker'?'elusive':this.profile.form==='brute'?'steadfast':'balanced',positions:{hero:{x:0,z:0},enemy:{x:npc.x-ox,z:npc.z-oz}},enemyLoadout:npc.echo?.loadout,colliders:[...this.village.colliders,...(!this.village.gate.broken?[-1.7,0,1.7].map(x=>({x,z:this.village.gate.z,r:.7})):[]),...(!this.has('acolyte')?[{...this.village.shelter}]:[])].filter(o=>Math.hypot(o.x-ox,o.z-oz)<11).map(o=>({...o,x:o.x-ox,z:o.z-oz}))});
 npc.state='combat';this.alarm=Math.min(100,this.alarm+8*(this.has('bellkeeper')?.5:1));this.idleFor=0;this.player.autoRoam=false;this.emit('engage',{npc});}
 consume(n){if(n.eaten)return;n.eaten=true;n.dead=true;this.eaten++;this.targetEaten||=n.marked;this.player.hp=Math.min(this.player.maxhp,this.player.hp+(this.has('traveller')?75:42));this.alarm=Math.min(100,this.alarm+(n.role==='bellkeeper'?0:12)*(this.has('bellkeeper')?.5:1));if(n.role==='bellkeeper'){this.alarm=Math.max(0,this.alarm-18);this.emit('bell-silenced');}this.ports.consume?.(n.role);this.emit('consume',{npc:n,role:n.role,goal:!!n.marked});}
 finish(status){if(this.finished)return;this.finished=true;if(this.fight)this.rememberFight(this.fight);cancelDevour(this);this.player.speed=0;this.player.autoRoam=false;this.ports.finish?.(status,this.eaten);this.emit('finish',{status,eaten:this.eaten,target:this.targetEaten});}
 addGuard(){if(this.guardSent)return;this.guardSent=true;const echo=this.profile.echo,n={id:this.village.id+':guardian',kind:'human',adult:true,role:'knight',name:echo?'読み込んだ守護者':'夜警の討伐騎士',x:2,z:-22,homeX:2,homeZ:-22,yaw:0,hp:echo?220:175,maxhp:echo?220:175,state:'pursue',clock:0,walk:0,marked:false,dead:false,eaten:false,echo};this.village.npcs.push(n);this.emit('guardian',{echo:!!echo});}
 tick(dt,input){if(this.finished)return;dt=Math.min(dt,1/30);this.time+=dt;for(const k of ['scent','scentCooldown','shadowCooldown','wardCooldown','safeTime'])this[k]=Math.max(0,this[k]-dt);const p=this.player,w=this.village;let v=input||{x:0,z:0,amount:0,screenX:0,screenY:0};
 if(!this.fight&&!this.devour){if(v.amount>.05){this.idleFor=0;p.autoRoam=false;}else this.idleFor+=dt;const fallenNear=w.npcs.some(n=>n.dead&&!n.eaten&&Math.hypot(n.x-p.x,n.z-p.z)<2.7);if(this.idleFor>4.5&&!fallenNear){this.roamTurn-=dt;if(this.roamTurn<=0){this.roamAngle+=(this.rng()-.5)*1.8;this.roamTurn=2.7+this.rng()*3.8;}v={...v,x:Math.sin(this.roamAngle),z:Math.cos(this.roamAngle),amount:.22,dash:false,autoRoam:true};p.autoRoam=true;}}else{this.idleFor=0;p.autoRoam=false;}
 if(this.fight){const f=this.fight;f.core.input(v.x||0,v.z||0,v.amount,0);const s=f.core.step(dt);p.x=f.ox+s.hero.x;p.z=f.oz+s.hero.z;p.yaw=s.hero.yaw;p.hp=s.hero.hp;p.pose=s.hero.pose;p.slot=s.hero.slot;p.skill=s.hero.skill;p.progress=s.hero.progress;p.speed=s.hero.moveSpeed;f.npc.x=f.ox+s.enemy.x;f.npc.z=f.oz+s.enemy.z;f.npc.yaw=s.enemy.yaw;f.npc.hp=s.enemy.hp;f.npc.pose=s.enemy.pose;
 if(p.hp<f.lastHp){this.emit('hurt',{amount:f.lastHp-p.hp});f.lastHp=p.hp;}
 if(s.hero.dead){this.rememberFight(f);this.finish('defeated');return;}
 if(s.enemy.dead){this.rememberFight(f);f.npc.dead=true;f.npc.pose=null;f.npc.state='down';this.devour={npc:f.npc,t:0};p.pose=null;p.skill=null;this.fight=null;this.emit('down',{npc:f.npc});}
 else{const d=Math.hypot(p.x-f.npc.x,p.z-f.npc.z),ix=v.x||0,iz=v.z||0,im=Math.hypot(ix,iz),ax=(p.x-f.npc.x)/(d||1),az=(p.z-f.npc.z)/(d||1),away=im>.001?(ix*ax+iz*az)/im:0;if(v.amount>.05&&away>.32&&d>3.8)f.retreat=Math.min(2,f.retreat+dt);else f.retreat=Math.max(0,f.retreat-dt*1.35);if(f.retreat>.9&&d>4.6){this.rememberFight(f);f.npc.state='pursue';f.npc.pose=null;this.fight=null;p.pose=null;p.skill=null;this.safeTime=2.1;this.emit('disengage');}}
 }else if(this.devour){advanceDevour(this,dt,v.amount);}
 else{
 const speed=v.dash?4.65:2.85,formBoost=this.profile.form==='stalker'?1.15:1;
 const dx=v.x*v.amount*speed*formBoost*dt,dz=v.z*v.amount*speed*formBoost*dt;const moved=this.walkActor(p,dx,dz);p.speed=moved/dt;p.walk+=moved*3.8;if(v.amount>.05){const target=Math.atan2(v.x,v.z);p.yaw+=Math.atan2(Math.sin(target-p.yaw),Math.cos(target-p.yaw))*Math.min(1,dt*(v.autoRoam?3.4:12));}
 if(!w.gate.broken&&this.has('smith')&&v.amount>.1&&Math.hypot(p.x-w.gate.x,p.z-w.gate.z)<2.7){this.gatePush+=dt;if(this.gatePush>.75){w.gate.broken=true;this.emit('gate',{x:w.gate.x,z:w.gate.z});}}else this.gatePush=0;
 for(const n of w.npcs){if(n.eaten)continue;const d=Math.hypot(n.x-p.x,n.z-p.z);if(n.dead){if(d<2.5&&v.amount<.05){this.devour={npc:n,t:0};break;}}else if(d<3.9&&this.safeTime<=0&&!this.lineBlocked(p,n)){this.engage(n);break;}}
 }
 let witnesses=0;
 for(const n of w.npcs){if(n.dead||n.eaten||n.state==='combat')continue;n.clock+=dt;const dx=p.x-n.x,dz=p.z-n.z,d=Math.hypot(dx,dz);let vx=0,vz=0,s=0;
 if(d<8&&!this.lineBlocked(p,n)){n.fear=Math.max(n.fear||0,3);witnesses++;}
 n.fear=Math.max(0,(n.fear||0)-dt);
 if(n.role==='knight'&&(this.alarm>20||d<10)||n.state==='pursue'){n.state='pursue';vx=dx;vz=dz;s=1.72;}
 else if(n.fear>0){n.state='flee';if(n.role==='bellkeeper'){vx=w.bell.x-n.x;vz=w.bell.z-n.z;if(Math.hypot(vx,vz)<1.5&&!this.has('bellkeeper')){this.alarm=Math.min(100,this.alarm+dt*13);}}else{vx=-dx;vz=-dz;}s=1.6;}
 else{n.state='idle';if(Math.sin(n.clock*.45)>.35){vx=n.homeX+Math.sin(n.clock*.2)*2-n.x;vz=n.homeZ+Math.cos(n.clock*.2)*2-n.z;s=.38;}}
 const norm=Math.hypot(vx,vz)||1;if(s){this.walkActor(n,vx/norm*s*dt,vz/norm*s*dt,true);n.walk+=dt*s*5;const yy=Math.atan2(vx,vz);n.yaw+=Math.atan2(Math.sin(yy-n.yaw),Math.cos(yy-n.yaw))*Math.min(1,dt*8);}
 }
 this.alarm=Math.min(100,Math.max(0,this.alarm+dt*(witnesses*.62*(this.has('bellkeeper')?.4:1)-(witnesses===0&&!this.fight?.2:0))));
 if((this.alarm>=72||this.time>160)&&!this.guardSent)this.addGuard();
 if(this.time>285)this.alarm=Math.min(100,this.alarm+dt*.8);
 const nearExit=Math.hypot(p.x-w.entry.x,p.z-w.entry.z)<2.8,backExit=this.has('gravekeeper')&&Math.hypot(p.x+7,p.z+25)<2.8;
 if((nearExit||backExit)&&this.eaten>0&&!this.fight&&!this.devour&&v.amount<.05){this.escapeHold+=dt;if(this.escapeHold>1.6)this.finish(this.targetEaten?'completed':'escaped');}else this.escapeHold=0;
 }
 lineBlocked(a,b){const w=this.village;if(!this.has('acolyte')&&Math.hypot(b.x-w.shelter.x,b.z-w.shelter.z)<w.shelter.r)return true;const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;if(!l2)return false;if(!w.gate.broken&&Math.abs(dz)>.001){const t=(w.gate.z-a.z)/dz;if(t>0&&t<1&&Math.abs(a.x+dx*t)<2.5)return true;}for(const c of this.village.colliders){const t=Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.z-a.z)*dz)/l2));if(Math.hypot(a.x+dx*t-c.x,a.z+dz*t-c.z)<c.r*.92)return true;}return false;}
}
