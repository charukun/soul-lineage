const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export const DEMON_RUNTIME_VISUAL=Object.freeze({
  pixelRatioCap:2,
  pixelRatioFloor:1.5,
});

export function demonEffectivePixelRatio(devicePixelRatio=1,renderScale=1){
  const raw=Number(devicePixelRatio),dpr=Number.isFinite(raw)&&raw>0?raw:1;
  const base=Math.min(dpr,DEMON_RUNTIME_VISUAL.pixelRatioCap);
  const scale=clamp(Number(renderScale)||1,.5,1);
  const floor=Math.min(base,DEMON_RUNTIME_VISUAL.pixelRatioFloor);
  return Math.round(Math.max(floor,base*scale)*1000)/1000;
}

export function demonRenderQualityKey(snapshot){
  const level=Math.max(0,Math.floor(Number(snapshot?.level)||0));
  const pressure=String(snapshot?.bottleneck||snapshot?.profile?.pressureAxis||'unknown');
  return `${level}:${pressure}`;
}

export function demonSceneQualityKey(snapshot,sceneRevision=0){
  const level=Math.max(0,Math.floor(Number(snapshot?.level)||0));
  const revision=Math.max(0,Math.floor(Number(sceneRevision)||0));
  return `${level}:${revision}`;
}
