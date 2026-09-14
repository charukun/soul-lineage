/** Review only schedules existing actor states; all poses come from HumanoidRuntime. */
import {SWORD_MOVES} from './authored-sword.js';
export const POSTURE_REVIEW_SECONDS=18;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const integral=x=>{x=clamp(x);return x*x*x-x*x*x*x/2;};
const ramps=[[4,.7,1.65],[6.5,1,2.25],[9.2,1.3,-3.9]];
export function postureTravel(time){
 let speed=0,z=0;
 for(const [start,length,change]of ramps){const t=time-start;if(t<=0)continue;speed+=change*ease(t/length);z+=change*(length*integral(t/length)+Math.max(0,t-length));}
 return {speed:Math.max(0,speed),z};
}
export function applyPostureReview(actor,time,locomotion){
 Object.assign(actor,{x:0,z:0,yaw:0,air:0,vx:0,vz:0,attack:null,motionBlend:null,motionSequence:false,weapon:'sword',weaponDraw:1,combatReady:true,weaponTransition:false,_humanoidClock:time});
 const travel=postureTravel(time);actor.z=travel.z;actor.vz=travel.speed;
 // Deterministic phase integration also works while scrubbing. Matches the runtime's
 // distance cadence and continuous walk/run mixture without keeping hidden state.
 let phase=0;for(let t=4;t<time&&t<10.5;t+=1/120){const dt=Math.min(1/120,time-t),speed=postureTravel(t+dt/2).speed,mix=ease((speed-1.8)/1.4);const distance=(locomotion?.walk?.cycleDistance||1.4)*(1-mix)+(locomotion?.run?.cycleDistance||2.5)*mix;phase+=speed*dt/distance;}
 actor._humanoidPhase=phase;
 let label=time<4?'構えと重心':time<6.5?'歩き出し → 歩行':time<9.2?'加速 → 走行':time<11.5?'減速 → 停止':'構えに戻る';
 if(time<1){actor.combatReady=false;actor.weaponDraw=0;label='自然体';}
 else if(time<2.4){actor.weaponTransition=true;actor.weaponDraw=clamp((time-1.15)/1.1);label='抜刀';}
 for(const [start,kind]of [[11.5,'slash'],[12.5,'heavy']])if(time>=start&&time<start+SWORD_MOVES[kind].seconds){actor.attack={id:kind,kind,t:time-start,duration:SWORD_MOVES[kind].seconds};label=SWORD_MOVES[kind].label;}
 if(time>=15){actor.weaponDraw=1-clamp((time-15.15)/1.1);actor.weaponTransition=time<16.4;actor.combatReady=time<16.4;label=time<16.4?'納刀':'自然体';}
 return label;
}
