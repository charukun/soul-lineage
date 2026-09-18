import {defs,RESOURCE_NAMES,DAYS_YEAR,ready,capacityOf,entry} from './game/core.js';
import {decayTrailTraffic} from './game/trail-lifecycle.js';
import {advanceVirtualCohorts,normalizeVirtualCohorts,planDemographicYear,recordDemographyHistory} from './game/demography.js';
import {ensureResidentAge,residentAgeYears,residentLifeStage} from './resident-aging.js';
import {t,exposeI18n} from './mura-i18n.js';

const village=window.village;
if(!village)throw new Error('MURAAAAAAA world systems require a booted village');
const {world,sim,save}=village;
exposeI18n();

const ACTIVE_DETAIL_LIMIT=96;
const POPULATION_CAP=1000;
const INITIAL_KINDS=new Set(['mayor','campfire','guardhome','storage']);
const RESOURCE_WEIGHT={wood:3.8,stone:5.2,plank:2.4,clay:3.2,food:.7,seed:.08,herb:.15,ore:4.8,metal:5.5,cloth:.4,leather:1.1,medicine:.25,knowledge:.05,crystal:1.6,charm:.35,gear:6.5,furnishing:8};
const FURNITURE_WEIGHT={chair:7,bench:18,table:22,bed:28,shelf:24,counter:30,workbench:38,hearth:46,rug:6,plant:10,lamp:4,sofa:42,dirtbed:18};
const TRAITS=['strong','nimble','sturdy','gentle'];
const BIRTH_NAMES=['ヒナ','ユイ','レン','マオ','コト','イオ','スイ','リツ','ナナ','トキ','ユラ','アサ','ミツ','サク','フウ','エナ'];

function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function systems(){
 const s=world.state,year=Math.floor(s.clock/DAYS_YEAR);
 s.muraSystems??={version:3,virtualResidents:0,virtualCohorts:{child:0,youth:0,adult:0,elder:0},lastLifecycleDay:Math.floor(s.clock),lastVirtualYear:year,storageV2:false};
 s.muraSystems.version=3;
 s.muraSystems.lastLifecycleDay=Number.isFinite(s.muraSystems.lastLifecycleDay)?Math.floor(s.muraSystems.lastLifecycleDay):Math.floor(s.clock);
 s.muraSystems.lastVirtualYear=Number.isFinite(s.muraSystems.lastVirtualYear)?Math.floor(s.muraSystems.lastVirtualYear):year;
 s.muraSystems.virtualResidents=Math.max(0,Math.floor(s.muraSystems.virtualResidents||0));
 s.muraSystems.virtualCohorts=normalizeVirtualCohorts(s.muraSystems.virtualCohorts,s.muraSystems.virtualResidents);
 s.muraSystems.virtualResidents=s.muraSystems.virtualCohorts.child+s.muraSystems.virtualCohorts.youth+s.muraSystems.virtualCohorts.adult+s.muraSystems.virtualCohorts.elder;
 s.muraSystems.demography??={birthCarry:0,lastProcessedYear:year,immigrationYear:year,immigrationCount:0,totalBirths:0,totalDeaths:0,totalDepartures:0,counters:{births:0,deaths:0,departures:0},history:[]};
 const d=s.muraSystems.demography;d.birthCarry=Math.max(0,Math.min(.999999,Number(d.birthCarry)||0));d.lastProcessedYear=Number.isFinite(d.lastProcessedYear)?Math.floor(d.lastProcessedYear):year;d.immigrationYear=Number.isFinite(d.immigrationYear)?Math.floor(d.immigrationYear):year;d.immigrationCount=Math.max(0,Math.floor(d.immigrationCount||0));d.totalBirths=Math.max(0,Math.floor(d.totalBirths||0));d.totalDeaths=Math.max(0,Math.floor(d.totalDeaths||0));d.totalDepartures=Math.max(0,Math.floor(d.totalDepartures||0));d.counters={births:Math.max(0,Math.floor(d.counters?.births||0)),deaths:Math.max(0,Math.floor(d.counters?.deaths||0)),departures:Math.max(0,Math.floor(d.counters?.departures||0))};d.history=Array.isArray(d.history)?d.history:[];
 return s.muraSystems;
}
const systemState=systems();

