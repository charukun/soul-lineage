/** A score of existing sword clips. Contains no poses, bone keys or new attack. */
import {SWORD_MOVES} from './authored-sword.js';
const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};

export function createSwordSequence(kinds,{connected=true}={}) {
 if(!kinds.length||kinds.some(kind=>!SWORD_MOVES[kind]))throw Error('Unknown sword motion');
 let end=0;
 const entries=kinds.map((kind,index)=>{
  const move=SWORD_MOVES[kind];
  const enter=connected&&index>0?.18:0,exit=connected&&index<kinds.length-1?.82:1;
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

export const SHORT_SWORD_SEQUENCE=createSwordSequence(['slash','back','uppercut','heavy']);
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
