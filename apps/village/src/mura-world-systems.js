import {defs,RESOURCE_NAMES,DAYS_YEAR,ready,capacityOf} from './game/core.js';
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

function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function systems(){
 const s=world.state;
 s.muraSystems??={version:2,virtualResidents:0,virtualCohorts:{adult:0,elder:0},lastLifecycleDay:Math.floor(s.clock),lastVirtualYear:Math.floor(s.clock/DAYS_YEAR),storageV2:false};
 s.muraSystems.virtualResidents=Math.max(0,Math.floor(s.muraSystems.virtualResidents||0));
 s.muraSystems.virtualCohorts??={adult:s.muraSystems.virtualResidents,elder:0};
 return s.muraSystems;
}
const systemState=systems();

function traitFor(p){return p.trait||TRAITS[hash(p.id)%TRAITS.length];}
function ensureProfile(p){
 if(!p)return p;
 if(!Number.isFinite(p.birthClock)){
  const base=p.role==='mayor'?34:p.id==='guard-npc'?29:18+(hash(p.id+'age')%4300)/100;
  p.birthClock=world.state.clock-base*DAYS_YEAR;
 }
 p.trait=traitFor(p);
 p.inventory??={};
 p.profileVersion=2;
 return p;
}
for(const p of world.people)ensureProfile(p);

function ageYears(p){ensureProfile(p);return Math.max(0,(world.state.clock-p.birthClock)/DAYS_YEAR);}
function lifeStage(p){const age=ageYears(p);return age<14?'child':age<28?'young':age<62?'adult':'elder';}
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

const originalArrive=sim.arrive.bind(sim);
sim.arrive=()=>{
 const pop=world.population();if(pop.people>=pop.limit||sim.raid)return false;
 if(world.people.length<ACTIVE_DETAIL_LIMIT){const p=originalArrive();if(p)ensureProfile(p);return p;}
 if(pop.openBeds<=pop.people)return false;
 systemState.virtualResidents++;
 systemState.virtualCohorts.adult=(systemState.virtualCohorts.adult||0)+1;
 world.state.stats.arrivals++;
 sim.emit(t('virtualArrival'),'arrival');world.changed();return{virtual:true};
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
function workerFactor(){const healthy=world.people.filter(p=>!p.downed&&ageYears(p)>=12).length;return 1+Math.min(5,Math.floor(healthy/12));}
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
  world.state.memorial.push({id:p.id,name:p.name,day:world.state.clock,reason:'old_age',age:Math.floor(age)});world.state.stats.losses++;
  world.people.splice(world.people.indexOf(p),1);sim.emit(t('agingDeath',{name:p.name}),'loss');world.changed();
 }
}
function virtualAging(year){
 const cohorts=systemState.virtualCohorts,adult=Math.max(0,cohorts.adult||0),elder=Math.max(0,cohorts.elder||0),toElder=Math.min(adult,Math.floor(adult*.028)),deaths=Math.min(elder,Math.floor(elder*.085));
 cohorts.adult=adult-toElder;cohorts.elder=elder+toElder-deaths;systemState.virtualResidents=Math.max(0,cohorts.adult+cohorts.elder);
 if(deaths>0){world.state.stats.losses+=deaths;sim.emit(t('virtualDeath',{count:deaths}),'loss');}
 systemState.lastVirtualYear=year;
}
function virtualUpkeep(){
 const n=systemState.virtualResidents||0;if(!n)return;
 const food=Math.max(1,Math.ceil(n/28));if(!world.spend({food})){
  const leaving=Math.min(n,Math.max(1,Math.ceil(n*.012)));systemState.virtualResidents-=leaving;
  const takeAdult=Math.min(systemState.virtualCohorts.adult||0,leaving);systemState.virtualCohorts.adult-=takeAdult;systemState.virtualCohorts.elder=Math.max(0,(systemState.virtualCohorts.elder||0)-(leaving-takeAdult));
  sim.emit(`食料不足で${leaving}人が村を離れました`,'life');
 }
}

const originalStep=sim.step.bind(sim);
sim.step=dt=>{
 const result=originalStep(dt),day=Math.floor(world.state.clock),year=Math.floor(world.state.clock/DAYS_YEAR);
 if(day!==systemState.lastLifecycleDay){systemState.lastLifecycleDay=day;activeAging();virtualUpkeep();if(year!==systemState.lastVirtualYear)virtualAging(year);save();}
 return result;
};

window.__MURA_SYSTEMS__={version:2,ACTIVE_DETAIL_LIMIT,POPULATION_CAP,RESOURCE_WEIGHT,FURNITURE_WEIGHT,ageYears,lifeStage,traitFor,carryLimit,carryWeight,canCarry,constructionLabel,durationFor,systems:()=>systemState};
