// Performance-only timing for the existing 17-23 second slash review block.
// The shared slash duration/contact clock remains authoritative in authored-slash.js.
export const THIRTY_SECOND_SLASH_BEATS=Object.freeze([0,2.35,4.45]);

export function thirtySecondSlashBeat(localTime,duration){
  if(!Number.isFinite(localTime)||localTime<0||!Number.isFinite(duration)||duration<=0)throw new Error('Invalid 30-second slash timing');
  const index=THIRTY_SECOND_SLASH_BEATS.findIndex(start=>localTime>=start&&localTime<start+duration);
  if(index<0)return null;
  const start=THIRTY_SECOND_SLASH_BEATS[index];
  return {index,start,time:localTime-start};
}
