import * as THREE from 'three';
import { Actor } from './actor.js';
import { WAVES,SKILLS,BLESSINGS,freshStats,waveEnemies,distance,clamp,seededRandom,chooseAutoBlessing } from '../domain/rules.js';
const C={gold:'#ffe1a0',cyan:'#87e9ff',rose:'#ff71b3'};
export class Game {
  constructor(world,assets,effects,sound,events={}) {
    Object.assign(this,{world,assets,effects,sound,events});
    this.state='title';this.stats=freshStats();this.enemies=[];this.telegraphs=[];this.timers=[];this.skills=[0,0,0];this.auto=true;this.input={x:0,z:0};this.manualGrace=0;this.hitStop=0;this.seed=4831;this.rand=seededRandom(this.seed);this.title();
  }
  title(){this.clear();this.state='title';this.world.mode='title';this.hero=new Actor(this.assets,'hero',{x:0,z:1.5});this.world.scene.add(this.hero.root);this.hero.model.rotation.y=-.2;this.hero.heading=-.2;this.hero.targetHeading=-.2;this.events.state?.('title');}
  clear(){this.hero?.dispose();for(const a of this.enemies)a.dispose();this.enemies=[];this.telegraphs=[];this.timers=[];this.effects.clear();}
  start(){
    this.clear();this.rand=seededRandom(this.seed);this.stats=freshStats();this.state='playing';this.world.mode='playing';this.hero=new Actor(this.assets,'hero');this.hero.hp=this.stats.hp;this.hero.maxHp=this.stats.maxHp;this.world.scene.add(this.hero.root);
    this.skills=[.8,3.5,8];this.auto=true;this.manualGrace=0;this.hitStop=0;this.input.x=this.input.z=0;this.combo=0;this.events.state?.('playing');this.beginWave(1);this.sound.bell();
  }
  beginWave(number){this.stats.wave=number;this.wave=WAVES[number-1];this.spawnQueue=waveEnemies(number);this.waveTotal=this.spawnQueue.length;this.waveKilled=0;this.spawnTimer=1.3;this.clearWait=0;this.telegraphs=[];this.events.announce?.(this.wave.subtitle,this.wave.title);}
  spawn(kind){
    const a=this.rand()*Math.PI*2;
    const pos=kind==='boss'?{x:0,z:-8.8}:{x:clamp(this.hero.position.x+Math.sin(a)*(7+this.rand()*2),-12,12),z:clamp(this.hero.position.z+Math.cos(a)*(6+this.rand()*2),-9.5,9.5)};
    const actor=new Actor(this.assets,kind,pos);actor.maxHp=actor.hp=kind==='boss'?1150:this.wave.hp*(kind==='warrior'?1.25:kind==='mage'?.85:1);
    actor.damage=this.wave.attack*(kind==='boss'?2.5:kind==='warrior'?1.15:1);actor.spawnTime=1.1;actor.act('Spawn_Ground_Skeletons',1.1,1.1,null);actor.face(this.hero.position);actor.cooldown=1.1+this.rand()*.5;
    this.enemies.push(actor);this.world.scene.add(actor.root);this.effects.ring(pos,1.1,kind==='boss'?C.gold:C.rose);return actor;
  }
  moveInput(x,z){this.input.x=x;this.input.z=z;if(Math.hypot(x,z)>.05)this.manualGrace=1.2;}
  toggleAuto(){this.auto=!this.auto;this.events.toast?.(this.auto?'自動移動を再開しました':'移動を手動に切り替えました。攻撃は自動です。');return this.auto;}
  later(delay,fn){this.timers.push({delay,fn});}
  update(dt){
    if(this.state==='title'){this.hero.tick(dt);return;}
    if(this.state==='upgrade'){this.upgradeTime-=dt;if(this.upgradeTime<=0)this.bless(chooseAutoBlessing(this.stats));return;}
    if(this.state!=='playing'){if(this.state==='ending'){this.hero.tick(dt);for(const e of this.enemies)e.tick(dt);this.endDelay-=dt;if(this.endDelay<=0){this.state='result';this.events.state?.('result');}}return;}
    this.stats.time+=dt;
    if(this.hitStop>0){this.hitStop-=dt;dt*=.15;}
    for(let i=this.timers.length-1;i>=0;i--){this.timers[i].delay-=dt;if(this.timers[i].delay<=0){const t=this.timers.splice(i,1)[0];t.fn();}}
    this.manualGrace=Math.max(0,this.manualGrace-dt);for(let i=0;i<3;i++)this.skills[i]=Math.max(0,this.skills[i]-dt);
    this.stats.hp=Math.min(this.stats.maxHp,this.stats.hp+dt*.65);this.hero.hp=this.stats.hp;this.hero.maxHp=this.stats.maxHp;
    this.spawnTimer-=dt;
    if(this.spawnQueue.length&&this.spawnTimer<=0&&this.enemies.filter(e=>e.alive).length<(this.world.mobile?15:19)){this.spawn(this.spawnQueue.shift());this.spawnTimer=this.wave.interval;}
    this.hero.tick(dt);
    for(let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i];e.tick(dt);if(e.deadTime>3.1){e.dispose();this.enemies.splice(i,1);}}
    for(let i=this.telegraphs.length-1;i>=0;i--){const t=this.telegraphs[i];t.age+=dt;if(t.age>=t.duration){this.telegraphs.splice(i,1);if(t.source.alive&&this.hero.alive){this.effects.ring(t,t.radius,t.boss?C.gold:C.rose);if(t.boss){this.effects.nova(t);this.world.impact(t,1.4);this.sound.hit(true);}else{this.effects.beam(t.source.position,t);this.sound.frost();}if(distance(this.hero.position,t)<t.radius+this.hero.radius*.4)this.hurtHero(t.damage,t.source);}}}
    const alive=this.enemies.filter(e=>e.alive&&e.spawnTime<=0);
    this.heroAI(dt,alive);for(const e of alive)this.enemyAI(e,dt);this.separate(alive,dt);
    if(!this.spawnQueue.length&&!this.enemies.some(e=>e.alive)){
      this.clearWait+=dt;if(this.clearWait>1.3){if(this.stats.wave===5)this.finish(true);else{this.state='upgrade';this.upgradeTime=12;this.hero.idle();this.effects.heal(this.hero.position,Math.min(75,this.stats.maxHp-this.stats.hp));this.stats.hp=Math.min(this.stats.maxHp,this.stats.hp+75);this.sound.bell();this.events.state?.('upgrade');}}
    }
  }
  heroAI(dt,alive){
    const h=this.hero;if(!h.alive||h.busy>0)return;
    let target=null,near=Infinity;for(const e of alive){const d=distance(h.position,e.position);if(d<near){near=d;target=e;}}
    const moving=Math.hypot(this.input.x,this.input.z)>.06;
    if(moving){h.move(this.input.x,this.input.z,4,dt);}
    else if(this.auto&&this.manualGrace<=0){
      const danger=this.telegraphs.find(t=>distance(h.position,t)<t.radius+1);
      if(danger){let dx=h.position.x-danger.x,dz=h.position.z-danger.z;if(Math.hypot(dx,dz)<.1){dx=1;dz=.4;}h.move(dx,dz,4.3,dt);}
      else if(target&&near>1.65+target.radius*.45)h.move(target.position.x-h.position.x,target.position.z-h.position.z,3.55,dt);
      else h.idle();
    } else if(!moving)h.idle();
    const close=alive.filter(e=>distance(h.position,e.position)<5.2);
    if(close.length>=3&&this.skills[2]<=0){this.skill(2);return;}
    if(close.length>=3&&this.skills[1]<=0){this.skill(1);return;}
    if(close.some(e=>distance(h.position,e.position)<3.7)&&this.skills[0]<=0){this.skill(0);return;}
    if(target&&target.isBoss&&near<5.5&&this.skills[2]<=0){this.skill(2);return;}
    if(target&&near<=2.35+target.radius*.3&&h.cooldown<=0){
      h.face(target.position);const heading=h.targetHeading;const name=['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop'][this.combo++%3];
      h.cooldown=.74;h.act(name,.68,.29,()=>{
        if(!h.alive)return;this.effects.slash(h.position,heading,2.5,C.gold);this.sound.slash();
        for(const enemy of this.enemies){if(!enemy.alive||enemy.spawnTime>0)continue;const d=distance(h.position,enemy.position);const dot=(Math.sin(heading)*(enemy.position.x-h.position.x)+Math.cos(heading)*(enemy.position.z-h.position.z))/Math.max(d,.01);if(d<2.8+enemy.radius*.2&&dot>-.5){const crit=this.rand()<.19;this.hurtEnemy(enemy,(crit?40:27)*this.stats.damage,crit,h.position,.9);}}
      });
    }
  }
  skill(index){
    if(this.state!=='playing'||!this.hero.alive||this.hero.busy>.2||this.skills[index]>.001)return false;
    const h=this.hero,s=SKILLS[index];this.skills[index]=s.cooldown*this.stats.cooldown;h.cooldown=s.duration+.15;
    this.events.toast?.(`${s.name} — ${['WHIRLWIND','FROST HALO','HEAVENFALL'][index]}`);
    h.act(s.animation,s.duration,index===2?.75:index===1?.42:.3,()=>{
      const pos=h.position.clone();if(index===0){this.effects.slash(pos,h.heading,4.2,C.gold,true);this.effects.ring(pos,4.2,C.gold);this.sound.slash();}
      if(index===1){this.effects.ring(pos,5.7,C.cyan);this.effects.burst(pos,C.cyan,45,6);this.sound.frost();}
      if(index===2){this.effects.nova(pos);this.sound.nova();}
      this.world.impact(pos,index===2?2:.7,index===1?C.cyan:C.gold);
      for(const e of this.enemies){if(e.alive&&e.spawnTime<=0&&distance(pos,e.position)<s.radius+e.radius){this.hurtEnemy(e,s.damage*this.stats.damage,index===2,pos,index===2?5:index===1?3:2.1);if(index===1)e.slow=4.2;}}
    });return true;
  }
  enemyAI(e,dt){
    if(!this.hero.alive||e.busy>0||e.spawnTime>0)return;
    const h=this.hero,d=distance(e.position,h.position);e.face(h.position);
    if(e.isMage){
      if(d>6.8)e.move(h.position.x-e.position.x,h.position.z-e.position.z,1.65,dt);
      else if(d<3.8)e.move(e.position.x-h.position.x,e.position.z-h.position.z,1.7,dt);else e.idle();
      if(d<9&&e.cooldown<=0){e.cooldown=3.5;const p=h.position.clone();e.act('Spellcast_Shoot',1.4,.25,()=>{this.telegraphs.push({x:p.x,z:p.z,y:.1,radius:1.6,age:0,duration:.95,source:e,damage:e.damage*1.4});});}
    }else if(e.isBoss){
      if(d>3)e.move(h.position.x-e.position.x,h.position.z-e.position.z,1.55,dt);else e.idle();
      if(e.cooldown<=0&&d<5.5){e.cooldown=4;const p=h.position.clone();e.act('2H_Melee_Attack_Chop',1.7,.25,()=>{this.telegraphs.push({x:p.x,z:p.z,y:.1,radius:3,age:0,duration:1,source:e,damage:e.damage,boss:true});});}
    }else{
      if(d>1.45)e.move(h.position.x-e.position.x,h.position.z-e.position.z,e.kind==='minion'?1.9:1.65,dt);else e.idle();
      if(d<1.95&&e.cooldown<=0){e.cooldown=1.7+this.rand()*.55;e.act('1H_Melee_Attack_Chop',1,.62,()=>{if(h.alive&&distance(e.position,h.position)<2.1){this.hurtHero(e.damage,e);this.effects.slash(e.position,e.heading,1.7,'#e69e9c');}});}
    }
  }
  separate(alive,dt){
    for(let i=0;i<alive.length;i++){const a=alive[i];for(let j=i+1;j<alive.length;j++){const b=alive[j],d=distance(a.position,b.position),min=a.radius+b.radius;if(d<min&&d>.001){const push=(min-d)*Math.min(1,dt*8)*.5,dx=(a.position.x-b.position.x)/d,dz=(a.position.z-b.position.z)/d;a.position.x+=dx*push;a.position.z+=dz*push;b.position.x-=dx*push;b.position.z-=dz*push;}}
      const d=distance(a.position,this.hero.position),min=a.radius+this.hero.radius;if(d<min&&d>.001){const push=(min-d)*Math.min(1,dt*12);a.position.x+=(a.position.x-this.hero.position.x)/d*push;a.position.z+=(a.position.z-this.hero.position.z)/d*push;}
    }
  }
  hurtEnemy(e,damage,crit,from,force){
    if(!e.alive)return;e.hp-=damage;e.flash=1;this.effects.damage({...e.position,y:e.isBoss?2:0},damage,crit);this.effects.burst({...e.position,y:1.1},e.isMage?C.rose:C.gold,crit?17:7,2.2);this.sound.hit(crit);this.hitStop=crit?.045:.02;
    const d=distance(from,e.position)||1;e.velocity.x+=(e.position.x-from.x)/d*force*(e.isBoss?.15:1);e.velocity.z+=(e.position.z-from.z)/d*force*(e.isBoss?.15:1);
    if(e.hp<=0){e.die();this.stats.kills++;this.waveKilled++;this.stats.hp=Math.min(this.stats.maxHp,this.stats.hp+(e.isBoss?35:2.8));this.effects.burst(e.position,e.isMage?C.rose:'#c4d5ca',14,2.8);}
  }
  hurtHero(damage,source){
    if(!this.hero.alive)return;this.stats.hp=Math.max(0,this.stats.hp-damage);this.hero.hp=this.stats.hp;this.hero.flash=.5;this.effects.damage(this.hero.position,damage,false,true);this.sound.hurt();this.events.hurt?.();
    if(this.stats.hp<=0){this.hero.die();this.finish(false);}
  }
  bless(id){
    if(this.state!=='upgrade')return;const blessing=BLESSINGS.find(b=>b.id===id);if(!blessing)return;
    blessing.apply(this.stats);this.stats.blessings.push(id);this.skills=this.skills.map(t=>Math.max(0,t-4));this.state='playing';this.events.state?.('playing');this.effects.heal(this.hero.position,0);this.beginWave(this.stats.wave+1);this.sound.bell();
  }
  finish(win){if(this.state==='ending'||this.state==='result')return;this.win=win;this.state='ending';this.endDelay=win?2.2:2.7;this.telegraphs=[];if(win){this.hero.play('Cheer',{once:true,duration:2.4});this.effects.nova(this.hero.position);this.sound.bell();}this.events.announce?.(win?'THE NIGHT IS OVER':'THE LIGHT REMAINS',win?'夜明けは、ここに。':'まだ、灯は消えない。');}
  snapshot(){return{state:this.state,hp:this.stats.hp,maxHp:this.stats.maxHp,wave:this.stats.wave,kills:this.stats.kills,time:this.stats.time,enemies:this.enemies.filter(e=>e.alive).length,spawnLeft:this.spawnQueue?.length||0,skills:[...this.skills],auto:this.auto,hero:{x:this.hero.position.x,z:this.hero.position.z,animation:this.hero.animation},boss:this.enemies.find(e=>e.isBoss)?.hp,win:this.win??null,models:this.assets.manifest.length};}
}
