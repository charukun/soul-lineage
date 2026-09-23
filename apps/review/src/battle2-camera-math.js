const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export function inspirationShotWeight(elapsed,duration){
  const p=Math.max(0,Math.min(1,(Number(elapsed)||0)/Math.max(.001,Number(duration)||1)));
  if(p>=1)return 0;
  if(p<.2){const rise=p/.2;return .28+.72*rise*rise*(3-2*rise);}
  if(p<.68)return 1;
  const release=(p-.68)/.32;
  return 1-release*release*(3-2*release);
}
export function battle2CameraWorldHeight(worldHeight,zoom=1){
  const height=Number(worldHeight),scale=clamp(zoom,.58,1.65);
  return Number.isFinite(height)&&height>0?height*scale:undefined;
}