function traitFor(p){return p.trait||TRAITS[hash(p.id)%TRAITS.length];}
function ensureProfile(p){
 if(!p)return p;
 ensureResidentAge(p,world.state.clock,{existing:true});
 if(!Number.isFinite(p.birthClock))p.birthClock=world.state.clock-residentAgeYears(p,world.state.clock)*DAYS_YEAR;
 p.trait=traitFor(p);
 p.inventory??={};
 p.profileVersion=3;
 return p;
}
for(const p of world.people)ensureProfile(p);

function ageYears(p){ensureProfile(p);return residentAgeYears(p,world.state.clock);}
function lifeStage(p){const stage=residentLifeStage(ageYears(p)).id;return stage==='youth'?'young':stage;}
function carryLimit(p){
 const age=ageYears(p),ageFactor=age<12?.42:age<18?.68:age<=42?1:age<=60?.9:age<=72?.72:.52;
 const traitFactor={strong:1.3,nimble:1.08,sturdy:1.15,gentle:.94}[traitFor(p)]||1;
 return Math.round(24*ageFactor*traitFactor*10)/10;
}
function carryWeight(p){
 let weight=0;
 for(const [key,count] of Object.entries(p.inventory||{}))weight+=(RESOURCE_WEIGHT[key]||1)*Math.max(0,Number(count)||0);
 if(p.carry)weight+=FURNITURE_WEIGHT[p.carry]||Math.max(4,((defs[p.carry]?.w||1)*(defs[p.carry]?.d||1))*1.6);
 return Math.round(weight*10)/10;
}
function canCarry(p,extraKg=0){return carryWeight(p)+extraKg<=carryLimit(p)+.001;}

function ensureStorage(){
 defs.storage.trait='村全体で共有する特別な資材庫。容量は無制限で、移動しても中身は失われません。';
 defs.storage.jobs=0;
 let storage=world.objects.find(o=>o.kind==='storage');
 if(!storage){
  storage={id:'b'+world.state.nextId++,kind:'storage',x:-18,z:8,rot:-.12,phase:'built',progress:1,level:1,material:'base',recipe:{},room:[],systemStorage:true,builtDay:world.state.clock};
  world.objects.push(storage);world.changed();save();
 }
 storage.systemStorage=true;systemState.storageV2=true;
 return storage;
}
ensureStorage();

const originalAdd=world.add.bind(world);
world.add=(kind,x,z,rot=0,roomId=null,options={})=>{
 if(kind==='storage'&&!roomId&&world.objects.some(o=>o.kind==='storage'))return{error:t('storageUnique')};
 return originalAdd(kind,x,z,rot,roomId,options);
};
const originalRemove=world.remove.bind(world);
world.remove=(id,roomId=null)=>{
 const object=world.list(roomId).find(o=>o.id===id);
 if(!roomId&&object?.kind==='storage')return{error:t('storageFixed')};
 return originalRemove(id,roomId);
};

// One shared storehouse is intentionally unlimited. Resource values remain in world.state.stock,
// so moving the physical storehouse never touches or risks its contents.
sim.capacity=()=>Number.MAX_SAFE_INTEGER;

const originalPopulation=world.population.bind(world);
world.population=()=>{
 const base=originalPopulation(),virtual=Math.max(0,systemState.virtualResidents||0),active=world.people.filter(p=>!p.dead).length,total=active+virtual;
 const infrastructureLimit=Math.max(2,Math.min(POPULATION_CAP,Math.floor(base.food),Math.floor(base.safety)));
 return{...base,people:total,activePeople:active,virtualPeople:virtual,limit:infrastructureLimit,housingBudget:Math.min(POPULATION_CAP,Math.max(base.housingBudget,infrastructureLimit+8))};
};

