export const MAX_SIMULATION_DELTA_SECONDS = .05;

export function splitRuntimeFrameDelta(elapsedSeconds,{paused=false}={}) {
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)throw Error('フレーム時間が不正です。');
  if(paused)return {simulationDelta:0,lifeDelta:0};
  return {simulationDelta:Math.min(MAX_SIMULATION_DELTA_SECONDS,elapsedSeconds),lifeDelta:elapsedSeconds};
}
