import {THREE as T} from '@soul/rendering';
import {DAYS_YEAR,isGuard,isPlayer} from './game/core.js';

const STAGES=[
 {id:'child',label:'幼年',min:0,max:13},
 {id:'youth',label:'青年',min:13,max:18},
 {id:'adult',label:'成人',min:18,max:60},
 {id:'elder',label:'老年',min:60,max:Infinity}
];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const stableHash=value=>[...String(value??'')].reduce((hash,ch)=>(hash*33+ch.codePointAt(0))>>>0,5381);

export const residentAgeYears=(person,clock,daysYear=DAYS_YEAR)=>{
 const base=Number(person?.ageBaseYears),anchor=Number(person?.ageAnchorDay),now=Number(clock);
 if(!Number.isFinite(base)||!Number.isFinite(anchor)||!Number.isFinite(now)||!Number.isFinite(daysYear)||daysYear<=0)return 18;
 return Math.max(0,base+Math.max(0,now-anchor)/daysYear);
};
export const residentLifeStage=age=>STAGES.find(stage=>age<stage.max)||STAGES.at(-1);
export const residentScale=age=>{
 const years=Math.max(0,Number(age)||0);
 if(years<13)return .64+clamp(years/13,0,1)*.20;
 if(years<18)return .84+((years-13)/5)*.16;
 if(years<60)return 1;
 return Math.max(.93,1-(years-60)*.0025);
};
export const residentMovementFactor=age=>{
 const stage=residentLifeStage(age).id;
 return stage==='child'?.86:stage==='youth'?.96:stage==='elder'?.78:1;
};
export const residentCanWork=age=>Number(age)>=16;
export const residentCanGuard=age=>Number(age)>=18;
export function ensureResidentAge(person,clock,{existing=false}={}){
 if(!person||isPlayer(person))return false;
 if(Number.isFinite(person.ageBaseYears)&&Number.isFinite(person.ageAnchorDay))return false;
 let base;
 if(person.role==='mayor')base=38;
 else if(person.id==='guard-npc')base=31;
 else{
  const hash=stableHash(`${person.id}:${person.seed}:${person.name}`);
  base=existing?18+(hash%32):8+(hash%41);
 }
 person.ageBaseYears=base;
 person.ageAnchorDay=Number.isFinite(Number(clock))?Number(clock):0;
 person.ageStage=residentLifeStage(base).id;
 return true;
}

function addElderHair(node,geometry,material){
 if(node.userData.elderHair||!node.userData.body)return;
 const hair=new T.Mesh(geometry,material);
 hair.position.set(0,1.82,-.04);hair.scale.set(1.04,.45,1.04);hair.castShadow=false;hair.receiveShadow=true;hair.userData.residentAgeOverlay=true;
 node.userData.body.add(hair);node.userData.elderHair=hair;
}
function removeElderHair(node){
 const hair=node.userData.elderHair;if(!hair)return;
 hair.parent?.remove(hair);delete node.userData.elderHair;
}

export function installResidentAging(village){
 if(!village?.world||!village?.sim||!village?.view)return()=>{};
 const {world,sim,view}=village,installedPeople=new Set(world.people.map(person=>person.id));
 for(const person of world.people)ensureResidentAge(person,world.state.clock,{existing:true});
 const elderHairGeometry=new T.OctahedronGeometry(.35,0),elderHairMaterial=new T.MeshStandardMaterial({color:0xa9a59b,roughness:1,metalness:0,flatShading:true});
 const originalArrive=sim.arrive,originalAssignJobs=sim.assignJobs,originalWalk=sim.walk;
 sim.arrive=function(...args){
  const person=originalArrive.apply(this,args);
  if(person)ensureResidentAge(person,world.state.clock,{existing:false});
  return person;
 };
 sim.assignJobs=function(...args){
  const held=[];
  for(const person of world.people){
   ensureResidentAge(person,world.state.clock,{existing:installedPeople.has(person.id)});
   if(isPlayer(person))continue;
   const age=residentAgeYears(person,world.state.clock);
   if(!residentCanGuard(age)&&isGuard(person)&&person.id!=='guard-npc'){
    person.role='resident';person.jobId=null;person.task='idle';person.path=[];
   }
   if(!residentCanWork(age)){
    if(person.jobId){person.jobId=null;person.task='idle';person.path=[];if(person.id!=='guard-npc'&&person.role!=='mayor')person.role='resident';}
    if(!person.downed){person.downed={residentAgingHold:true};held.push(person);}
   }
  }
  try{return originalAssignJobs.apply(this,args);}
  finally{for(const person of held)delete person.downed;}
 };
 sim.walk=function(person,dt,...args){
  if(!person||isPlayer(person))return originalWalk.call(this,person,dt,...args);
  ensureResidentAge(person,world.state.clock,{existing:installedPeople.has(person.id)});
  return originalWalk.call(this,person,dt*residentMovementFactor(residentAgeYears(person,world.state.clock)),...args);
 };
 const frameHook=()=>{
  for(const person of world.people){
   const wasKnown=installedPeople.has(person.id);
   ensureResidentAge(person,world.state.clock,{existing:wasKnown});installedPeople.add(person.id);
   if(isPlayer(person))continue;
   const age=residentAgeYears(person,world.state.clock),stage=residentLifeStage(age);
   if(person.ageStage!==stage.id){
    person.ageStage=stage.id;
    const text=stage.id==='youth'?`${person.name}が青年期を迎えました`:stage.id==='adult'?`${person.name}が成人しました`:stage.id==='elder'?`${person.name}が老年期を迎えました`:null;
    if(text){sim.remember?.(person,text);sim.emit?.(text,'life');world.changed?.();}
   }
   const node=view.actorNodes.get(person.id);if(!node)continue;
   node.scale.setScalar(residentScale(age));
   if(node.userData.residentAgeStage!==stage.id){
    if(stage.id==='elder')addElderHair(node,elderHairGeometry,elderHairMaterial);else removeElderHair(node);
    node.userData.residentAgeStage=stage.id;
   }
   if(stage.id==='elder'&&node.userData.body)node.userData.body.rotation.x+=.045;
  }
 };
 village.frameHooks?.add(frameHook);
 const dialog=document.getElementById('dialog'),content=document.getElementById('dialogContent');
 const observer=content?new MutationObserver(()=>{
  if(dialog?.dataset.page!=='person'||content.querySelector('[data-resident-age]'))return;
  const name=content.querySelector('h2')?.textContent,person=world.people.find(candidate=>candidate.name===name&&!isPlayer(candidate));if(!person)return;
  ensureResidentAge(person,world.state.clock,{existing:installedPeople.has(person.id)});
  const age=Math.floor(residentAgeYears(person,world.state.clock)),stage=residentLifeStage(age);
  const line=document.createElement('p');line.dataset.residentAge='';line.className='muted residentAge';line.textContent=`${age}歳 · ${stage.label}`;
  content.querySelector('.personStatus')?.after(line);
 }):null;
 if(observer)observer.observe(content,{childList:true,subtree:true});
 frameHook();
 return()=>{
  village.frameHooks?.delete(frameHook);observer?.disconnect();sim.arrive=originalArrive;sim.assignJobs=originalAssignJobs;sim.walk=originalWalk;
  for(const node of view.actorNodes.values())removeElderHair(node);
  elderHairGeometry.dispose();elderHairMaterial.dispose();
 };
}