function noteDemography(kind,count=1){
 const d=systemState.demography,n=Math.max(0,Math.floor(Number(count)||0));if(!n||!Object.hasOwn(d.counters,kind))return;
 d.counters[kind]+=n;if(kind==='births')d.totalBirths+=n;else if(kind==='deaths')d.totalDeaths+=n;else if(kind==='departures')d.totalDepartures+=n;
}
function cohortCounts(){
 const active={children:0,youth:0,adults:0,elders:0};
 for(const p of world.people.filter(p=>!p.dead)){
  if(p.source==='rinne-player'||p.source==='local-player-demo'){active.adults++;continue;}
  const stage=residentLifeStage(ageYears(p)).id;if(stage==='child')active.children++;else if(stage==='youth')active.youth++;else if(stage==='elder')active.elders++;else active.adults++;
 }
 const c=normalizeVirtualCohorts(systemState.virtualCohorts,systemState.virtualResidents);
 return{children:active.children+c.child,youth:active.youth+c.youth,adults:active.adults+c.adult,elders:active.elders+c.elder};
}
function recordDemographySnapshot(yearIndex=Math.floor(world.state.clock/DAYS_YEAR)){
 const d=systemState.demography,c=cohortCounts(),population=world.population().people;
 d.history=recordDemographyHistory(d.history,{year:yearIndex+1,population,births:d.counters.births,deaths:d.counters.deaths,departures:d.counters.departures,children:c.children,youth:c.youth,adults:c.adults,elders:c.elders});
}
function resetYearCounters(){systemState.demography.counters={births:0,deaths:0,departures:0};}

const originalArrive=sim.arrive.bind(sim);
sim.arrive=()=>{
 const pop=world.population(),year=Math.floor(world.state.clock/DAYS_YEAR),d=systemState.demography;
 if(d.immigrationYear!==year){d.immigrationYear=year;d.immigrationCount=0;}
 const quota=pop.people<6?3:1;
 if(d.immigrationCount>=quota||pop.people>=pop.limit||sim.raid)return false;
 if(world.people.length<ACTIVE_DETAIL_LIMIT){const p=originalArrive();if(p){ensureProfile(p);d.immigrationCount++;recordDemographySnapshot(year);}return p;}
 if(pop.openBeds<=pop.people)return false;
 systemState.virtualResidents++;
 systemState.virtualCohorts.adult=(systemState.virtualCohorts.adult||0)+1;
 world.state.stats.arrivals++;d.immigrationCount++;
 sim.emit(t('virtualArrival'),'arrival');world.changed();recordDemographySnapshot(year);return{virtual:true};
};

function durationFor(o){
 const d=defs[o.kind]||{},area=(d.w||8)*(d.d||8),builtCount=world.objects.filter(x=>ready(x)&&defs[x.kind]?.building&&!INITIAL_KINDS.has(x.kind)).length;
 if(builtCount<5)return 1.4+Math.min(3,area/90);
 if(['harbor','clanManor'].includes(o.kind))return 7200;
 if(['chapel','barracks','restaurant'].includes(o.kind))return 3600;
 if(area>=320)return 900;
 if(area>=220)return 300;
 if(area>=140)return 90;
 return 18+area*.12;
}
function workerFactor(){const healthy=world.people.filter(p=>!p.downed&&ageYears(p)>=16).length;return 1+Math.min(5,Math.floor(healthy/12));}
function constructionLabel(seconds){if(seconds>=3600)return`${(seconds/3600).toFixed(seconds>=7200?0:1)}時間`;if(seconds>=60)return`${Math.ceil(seconds/60)}分`;return`${Math.ceil(seconds)}秒`;}

sim.construction=dt=>{
 let changed=false;const w=world,s=w.state,workers=workerFactor();
 for(const o of w.objects){
  if(o.phase==='planned'&&w.people.length&&w.spend(o.recipe||defs[o.kind].cost)){
   o.phase='building';o.progress=0;o.buildElapsed=0;o.buildDuration=durationFor(o);o.startedDay=s.clock;changed=true;sim.emit(`${defs[o.kind].label}の建築が始まりました（目安 ${constructionLabel(o.buildDuration/workers)}）`,'construction');
  }
  if(o.phase==='building'){
   o.buildDuration=Number.isFinite(o.buildDuration)?o.buildDuration:durationFor(o);o.buildElapsed=(o.buildElapsed||o.progress*o.buildDuration)+dt*workers;o.progress=Math.min(1,o.buildElapsed/o.buildDuration);
   if(o.progress>=1){o.phase='built';o.progress=1;o.builtDay=s.clock;changed=true;sim.emit(`${defs[o.kind].label}が完成しました`,'construction');}
  }
  if(o.upgrade){
   const duration=Math.max(120,(o.buildDuration||durationFor(o))*.65);o.upgrade.progress=Math.min(1,o.upgrade.progress+dt*workers/duration);
   if(o.upgrade.progress>=1){o.level=o.upgrade.target;delete o.upgrade;s.stats.upgrades++;changed=true;sim.emit(`${defs[o.kind].label}が${o.level}段階目になりました`,'construction');}
  }
 }
 if(changed)w.changed();
};

