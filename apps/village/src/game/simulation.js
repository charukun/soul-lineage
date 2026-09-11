import {defs,ready,entry,inWater,LIMIT,extent,localToWorld,DAY_SECONDS,DAYS_YEAR,clamp,isGuard,isPlayer,dist,capacityOf,jobsOf,RESOURCE_NAMES} from './core.js';
import {TERRAIN_SITES} from './terrain.js';
const STEP=2, key=(x,z)=>`${x},${z}`,cell=v=>Math.round(v/STEP);
const names=['こはる','リオ','セナ','ルカ','ミオ','ニナ','ソラ','カイ','エマ','フィン','ハル','ユノ','レイ','ノア','アオ','メイ','テオ','リナ','ナギ','ミナ','ルイ','アン','トワ','リネ'];
class Heap{constructor(){this.a=[];}push(n){const a=this.a;a.push(n);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p;}a[i]=n;}pop(){const a=this.a,r=a[0],n=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(n.f<=a[c].f)break;a[i]=a[c];i=c;}a[i]=n;}return r;}get length(){return this.a.length;}}
/** Private navigation cells, independent of the arbitrary world-space editor. */
export class Navigation{
 constructor(world){this.world=world;this.revision=-1;this.cache=new Map();}
 sync(){if(this.revision!==this.world.state.revision){this.revision=this.world.state.revision;this.cache.clear();this.obstacles=this.world.objects.filter(o=>!defs[o.kind].soft&&!['field','orchard','pond'].includes(defs[o.kind].shape)).map(o=>({...o,bounds:extent(o)}));}}
 blocked(x,z){this.sync();const k=key(x,z);if(this.cache.has(k))return this.cache.get(k);const wx=x*STEP,wz=z*STEP;const bad=Math.abs(wx)>LIMIT-2||Math.abs(wz)>LIMIT-2||inWater(wx,wz,.45)||this.obstacles.some(o=>Math.abs(o.x-wx)<o.bounds[0]/2+1.05&&Math.abs(o.z-wz)<o.bounds[1]/2+1.05);this.cache.set(k,bad);return bad;}
 free(x,z){if(!this.blocked(x,z))return{x,z};for(let r=1;r<=6;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;if(!this.blocked(x+dx,z+dz))return{x:x+dx,z:z+dz};}return null;}
 route(from,to){const a=this.free(cell(from.x),cell(from.z)),b=this.free(cell(to.x),cell(to.z));if(!a||!b)return null;const target=key(b.x,b.z),start=key(a.x,a.z),open=new Heap(),dist=new Map([[start,0]]),prev=new Map(),closed=new Set();open.push({...a,f:0});let found=false;
  while(open.length&&closed.size<18000){const n=open.pop(),k=key(n.x,n.z);if(closed.has(k))continue;if(k===target){found=true;break;}closed.add(k);
   for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=n.x+dx,z=n.z+dz,nk=key(x,z);if(this.blocked(x,z)||closed.has(nk)||dx&&dz&&(this.blocked(n.x+dx,n.z)||this.blocked(n.x,n.z+dz)))continue;
    const wear=this.world.state.traffic[nk]||0,cost=(dx&&dz?1.414:1)*(1-.20*Math.min(1,wear/16)),g=dist.get(k)+cost;if(g>=(dist.get(nk)??Infinity))continue;dist.set(nk,g);prev.set(nk,k);open.push({x,z,f:g+Math.hypot(b.x-x,b.z-z)*.79});}
  }
  if(!found)return null;const path=[];let k=target;while(k!==start){const[x,z]=k.split(',').map(Number);path.push({x:x*STEP,z:z*STEP});k=prev.get(k);if(!k)return null;}path.reverse();return path;
 }
}
const ROLE_NAMES={mayor:'村長',guard:'護衛',resident:'村人',player:'一族プレイヤー'};
const FAVORITES=['焚き火の語らい','花を眺める','木陰でひと休み','釣り','部屋を飾る','読書','朝の散歩'];
export class Simulation{
 constructor(world){this.world=world;this.nav=new Navigation(world);this.elapsed=0;this.arrivalTimer=6;this.assignmentTimer=0;this.constructionTimer=0;this.decayTimer=0;this.momentTimer=18;this.trafficRevision=1;this.extras=[];this.onEvent=()=>{};this.refresh();}
 get raid(){return this.world.state.defense.raid;}
 set raid(value){this.world.state.defense.raid=value;}
 refresh(){this.trafficRevision++;this.nav.revision=-1;this.extras=[];
  for(const p of this.world.people){p.hunger??=85;p.purse??=0;p.task??='idle';p.timer??=0;p.path??=[];p.health??=100;p.skill??=0;p.happiness??=75;p.favorite??=FAVORITES[this.world.people.indexOf(p)%FAVORITES.length];p.memories??=[];p.seed??=this.world.random()*20;}
  if(!this.world.state.wildlife.length)this.seedWildlife();
 }
 random(){return this.world.random();}
 emit(text,type='life'){this.world.notify(text,type);this.onEvent(text,type);}
 remember(p,text,bubble=null){p.memories.unshift({text,day:this.world.state.clock});p.memories=p.memories.slice(0,6);if(bubble){p.bubble={text:bubble,id:this.world.state.nextId++,until:this.elapsed+5};}}
 moment(text,actors=[]){const s=this.world.state,m={text,day:s.clock,ids:actors.map(p=>p.id),id:s.nextId++};s.moments.unshift(m);s.moments=s.moments.slice(0,12);s.stats.moments++;this.emit(text,'moment');}
 availableHomes({player=false}={}){return this.world.objects.filter(o=>ready(o)&&capacityOf(o)&&!defs[o.kind].reserved&&!!defs[o.kind].clanOnly===player&&this.world.people.filter(p=>p.homeId===o.id).length<capacityOf(o));}
 arrive(){const w=this.world,pop=w.population();if(w.people.length>=pop.limit||this.raid)return false;
  const h=this.availableHomes().filter(o=>w.safetyAt(o)).sort((a,b)=>w.people.filter(p=>p.homeId===a.id).length-w.people.filter(p=>p.homeId===b.id).length)[0];if(!h)return false;
  const i=w.state.stats.arrivals++,e=entry(h),spawn=this.nav.free(cell(e.x-12),cell(e.z+12));if(!spawn)return false;
  const p={id:'npc'+w.state.nextId++,name:names[i%names.length]+(i>=names.length?' '+(1+Math.floor(i/names.length)):''),source:'local-npc',role:'resident',homeId:h.id,jobId:null,x:spawn.x*STEP,z:spawn.z*STEP,task:'idle',timer:0,path:[],hunger:83,purse:0,health:100,happiness:78,skill:0,seed:i*.63,angle:0,hidden:false,favorite:FAVORITES[i%FAVORITES.length],memories:[]};
  w.people.push(p);w.changed();this.go(p,h,'home');this.remember(p,'この村で暮らし始めた','ここに暮らそう');this.emit(`${p.name}が${defs[h.kind].label}に住み着きました`,'arrival');return p;
 }
 assignJobs(){const w=this.world,jobs=w.objects.filter(o=>ready(o)&&jobsOf(o));
  for(const p of w.people)if(p.jobId&&!jobs.some(o=>o.id===p.jobId)){p.jobId=null;if(p.id!=='guard-npc'&&p.role!=='mayor'&&!isPlayer(p))p.role='resident';}
  const guards=jobs.filter(o=>['guard','watch'].includes(defs[o.kind].effect));
  const limitGuards=Math.max(1,Math.floor((w.people.length-2)/3)+1);
  for(const o of guards){const occupied=w.people.filter(p=>p.jobId===o.id).length;if(occupied>=jobsOf(o)||w.people.filter(p=>isGuard(p)&&p.id!=='guard-npc').length>=limitGuards)continue;
   const candidate=w.people.filter(p=>p.role==='resident'&&!p.downed).sort((a,b)=>(a.jobId?1:0)-(b.jobId?1:0))[0];
   if(candidate){candidate.role='guard';candidate.jobId=o.id;candidate.task='idle';candidate.path=[];candidate.timer=0;this.remember(candidate,'村の警備職になった','見回りに行こう');this.emit(`${candidate.name}が警備職に就きました`,'life');}
  }
  // A small village changes jobs by itself when an unattended resource blocks growth.
  // Retain jobs for at least 80 seconds, never pull a guard off duty, and let the
  // current journey/work action finish rather than teleporting or resetting it.
  const demand={};
  for(const o of w.objects)if(o.phase==='planned')for(const[k,n]of Object.entries(o.recipe||{}))demand[k]=(demand[k]||0)+n;
  for(const o of jobs)for(const[k,n]of Object.entries(defs[o.kind].input||{}))demand[k]=Math.max(demand[k]||0,n*4);
  const civilianJobs=jobs.filter(o=>!['guard','watch'].includes(defs[o.kind].effect));
  const priority=(o,p)=>{const d=defs[o.kind],workers=w.people.filter(n=>n.id!==p.id&&n.jobId===o.id).length;
   const values=Object.entries(d.produce||{}).map(([k,n])=>{
    const stock=w.state.stock[k],missing=Math.max(0,(demand[k]||0)-stock);
    let score=!w.state.known.includes(k)?185:stock<8?70:stock>this.capacity()*.8?-40:20;
    if(missing>0)score+=100+Math.min(100,missing*2);
    if(k==='food'&&stock<w.people.length*2+5)score+=110;
    return score;
   });
   let score=values.length?Math.max(...values):5;
   if(d.input&&!w.canAfford(d.input))score-=110;
   if(o.kind==='market'&&!w.state.merchant.present)score-=90;
   return score-workers*110-dist(o,p)*.35+(p.jobId===o.id?20:0);
  };
  for(const p of w.people){if(isGuard(p)||isPlayer(p)||p.downed)continue;
   const current=w.object(p.jobId),available=civilianJobs.filter(o=>w.people.filter(n=>n.id!==p.id&&n.jobId===o.id).length<jobsOf(o));
   available.sort((a,b)=>priority(b,p)-priority(a,p));const next=available[0];if(!next||next.id===p.jobId)continue;
   if(current&&(this.elapsed-(p.jobAssignedAt||0)<80||priority(next,p)<priority(current,p)+45))continue;
   p.jobId=next.id;p.jobAssignedAt=this.elapsed;this.remember(p,defs[next.kind].label+'で働くことにした');
  }
 }
 go(p,o,action){if(!o)return false;const destination=o.kind?entry(o):o;const path=this.nav.route(p,destination);
  if(path===null){p.task='idle';p.timer=5;p.status='通れる道を探しています';return false;}
  p.path=path;p.destination={x:destination.x,z:destination.z};p.navRevision=this.world.state.revision;p.task='walk';p.nextAction=action;p.targetId=o.id||null;p.insideId=null;
  p.status={work:'仕事へ向かう',eat:'食事へ向かう',shop:'旅商人の店へ',decorate:'家具を家へ運ぶ',home:'自宅へ帰る',rest:'休みに行く',wander:'散歩',service:'施設へ向かう',social:'語らいの輪へ',patrol:'ゆっくり見回り',escort:'村長に同行中',rescue:'救助に向かう'}[action]||'移動中';return true;
 }
 footprint(x,z,amount){if(inWater(x,z))return;const k=key(cell(x),cell(z));this.world.state.traffic[k]=Math.min(40,(this.world.state.traffic[k]||0)+amount);this.trafficRevision++;}
 walk(p,dt){if(p.navRevision!==this.world.state.revision){const target=p.targetId?this.world.object(p.targetId):p.destination;if(!target){p.task='idle';p.timer=0;return;}if(!this.go(p,target,p.nextAction))return;}
  p.moving=false;let left=dt*(isGuard(p)?4.6:2.8);while(left>0&&p.path.length){const n=p.path[0],dx=n.x-p.x,dz=n.z-p.z,d=Math.hypot(dx,dz);if(d<.025){p.path.shift();continue;}
   const step=Math.min(left,d),beforeX=p.x,beforeZ=p.z;p.x+=dx/d*step;p.z+=dz/d*step;p.angle=Math.atan2(dx,dz);left-=step;p.moving=true;p.walked=(p.walked||0)+step;if(p.walked>.8){this.footprint((p.x+beforeX)/2,(p.z+beforeZ)/2,.46);p.walked=0;}if(step>=d-.001)p.path.shift();}
  if(!p.path.length)this.onArrival(p);
 }
 onArrival(p){p.moving=false;p.task=p.nextAction;p.timer={work:8,eat:4,shop:3,decorate:4,home:6,rest:10,wander:6,service:7,social:10,patrol:5,escort:2}[p.task]||3;
  const h=this.world.object(p.targetId);if(['home','decorate','rest'].includes(p.task)&&h){const spot=localToWorld(h,0,defs[h.kind].d/2-1.4);p.x=spot.x;p.z=spot.z;p.insideId=h.id;}
  const jobs={logging:'薪をまとめている',wheat:'小麦を刈っている',quarry:'石を選り分けている',clay:'粘土をすくっている',carpenter:'板を削っている',fishpond:'釣り糸を垂れている',orchard:'実を摘んでいる',school:'読み書きを学んでいる',smith:'鉄を鍛えている'};
  p.status={work:jobs[h?.kind]||'仕事中',eat:'食事中',shop:'小物を選んでいる',decorate:'部屋を飾っている',home:'自宅でひと休み',rest:'休息中',wander:p.favorite||'ひなたぼっこ',service:'施設を利用中',social:'焚き火を囲んで語らう',patrol:'周囲を見守っている',escort:'村長のそばで見守る'}[p.task]||'ひと休み';
 }
 finish(p){const w=this.world,s=w.state,o=w.object(p.targetId),d=o&&defs[o.kind];
  if(this.raid?.phase==='active'&&p.insideId&&['home','rest'].includes(p.task)){p.timer=4;p.health=Math.min(100,p.health+3);p.status='屋内で、警備職の帰りを待つ';return;}
  if(p.task==='work'&&o&&ready(o)){
   let valid=w.canAfford(d.input||{})&&(d.id!=='market'||s.merchant.present);
   if(valid){w.spend(d.input||{});const tools=w.objects.some(b=>ready(b)&&b.kind==='tools')?1.15:1;const mult=(1+(o.level-1)*.45)*(1+p.skill*.005)*tools*(o.damage>30?.75:1);
    for(const[k,n]of Object.entries(d.produce||{})){const amount=Math.min(Math.max(0,this.capacity()-s.stock[k]),n*mult);w.gain(k,amount);s.stats.produced+=amount;}
    if(d.id==='quarry'&&o.level>=2){o.workCycles=(o.workCycles||0)+1;if(o.workCycles%3===0)w.gain('crystal',1);}
    p.purse=Math.min(200,p.purse+5);p.skill=Math.min(100,p.skill+.1);p.workCount=(p.workCount||0)+1;
    if(d.effect==='healing'){for(const n of w.people)if(dist(n,o)<36)n.health=Math.min(100,n.health+7);}
    if(['learning','training'].includes(d.effect))p.skill=Math.min(100,p.skill+.5);
    if(d.effect==='comfort')p.happiness=Math.min(100,p.happiness+6);
    if(p.workCount%5===0)this.remember(p,`${d.label}で${Object.keys(d.produce||{}).map(k=>RESOURCE_NAMES[k]).join('と')||'ひと仕事'}を届けた`,'ひと仕事おわり');
   }else p.status='材料や旅商人の到着を待つ';
  }else if(p.task==='eat'){
   const food=w.spend({food:1});p.hunger=Math.min(100,p.hunger+(food?78:40));p.happiness=Math.min(100,p.happiness+(food?4:0));s.stats.meals++;this.remember(p,food?'みんなの収穫で食事をした':'木の実を集めて腹ごしらえ','いただきます');
  }else if(p.task==='shop'&&s.merchant.present&&p.purse>=10&&!p.carry){
   const options=['plant','chair','lamp','bed','rug','shelf','table','sofa'],owned=w.object(p.homeId)?.room.filter(f=>f.ownerId===p.id).length||0;
   if(owned<8){p.carry=options[owned%options.length];p.purse-=10;s.stats.purchases++;this.remember(p,defs[p.carry].label+'を買った','家に飾ろう');this.emit(`${p.name}が${defs[p.carry].label}を買いました`);}
  }else if(p.task==='decorate'&&p.carry){if(w.furnish(p,p.carry)){const label=defs[p.carry].label;p.carry=null;this.remember(p,label+'を部屋に置いた','いい感じ');this.moment(`${p.name}の部屋に、新しい${label}が増えました。`,[p]);}else{p.status='家具を置く場所を待っています';p.decorateRetry=30;}}
  else if(['rest','home'].includes(p.task)){p.health=Math.min(100,p.health+14);p.happiness=Math.min(100,p.happiness+3);}
  else if(p.task==='social'){p.happiness=Math.min(100,p.happiness+9);p.friendships=(p.friendships||0)+1;}
  else if(p.task==='service'&&d){if(d.effect==='healing')p.health=100;if(['learning','training'].includes(d.effect))p.skill=Math.min(100,p.skill+.5);p.happiness=Math.min(100,p.happiness+7);}
  if(p.insideId){const home=w.object(p.insideId);if(home){const e=entry(home);p.x=e.x;p.z=e.z;}p.insideId=null;}
  p.task='idle';p.timer=1+this.random()*2;
 }
 decide(p){const w=this.world,s=w.state,home=w.object(p.homeId),job=w.object(p.jobId),fire=w.objects.find(o=>o.kind==='campfire');
  if(this.raid?.phase==='active'){if(!p.insideId)this.go(p,home,'home');else{p.task='home';p.timer=5;}return;}
  if(p.hunger<44){const restaurants=w.objects.filter(o=>ready(o)&&['meal','feast'].includes(defs[o.kind].effect));this.go(p,restaurants.sort((a,b)=>dist(a,p)-dist(b,p))[0]||fire,'eat');return;}
  if(p.carry&&!p.decorateRetry){this.go(p,home,'decorate');return;}
  const market=w.objects.find(o=>o.kind==='market'&&ready(o));if(market&&s.merchant.present&&p.purse>=10&&!p.carry&&(home.room.filter(f=>f.ownerId===p.id).length<8)){this.go(p,market,'shop');return;}
  if(s.time>=21||s.time<5){this.go(p,home,'rest');return;}
  if(s.time>=17&&s.time<=21&&this.random()<.65){const a=this.random()*6.28;this.go(p,{x:fire.x+Math.cos(a)*4,z:fire.z+Math.sin(a)*4},'social');return;}
  if(job&&this.random()<.84){this.go(p,job,'work');return;}
  const sites=w.objects.filter(o=>ready(o)&&defs[o.kind].effect&&!['harbor','storage','guard','watch'].includes(defs[o.kind].effect));if(sites.length&&this.random()<.3){this.go(p,sites[Math.floor(this.random()*sites.length)],'service');return;}
  const bench=w.objects.find(o=>o.kind==='bench'&&dist(o,p)<50);if(bench&&this.random()<.5){this.go(p,{x:bench.x,z:bench.z+1},'wander');return;}
  const center=fire||home,a=this.random()*6.28,r=4+this.random()*12;this.go(p,{x:center.x+Math.cos(a)*r,z:center.z+Math.sin(a)*r},'wander');
 }
 capacity(){return 100+this.world.objects.filter(o=>o.kind==='storage'&&ready(o)).reduce((n,o)=>n+o.level*300,0);}
 construction(dt){let changed=false;const w=this.world,s=w.state;
  for(const o of w.objects){
   if(o.phase==='planned'&&w.people.length&&w.spend(o.recipe||defs[o.kind].cost)){o.phase='building';o.progress=0;changed=true;this.emit(`${defs[o.kind].label}の建築が始まりました`,'construction');}
   if(o.phase==='building'){o.progress=Math.min(1,o.progress+dt*Math.max(1,Math.min(4,w.people.filter(p=>!p.downed).length))/70);if(o.progress>=1){o.phase='built';o.builtDay=s.clock;changed=true;this.emit(`${defs[o.kind].label}が完成しました`,'construction');}}
   if(o.upgrade){o.upgrade.progress=Math.min(1,o.upgrade.progress+dt/45);if(o.upgrade.progress>=1){o.level=o.upgrade.target;delete o.upgrade;s.stats.upgrades++;changed=true;this.emit(`${defs[o.kind].label}が${o.level}段階目になりました`,'construction');}}
   if(o.damage&&!this.raid)o.damage=Math.max(0,o.damage-dt*.4);
  }if(changed)w.changed();
 }
 merchant(){const s=this.world.state,m=this.world.objects.find(o=>o.kind==='market'&&ready(o)),cycle=Math.floor(s.clock/4),present=!!m&&(s.clock%4<2);
  if(present&&!s.merchant.present)this.emit('旅商人が市場にやってきました','moment');s.merchant={present,cycle};
  if(present){const e=entry(m);this.extras=[{id:'merchant',name:'旅商人',x:e.x+2,z:e.z,seed:13,angle:-.5,moving:false,role:'merchant',status:'旅の品物を並べる'}];}else this.extras=[];
 }
 ship(dt){const w=this.world,s=w.state,v=s.voyage,harbor=w.objects.find(o=>o.kind==='harbor'&&ready(o)),cycle=Math.floor(s.clock/(DAYS_YEAR*5));
  if(cycle>v.lastCycle){v.lastCycle=cycle;if(harbor&&v.phase==='away'){v.phase='arriving';v.progress=0;v.harborId=harbor.id;this.emit('魔王軍戦線へ向かう巨大帆船が沖に現れました','voyage');}}
  if(v.phase!=='away'){if(!harbor||harbor.id!==v.harborId){v.phase='away';return;}v.progress+=dt;const duration=v.phase==='docked'?25:18;
   if(v.progress>=duration){v.progress=0;if(v.phase==='arriving'){v.phase='docked';s.stats.ships++;w.gain('cloth',12);w.gain('herb',8);this.emit('巨大帆船が停泊。布と薬草が届きました。次の航路は魔王軍戦線です','voyage');}
    else if(v.phase==='docked'){v.phase='departing';this.emit('帆船が魔王軍戦線へ出港します','voyage');}else v.phase='away';}}
 }
 seedWildlife(){for(let i=0;i<5;i++){const species=i<3?'rabbit':'deer',x=i<3?-22+i*12:35+i*3,z=i<3?25+i*2:19;this.world.state.wildlife.push({id:'wild'+this.world.state.nextId++,name:species==='rabbit'?'野うさぎ':'鹿',species,hostile:false,x,z,health:35,homeX:x,homeZ:z,seed:i*.8,angle:0,path:[],repath:0,moving:false});}}
 spawnWildlife(){const w=this.world,s=w.state;if(s.wildlife.filter(a=>a.hostile).length>=4)return;
  const sites=TERRAIN_SITES.filter(t=>t.kind==='forest'),site=sites[Math.floor(this.random()*sites.length)],pos=this.nav.free(cell(site.x),cell(site.z));if(!pos)return;
  const species=this.random()<.5?'boar':'wolf';s.wildlife.push({id:'wild'+s.nextId++,species,name:species==='boar'?'野いのしし':'狼',hostile:true,x:pos.x*STEP,z:pos.z*STEP,homeX:site.x,homeZ:site.z,health:species==='boar'?45:35,damage:5,speed:2.1,seed:this.random()*9,angle:0,path:[],repath:0,moving:false});
 }
 raidBudget(pop){return{count:clamp(Math.ceil(pop/3),2,18),health:30+Math.floor(Math.sqrt(pop)*4),damage:2.2+Math.floor(pop/12)*.65,speed:1.4+Math.min(.8,pop*.012)};}
 startRaid({immediate=false}={}){if(this.raid)return false;const w=this.world,s=w.state,seq=++s.defense.sequence,pop=w.people.length,budget=this.raidBudget(pop),fire=w.objects.find(o=>o.kind==='campfire');
  const angle=2.3+this.random()*1.5,anchor={x:fire.x+Math.cos(angle)*60,z:fire.z+Math.sin(angle)*60};
  this.raid={id:'village-raid-'+seq,phase:immediate?'active':'warning',startDay:s.clock+(immediate?0:.75),age:0,popSnapshot:pop,budget,monsters:[]};
  for(let i=0;i<budget.count;i++){const pos=this.nav.free(cell(anchor.x+i*3),cell(anchor.z+i%3*3));if(!pos)continue;this.raid.monsters.push({id:`raid-${seq}-${i}`,name:i%6===5?'魔王軍の精鋭':'魔王軍の斥候',x:pos.x*STEP,z:pos.z*STEP,health:budget.health*(i%6===5?1.4:1),maxHealth:budget.health,damage:budget.damage,speed:budget.speed,seed:i,angle:0,moving:false,path:[],repath:0,hostile:true,species:'monster'});}
  if(immediate)s.stats.raids++;
  this.emit(immediate?'魔王軍の斥候が村へ近づいています。警備職が迎撃します。':'遠くに魔王軍の気配。住人たちは帰宅の支度を始めます。','threat');return true;
 }
 threatMotion(a,target,dt,speed){if(!target)return;a.repath=(a.repath||0)-dt;if(a.repath<=0||!a.path){a.path=this.nav.route(a,target)||[];a.repath=2.5;}
  a.moving=false;let left=dt*speed;while(left>0&&a.path.length){const n=a.path[0],dx=n.x-a.x,dz=n.z-a.z,d=Math.hypot(dx,dz);if(d<.05){a.path.shift();continue;}const k=Math.min(left,d);a.x+=dx/d*k;a.z+=dz/d*k;a.angle=Math.atan2(dx,dz);left-=k;a.moving=true;if(k>=d-.01)a.path.shift();}
 }
 guardPower(p){const w=this.world,dojo=w.objects.filter(o=>o.kind==='dojo'&&ready(o)).reduce((n,o)=>n+o.level*2,0);return 18+p.skill*.1+dojo+Math.min(12,w.state.stock.gear*.25)+(p.id==='guard-npc'?6:0);}
 nearbyGuard(p){return this.world.people.find(g=>isGuard(g)&&g.health>0&&!g.downed&&dist(g,p)<=11);}
 hurt(p,damage,source){
  if(p.downed||p.dead)return;
  const g=source==='wildlife'?this.nearbyGuard(p):null;
  if(g){g.health=Math.max(40,g.health-damage*.22);g.status='野生動物からかばっている';p.health=Math.max(25,p.health);p.protectedAt=this.elapsed;return;}
  p.health=Math.max(0,p.health-damage);p.happiness=Math.max(20,p.happiness-damage*.08);
  if(p.health===0){p.downed={left:90,source};p.task='downed';p.moving=false;p.path=[];p.status='負傷して救助を待つ';this.emit(`${p.name}が負傷しました。護衛か治療所が救助に向かいます。`,'threat');}
 }
 guardStep(g,dt){if(g.downed)return;g.health=Math.min(100,g.health+dt*.35);g.hunger=Math.max(35,g.hunger-dt*.12);const w=this.world;
  const injured=w.people.filter(p=>p.downed&&dist(p,g)<50).sort((a,b)=>dist(a,g)-dist(b,g))[0];
  if(injured){g.insideId=null;g.status='負傷者の救助へ';if(dist(g,injured)<4){delete injured.downed;injured.health=50;injured.task='idle';injured.timer=2;w.state.stats.rescues++;this.remember(injured,`${g.name}に助けてもらった`,'ありがとう');this.emit(`${g.name}が${injured.name}を救助しました`,'rescue');}else this.threatMotion(g,injured,dt,4.8);return;}
  const threats=[...w.state.wildlife.filter(a=>a.hostile),...(this.raid?.phase==='active'?this.raid.monsters:[])];
  const home=w.object(g.jobId||g.homeId),mayor=w.people.find(p=>p.role==='mayor'),anchor=g.id==='guard-npc'?(mayor||home):home;
  const target=threats.filter(a=>a.health>0&&(dist(a,g)<20||dist(a,anchor)<24)).sort((a,b)=>dist(a,g)-dist(b,g))[0];
  if(target){g.insideId=null;g.status='村を守って迎撃中';g.task='defending';if(dist(g,target)<=3.6){g.moving=false;g.angle=Math.atan2(target.x-g.x,target.z-g.z);target.health=Math.max(0,target.health-dt*this.guardPower(g));g.attackPulse=this.elapsed;g.skill=Math.min(100,g.skill+dt*.015);}else this.threatMotion(g,target,dt,5);return;}
  if(g.hunger<=42){const meal=w.spend({food:1});g.hunger=Math.min(100,g.hunger+(meal?64:45));g.snackUntil=this.elapsed+4;w.state.stats.meals++;this.remember(g,meal?'見張りの合間にお弁当を食べた':'木の実で腹ごしらえをした','見張りながら、ひと口');}
  if(g.snackUntil>this.elapsed){g.moving=false;g.status='見張りを続けながら、軽く食事';return;}
  if(g.id==='guard-npc'&&mayor?.insideId&&(w.state.time>=21||w.state.time<5)){
   const at=entry(w.object(g.homeId));g.status='自宅から村の灯りを見守る';g.task='rest';
   if(dist(g,at)>3)this.threatMotion(g,at,dt,3);else{g.moving=false;g.insideId=g.homeId;}return;
  }
  const destination=g.id==='guard-npc'?{x:anchor.x+3,z:anchor.z+3}:{x:home.x+Math.cos(this.elapsed*.032+g.seed)*13,z:home.z+Math.sin(this.elapsed*.032+g.seed)*13};
  g.status=g.id==='guard-npc'?'村長に寄り添い、周囲を見守る':'村の小径を巡回する';g.task='patrol';g.insideId=null;
  if(dist(g,destination)>4)this.threatMotion(g,destination,dt,g.id==='guard-npc'?4.4:2.5);else{g.moving=false;g.path=[];g.repath=0;}
 }
 updateWildlife(dt){const w=this.world,s=w.state;
  if(s.clock>=s.defense.nextWildlife){s.defense.nextWildlife=s.clock+3+this.random()*2;this.spawnWildlife();}
  for(const a of s.wildlife){if(a.health<=0)continue;
   const vulnerable=w.people.filter(p=>!p.downed&&!p.insideId&&p.health>0&&dist(p,a)<(a.hostile?20:8)).sort((p,q)=>dist(p,a)-dist(q,a))[0];
   if(a.hostile&&vulnerable){a.targetId=vulnerable.id;if(dist(a,vulnerable)<2.6){a.moving=false;this.hurt(vulnerable,dt*(a.damage||5),'wildlife');}
    else this.threatMotion(a,vulnerable,dt,a.speed||2.1);
    if(!a.warned){a.warned=true;this.remember(vulnerable,'野生動物の気配に気づいた','護衛のそばへ');}
   }else{a.wanderTime=(a.wanderTime||0)-dt;if(a.wanderTime<=0){a.wanderTime=8+this.random()*10;const angle=this.random()*6.28,r=5+this.random()*12;a.wanderTarget={x:a.homeX+Math.cos(angle)*r,z:a.homeZ+Math.sin(angle)*r};a.repath=0;}
    if(a.wanderTarget&&dist(a,a.wanderTarget)>2)this.threatMotion(a,a.wanderTarget,dt,a.hostile?1.1:a.species==='rabbit'?1.5:1);else a.moving=false;
   }
  }
  const dead=s.wildlife.filter(a=>a.health<=0);if(dead.length){s.stats.defeated+=dead.length;for(const a of dead)if(a.hostile){w.gain('leather',1);this.emit('護衛が野生動物を追い払い、落ち着きを取り戻しました','rescue');}s.wildlife=s.wildlife.filter(a=>a.health>0);}
 }
 updateRaid(dt){const w=this.world,s=w.state;if(!this.raid){if(s.clock>=s.defense.nextRaid-.75)this.startRaid();return;}
  const r=this.raid;if(r.phase==='warning'){if(s.clock<r.startDay)return;r.phase='active';s.stats.raids++;this.emit('魔王軍が村へ。住人は屋内へ避難し、警備職が迎撃します。','threat');for(const p of w.people)if(!isGuard(p)){p.task='idle';p.timer=0;p.path=[];}}
  r.age+=dt;const fire=w.objects.find(o=>o.kind==='campfire');
  for(const a of r.monsters){if(a.health<=0)continue;const people=w.people.filter(p=>!p.downed&&p.health>0&&!p.insideId).sort((p,q)=>dist(p,a)-dist(q,a));const target=people[0];
   if(target&&dist(a,target)<2.5){a.moving=false;this.hurt(target,dt*(a.damage||r.budget.damage),'monster');}else this.threatMotion(a,target||fire,dt,a.speed||1.5);
   for(const o of w.objects){if(!ready(o))continue;if(['watchtower','wardlamp'].includes(o.kind)&&dist(a,o)<(o.kind==='wardlamp'?16:28)){const staffed=o.kind==='wardlamp'||w.people.some(p=>p.jobId===o.id);if(staffed)a.health=Math.max(0,a.health-dt*(o.kind==='wardlamp'?3:4)*(o.level||1));}
    if(defs[o.kind].building&&dist(a,o)<8){o.damage=Math.min(80,(o.damage||0)+dt*(o.material==='stone'?.25:.6));}}
  }
  const before=r.monsters.length;r.monsters=r.monsters.filter(a=>a.health>0);s.stats.defeated+=before-r.monsters.length;
  if(!r.monsters.length||r.age>100){const won=!r.monsters.length;this.raid=null;s.defense.lastRaid=s.clock;s.defense.nextRaid=s.clock+12+this.random()*2;this.emit(won?'村を守りきりました。住人が小径へ戻ってきます。':'魔王軍が退いていきました。村はゆっくり元の暮らしへ。','rescue');this.moment('焚き火のまわりに、いつもの暮らしが戻りました。',w.people.slice(0,2));}
 }
 rescueAndRecovery(dt){const w=this.world,clinic=w.objects.find(o=>o.kind==='clinic'&&ready(o)&&w.people.some(p=>p.jobId===o.id));
  for(const p of [...w.people]){if(!p.downed)continue;
   if(clinic&&dist(p,clinic)<75&&w.spend({medicine:1})){delete p.downed;p.health=65;p.task='idle';p.timer=3;w.state.stats.rescues++;this.remember(p,'治療所で手当てを受けた','助かった');continue;}
   p.downed.left-=dt;if(p.downed.left>0)continue;
   // The local avatar and dedicated starter guard are recoverable, not an irreversible tutorial fail.
   if(p.role==='mayor'||p.id==='guard-npc'||isPlayer(p)){delete p.downed;p.health=40;const e=entry(w.object(p.homeId));p.x=e.x;p.z=e.z;p.task='idle';p.timer=10;this.emit(`${p.name}が自宅で療養しています`,'rescue');}
   else{w.state.memorial.push({id:p.id,name:p.name,day:w.state.clock,reason:p.downed.source});w.state.stats.losses++;w.people.splice(w.people.indexOf(p),1);w.changed();this.emit(`${p.name}は救助が間に合わず亡くなりました。住まいの家具と思い出は残ります。`,'loss');}
  }
 }
 quietMoments(){const w=this.world,s=w.state;if(this.raid?.phase==='active')return;
  const free=w.people.filter(p=>!p.downed&&!p.insideId&&!isGuard(p)),a=free[Math.floor(this.random()*free.length)];if(!a)return;
  const b=free.find(p=>p.id!==a.id&&dist(a,p)<7&&!p.carry&&!a.carry&&['idle','wander','social'].includes(p.task)&&['idle','wander','social'].includes(a.task));
  if(b){for(const[p,q]of[[a,b],[b,a]]){p.path=[];p.task='social';p.timer=5;p.moving=false;p.angle=Math.atan2(q.x-p.x,q.z-p.z);p.status=q.name+'と少し立ち話';}this.remember(a,`${b.name}と顔を合わせて挨拶した`,'おつかれさま');this.remember(b,`${a.name}に挨拶を返した`,'いい日だね');a.happiness=Math.min(100,a.happiness+3);b.happiness=Math.min(100,b.happiness+3);this.moment(`${a.name}と${b.name}が、道ばたで少し立ち話。`,[a,b]);}
  else{const messages=[`${a.name}が、風に揺れる木立を眺めています。`,`${a.name}の足取りから、小さな道が育っています。`,`${a.name}は${a.favorite}の時間を楽しんでいます。`];this.remember(a,'村で静かなひとときを過ごした','ひとやすみ');this.moment(messages[Math.floor(this.random()*messages.length)],[a]);}
  const restaurant=w.objects.find(o=>o.kind==='restaurant'&&ready(o));if(restaurant&&s.clock%6<1&&w.spend({food:3,herb:1})){for(const p of w.people)p.happiness=Math.min(100,p.happiness+12);this.moment('料亭からよい香り。小さなごちそうの集いが始まりました。',w.people.slice(0,3));}
 }
 update(dt){if(!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,10);while(remaining>0){const step=Math.min(.25,remaining);this.step(step);remaining-=step;}}
 step(dt){this.elapsed+=dt;const w=this.world,s=w.state;s.clock+=dt/DAY_SECONDS;s.time=(s.clock%1)*24;
  this.arrivalTimer-=dt;if(this.arrivalTimer<=0){this.arrivalTimer=27;this.arrive();}
  this.assignmentTimer-=dt;if(this.assignmentTimer<=0){this.assignmentTimer=5;this.assignJobs();this.merchant();w.discover();}
  this.constructionTimer+=dt;if(this.constructionTimer>=.5){this.construction(this.constructionTimer);this.constructionTimer=0;}
  this.ship(dt);this.updateRaid(dt);
  for(const p of w.people){if(p.downed||p.remoteControlled)continue;p.hunger=Math.max(0,(p.hunger??80)-dt*.34);p.decorateRetry=Math.max(0,(p.decorateRetry||0)-dt);
   if(isGuard(p)){this.guardStep(p,dt);continue;}
   if(p.bubble&&p.bubble.until<this.elapsed)p.bubble=null;
   if(p.task==='walk'){this.walk(p,dt);continue;}p.moving=false;p.timer-=dt;if(p.timer>0)continue;if(p.task==='idle')this.decide(p);else this.finish(p);
  }
  this.updateWildlife(dt);this.rescueAndRecovery(dt);
  this.momentTimer-=dt;if(this.momentTimer<=0){this.momentTimer=22+this.random()*15;this.quietMoments();}
  this.decayTimer+=dt;if(this.decayTimer>8){const factor=Math.pow(.98,this.decayTimer/60);for(const[k,v]of Object.entries(s.traffic)){if(v*factor<.02)delete s.traffic[k];else s.traffic[k]=v*factor;}this.decayTimer=0;this.trafficRevision++;}
 }
}
