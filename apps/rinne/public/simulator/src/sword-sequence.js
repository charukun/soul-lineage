/** A score of existing sword clips. Contains no poses, bone keys or new attack. */
import {SWORD_MOVES,SWORD_STEPS,sampleSwordPose} from './authored-sword.js';
const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};

export function createSwordSequence(kinds,{connected=true}={}) {
 if(!kinds.length||kinds.some(kind=>!SWORD_MOVES[kind]))throw Error('Unknown sword motion');
 let end=0;
 const entries=kinds.map((kind,index)=>{
  const move=SWORD_MOVES[kind];
  const enter=connected&&index>0?.18:0,exit=connected&&index<kinds.length-1?.72:1;
  const overlap=connected&&index>0?.08:0,start=end-overlap;
  const length=(exit-enter)*move.seconds;
  const row={kind,index,start,end:start+length,enter,exit,overlap,seconds:move.seconds,label:move.label};
  end=row.end;return Object.freeze(row);
 });
 return Object.freeze({entries:Object.freeze(entries),duration:end,connected});
}

/** Both samples refer to the original clip's own time. Seeking has no history. */
export function swordSequenceFrame(sequence,seconds) {
 const time=Math.min(sequence.duration,Math.max(0,Number.isFinite(seconds)?seconds:0));
 let index=0;while(index+1<sequence.entries.length&&time>=sequence.entries[index+1].start)index++;
 const row=sequence.entries[index];
 const sample=entry=>({kind:entry.kind,index:entry.index,phase:Math.min(entry.exit,entry.enter+Math.max(0,time-entry.start)/entry.seconds),label:entry.label});
 const current=sample(row),previous=index>0&&time<sequence.entries[index-1].end?sample(sequence.entries[index-1]):null;
 const weight=previous?smooth((time-row.start)/row.overlap):1;
 return {time,index,current,previous,weight,offset:row.start-row.enter*row.seconds};
}

/** Root travel belongs to the calling movement/review controller, not to the rig.
 * Step advance shares the clip's loading/plant/recovery phases. No additional pose.
 */
export function swordSequencePelvisZ(sequence,time){
 const f=swordSequenceFrame(sequence,time),current=sampleSwordPose(f.current.kind,f.current.phase).offset[2];
 return f.previous?sampleSwordPose(f.previous.kind,f.previous.phase).offset[2]*(1-f.weight)+current*f.weight:current;
}
export function swordSequenceTravel(sequence,seconds,poseScale=1){
 const time=Math.max(0,Math.min(sequence.duration,Number.isFinite(seconds)?seconds:0));
 let x=0,z=0,vx=0,vz=0;
 for(const row of sequence.entries){
  const phase=row.enter+(time-row.start)/row.seconds;
  const u=clamp((phase-.25)/.44),distance=smooth(u);
  const speed=u>0&&u<1?30*u*u*(1-u)*(1-u)/(.44*row.seconds):0;
  const step=SWORD_STEPS[row.kind];x+=step[0]*distance;z+=step[1]*distance;vx+=step[0]*speed;vz+=step[1]*speed;
 }
 // Extract the baked pelvis' forward translation so recovering one source
 // clip cannot pull the moving actor backward between cuts. Body height/lateral
 // weight shifts and all relative limb motion remain in the original clip.
 const offset=at=>swordSequencePelvisZ(sequence,at);
 const dt=Math.min(1e-5,time,sequence.duration-time),lo=time-dt,hi=time+dt;
 z-=offset(time)*poseScale;
 if(hi>lo)vz-=(offset(hi)-offset(lo))/(hi-lo)*poseScale;
 return {x,z,vx,vz};
}

export const SHORT_SWORD_SEQUENCE=createSwordSequence(['slash','back','uppercut','slash','back','thrust','heavy']);
export const SHORT_SWORD_SECONDS=4;
export function applySwordSequence(actor,sequence,seconds,{start=0}={}) {
 const frame=swordSequenceFrame(sequence,seconds-start),row=sequence.entries[frame.index];
 actor.attack={id:`sword-sequence:${start}:${frame.index}`,kind:frame.current.kind,t:frame.current.phase*row.seconds,duration:row.seconds};
 actor.motionBlend=frame.previous?{kind:frame.previous.kind,phase:frame.previous.phase,weight:1-frame.weight}:null;
 // An explicit clip composition owns its transition, so it does not also receive
 // the runtime's stateful movement/attack snapshot blend.
 actor.motionSequence=frame.index>0;
 return frame;
}