const originalFinish=sim.finish.bind(sim);
sim.finish=p=>{
 const before=p?.carry,result=originalFinish(p);if(!p)return result;ensureProfile(p);
 if(p.carry&&p.carry!==before&&!canCarry(p)){
  const item=p.carry;p.carry=null;p.purse=Math.min(200,(p.purse||0)+10);p.status=t('carryTooHeavy');sim.emit(`${p.name}: ${defs[item]?.label||item}は重すぎて持ち帰れませんでした`,'life');
 }
 return result;
};

function activeAging(){
 for(const p of [...world.people]){
  ensureProfile(p);const age=ageYears(p);p.ageYears=age;p.lifeStage=lifeStage(p);p.carryLimitKg=carryLimit(p);p.carryWeightKg=carryWeight(p);
  if(p.role==='mayor'||p.source==='rinne-player'||p.source==='local-player-demo'||p.downed||age<72)continue;
  const deathChance=Math.min(.04,Math.max(0,(age-72)*.0015));
  if(world.random()>=deathChance)continue;
  world.state.memorial.push({id:p.id,name:p.name,day:world.state.clock,reason:'old_age',age:Math.floor(age)});world.state.stats.losses++;noteDemography('deaths');
  world.people.splice(world.people.indexOf(p),1);sim.emit(t('agingDeath',{name:p.name}),'loss');world.changed();
 }
}
function virtualAging(){
 const result=advanceVirtualCohorts(systemState.virtualCohorts);systemState.virtualCohorts=result.cohorts;systemState.virtualResidents=result.cohorts.child+result.cohorts.youth+result.cohorts.adult+result.cohorts.elder;
 if(result.deaths>0){world.state.stats.losses+=result.deaths;noteDemography('deaths',result.deaths);sim.emit(t('virtualDeath',{count:result.deaths}),'loss');}
}
function removeVirtualResidents(count){
 let left=Math.max(0,Math.floor(count||0)),removed=0;const c=systemState.virtualCohorts;
 for(const key of ['adult','youth','child','elder']){const take=Math.min(left,Math.max(0,Math.floor(c[key]||0)));c[key]-=take;left-=take;removed+=take;if(!left)break;}
 systemState.virtualResidents=Math.max(0,c.child+c.youth+c.adult+c.elder);return removed;
}
function removeResidents(count,reason='生活基盤が足りず'){let left=Math.max(0,Math.floor(count||0)),removed=removeVirtualResidents(left);left-=removed;
 if(left>0){const candidates=world.people.filter(p=>p.role!=='mayor'&&p.id!=='guard-npc'&&p.source!=='rinne-player'&&p.source!=='local-player-demo'&&!p.dead).sort((a,b)=>(a.happiness??70)-(b.happiness??70)||ageYears(b)-ageYears(a));
  for(const p of candidates.slice(0,left)){world.people.splice(world.people.indexOf(p),1);removed++;sim.emit(`${p.name}は${reason}、村を離れました`,'life');}}
 if(removed){noteDemography('departures',removed);world.changed();}return removed;
}
function virtualUpkeep(){
 const n=systemState.virtualResidents||0;if(!n)return;
 const food=Math.max(1,Math.ceil(n/28));if(!world.spend({food})){
  const leaving=Math.min(n,Math.max(1,Math.ceil(n*.012))),removed=removeVirtualResidents(leaving);if(removed){noteDemography('departures',removed);sim.emit(`食料不足で${removed}人が村を離れました`,'life');world.changed();}
 }
}
function eligibleParents(){return world.people.filter(p=>p.role!=='mayor'&&p.id!=='guard-npc'&&p.source!=='rinne-player'&&p.source!=='local-player-demo'&&!p.dead&&!p.downed&&ageYears(p)>=20&&ageYears(p)<=44);}
function detailedBirth(index){
 const parents=eligibleParents();if(parents.length<2||world.people.length>=ACTIVE_DETAIL_LIMIT)return false;
 const homes=world.objects.filter(o=>ready(o)&&capacityOf(o)&&!defs[o.kind].reserved&&!defs[o.kind].clanOnly&&world.safetyAt(o)&&world.people.filter(p=>p.homeId===o.id&&!p.dead).length<capacityOf(o));if(!homes.length)return false;
 const primary=parents.find(p=>homes.some(h=>h.id===p.homeId))||parents[0],home=homes.find(h=>h.id===primary.homeId)||homes[Math.floor(world.random()*homes.length)],secondary=parents.filter(p=>p.id!==primary.id).sort((a,b)=>Math.hypot(a.x-primary.x,a.z-primary.z)-Math.hypot(b.x-primary.x,b.z-primary.z))[0];if(!secondary)return false;
 const e=entry(home),base=BIRTH_NAMES[index%BIRTH_NAMES.length],name=index<BIRTH_NAMES.length?base:`${base} ${1+Math.floor(index/BIRTH_NAMES.length)}`;
 const child={id:'npc'+world.state.nextId++,name,source:'local-npc',role:'resident',homeId:home.id,jobId:null,x:e.x,z:e.z,task:'idle',timer:2,path:[],hunger:90,purse:0,health:100,happiness:86,skill:0,seed:world.random()*20,angle:0,hidden:false,favorite:'家族と過ごす',memories:[],ageBaseYears:0,ageAnchorDay:world.state.clock,birthClock:world.state.clock,ageStage:'child',parentIds:[primary.id,secondary.id]};
 world.people.push(child);ensureProfile(child);sim.remember?.(child,`${primary.name}たちの家族として生まれた`,'おぎゃあ');sim.emit(`${name}が${defs[home.kind].label}の家族に生まれました`,'life');world.changed();return true;
}
function addBirths(count){let births=0;for(let i=0;i<count;i++){const index=systemState.demography.totalBirths+births;if(detailedBirth(index))births++;else{systemState.virtualCohorts.child=(systemState.virtualCohorts.child||0)+1;systemState.virtualResidents++;births++;}}if(births)noteDemography('births',births);return births;}
function demographicYear(){
 const pop=world.population(),parents=eligibleParents().length+Math.floor((systemState.virtualCohorts.adult||0)*.55),plan=planDemographicYear({population:pop.people,limit:pop.limit,openBeds:pop.openBeds,eligibleAdults:parents,comfort:pop.comfort,foodStock:world.state.stock.food,birthCarry:systemState.demography.birthCarry,protectedResidents:2});
 systemState.demography.birthCarry=plan.birthCarry;if(plan.departures)removeResidents(plan.departures,'食料や守りに余裕がなく');if(plan.births)addBirths(plan.births);
}

