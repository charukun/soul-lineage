/** Deterministic stage choreography. The shared clips retain their native clocks. */
import {gaitMix} from './posture-motion.js';
import {SLASH_SECONDS} from './authored-slash.js';
import {SWORD_MOVES} from './authored-sword.js';
import {SWORD_LOADOUTS} from './sword-techniques.js';
import {createSwordTechnique,applySwordSequence,swordSequenceTravel,swordSequenceAir} from './sword-sequence.js';
import {sampleDirectionalStep} from './directional-step.js';
export const PERFORMANCE_SECONDS=30;
export const PERFORMANCE_REVISION='joha-kyu-sword-2';
export const SWORD_TIMINGS=Object.freeze(Object.fromEntries(Object.entries(SWORD_MOVES).map(([kind,move])=>[kind,move.timing])));
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=p=>p*p*p*(10+p*(-15+6*p));
const velocity=p=>30*p*p*(1-p)*(1-p);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
const rotate=(p,yaw)=>({x:p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z:-p.x*Math.sin(yaw)+p.z*Math.cos(yaw)});
// Three loadouts, each played as 序 -> 破 -> 急. Each slot contains a
// three-action technique. Spectacle comes from those reusable basic actions.
const stageName={jo:'序',ha:'破',kyu:'急'};
const score=[
 [1.10,'draw','抜刀'],[1.60,'move','序の間合いへ',[0,1.5],0,{step:'forward'}],
 [3.80,'phrase','jo',SWORD_LOADOUTS[0].jo],
 [4.35,'move','破へ切り返す',[-.8,1.8],-.5,{step:'side-right'}],
 [6.75,'phrase','ha',SWORD_LOADOUTS[0].ha],
 [7.20,'move','急の間合いへ',[.4,1.0],0,{step:'back-left'}],
 [10.00,'phrase','kyu',SWORD_LOADOUTS[0].kyu],
 [11.15,'move','次の構成・側面へ',[-1.6,.2],Math.PI/2,{bow:.7,step:'side-left'}],
 [13.35,'phrase','jo',SWORD_LOADOUTS[1].jo],
 [13.85,'move','破へ転身',[1.4,1.2],Math.PI,{step:'back-right'}],
 [16.25,'phrase','ha',SWORD_LOADOUTS[1].ha],
 [16.85,'move','急の間合いへ',[.6,.4],0,{step:'side-right'}],
 [19.65,'phrase','kyu',SWORD_LOADOUTS[1].kyu],
 [20.65,'move','最後の構成・正面へ',[-1.2,-.6],0,{bow:.5,step:'back-left'}],
 [22.80,'phrase','jo',SWORD_LOADOUTS[2].jo],
 [23.20,'move','破・斜めへ',[-.5,1.4],-.7,{step:'side-left'}],
 [25.60,'phrase','ha',SWORD_LOADOUTS[2].ha],
 [26.10,'move','急・最後の踏み込み',[0,-.8],0,{step:'back'}],
 [28.75,'phrase','kyu',SWORD_LOADOUTS[2].kyu],
 [29.25,'move','残心から納刀へ',[0,0],0,{step:'back'}],[30,'sheathe','納刀・終'],
];
// A quadratic bow gives approaches a visible flank instead of a straight slide.
// Directional steps keep the same collision/root ownership while adopting the
// CC0 reference's synchronized eight-direction phase and left-foot start.
function path(e,p){
 const step=e.kind==='move'?sampleDirectionalStep(e,p):null;
 const u=step?.travel??ease(p),v=(step?step.derivative:velocity(p))/e.duration,dx=e.to[0]-e.from[0],dz=e.to[1]-e.from[1];
 const b=4*u*(1-u),db=4*(1-2*u),bx=-dz/(e.chord||1)*e.bow,bz=dx/(e.chord||1)*e.bow;
 return {x:e.from[0]+dx*u+bx*b,z:e.from[1]+dz*u+bz*b,vx:(dx+bx*db)*v,vz:(dz+bz*db)*v,step};
}
function gait(e,p){
 let walk=0,run=0;
 if(e.kind!=='move')return{walk,run};
 for(let i=0;i<64;i++){
  const phase=p*(i+.5)/64,point=path(e,phase),speed=Math.hypot(point.vx,point.vz),ds=speed*e.duration*p/64;
  const mix=gaitMix(speed);walk+=ds*(1-mix);run+=ds*mix;
 }
 return {walk:walk*e.direction,run:run*e.direction};
}
function phraseMotion(phrase,time,poseScale){
 const travel=swordSequenceTravel(phrase.sequence,time-phrase.start,poseScale);
 return {...rotate(travel,phrase.yaw),...Object.fromEntries(Object.entries(rotate({x:travel.vx,z:travel.vz},phrase.yaw)).map(([key,value])=>['v'+key,value])),yaw:phrase.yaw,air:swordSequenceAir(phrase.sequence,time-phrase.start)};
}
let start=0,position=[0,0],yaw=0,walk=0,run=0;
export const PERFORMANCE_EVENTS=[],PERFORMANCE_PHRASES=[];
for(const row of score){
 const [end,kind,label,target,face,options={}]=row;
 if(kind==='phrase'){
  const sequence=createSwordTechnique(target);
  const phrase=Object.freeze({start,end,sequence,from:Object.freeze([...position]),yaw,label:stageName[label]+'「'+target.name+'」',slot:label,recipe:target});
  if(sequence.duration>end-start+1e-8)throw Error(`${label} exceeds its score slot: ${sequence.duration}`);
  PERFORMANCE_PHRASES.push(phrase);
  for(const [j,entry]of sequence.entries.entries()){
   const at=start+entry.start,until=j+1<sequence.entries.length?start+sequence.entries[j+1].start:end;
   PERFORMANCE_EVENTS.push(Object.freeze({id:`performance-${at}`,start:at,end:until,duration:until-at,kind:entry.kind,label:phrase.label,from:phrase.from,to:phrase.from,yaw,turn:0,chord:0,bow:0,step:null,direction:1,walk,run,phrase}));
  }
  const final=phraseMotion(phrase,end,1);position=[position[0]+final.x,position[1]+final.z];yaw=final.yaw;start=end;continue;
 }
 const to=target||position,dx=to[0]-position[0],dz=to[1]-position[1],chord=Math.hypot(dx,dz),facing=chord?(face??Math.atan2(dx,dz)):yaw;
 const e={id:`performance-${start}`,start,end,duration:end-start,kind,label,from:[...position],to:[...to],yaw,turn:angle(facing-yaw),chord,bow:options.bow||0,step:options.step||null,direction:dx*Math.sin(facing)+dz*Math.cos(facing)<0?-1:1,walk,run};
 const traveled=gait(e,1);walk+=traveled.walk;run+=traveled.run;start=end;position=to;yaw+=e.turn;
 PERFORMANCE_EVENTS.push(Object.freeze({...e,from:Object.freeze(e.from),to:Object.freeze(e.to)}));
}
Object.freeze(PERFORMANCE_EVENTS);Object.freeze(PERFORMANCE_PHRASES);
export function samplePerformance(seconds,poseScale=1){
 const time=Math.min(PERFORMANCE_SECONDS,Math.max(0,Number.isFinite(seconds)?seconds:0));
 const event=PERFORMANCE_EVENTS.find(e=>time<e.end)??PERFORMANCE_EVENTS.at(-1),p=clamp((time-event.start)/event.duration);
 const traveled=gait(event,p),passive=['move','draw','sheathe'].includes(event.kind),attack=passive?null:{id:event.id,kind:event.kind,t:time-event.start,duration:event.duration};
 const point=path(event,p),weaponDraw=event.kind==='draw'?ease(p):event.kind==='sheathe'?1-ease(p):1;
 const result={time,event,phase:p,...point,yaw:event.yaw+event.turn*ease(clamp(p/.8)),air:0,walk:event.walk+traveled.walk,run:event.run+traveled.run,attack,weaponDraw,weaponTransition:event.kind==='draw'||event.kind==='sheathe',combatReady:event.kind==='draw'?p>.42:event.kind==='sheathe'?p<.58:true,directionalStep:point.step};
 if(event.phrase){const motion=phraseMotion(event.phrase,time,poseScale);Object.assign(result,motion,{x:event.from[0]+motion.x,z:event.from[1]+motion.z});}
 return result;
}
export function applyPerformance(actor,seconds,locomotion,poseScale=1){
 const s=samplePerformance(seconds,poseScale);
 Object.assign(actor,{x:s.x,z:s.z,yaw:s.yaw,air:s.air,vx:s.vx,vz:s.vz,attack:s.attack,weaponDraw:s.weaponDraw,weaponTransition:s.weaponTransition,combatReady:s.combatReady,_directionalStep:s.directionalStep,_humanoidClock:s.time,
  _humanoidPhase:s.walk/(locomotion?.walk?.cycleDistance||1.16)+s.run/(locomotion?.run?.cycleDistance||1.8),motionBlend:null,motionSequence:false});
 const phrase=s.event.phrase;
 if(phrase){const frame=applySwordSequence(actor,phrase.sequence,s.time,{start:phrase.start});s.event={...s.event,label:phrase.label+' · '+frame.current.label};}
 return s;
}
