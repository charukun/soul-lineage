// Deterministic simulation. Rendering, audio and browser APIs never enter this module.
export const HEROES = [
  {kind:'captain',name:'バルバロッサ',role:'誓いの守護者',hp:480,attack:25,range:1.65,speed:2.4,interval:1.02,height:2.5,color:'#dbb571',model:'Characters_Captain_Barbarossa'},
  {kind:'anne',name:'アン',role:'灰燼の斧使い',hp:365,attack:29,range:1.5,speed:3.05,interval:.82,height:2.3,color:'#82cfc3',model:'Characters_Anne'},
  {kind:'henry',name:'ヘンリー',role:'灯を紡ぐ吟遊詩人',hp:310,attack:20,range:6,speed:2.6,interval:1.3,height:2.25,color:'#b8c2e1',model:'Characters_Henry'},
];
export const BOONS = [
  {id:'might',icon:'✧',name:'熾火の刃',text:'全員の攻撃力が25%上昇。\n燃え尽きぬ意志を、その刃に。',en:'EMBERBORN',apply:g=>{for(const h of g.heroes)h.attack*=1.25;}},
  {id:'life',icon:'❧',name:'還り咲く灯',text:'最大生命力が20%上昇。\nさらに全員の生命力を40%回復。',en:'REKINDLING',apply:g=>{for(const h of g.heroes){h.maxHp*=1.2;h.hp=Math.min(h.maxHp,h.hp+h.maxHp*.4);}}},
  {id:'haste',icon:'⟡',name:'風渡りの誓い',text:'攻撃速度が20%上昇。\n移動速度が10%上昇。',en:'WINDWALKER',apply:g=>{for(const h of g.heroes){h.interval*=.8;h.speed*=1.1;}}},
  {id:'ward',icon:'◇',name:'石守の祈り',text:'受けるダメージが18%減少。\n灰の向こうから、誰かが守る。',en:'STONEWARD',apply:g=>{for(const h of g.heroes)h.armor*=.82;}},
  {id:'song',icon:'♮',name:'夜明けの歌',text:'吟遊詩人の回復量が65%上昇。\n祈りの鐘の待ち時間が短縮。',en:'DAWNSINGER',apply:g=>{g.healPower*=1.65;g.bellMax=Math.max(7,g.bellMax-2);}},
];
export const WAVES=['亡者の目覚め','骨に宿る記憶','這い寄る深淵','朽ちた誓約','弔鐘の行進','深淵の提督'];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class Battle {
  constructor(seed=7331){this.seed=seed;this.state='title';this.units=[];this.heroes=[];this.events=[];this.nextId=1;this.time=0;this.speed=1;this.wave=0;this.kills=0;this.damage=0;this.embers=0;this.boons=[];this.bellCooldown=0;this.bellMax=14;this.healPower=1;this.healClock=3;this.rally=null;}
  random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  emit(type,data={}){this.events.push({type,...data});}
  drain(){const e=this.events;this.events=[];return e;}
  start(){
    this.state='combat';this.units=[];this.heroes=[];this.events=[];this.nextId=1;this.time=0;this.wave=0;this.kills=0;this.damage=0;this.embers=0;this.boons=[];this.bellCooldown=0;this.bellMax=14;this.healPower=1;this.healClock=3;this.rally=null;
    HEROES.forEach((d,i)=>{const u=this.make({...d,team:'hero',x:(i-1)*2.25,z:i===2?2.4:.7});this.heroes.push(u);});
    this.beginWave();
  }
  make(data){const u={id:this.nextId++,hp:100,maxHp:data.hp,attack:10,range:1.2,speed:2,interval:1.4,cooldown:this.random()*.5,armor:1,x:0,z:0,angle:Math.PI,action:'Idle',actionTime:0,windup:0,pending:null,dead:false,deathTime:0,skill:5+this.random()*3,hit:0,...data};u.maxHp=u.hp;this.units.push(u);this.emit('spawn',{unit:u});return u;}
  beginWave(){
    this.wave++;this.waveTime=0;this.spawnClock=.2;this.pendingSpawns=5+this.wave*2;this.state='combat';this.rally=null;
    this.emit('wave',{wave:this.wave,name:WAVES[this.wave-1]});
    if(this.wave===6){this.make({kind:'boss',team:'enemy',name:'深淵の提督',model:'Characters_Sharky',hp:1250,attack:30,range:2.25,speed:1.8,interval:1.8,height:4.4,x:0,z:-7,skill:4});this.pendingSpawns=10;}
    for(let i=0;i<3;i++)this.spawnEnemy();
  }
  spawnEnemy(){
    if(this.pendingSpawns<=0)return;
    this.pendingSpawns--;
    const a=this.random()*Math.PI*2,r=8.2+this.random()*.8;
    const tentacle=this.wave>=3 && this.random()<.21;
    const headless=!tentacle&&this.wave>=2&&this.random()<.35;
    this.make({kind:tentacle?'tentacle':'skeleton',team:'enemy',model:tentacle?'Characters_Tentacle':headless?'Characters_Skeleton_Headless':'Characters_Skeleton',hp:(tentacle?94:47)+this.wave*12,attack:(tentacle?15:8)+this.wave*1.7,range:tentacle?3.1:1.3,speed:tentacle?.85:1.45+this.wave*.07,interval:tentacle?2.5:1.65,height:tentacle?2.35:2.15,x:Math.cos(a)*r,z:Math.sin(a)*r,skill:99});
  }
  togglePause(){if(this.state==='paused'){this.state=this.beforePause;return;}if(['combat','choice'].includes(this.state)){this.beforePause=this.state;this.state='paused';}}
  order(x,z){if(this.state!=='combat')return;this.rally={x:clamp(x,-7,7),z:clamp(z,-7,7),time:3.1};this.emit('rally',this.rally);}
  bell(){
    if(this.state!=='combat'||this.bellCooldown>0)return false;
    this.bellCooldown=this.bellMax;
    for(const h of this.heroes)if(!h.dead){this.heal(h,h.maxHp*.17);this.emit('nova',{x:h.x,z:h.z,radius:3.8,color:'#ead095'});for(const e of this.enemies())if(dist(h,e)<3.8)this.hurt(e,42+this.wave*9,h);}
    this.emit('bell');return true;
  }
  enemies(){return this.units.filter(u=>u.team==='enemy'&&!u.dead);}
  heal(u,value){if(u.dead)return;const amount=Math.min(value,u.maxHp-u.hp);u.hp+=amount;if(amount>1)this.emit('heal',{unit:u,value:Math.round(amount)});}
  hurt(target,amount,source,critical=false){
    if(!target||target.dead)return;
    const n=Math.max(1,Math.round(amount*target.armor));target.hp=Math.max(0,target.hp-n);target.hit=.18;
    if(source.team==='hero')this.damage+=n;
    this.emit('hit',{unit:target,source,value:n,critical});
    if(target.hp<=0){target.dead=true;target.action='Death';target.actionTime=9;target.pending=null;target.deathTime=0;this.emit('death',{unit:target});if(target.team==='enemy'){this.kills++;this.embers+=target.kind==='boss'?100:10;}}
  }
  strike(u,t){
    u.cooldown=u.interval;u.action=u.kind==='tentacle'?'Tentacle_Attack':'Sword';u.actionTime=.68;u.windup=u.kind==='henry'?.4:.28;u.pending={targetId:t.id,kind:'attack'};
    this.emit('attack',{unit:u,target:t,ranged:u.kind==='henry'});
  }
  resolve(u){
    const p=u.pending;u.pending=null;if(!p||u.dead)return;
    if(p.kind==='slam'){
      this.emit('nova',{x:p.x,z:p.z,radius:3.1,color:'#df8c64'});
      for(const h of this.heroes)if(!h.dead&&Math.hypot(h.x-p.x,h.z-p.z)<3.1)this.hurt(h,u.attack*2,u);
      return;
    }
    const t=this.units.find(n=>n.id===p.targetId);if(!t||t.dead)return;
    if(dist(u,t)>u.range+1.05&&u.kind!=='henry')return;
    const crit=u.team==='hero'&&this.random()<.16;this.hurt(t,u.attack*(crit?1.7:1),u,crit);
    if(u.kind==='anne' && u.skill<=0){u.skill=6;this.emit('nova',{x:u.x,z:u.z,radius:2.6,color:'#90eee0'});for(const e of this.enemies())if(e.id!==t.id&&dist(u,e)<2.6)this.hurt(e,u.attack*.85,u);}
    if(u.kind==='captain' && u.skill<=0){u.skill=8;this.heal(u,26);this.emit('guard',{unit:u});}
  }
  choose(index=0){if(this.state!=='choice')return false;const b=this.choices[clamp(index,0,2)];b.apply(this);this.boons.push(b.id);this.emit('boon',{boon:b});this.beginWave();return true;}
  endWave(){
    if(this.wave>=6){this.state='win';this.emit('result',{win:true});return;}
    for(const h of this.heroes){if(h.dead){h.dead=false;h.hp=h.maxHp*.45;h.action='Idle';h.actionTime=0;this.emit('revive',{unit:h});}else this.heal(h,h.maxHp*.23);h.pending=null;h.windup=0;}
    this.units=this.heroes.slice();this.state='choice';this.choiceTime=8;
    const list=[...BOONS];for(let i=list.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    this.choices=list.slice(0,3);this.emit('choice');
  }
  step(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.08);
    if(this.state==='choice'){this.choiceTime-=dt;if(this.choiceTime<=0)this.choose(0);return;}
    if(this.state!=='combat')return;
    this.time+=dt;this.waveTime+=dt;this.bellCooldown=Math.max(0,this.bellCooldown-dt);this.healClock-=dt;
    if(this.rally){this.rally.time-=dt;if(this.rally.time<=0)this.rally=null;}
    const livingHeroes=this.heroes.filter(u=>!u.dead);
    if(!livingHeroes.length){this.state='lose';this.emit('result',{win:false});return;}
    if(this.healClock<=0){this.healClock=3;const bard=this.heroes.find(h=>h.kind==='henry');if(bard&&!bard.dead){const weak=[...livingHeroes].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];this.heal(weak,19*this.healPower);this.emit('song',{unit:bard,target:weak});}}
    this.spawnClock-=dt;
    if(this.spawnClock<=0&&this.pendingSpawns>0&&this.enemies().length<8){this.spawnClock=1.6;this.spawnEnemy();}
    for(const u of this.units){
      u.hit=Math.max(0,u.hit-dt);
      if(u.dead){u.deathTime+=dt;continue;}
      u.cooldown-=dt;u.skill-=dt;u.actionTime-=dt;
      if(u.pending){u.windup-=dt;if(u.windup<=0)this.resolve(u);continue;}
      if(u.actionTime>0)continue;
      const opponents=u.team==='hero'?this.enemies():livingHeroes.filter(h=>!h.dead);
      let target=null,best=Infinity;
      for(const t of opponents){const d=dist(u,t);if(d<best){best=d;target=t;}}
      if(!target){u.action='Idle';continue;}
      if(u.kind==='boss'&&u.skill<=0){u.skill=8;u.windup=1.1;u.action='Punch';u.actionTime=1.6;u.pending={kind:'slam',x:target.x,z:target.z};this.emit('telegraph',{x:target.x,z:target.z,radius:3.1,life:1.1});continue;}
      const goal=u.team==='hero'&&this.rally?{x:this.rally.x+(this.heroes.indexOf(u)-1)*1.4,z:this.rally.z+(u.kind==='henry'?1.6:0)}:target;
      const distance=dist(u,goal),limit=goal===target?u.range:.4;
      if(distance>limit){
        let dx=(goal.x-u.x)/distance,dz=(goal.z-u.z)/distance;
        for(const o of this.units){if(o===u||o.dead)continue;const od=dist(u,o),r=(u.kind==='boss'||o.kind==='boss')?1.15:.75;if(od>.001&&od<r){dx+=(u.x-o.x)/od*(r-od)*1.3;dz+=(u.z-o.z)/od*(r-od)*1.3;}}
        const length=Math.hypot(dx,dz)||1;u.x=clamp(u.x+dx/length*u.speed*dt,-9.7,9.7);u.z=clamp(u.z+dz/length*u.speed*dt,-9.7,9.7);u.angle=Math.atan2(dx,dz);u.action=u.kind==='tentacle'?'Tentacle_Idle':'Run';
      }else{u.angle=Math.atan2(target.x-u.x,target.z-u.z);u.action=u.kind==='tentacle'?'Tentacle_Idle':'Idle';if(u.cooldown<=0&&best<=u.range+.25)this.strike(u,target);}
    }
    this.units=this.units.filter(u=>u.team==='hero'||!u.dead||u.deathTime<2.5);
    if(!this.enemies().length&&this.pendingSpawns===0)this.endWave();
  }
  snapshot(){return {state:this.state,wave:this.wave,time:Number(this.time.toFixed(2)),kills:this.kills,damage:this.damage,embers:this.embers,bellCooldown:this.bellCooldown,heroes:this.heroes.map(h=>({id:h.id,kind:h.kind,hp:Math.round(h.hp),maxHp:Math.round(h.maxHp),x:h.x,z:h.z,dead:h.dead})),enemies:this.enemies().length,units:this.units.length};}
}