recordDemographySnapshot();
const originalStep=sim.step.bind(sim);
sim.step=dt=>{
 const beforeClock=world.state.clock;
 // Retire the legacy wall-clock trail decay; roads now age only when village time advances.
 sim.decayTimer=0;
 const result=originalStep(dt),elapsedVillageDays=Math.max(0,world.state.clock-beforeClock),day=Math.floor(world.state.clock),year=Math.floor(world.state.clock/DAYS_YEAR);
 if(decayTrailTraffic(world.state.traffic,elapsedVillageDays))sim.trafficRevision++;
 if(day!==systemState.lastLifecycleDay){
  const previousYear=systemState.lastVirtualYear;systemState.lastLifecycleDay=day;
  if(year!==previousYear){recordDemographySnapshot(previousYear);resetYearCounters();virtualAging();demographicYear();systemState.lastVirtualYear=year;systemState.demography.lastProcessedYear=year;}
  activeAging();virtualUpkeep();recordDemographySnapshot(year);save();
 }
 return result;
};

window.__MURA_SYSTEMS__={version:3,ACTIVE_DETAIL_LIMIT,POPULATION_CAP,RESOURCE_WEIGHT,FURNITURE_WEIGHT,ageYears,lifeStage,traitFor,carryLimit,carryWeight,canCarry,constructionLabel,durationFor,cohortCounts,recordDemographySnapshot,systems:()=>systemState};
