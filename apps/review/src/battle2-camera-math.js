const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export function battle2CameraWorldHeight(worldHeight,zoom=1){
  const height=Number(worldHeight),scale=clamp(zoom,.58,1.65);
  return Number.isFinite(height)&&height>0?height*scale:undefined;
}
