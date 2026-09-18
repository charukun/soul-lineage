const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export const RINNE_RUNTIME_PERFORMANCE=Object.freeze({
  mobileTargetFps:30,
  desktopTargetFps:60,
  pixelRatioCap:1.75,
  pixelRatioFloor:.85,
  uiSyncInterval:.1,
});

export function targetFpsForView(view=globalThis){
  const coarse=Boolean(view?.matchMedia?.('(pointer: coarse)')?.matches);
  const width=Number(view?.innerWidth);
  const compact=Number.isFinite(width)&&width>0&&width<=720;
  return coarse||compact?RINNE_RUNTIME_PERFORMANCE.mobileTargetFps:RINNE_RUNTIME_PERFORMANCE.desktopTargetFps;
}

export function renderPixelRatio(devicePixelRatio=1,renderScale=1){
  const raw=Number(devicePixelRatio),dpr=Number.isFinite(raw)&&raw>0?Math.max(1,raw):1;
  const scale=clamp(Number(renderScale)||1,.5,1);
  const base=Math.min(dpr,RINNE_RUNTIME_PERFORMANCE.pixelRatioCap);
  const ratio=Math.max(RINNE_RUNTIME_PERFORMANCE.pixelRatioFloor,Math.min(base,base*scale));
  return Math.round(ratio*1000)/1000;
}
