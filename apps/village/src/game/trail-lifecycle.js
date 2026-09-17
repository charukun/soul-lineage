export const TRAIL_RETENTION_PER_DAY=.4;
export const TRAIL_PRUNE_THRESHOLD=.02;

/** Foot traffic is self-reinforcing: walkers add wear, quiet village days reclaim it. */
export function decayTrailTraffic(traffic,elapsedVillageDays){
 const days=Math.max(0,Number(elapsedVillageDays)||0);
 if(!days||!traffic)return false;
 const factor=Math.pow(TRAIL_RETENTION_PER_DAY,days);let changed=false;
 for(const[key,value]of Object.entries(traffic)){
  const next=Math.max(0,(Number(value)||0)*factor);
  if(next<TRAIL_PRUNE_THRESHOLD){delete traffic[key];changed=true;}
  else if(next!==value){traffic[key]=next;changed=true;}
 }
 return changed;
}
