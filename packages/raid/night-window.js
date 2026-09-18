export const WORLD_DAY_SECONDS=600;
export const NIGHT_START_HOUR=17;
export const NIGHT_END_HOUR=5;

const hour=value=>((Number(value)%24)+24)%24;

export function isRaidNightHour(worldHour){
  if(!Number.isFinite(worldHour))return false;
  const h=hour(worldHour);
  return h>=NIGHT_START_HOUR||h<NIGHT_END_HOUR;
}

export function raidNightId(worldClockDays){
  if(!Number.isFinite(worldClockDays))throw Error('world clock must be finite');
  return Math.floor(worldClockDays+(24-NIGHT_START_HOUR)/24);
}

export function raidWindowForClock(worldClockDays){
  if(!Number.isFinite(worldClockDays))throw Error('world clock must be finite');
  const worldHour=hour(worldClockDays*24);
  const open=isRaidNightHour(worldHour);
  return Object.freeze({open,worldHour,nightId:open?raidNightId(worldClockDays):null});
}
