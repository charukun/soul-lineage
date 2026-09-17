// Continuous performance plan for the existing 17-23 second Motion QA block.
// It deliberately reuses the shipped shino-slash-2 plus real locomotion/parry/zanshin
// runtime states. No review-only replacement pose or alternate gameplay clock exists.
export const THIRTY_SECOND_ENBU_SECONDS=6;
export const THIRTY_SECOND_ENBU_SEGMENTS=Object.freeze([
  Object.freeze({id:'surge',mode:'move',start:0,end:.28,vx:0,vz:3.2}),
  Object.freeze({id:'cut-1',mode:'slash',index:0,start:.28,end:.94}),
  Object.freeze({id:'rebound',mode:'move',start:.94,end:1.18,vx:-1.4,vz:-.7}),
  Object.freeze({id:'receive',mode:'parry',start:1.18,end:1.48}),
  Object.freeze({id:'cut-2',mode:'slash',index:1,start:1.48,end:2.14}),
  Object.freeze({id:'drive',mode:'move',start:2.14,end:2.40,vx:1.8,vz:2.4}),
  Object.freeze({id:'cut-3',mode:'slash',index:2,start:2.40,end:3.06}),
  Object.freeze({id:'cutover',mode:'move',start:3.06,end:3.32,vx:-2.2,vz:1.8}),
  Object.freeze({id:'cut-4',mode:'slash',index:3,start:3.32,end:3.98}),
  Object.freeze({id:'charge',mode:'move',start:3.98,end:4.30,vx:.8,vz:3.0}),
  Object.freeze({id:'cut-5',mode:'slash',index:4,start:4.30,end:4.96}),
  Object.freeze({id:'brake',mode:'move',start:4.96,end:5.24,vx:-.6,vz:-1.2}),
  Object.freeze({id:'zanshin',mode:'zanshin',start:5.24,end:6}),
]);
export const THIRTY_SECOND_SLASH_BEATS=Object.freeze(THIRTY_SECOND_ENBU_SEGMENTS.filter(row=>row.mode==='slash').map(row=>row.start));

function validate(localTime,duration){
  if(!Number.isFinite(localTime)||localTime<0||!Number.isFinite(duration)||duration<=0)throw new Error('Invalid 30-second enbu timing');
}

export function thirtySecondEnbuState(localTime,duration){
  validate(localTime,duration);
  if(localTime>=THIRTY_SECOND_ENBU_SECONDS)return null;
  const row=THIRTY_SECOND_ENBU_SEGMENTS.find(segment=>localTime>=segment.start&&localTime<segment.end);
  if(!row)throw new Error(`Uncovered 30-second enbu time: ${localTime}`);
  const span=row.end-row.start;
  if(row.mode==='slash'&&Math.abs(span-duration)>1e-9)throw new Error(`Slash duration ${duration} no longer matches enbu segment ${span}`);
  return {...row,time:localTime-row.start,duration:span};
}

export function thirtySecondSlashBeat(localTime,duration){
  const state=thirtySecondEnbuState(localTime,duration);
  return state?.mode==='slash'?{index:state.index,start:state.start,time:state.time}:null;
}
