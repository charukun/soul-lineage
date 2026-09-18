import {AUTHORED_EFFECTS,EFFECT_ASSETS,EFFECT_PUBLIC_PATH} from './authored-effect-manifest.js';

const runtimes=new WeakMap(),dispatchers=new WeakMap();let nextOwner=0;
const OWNER='rinne-vfx-owner';

export function authoredEffectBase(document,base=import.meta.env?.BASE_URL||'./'){
  const url=new URL(EFFECT_PUBLIC_PATH,new URL(base,document.baseURI));
  if(url.origin!==new URL(document.baseURI).origin)throw Error('VFX assets must be same-origin');
  return url;
}

async function fetchBytes(url,signal,fetchImpl,expected){
  const response=await fetchImpl(url,{signal,credentials:'same-origin'});
  if(!response.ok)throw Error(`VFX asset HTTP ${response.status}: ${new URL(url).pathname}`);
  const bytes=await response.arrayBuffer();
  if(expected!=null&&bytes.byteLength!==expected)throw Error('VFX asset size mismatch');
  return bytes;
}

function loadImage(bytes,document,signal){
  return new Promise((resolve,reject)=>{
    const win=document.defaultView||globalThis,image=new win.Image();
    const url=win.URL.createObjectURL(new win.Blob([bytes],{type:'image/png'}));let settled=false;
    const finish=(error)=>{
      if(settled)return;settled=true;signal.removeEventListener('abort',abort);image.onload=null;image.onerror=null;
      win.URL.revokeObjectURL(url);if(error){image.src='';reject(error);}else resolve(image);
    };
    const abort=()=>finish(Error('VFX image loading cancelled'));
    image.onload=()=>finish();image.onerror=()=>finish(Error('VFX image decoding failed'));
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}image.src=url;
  });
}

export function loadEffekseer(document,baseUrl,{fetchImpl=globalThis.fetch}={}){
  if(runtimes.has(document))return runtimes.get(document);
  const promise=new Promise((resolve,reject)=>{
    const win=document.defaultView||globalThis,abort=new AbortController();let settled=false,wasmUrl;
    const script=document.createElement('script');script.async=true;script.src=new URL('./effekseer.js',baseUrl).href;
    const finish=(error,sdk)=>{
      if(settled)return;settled=true;clearTimeout(timer);abort.abort();script.onload=null;script.onerror=null;
      if(wasmUrl)win.URL.revokeObjectURL(wasmUrl);
      if(error){script.remove();reject(error);}else resolve(sdk);
    };
    const timer=setTimeout(()=>finish(Error('Effekseer initialization timed out')),20_000);
    if(win.effekseer){finish(Error('Another Effekseer runtime already owns this document'));return;}
    script.onerror=()=>finish(Error('Effekseer script unavailable'));
    script.onload=async()=>{
      try{
        const sdk=win.effekseer;if(typeof sdk?.initRuntime!=='function')throw Error('Effekseer runtime invalid');
        const bytes=await fetchBytes(new URL('./effekseer.wasm',baseUrl),abort.signal,fetchImpl,1201973);
        const magic=new Uint8Array(bytes,0,4);if(magic[0]!==0||magic[1]!==97||magic[2]!==115||magic[3]!==109)throw Error('Effekseer WASM invalid');
        if(settled)return;wasmUrl=win.URL.createObjectURL(new win.Blob([bytes],{type:'application/wasm'}));
        sdk.initRuntime(wasmUrl,()=>finish(null,sdk),()=>finish(Error('Effekseer WASM unavailable')));
      }catch(error){finish(error);}
    };
    try{document.head.append(script);}catch(error){finish(error);}
  });
  // Cache failure too: a missing optional asset must not create a retry storm.
  runtimes.set(document,promise);return promise;
}

function dispatcherFor(sdk){
  if(dispatchers.has(sdk))return dispatchers.get(sdk);
  const owners=new Map();
  const load=(raw,onload)=>{
    const url=new URL(raw),owner=owners.get(url.searchParams.get(OWNER));if(!owner||owner.disposed)return;
    url.searchParams.delete(OWNER);const key=url.href,row=owner.allowed.get(key);
    // Native Effekseer can ask for an optional compiled-material cache. The raw
    // pinned .efkmat is the source; explicitly return a cache miss, not a 404 hit.
    if(!row&&/\.efkmat[cd]$/.test(url.pathname)){
      const source=new URL(url);source.pathname=source.pathname.slice(0,-1);
      if(owner.allowed.has(source.href)){queueMicrotask(()=>{if(!owner.disposed)onload(null);});return;}
    }
    if(!row){owner.fail(Error(`Unpinned VFX dependency: ${url.pathname}`));return;}
    owner.pending++;
    let pending=owner.cache.get(key);
    if(!pending){
      pending=fetchBytes(url,owner.abort.signal,owner.fetchImpl,row.byteLength)
        .then(bytes=>row.path.endsWith('.png')?loadImage(bytes,owner.document,owner.abort.signal):bytes);
      owner.cache.set(key,pending);
    }
    pending.then(data=>{if(!owner.disposed)onload(data);})
      .catch(error=>owner.fail(error)).finally(()=>{owner.pending--;owner.reap();});
  };
  const dispatcher={owners,load};dispatchers.set(sdk,dispatcher);return dispatcher;
}

