export const FLICK_DASH_DISTANCE=42;
export const FLICK_DASH_MAX_MS=260;
export const FLICK_DASH_BURST_MS=360;

export function detectFlickDash({startX,startY,endX,endY,durationMs}={}){
  const dx=Number(endX)-Number(startX),dy=Number(endY)-Number(startY),distance=Math.hypot(dx,dy),elapsed=Number(durationMs);
  if(!Number.isFinite(distance)||!Number.isFinite(elapsed)||distance<FLICK_DASH_DISTANCE||elapsed<0||elapsed>FLICK_DASH_MAX_MS)return null;
  return{axis:{x:dx/distance,y:dy/distance},durationMs:FLICK_DASH_BURST_MS};
}
