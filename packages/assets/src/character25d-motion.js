import {CHARACTER25D_ACTIONS} from './character25d-schema.js';
import {clamp,createHumanoidRig} from './character25d-rig.js';
const BONE_INDEX=Object.fromEntries(createHumanoidRig().bones.map((b,i)=>[b.name,i*3]));
const SIDES=[['L',1],['R',-1]];

// Original constrained tracks. RINNE's existing 3D gait supplies the cadence and
// opposite-arm/leg convention; image-space excursions are intentionally smaller.
export const MOTION_CLIPS=Object.freeze({idle:{duration:3,loop:true},walk:{duration:.9,loop:true},run:{duration:.58,loop:true},turn:{duration:.55,loop:false},attack:{duration:.7,loop:false},hit:{duration:.5,loop:false},talk:{duration:1.8,loop:false},pickup:{duration:1.35,loop:false},rest:{duration:2.5,loop:true}});
export function createMotionState() {
  let action='idle',time=0,phase=0,manual=false,blend=0;
  return {play(name,{restart=true,automatic=false}={}){name=String(name).toLowerCase();if(!CHARACTER25D_ACTIONS.includes(name))throw new Error('Unknown Character25D action: '+name);if(name===action&&!restart)return;action=name;time=0;blend=0;manual=!automatic;},
    step(dt,speed=0){dt=clamp(Number(dt)||0,0,.05);time+=dt;blend=Math.min(1,blend+dt*10);phase=(phase+dt*(speed>2.5?10.8:7))%(Math.PI*2);
      if(!MOTION_CLIPS[action].loop&&time>=MOTION_CLIPS[action].duration){manual=false;action='idle';time=0;}
      if(!manual){const next=speed>.08?(speed>2.5?'run':'walk'):'idle';if(next!==action){action=next;time=0;blend=0;}}
    },release(){manual=false;},get action(){return action;},get time(){return time;},get phase(){return phase;},get weight(){return blend;},get manual(){return manual;}};
}
export function sampleMotion(state,rig,rotations,translations) {
  rotations.fill(0);translations.fill(0);
  const index=name=>BONE_INDEX[name];
  const rotate=(name,x=0,y=0,z=0)=>{const i=index(name);rotations[i]=x;rotations[i+1]=y;rotations[i+2]=z;};
  const action=state.action,t=state.time,p=clamp(t/MOTION_CLIPS[action].duration,0,1),pulse=Math.sin(p*Math.PI),gait=Math.sin(state.phase),run=action==='run',move=run||action==='walk';
  rotate('chest',0,0,Math.sin(t*2)*.012);rotate('head',Math.sin(t*1.7)*.012);
  if(move)for(const [side,sign] of SIDES) {
    const stride=gait*sign*(run?.30:.20)*state.weight;
    rotate('upperLeg.'+side,stride,0,sign*Math.abs(stride)*.075);
    rotate('lowerLeg.'+side,Math.max(0,-stride)*.6);
    rotate('upperArm.'+side,-stride*.7,0,-sign*.025);
    rotate('lowerArm.'+side,-Math.max(0,stride)*.4);
    translations[index('foot.'+side)+1]=Math.max(0,-gait*sign)*(run?.045:.025)*state.weight;
  }
  if(action==='turn'){rotate('chest',0,pulse*.16);rotate('head',0,pulse*.25);}
  if(action==='attack') {const strike=Math.sin(clamp((p-.15)/.65,0,1)*Math.PI);rotate('upperArm.R',-.32*strike,0,.30*strike);rotate('lowerArm.R',-.28*strike,0,.17*strike);rotate('chest',.07*strike,0,-.065*strike);}
  if(action==='hit'){rotate('chest',-.10*pulse,0,.11*pulse);rotate('head',-.09*pulse,0,.04*pulse);rotate('upperArm.L',.1*pulse,0,-.08*pulse);}
  if(action==='talk'){rotate('upperArm.L',-.12*pulse,0,-.22*pulse);rotate('lowerArm.L',-.18*pulse,0,-.15*pulse);rotate('head',Math.sin(t*9)*.045*pulse);}
  if(action==='pickup'){rotate('spine',.20*pulse,0,.055*pulse);rotate('head',.14*pulse);rotate('upperArm.R',-.16*pulse,0,.10*pulse);}
  if(action==='rest'){rotate('spine',.075,0,.018);rotate('head',.11);rotate('upperArm.L',.025,0,-.025);rotate('upperArm.R',.025,0,.025);}
  for(let i=0;i<rotations.length;i++)rotations[i]=clamp(rotations[i],-.34,.34);
}
export function stepSpring(spring,target,dt,config) {
  dt=clamp(Number(dt)||0,0,.05);target=clamp(target,-config.limit,config.limit);
  const steps=Math.max(1,Math.ceil(dt/.0125)),h=dt/steps;
  for(let i=0;i<steps;i++){spring.velocity+=(config.stiffness*(target-spring.value)-config.damping*spring.velocity)*h;spring.value=clamp(spring.value+spring.velocity*h,-config.limit,config.limit);}
  return spring.value;
}