/**
 * Own every resource callback. On dispose, abort requests and suppress callbacks
 * before releasing native memory; an SDK callback cannot revive a torn-down view.
 */
export async function createEffekseerBackend({renderer,document,baseUrl,signal,
  fetchImpl=globalThis.fetch,sdkLoader=loadEffekseer,budget,effectDefinitions=AUTHORED_EFFECTS}){
  const sdk=await sdkLoader(document,baseUrl,{fetchImpl});
  if(signal?.aborted)throw Error('VFX view disposed');
  const abort=new AbortController(),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});
  let context,initialized=false,disposed=false,released=false,pending=0,failed;
  const effects=new Map(),cache=new Map(),id=String(++nextOwner),dispatcher=dispatcherFor(sdk);
  const allowed=new Map(EFFECT_ASSETS.map(row=>[new URL(row.path,baseUrl).href,row]));
  let rejectReady;
  const owner={document,fetchImpl,abort,allowed,cache,get disposed(){return disposed;},
    get pending(){return pending;},set pending(value){pending=value;},
    fail(error){if(disposed)return;failed=error;close();rejectReady?.(error);},reap};
  const loaded=[];
  function reap(){
    if(!disposed||pending!==0||released||!context)return;
    released=true;dispatcher.owners.delete(id);
    // SDK initialization can fail after allocating partial context resources.
    if(initialized)for(const effect of effects.values())if(effect?.isLoaded){try{context.releaseEffect(effect);}catch{}}
    try{sdk.releaseContext(context);}catch{/* Partial initialization may have no native context. */}
    cache.clear();signal?.removeEventListener('abort',cancel);renderer.resetState();
  }
  function close(){if(disposed)return;disposed=true;abort.abort();if(initialized){try{context.stopAll();}catch{}}queueMicrotask(reap);}
  const timeout=setTimeout(()=>owner.fail(Error('VFX resource loading timed out')),15_000);
  const onAbort=()=>{owner.fail(Error('VFX view disposed'));};signal?.addEventListener('abort',onAbort,{once:true});
  try{
    const originals=await Promise.all(Object.entries(effectDefinitions).map(async([key,asset])=>{
      const url=new URL(asset.path,baseUrl),row=allowed.get(url.href);
      if(!row)throw Error(`Unpinned authored VFX: ${asset.path}`);
      return [key,asset,await fetchBytes(url,abort.signal,fetchImpl,row.byteLength)];
    }));
    if(disposed||abort.signal.aborted)throw failed||Error('VFX view disposed');
    context=sdk.createContext();context.init(renderer.getContext(),{instanceMaxCount:budget.instanceMaxCount,squareMaxCount:budget.squareMaxCount});
    initialized=true;context.setRestorationOfStatesFlag(true);context.setResourceLoader(dispatcher.load);dispatcher.owners.set(id,owner);
    let failLoading;
    const loadingFailure=new Promise((_,reject)=>{failLoading=reject;});rejectReady=failLoading;
    for(const [key,asset,bytes] of originals){
      loaded.push(new Promise((resolve,reject)=>{
        const effect=context.loadEffect(bytes,asset.scale,resolve,reason=>reject(Error(String(reason))),relative=>{
          const url=new URL(relative,new URL(asset.path,baseUrl));url.searchParams.set(OWNER,id);return url.href;
        });
        effects.set(key,effect);
      }));
    }
    await Promise.race([Promise.all(loaded),loadingFailure]);
    if(disposed)throw failed||Error('VFX view disposed');
    clearTimeout(timeout);renderer.resetState();
    return {
      play(cue){
        if(disposed)return null;const handle=context.play(effects.get(cue.effect),cue.position.x,cue.position.y,cue.position.z);
        if(!handle)return null;
        handle.setRotation(cue.rotation.x,cue.rotation.y,cue.rotation.z);handle.setScale(cue.scale,cue.scale,cue.scale);
        handle.setAllColor(...cue.color);return handle;
      },
      update(dt){if(!disposed&&Number.isFinite(dt)&&dt>0)context.update(Math.min(dt,.05)*60);},
      draw(camera){if(disposed)return;context.setProjectionMatrix(camera.projectionMatrix.elements);context.setCameraMatrix(camera.matrixWorldInverse.elements);context.draw();},
      clear(){if(!disposed)context.stopAll();},
      dispose(){signal?.removeEventListener('abort',onAbort);close();},
      snapshot:()=>({disposed,pendingResources:pending}),
    };
  }catch(error){close();throw error;}
  finally{clearTimeout(timeout);if(disposed){signal?.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',cancel);}}
}
