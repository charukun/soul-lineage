export async function probeExperimentalWebGPU({navigatorRef=globalThis.navigator}={}){
  if(!navigatorRef?.gpu)return Object.freeze({available:false,reason:'navigator.gpu unavailable',defaultBackend:'webgl2'});
  try{
    const adapter=await navigatorRef.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)return Object.freeze({available:false,reason:'no adapter',defaultBackend:'webgl2'});
    const limits={};for(const key of ['maxBindGroups','maxStorageBuffersPerShaderStage','maxTextureDimension2D'])if(Number.isFinite(adapter.limits?.[key]))limits[key]=adapter.limits[key];
    return Object.freeze({available:true,features:[...adapter.features].sort(),limits:Object.freeze(limits),defaultBackend:'webgl2',experimentalOnly:true});
  }catch(error){return Object.freeze({available:false,reason:error?.message||String(error),defaultBackend:'webgl2'});}
}

export function selectRendererBackend({webgpuAvailable=false,experimental=false}={}){return experimental&&webgpuAvailable?'webgpu-experimental':'webgl2';}
