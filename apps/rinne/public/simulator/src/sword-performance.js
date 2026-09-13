/** Deterministic 30-second choreography using the shared sword/locomotion rig. */
import {SLASH_SECONDS,SLASH_TIMING} from './authored-slash.js';
import {SWORD_MOVES} from './authored-sword.js';
import {createSwordSequence,applySwordSequence} from './sword-sequence.js';
export const PERFORMANCE_SECONDS=30;
export const PERFORMANCE_REVISION='existing-sword-sequence-2';
export const SWORD_TIMINGS=Object.freeze(Object.fromEntries(Object.entries(SWORD_MOVES).map(([kind,move])=>[kind,move.timing])));
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=p=>p*p*p*(10+p*(-15+6*p));
const velocity=p=>30*p*p*(1-p)*(1-p);
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
// Each phrase has its own approach, cadence and recovery; the ending returns home.
const score=[
 [1.20,'guard','構え'],[3.00,'move','接近',[0,1.8]],
 [3.66,'slash','一閃'],[4.35,'back','斬り返し'],[5.02,'thrust','突き'],[5.55,'guard','残心'],
 [7.25,'move','回り込み',[1.8,1.9]],
 [7.91,'slash','横薙ぎ'],[8.60,'back','斬り返し'],[9.34,'uppercut','斬り上げ'],
 [10.55,'move','間合いを外す',[1.4,.6],Math.PI/2],
 [12.10,'move','再接近',[-1.4,1.9]],
 [12.76,'slash','一閃'],[13.45,'back','斬り返し'],[14.43,'heavy','振り下ろし'],[15.20,'guard','残心'],
 [17.10,'move','後退',[-1.6,-.7],0],[18.70,'move','踏み込む',[.5,.9]],
 [19.36,'slash','一閃'],[20.05,'back','斬り返し'],[20.79,'uppercut','斬り上げ'],[21.46,'thrust','突き'],[22.30,'guard','間を取る'],
 [24.10,'move','回り込み',[1.5,-.8]],
 [24.76,'slash','一閃'],[25.45,'back','斬り返し'],[26.19,'uppercut','斬り上げ'],[27.17,'heavy','大きく振り抜く'],
 [28.80,'move','構えへ戻る',[0,0],0],[30.00,'guard','残心'],
];
// Split traveled distance at the runtime's walk/run threshold without resetting
// gait phase at a speed transition. Signed distance also supports backward steps.
function gait(e,p){
 const D=e.distance,u=ease(p),q=D?Math.sqrt(2.4*e.duration/(30*D)):1;
 let run=0;
 if(q<.25){const a=(1-Math.sqrt(1-4*q))/2,b=1-a;run=D*Math.max(0,ease(Math.min(p,b))-ease(a));}
 return {walk:(D*u-run)*e.direction,run:run*e.direction};
}
let start=0,position=[0,0],yaw=0,walk=0,run=0;
export const PERFORMANCE_EVENTS=Object.freeze(score.map(([end,kind,label,to=position,face])=>{
 const dx=to[0]-position[0],dz=to[1]-position[1],distance=Math.hypot(dx,dz);
 const target=distance?(face??Math.atan2(dx,dz)):yaw;
 const e={id:`performance-${start}`,start,end,duration:end-start,kind,label,from:[...position],to:[...to],yaw,turn:angle(target-yaw),distance,direction:dx*Math.sin(target)+dz*Math.cos(target)<0?-1:1,walk,run};
 const traveled=gait(e,1);walk+=traveled.walk;run+=traveled.run;start=end;position=to;yaw+=e.turn;
 return Object.freeze({...e,from:Object.freeze(e.from),to:Object.freeze(e.to)});
}));
// Keep the existing 30-second route. Each attack phrase refers to the same
// individual clips used in the Lab's 技構成, with recovery/wind-up overlap.
export const PERFORMANCE_PHRASES=[];
for(let i=0;i<PERFORMANCE_EVENTS.length;i++){
 if(!SWORD_MOVES[PERFORMANCE_EVENTS[i].kind])continue;
 const first=i,kinds=[];
 while(i<PERFORMANCE_EVENTS.length&&SWORD_MOVES[PERFORMANCE_EVENTS[i].kind])kinds.push(PERFORMANCE_EVENTS[i++].kind);
 const last=PERFORMANCE_EVENTS[--i];
 PERFORMANCE_PHRASES.push(Object.freeze({start:PERFORMANCE_EVENTS[first].start,end:last.end,sequence:createSwordSequence(kinds)}));
}
Object.freeze(PERFORMANCE_PHRASES);
export function samplePerformance(seconds){
 const time=Math.min(PERFORMANCE_SECONDS,Math.max(0,Number.isFinite(seconds)?seconds:0));
 const event=PERFORMANCE_EVENTS.find(e=>time<e.end)??PERFORMANCE_EVENTS.at(-1);
 const p=clamp((time-event.start)/event.duration),u=ease(p),v=velocity(p)/event.duration;
 const dx=event.to[0]-event.from[0],dz=event.to[1]-event.from[1],traveled=gait(event,p);
 const attack=event.kind==='move'?null:{id:event.id,kind:event.kind==='guard'?'slash':event.kind,t:event.kind==='guard'?0:time-event.start,duration:event.kind==='guard'?SLASH_SECONDS:event.duration};
 return {time,event,phase:p,x:event.from[0]+dx*u,z:event.from[1]+dz*u,yaw:event.yaw+event.turn*ease(clamp(p/.65)),vx:dx*v,vz:dz*v,walk:event.walk+traveled.walk,run:event.run+traveled.run,attack};
}
export function applyPerformance(actor,seconds,locomotion){
 const s=samplePerformance(seconds);
 Object.assign(actor,{x:s.x,z:s.z,yaw:s.yaw,vx:s.vx,vz:s.vz,attack:s.attack,_humanoidClock:s.time,
  _humanoidPhase:s.walk/(locomotion?.walk?.cycleDistance||1.16)+s.run/(locomotion?.run?.cycleDistance||1.8),motionBlend:null,motionSequence:false});
 const phrase=PERFORMANCE_PHRASES.find(row=>s.time>=row.start&&s.time<row.end);
 if(phrase){const frame=applySwordSequence(actor,phrase.sequence,s.time,{start:phrase.start});s.event={...s.event,label:frame.current.label};}
 return s;
}
