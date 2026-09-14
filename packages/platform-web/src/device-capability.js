const KEY='soul.device-capability.v1';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

export function detectDeviceCapability({renderer=null,windowRef=globalThis.window,navigatorRef=globalThis.navigator}={}){
  const gl=renderer?.getContext?.();
  const maxTextureSize=Number(gl?.getParameter?.(gl.MAX_TEXTURE_SIZE)||0);
  const maxTextures=Number(gl?.getParameter?.(gl.MAX_TEXTURE_IMAGE_UNITS)||0);
  const dpr=Number(windowRef?.devicePixelRatio||1),cores=Number(navigatorRef?.hardwareConcurrency||2),memory=Number(navigatorRef?.deviceMemory||0);
  const mobile=/Android|iPhone|iPad/i.test(navigatorRef?.userAgent||'')||(Number(windowRef?.innerWidth)||9999)<800;
  let score=0;score+=clamp((cores-2)/6,0,1)*30;score+=clamp((memory||4)-2,0,6)/6*20;score+=clamp((maxTextureSize-2048)/6144,0,1)*20;score+=clamp((maxTextures-8)/24,0,1)*10;score+=mobile?5:15;score-=clamp((dpr-2)/2,0,1)*5;
  const tier=score>=72?'high':score>=48?'mid':score>=28?'mobile':'low';
  const initialQuality={high:0,mid:0,mobile:1,low:2}[tier];
  return Object.freeze({version:1,tier,score:Math.round(score),mobile,dpr,cores,memory,maxTextureSize,maxTextures,targetFps:mobile?30:60,initialQuality});
}

export function loadDeviceCapability(storage=globalThis.localStorage){try{const value=JSON.parse(storage?.getItem?.(KEY)||'null');return value?.version===1?value:null;}catch{return null;}}
export function saveDeviceCapability(profile,storage=globalThis.localStorage){try{storage?.setItem?.(KEY,JSON.stringify(profile));return true;}catch{return false;}}
export function deviceCapabilityProfile(options={}){const detected=detectDeviceCapability(options),saved=loadDeviceCapability(options.storage);if(!saved)return detected;const tierOrder=['low','mobile','mid','high'];const tier=tierOrder[Math.min(tierOrder.indexOf(detected.tier),tierOrder.indexOf(saved.tier))]||detected.tier;return Object.freeze({...detected,tier,initialQuality:Math.max(detected.initialQuality,Number(saved.initialQuality)||0),learned:true});}
