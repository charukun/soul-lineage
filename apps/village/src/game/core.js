import {BUILDINGS,GARDEN,FURNITURE,defs,RESOURCE_NAMES,MATERIALS,unlocked,recipe,materialOptions,capacityOf,jobsOf,TUTORIAL} from './catalog.js';
import {LIMIT,SIZE,riverX,inWater,terrainError,terrainHint,TERRAIN_SITES} from './terrain.js';
export {BUILDINGS,GARDEN,FURNITURE,defs,RESOURCE_NAMES,MATERIALS,unlocked,recipe,materialOptions,capacityOf,jobsOf,TUTORIAL,LIMIT,SIZE,riverX,inWater,terrainHint,TERRAIN_SITES};
export const VERSION=5,DAY_SECONDS=60,DAYS_YEAR=12,MAX_POPULATION=64;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const copy=x=>JSON.parse(JSON.stringify(x));
export const extent=o=>{const d=defs[o.kind],c=Math.abs(Math.cos(o.rot)),s=Math.abs(Math.sin(o.rot));return[d.w*c+d.d*s,d.d*c+d.w*s];};
export const localToWorld=(h,x,z)=>({x:h.x+x*Math.cos(h.rot)+z*Math.sin(h.rot),z:h.z-x*Math.sin(h.rot)+z*Math.cos(h.rot)});
export const worldToLocal=(h,x,z)=>({x:(x-h.x)*Math.cos(h.rot)-(z-h.z)*Math.sin(h.rot),z:(x-h.x)*Math.sin(h.rot)+(z-h.z)*Math.cos(h.rot)});
export const entry=o=>localToWorld(o,0,defs[o.kind].d/2+2);
export const ready=o=>!!o&&(!o.phase||o.phase==='built');
export const isGuard=p=>p.role==='guard'||p.role==='ranger';
export const isPlayer=p=>p.source==='rinne-player'||p.source==='local-player-demo';
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function actor(id,name,homeId,x,z,role){return{id,name,homeId,x,z,role,source:role==='mayor'?'avatar-npc':'local-npc',jobId:null,task:'idle',timer:0,path:[],hunger:85,purse:0,health:100,happiness:78,skill:0,seed:role==='mayor'?1:8,angle:0,insideId:null,status:role==='guard'?'村長を見守っています':'新しい村を見渡しています',favorite:role==='mayor'?'焚き火の語らい':'木陰でひと休み',memories:[]};}
export function initial(){return{
 version:VERSION,name:'星継ぎの庭',villageId:'local-hoshitsugi',nextId:4,revision:0,rng:837491,
 objects:[{id:'b1',kind:'mayor',x:-7,z:-5,rot:0,phase:'built',level:1,material:'base',room:[]},{id:'b2',kind:'campfire',x:5,z:8,rot:0,phase:'built',level:1,room:[]},{id:'b3',kind:'guardhome',x:12,z:-7,rot:0,phase:'built',level:1,room:[]}],
 people:[actor('mayor-npc','村長','b1',-5,5,'mayor'),actor('guard-npc','アルド','b3',0,6,'guard')],
 clock:.36,time:8.64,stock:Object.fromEntries(Object.keys(RESOURCE_NAMES).map(k=>[k,0])),known:[],traffic:{},
 settings:{speed:1,tilt:.85,quality:1},stats:{arrivals:0,produced:0,meals:0,purchases:0,furnished:0,ships:0,raids:0,defeated:0,rescues:0,losses:0,upgrades:0,moments:0},
 news:[],moments:[],memorial:[],tutorial:{dismissed:false,completed:false},merchant:{present:false,cycle:-1},voyage:{lastCycle:0,phase:'away',progress:0},seenRaidIds:[],
 defense:{nextRaid:8.5,lastRaid:-100,sequence:0,raid:null,nextWildlife:2.8},wildlife:[],connection:{mode:'local',hostEpoch:0}
};}
export class World{
 constructor(state=initial()){this.state=validate(state);this.history=[];this.future=[];this.listeners=new Set();this.resourceRevision=0;}
 get objects(){return this.state.objects;} get people(){return this.state.people;}
 object(id){return this.objects.find(o=>o.id===id);} list(id=null){return id?this.object(id)?.room||[]:this.objects;}
 random(){let a=this.state.rng|0;a^=a<<13;a^=a>>>17;a^=a<<5;this.state.rng=a>>>0;return(a>>>0)/4294967296;}
 changed(){this.state.revision++;for(const f of this.listeners)f();}
 notify(text,type='life'){this.state.news.unshift({text:String(text).slice(0,250),day:this.state.clock,type});this.state.news=this.state.news.slice(0,80);}
 gain(resource,amount){if(!Object.hasOwn(RESOURCE_NAMES,resource)||!Number.isFinite(amount)||amount<=0)return false;this.state.stock[resource]=Math.min(1e6,this.state.stock[resource]+amount);this.resourceRevision++;if(!this.state.known.includes(resource)){this.state.known.push(resource);this.notify(`${RESOURCE_NAMES[resource]}を初めて手に入れました。新しい暮らしのきっかけです。`,'discovery');}return true;}
 discover(){for(const k of Object.keys(RESOURCE_NAMES))if(this.state.stock[k]>0&&!this.state.known.includes(k)){this.state.known.push(k);this.resourceRevision++;this.notify(`${RESOURCE_NAMES[k]}を手に入れました。`,'discovery');}}
 canAfford(cost){return Object.entries(cost||{}).every(([k,v])=>Object.hasOwn(RESOURCE_NAMES,k)&&Number.isFinite(v)&&v>=0&&this.state.stock[k]>=v);}
 spend(cost){if(!this.canAfford(cost))return false;for(const[k,v]of Object.entries(cost||{}))this.state.stock[k]-=v;this.resourceRevision++;return true;}
 deficit(cost){return Object.entries(cost||{}).filter(([k,v])=>this.state.stock[k]<v).map(([k,v])=>`${RESOURCE_NAMES[k]} ${Math.ceil(v-this.state.stock[k])}`);}
 remember(patch){this.history.push(copy(patch));this.history=this.history.slice(-40);this.future=[];this.changed();}
 population(){
  const buildings=this.objects.filter(ready),general=this.people.filter(p=>!p.dead),dedicated=general.some(p=>p.id==='guard-npc'&&p.health>0);
  let food=6,safety=dedicated?6:3,comfort=0;
  for(const o of buildings){const d=defs[o.kind],level=o.level||1,staff=this.people.filter(p=>p.jobId===o.id&&!p.dead).length;
   if(d.produce?.food)food+=(d.id==='wheat'?4:8)*level;
   if(d.effect==='meal'||d.effect==='feast')food+=2*level;
   if(d.defense){if(staff>0)safety+=d.defense*level;else if(d.effect==='watch')safety+=2*level;}
   if(['comfort','rest','learning'].includes(d.effect))comfort+=2*level;
  }
  // Scattered decorations cannot replace staffed defenses; only those near housing count.
  const homeSites=buildings.filter(o=>capacityOf(o));
  const passive=buildings.filter(o=>defs[o.kind].garden&&defs[o.kind].defense&&homeSites.some(h=>dist(o,h)<25)).reduce((sum,o)=>sum+defs[o.kind].defense,0);
  safety+=Math.min(4,Math.floor(passive));
  const limit=Math.min(MAX_POPULATION,Math.floor(food),Math.floor(safety));
  const beds=this.objects.reduce((n,o)=>n+capacityOf(o),0),openBeds=buildings.reduce((n,o)=>n+capacityOf(o),0);
  return{people:general.length,food:Math.floor(food),safety:Math.floor(safety),limit,beds,openBeds,housingBudget:Math.min(80,limit+4+Math.min(4,comfort)),comfort,reason:limit===Math.floor(safety)?'守りを広げると、次の住人を迎えられます':'畑や食事の場所を増やすと、次の住人を迎えられます'};
 }
 safetyAt(o){const start=this.objects.find(b=>b.kind==='campfire');if(start&&dist(start,o)<36&&this.people.some(p=>p.id==='guard-npc'&&p.health>0))return true;
  return this.objects.some(b=>ready(b)&&defs[b.kind].defense&&dist(b,o)<(defs[b.kind].effect==='watch'?44:38)&&this.people.some(p=>p.jobId===b.id&&isGuard(p)));
 }
 canPlace(kind,x,z,rot=0,roomId=null,ignore=null){
  const d=defs[kind];if(!d||![x,z,rot].every(Number.isFinite))return'配置データが不正です';
  const[w,h]=extent({kind,rot});let bx=LIMIT-.5,bz=LIMIT-.5;
  if(roomId){const host=this.object(roomId);if(!host||!ready(host))return'完成した建物を選んでください';if(!d.furniture)return'室内用の家具を選んでください';bx=defs[host.kind].w/2-.8;bz=defs[host.kind].d/2-.8;}
  else if(!d.building&&!d.garden)return'家具は建物の中に置きます';
  if(Math.abs(x)+w/2>bx||Math.abs(z)+h/2>bz)return roomId?'部屋の外には置けません':'村の範囲を超えています';
  if(!roomId){if(kind==='harbor'){if(x<163||x>170||Math.abs(rot)>.01)return'船着き場は東海岸の岸沿いに置きます';}
   else if([-w/2,0,w/2].some(dx=>[-h/2,0,h/2].some(dz=>inWater(x+dx,z+dz))))return'水の上には置けません';
   const land=terrainError(d.terrain,x,z,this.objects);if(land)return land;
   if(d.capacity&&!d.reserved&&!ignore){const p=this.population();if(p.beds+d.capacity>p.housingBudget)return`いまは住まいに余裕があります。食事と守りを整えると増やせます（寝床 ${p.beds} / 目安 ${p.housingBudget}）`;}
  }
  for(const o of this.list(roomId)){if(o.id===ignore||d.soft||defs[o.kind].soft)continue;const[ow,od]=extent(o);if(Math.abs(o.x-x)<(ow+w)/2+.1&&Math.abs(o.z-z)<(od+h)/2+.1)return'ほかの物と重なっています';}
  if(roomId&&!d.soft&&z+h/2>bz-2&&Math.abs(x)<w/2+1)return'入口を空けてください';
  if(!roomId&&!d.soft)for(const o of this.objects){if(o.id===ignore||!defs[o.kind].building)continue;const e=entry(o);if(Math.abs(e.x-x)<w/2+.7&&Math.abs(e.z-z)<h/2+.7)return'建物の入口を空けてください';}
  return null;
 }
 add(kind,x,z,rot=0,roomId=null,options={}){
  if(!unlocked(this.state,kind,!!roomId))return{error:'まだ利用できません。新しい資源との出会いを待ちましょう'};
  if(kind==='harbor'){x=166;rot=0;}
  const error=this.canPlace(kind,x,z,rot,roomId);if(error)return{error};if(this.objects.length>=2000||this.list(roomId).length>=600)return{error:'配置上限に達しました'};
  const d=defs[kind],variant=Object.hasOwn(MATERIALS,options.material)?options.material:'base',cost=roomId?{}:recipe(kind,variant);
  if(!roomId&&d.variants&&variant!=='base'&&!materialOptions(this.state,kind).some(v=>v.id===variant))return{error:'その建材はまだ見つかっていません'};
  if(!d.building&&!this.canAfford(cost))return{error:'必要な資材：'+this.deficit(cost).join('・')};
  const o={id:(roomId?'f':'b')+this.state.nextId++,kind,x,z,rot,material:variant};
  if(d.building){o.room=[];o.phase=Object.keys(cost).length?'planned':'built';o.progress=0;o.level=1;o.recipe=cost;}else this.spend(cost);
  this.list(roomId).push(o);this.remember({roomId,before:null,after:o,payment:d.building?null:cost});return{ok:true,object:o};
 }
 move(id,x,z,rot,roomId=null){const o=this.list(roomId).find(o=>o.id===id);if(!o)return{error:'選択した物が見つかりません'};if(o.kind==='harbor'){x=166;rot=0;}const error=this.canPlace(o.kind,x,z,rot,roomId,id);if(error)return{error};const before=copy(o);Object.assign(o,{x,z,rot});this.remember({roomId,before,after:o,transform:true});return{ok:true,object:o};}
 remove(id,roomId=null){const l=this.list(roomId),o=l.find(o=>o.id===id);if(!o)return{error:'見つかりません'};if(defs[o.kind].reserved||o.kind==='campfire')return{error:'村のはじまりの住まいと焚き火は残します'};
  if(!roomId&&this.people.some(p=>p.homeId===id))return{error:'住人が暮らしています。先に住み替えてから削除できます'};
  if(o.upgrade)return{error:'増築が終わってから移設・削除してください'};
  const before=copy(o);l.splice(l.indexOf(o),1);for(const p of this.people)if(p.jobId===id){p.jobId=null;p.task='idle';p.path=[];if(p.id!=='guard-npc'&&p.role!=='mayor')p.role='resident';}this.remember({roomId,before,after:null});return{ok:true};
 }
 applyPatch(p,reverse){const from=reverse?p.after:p.before,to=reverse?p.before:p.after,l=this.list(p.roomId),id=(from||to).id,now=l.find(o=>o.id===id);
  if(p.roomId&&!this.object(p.roomId))return{error:'建物がもうありません'};
  if(!to){if(!p.roomId&&this.people.some(n=>n.homeId===id))return{error:'すでに住人が入居したため取り消せません'};if(!now)return{error:'対象が変更されています'};if(now.upgrade)return{error:'増築中は取り消せません'};
   // Keep the current built state and later purchases for redo, never rewind simulation.
   if(reverse)p.after=copy(now);else p.before=copy(now);l.splice(l.indexOf(now),1);if(reverse&&p.payment)for(const[k,n]of Object.entries(p.payment))this.gain(k,n);
  }else if(p.transform&&now){const error=this.canPlace(now.kind,to.x,to.z,to.rot,p.roomId,id);if(error)return{error};Object.assign(now,{x:to.x,z:to.z,rot:to.rot});}
  else if(!now){const error=this.canPlace(to.kind,to.x,to.z,to.rot,p.roomId,'undo-restore');if(error)return{error};if(!reverse&&p.payment&&!this.spend(p.payment))return{error:'やり直すための資材が不足しています'};l.push(copy(to));}
  else return{error:'住民による変更と競合するため取り消せません'};
  this.changed();return{ok:true};
 }
 undo(){const p=this.history.at(-1);if(!p)return{error:'取り消す操作がありません'};const r=this.applyPatch(p,true);if(r.ok){this.history.pop();this.future.push(p);}return r;}
 redo(){const p=this.future.at(-1);if(!p)return{error:'やり直す操作がありません'};const r=this.applyPatch(p,false);if(r.ok){this.future.pop();this.history.push(p);}return r;}
 assign(personId,homeId){const p=this.people.find(p=>p.id===personId),h=this.object(homeId),d=h&&defs[h.kind];if(!p||!h||!ready(h)||d.reserved||!d.capacity)return{error:'空き住まいを選んでください'};
  if(['mayor','guard-npc'].includes(p.role)||p.id==='guard-npc')return{error:'村長と専属護衛は、それぞれの住まいを使います'};
  if(d.clanOnly&&!isPlayer(p))return{error:'この邸宅は一族プレイヤー専用です'};
  if(isPlayer(p)&&!d.clanOnly)return{error:'一族プレイヤーには専用の邸宅を用意してください'};
  if(this.people.filter(n=>n.id!==personId&&n.homeId===homeId).length>=capacityOf(h))return{error:'満室です'};
  p.homeId=homeId;p.task='idle';p.path=[];this.changed();return{ok:true};
 }
 missing(o){return this.deficit(o.recipe||recipe(o.kind,o.material));}
 upgradeCost(o){const level=o.level||1,base=recipe(o.kind,o.material);if(!Object.keys(base).length)return{wood:10*level,stone:5*level};return Object.fromEntries(Object.entries(base).map(([k,n])=>[k,Math.max(1,Math.ceil(n*(.65+level*.2)))]));}
 upgrade(id){const o=this.object(id);if(!o||!defs[o.kind].building||!ready(o)||o.kind==='campfire')return{error:'完成した施設を選んでください'};if((o.level||1)>=3)return{error:'増築は3段階までです'};if(o.upgrade)return{error:'すでに増築中です'};
  const cost=this.upgradeCost(o);if(!this.spend(cost))return{error:'必要な資材：'+this.deficit(cost).join('・')};o.upgrade={target:(o.level||1)+1,progress:0,cost};this.changed();this.notify(`${defs[o.kind].label}の増築が始まりました`,'construction');return{ok:true,object:o};
 }
 furnish(person,kind){const h=this.object(person.homeId);if(!h||!ready(h)||!defs[kind]?.furniture)return false;
  for(let z=-defs[h.kind].d/2+2;z<defs[h.kind].d/2-2;z+=1.25)for(let x=-defs[h.kind].w/2+1.8;x<defs[h.kind].w/2-1.2;x+=1.25){if(this.canPlace(kind,x,z,0,h.id))continue;h.room.push({id:'f'+this.state.nextId++,kind,x,z,rot:0,ownerId:person.id});this.state.stats.furnished++;this.changed();return true;}return false;
 }
 tutorialStep(){if(this.state.tutorial.dismissed||this.state.tutorial.completed)return null;const index=TUTORIAL.findIndex(t=>!this.objects.some(o=>o.kind===t.kind&&ready(o)));if(index<0){this.state.tutorial.completed=true;return null;}return{...TUTORIAL[index],index};}
 export(){return JSON.stringify(this.state,null,2);}
 load(text){try{const next=validate(JSON.parse(text));this.state=next;this.history=[];this.future=[];this.resourceRevision++;this.changed();return{ok:true};}catch(e){return{error:'読み込めません: '+e.message};}}
}
function migrate(input){
 const s=copy(input);if(s.version!==4)return s;
 s.version=VERSION;s.known=Object.keys(s.stock||{}).filter(k=>s.stock[k]>0);for(const k of Object.keys(RESOURCE_NAMES))s.stock[k]??=0;
 const used=new Set(s.objects.map(o=>o.id));let n=Math.max(4,s.nextId||4);while(used.has('b'+n))n++;
 if(!s.objects.some(o=>o.kind==='guardhome')){const mayor=s.objects.find(o=>o.kind==='mayor')||s.objects[0];let pos=null;for(let r=18;r<150&&!pos;r+=12)for(let a=0;a<6.28;a+=.4){const x=mayor.x+Math.cos(a)*r,z=mayor.z+Math.sin(a)*r;if(Math.abs(x)>230||Math.abs(z)>230||inWater(x,z,6))continue;if(s.objects.every(o=>Math.abs(o.x-x)>(defs[o.kind]?.w||4)/2+6||Math.abs(o.z-z)>(defs[o.kind]?.d||4)/2+7)){pos={x,z};break;}}
  if(!pos)throw Error('専属護衛の住まいを追加できる空地がありません');s.objects.push({id:'b'+n++,kind:'guardhome',...pos,rot:0,phase:'built',level:1,room:[]});}
 const mayor=s.objects.find(o=>o.kind==='mayor'),guard=s.objects.find(o=>o.kind==='guardhome');
 if(mayor&&!s.people.some(p=>p.role==='mayor'))s.people.push(actor('mayor-npc','村長',mayor.id,entry(mayor).x,entry(mayor).z,'mayor'));
 if(!s.people.some(p=>p.id==='guard-npc'))s.people.push(actor('guard-npc','アルド',guard.id,entry(guard).x,entry(guard).z,'guard'));
 s.nextId=n;s.defense={...initial().defense,nextRaid:s.clock+8};s.tutorial={dismissed:s.people.length>2,completed:false};return s;
}
export function validate(input){
 if(!input||![4,VERSION].includes(input.version))throw Error('暮らし版 v4 / v5 の保存データを選んでください');
 if(!Array.isArray(input.objects)||input.objects.length>2000||!Array.isArray(input.people)||input.people.length>100)throw Error('村のデータ形式が不正です');
 const s=migrate(input),defaults=initial(),ids=new Set(),finite=v=>typeof v==='number'&&Number.isFinite(v);
 const check=(o,host=null)=>{if(!o||!Object.hasOwn(defs,o.kind)||typeof o.id!=='string'||o.id.length>60||ids.has(o.id)||![o.x,o.z,o.rot].every(finite))throw Error('配置データが不正です');ids.add(o.id);
  if(Math.abs(o.x)>LIMIT||Math.abs(o.z)>LIMIT)throw Error('配置が村の範囲外です');if(host&&!defs[o.kind].furniture)throw Error('室内の配置が不正です');
  if(!host&&defs[o.kind].building){if(!Array.isArray(o.room)||o.room.length>600||!['planned','building','built'].includes(o.phase))throw Error('建物の情報が不正です');o.level=clamp(Math.floor(Number(o.level)||1),1,3);o.material=Object.hasOwn(MATERIALS,o.material)?o.material:'base';o.progress=clamp(Number(o.progress)||0,0,1);o.recipe=recipe(o.kind,o.material);
   if(o.upgrade){if(!finite(o.upgrade.progress)||o.upgrade.progress<0||o.upgrade.progress>1||o.upgrade.target!==o.level+1||o.level>=3)throw Error('増築データが不正です');}o.room.forEach(f=>check(f,o));}};
 s.objects.forEach(o=>check(o));if(!s.objects.some(o=>o.kind==='campfire')||!s.objects.some(o=>o.kind==='mayor')||!s.objects.some(o=>o.kind==='guardhome'))throw Error('村のはじまりの施設がありません');
 for(const p of s.people){if(!p||typeof p.id!=='string'||p.id.length>80||ids.has(p.id)||typeof p.name!=='string'||p.name.length>40||![p.x,p.z].every(finite)||Math.abs(p.x)>LIMIT||Math.abs(p.z)>LIMIT||!s.objects.some(o=>o.id===p.homeId&&defs[o.kind].capacity))throw Error('住人の情報が不正です');ids.add(p.id);p.path=[];p.task='idle';p.timer=0;p.insideId=null;p.role=p.role||'resident';delete p.jobAssignedAt;delete p.snackUntil;delete p.attackPulse;
  if(!['mayor','guard','ranger','resident','player'].includes(p.role))throw Error('役割が不正です');
  if(!['local-npc','avatar-npc','local-player-demo','rinne-player'].includes(p.source))p.source='local-npc';
  if(defs[s.objects.find(o=>o.id===p.homeId).kind].clanOnly&&!isPlayer(p))throw Error('一族専用の住まいにNPCは入居できません');
  for(const[k,v]of Object.entries({hunger:80,purse:0,health:100,happiness:70,skill:0}))p[k]=finite(p[k])?clamp(p[k],0,k==='purse'?200:100):v;
  if(p.downed&&(!finite(p.downed.left)||p.downed.left<=0||p.downed.left>90||!['wildlife','monster'].includes(p.downed.source)))throw Error('負傷者の情報が不正です');
  if(p.carry&&!FURNITURE.some(f=>f.id===p.carry))p.carry=null;p.memories=(Array.isArray(p.memories)?p.memories:[]).filter(n=>typeof n.text==='string').slice(0,6);p.bubble=null;
 }
 if(!finite(s.clock)||s.clock<0||s.clock>1e8)throw Error('世界時計が不正です');
 if(!s.stock||Object.keys(RESOURCE_NAMES).some(k=>!finite(s.stock[k])||s.stock[k]<0||s.stock[k]>1e7))throw Error('資材の情報が不正です');
 if(!s.traffic||Object.keys(s.traffic).length>70000)throw Error('動線の情報が不正です');for(const[k,v]of Object.entries(s.traffic))if(!/^-?\d+,-?\d+$/.test(k)||!finite(v)||v<0||v>100)throw Error('道の情報が不正です');
 s.known=[...new Set([...(Array.isArray(s.known)?s.known:[]),...Object.keys(s.stock).filter(k=>s.stock[k]>0)])].filter(k=>Object.hasOwn(RESOURCE_NAMES,k));
 s.nextId=Math.max(Number.isInteger(s.nextId)?s.nextId:4,...[...ids].map(x=>Number(x.match(/\d+$/)?.[0]||0)+1));s.revision=0;s.rng=Number.isInteger(s.rng)?s.rng>>>0:defaults.rng;
 s.settings={speed:[0,1,5,20].includes(s.settings?.speed)?s.settings.speed:1,tilt:clamp(Number(s.settings?.tilt)||.85,.2,1.6),quality:s.settings?.quality===.65?.65:1};
 s.stats=Object.fromEntries(Object.entries(defaults.stats).map(([k,v])=>[k,finite(s.stats?.[k])?clamp(s.stats[k],0,1e9):v]));
 s.news=(Array.isArray(s.news)?s.news:[]).filter(n=>typeof n.text==='string'&&n.text.length<300&&finite(n.day)).slice(0,80);
 s.moments=(Array.isArray(s.moments)?s.moments:[]).filter(n=>typeof n.text==='string').slice(0,12);s.memorial=(Array.isArray(s.memorial)?s.memorial:[]).slice(-100);
 s.tutorial={dismissed:!!s.tutorial?.dismissed,completed:!!s.tutorial?.completed};s.merchant={present:false,cycle:-1};
 s.voyage={lastCycle:Math.floor(s.clock/(DAYS_YEAR*5)),phase:'away',progress:0,...s.voyage};if(!['away','arriving','docked','departing'].includes(s.voyage.phase)||!finite(s.voyage.progress)||s.voyage.progress<0||!finite(s.voyage.lastCycle))throw Error('航路の情報が不正です');
 s.defense={...defaults.defense,nextRaid:s.clock+8,...s.defense};for(const k of ['nextRaid','lastRaid','sequence','nextWildlife'])if(!finite(s.defense[k]))throw Error('襲撃時刻が不正です');
 const validateThreat=t=>{if(!t||typeof t.id!=='string'||![t.x,t.z,t.health].every(finite)||Math.abs(t.x)>270||Math.abs(t.z)>270||t.health<0||t.health>1e5)throw Error('脅威の情報が不正です');if(t.damage!==undefined&&(!finite(t.damage)||t.damage<0||t.damage>1000))throw Error('脅威の攻撃力が不正です');if(t.speed!==undefined&&(!finite(t.speed)||t.speed<0||t.speed>30))throw Error('脅威の速度が不正です');t.path=[];t.repath=0;};
 if(s.defense.raid){const r=s.defense.raid;if(!['warning','active'].includes(r.phase)||!finite(r.startDay)||!finite(r.age)||!Array.isArray(r.monsters)||r.monsters.length>24)throw Error('襲撃情報が不正です');if(!r.budget||!['count','health','damage','speed'].every(k=>finite(r.budget[k])&&r.budget[k]>=0))throw Error('襲撃の強さが不正です');r.monsters.forEach(validateThreat);}
 s.wildlife=Array.isArray(s.wildlife)?s.wildlife:[];if(s.wildlife.length>30)throw Error('野生動物が多すぎます');s.wildlife.forEach(validateThreat);
 s.connection={mode:'local',hostEpoch:0};s.time=(s.clock%1)*24;return s;
}
