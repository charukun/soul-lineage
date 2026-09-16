// Choreography for the real 17-23 second slash review block. Each beat uses the
// shipping `slash` gameplay clock; only the presentation variant and spacing differ.
export const THIRTY_SECOND_ENBU_REVISION='three-cut-choreography-2';
export const THIRTY_SECOND_SLASH_BEATS=Object.freeze([
  Object.freeze({start:.35,variant:'cross',label:'切り込み',intent:'open-line'}),
  Object.freeze({start:2.05,variant:'return',label:'返し',intent:'reverse-chain'}),
  Object.freeze({start:3.85,variant:'finisher',label:'打ち下ろし',intent:'finish-and-brake'}),
]);

export function thirtySecondSlashBeat(localTime,duration){
  if(!Number.isFinite(localTime)||localTime<0||!Number.isFinite(duration)||duration<=0)throw new Error('Invalid 30-second slash timing');
  const index=THIRTY_SECOND_SLASH_BEATS.findIndex(beat=>localTime>=beat.start&&localTime<beat.start+duration);
  if(index<0)return null;
  const beat=THIRTY_SECOND_SLASH_BEATS[index],time=localTime-beat.start;
  return {index,...beat,time,progress:time/duration};
}

export function thirtySecondEnbuStructure(duration){
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Invalid 30-second slash duration');
  const first=THIRTY_SECOND_SLASH_BEATS[0],last=THIRTY_SECOND_SLASH_BEATS.at(-1);
  return Object.freeze({revision:THIRTY_SECOND_ENBU_REVISION,preparation:first.start,beats:THIRTY_SECOND_SLASH_BEATS,finish:last.start+duration,zanshin:6-(last.start+duration)});
}
