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
  fetchImpl=globalThis.fetch,sdkLoader=loadEffekseer,budget,effectDefinitions=AUTHORED_EFFECTS,
  streaming=false,fallbackEffects=['slash','impact'],maxResident=24,retentionMs=60_000}){
  const sdk=await sdkLoader(document,baseUrl,{fetchImpl});
  if(signal?.aborted)throw Error('VFX view disposed');
  const abort=new AbortController(),cancel=()=>abort.abort();signal?.addEventListener('abort',cancel,{once:true});
  let context,initialized=false,disposed=false,released=false,pending=0,failed,pumping=false,lastSweep=0,fallbackPlays=0;
  const effects=new Map(),loads=new Map(),cache=new Map(),queue=new Map(),lastUsed=new Map(),demanded=new Set();
  const id=String(++nextOwner),dispatcher=dispatcherFor(sdk);
  const allowed=new Map(EFFECT_ASSETS.map(row=>[new URL(row.path,baseUrl).href,row]));
  const keys=Object.keys(effectDefinitions||{});
  const fallbacks=[...new Set(fallbackEffects)].filter(key=>Object.hasOwn(effectDefinitions,key));
  if(!fallbacks.length&&keys.length)fallbacks.push(keys[0]);
  const residentLimit=Math.max(fallbacks.length,Number.isFinite(maxResident)?Math.max(1,Math.floor(maxResident)):24);
  const retention=Number.isFinite(retentionMs)?Math.max(0,retentionMs):60_000;
  const nowMs=()=>globalThis.performance?.now?.()??Date.now();
  let rejectReady;
  const owner={document,fetchImpl,abort,allowed,cache,get disposed(){return disposed;},
    get pending(){return pending;},set pending(value){pending=value;},
    fail(error){if(disposed)return;failed=error;close();rejectReady?.(error);},reap};
  function releaseEffect(key){
    const effect=effects.get(key);if(!effect)return false;
    if(effect?.isLoaded){try{context.releaseEffect(effect);}catch{}}
    effects.delete(key);lastUsed.delete(key);return true;
  }
  function evict(){
    if(!streaming||effects.size<=residentLimit||disposed)return;
    const protectedKeys=new Set([...fallbacks,...demanded]),now=nowMs();
    const candidates=[...effects.keys()].filter(key=>!protectedKeys.has(key)&&!loads.has(key)&&now-(lastUsed.get(key)||0)>=retention)
      .sort((a,b)=>(lastUsed.get(a)||0)-(lastUsed.get(b)||0));
    let evicted=false;
    for(const key of candidates){if(effects.size<=residentLimit)break;evicted=releaseEffect(key)||evicted;}
    if(evicted&&pending===0&&loads.size===0)cache.clear();
  }
  function reap(){
    if(!disposed||pending!==0||released||!context)return;
    released=true;dispatcher.owners.delete(id);
    if(initialized)for(const key of [...effects.keys()])releaseEffect(key);
    try{sdk.releaseContext(context);}catch{}
    cache.clear();signal?.removeEventListener('abort',cancel);renderer.resetState();
  }
  function close(){if(disposed)return;disposed=true;abort.abort();queue.clear();if(initialized){try{context.stopAll();}catch{}}queueMicrotask(reap);}
  const timeout=setTimeout(()=>owner.fail(Error('VFX resource loading timed out')),15_000);
  const onAbort=()=>owner.fail(Error('VFX view disposed'));signal?.addEventListener('abort',onAbort,{once:true});
  try{
    context=sdk.createContext();context.init(renderer.getContext(),{instanceMaxCount:budget.instanceMaxCount,squareMaxCount:budget.squareMaxCount});
    initialized=true;context.setRestorationOfStatesFlag(true);context.setResourceLoader(dispatcher.load);dispatcher.owners.set(id,owner);
    let failLoading;
    const loadingFailure=new Promise((_,reject)=>{failLoading=reject;});loadingFailure.catch(()=>{});rejectReady=failLoading;
    const loadOne=key=>{
      if(effects.has(key))return Promise.resolve(effects.get(key));
      if(loads.has(key))return loads.get(key);
      const asset=effectDefinitions[key];
      if(!asset)return Promise.reject(Error('Unknown authored VFX: '+key));
      const promise=(async()=>{
        const url=new URL(asset.path,baseUrl),row=allowed.get(url.href);
        if(!row)throw Error('Unpinned authored VFX: '+asset.path);
        const bytes=await fetchBytes(url,abort.signal,fetchImpl,row.byteLength);
        if(disposed||abort.signal.aborted)throw failed||Error('VFX view disposed');
        let effect;
        const nativeReady=new Promise((resolve,reject)=>{
          effect=context.loadEffect(bytes,asset.scale,()=>resolve(effect),reason=>reject(Error(String(reason))),relative=>{
            const dependency=new URL(relative,new URL(asset.path,baseUrl));dependency.searchParams.set(OWNER,id);return dependency.href;
          });
        });
        await Promise.race([nativeReady,loadingFailure]);
        if(disposed)throw failed||Error('VFX view disposed');
        effects.set(key,effect);lastUsed.set(key,nowMs());return effect;
      })().finally(()=>loads.delete(key));
      loads.set(key,promise);return promise;
    };
    async function pump(){
      if(pumping||disposed)return;pumping=true;
      try{
        while(queue.size&&!disposed){
          const next=[...queue].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
          queue.delete(next[0]);await loadOne(next[0]);evict();
        }
      }catch(error){owner.fail(error);}
      finally{pumping=false;}
    }
    const requestEffect=(key,priority=0)=>{
      if(disposed||!streaming||effects.has(key)||loads.has(key)||!Object.hasOwn(effectDefinitions,key))return false;
      queue.set(key,Math.max(queue.get(key)||-Infinity,Number(priority)||0));void pump();return true;
    };
    const initial=streaming?fallbacks:keys;
    await Promise.race([Promise.all(initial.map(loadOne)),loadingFailure]);
    if(disposed)throw failed||Error('VFX view disposed');
    clearTimeout(timeout);renderer.resetState();
    return {
      setDemand(rows=[]){
        demanded.clear();
        for(const row of Array.isArray(rows)?rows:[]){
          const key=typeof row==='string'?row:row?.effect,priority=typeof row==='string'?0:row?.priority;
          if(typeof key!=='string'||!Object.hasOwn(effectDefinitions,key))continue;
          demanded.add(key);requestEffect(key,priority);
        }
        evict();
      },
      play(cue){
        if(disposed)return null;
        let key=cue.effect,effect=effects.get(key);
        if(!effect&&streaming)requestEffect(key,120);
        if(!effect&&streaming){
          key=(String(cue.kind||'').includes('trail')&&effects.has('slash'))?'slash':effects.has('impact')?'impact':fallbacks.find(candidate=>effects.has(candidate));
          effect=key?effects.get(key):null;if(effect)fallbackPlays++;
        }
        if(!effect)return null;
        lastUsed.set(key,nowMs());
        const handle=context.play(effect,cue.position.x,cue.position.y,cue.position.z);
        if(!handle)return null;
        handle.setRotation(cue.rotation.x,cue.rotation.y,cue.rotation.z);handle.setScale(cue.scale,cue.scale,cue.scale);
        handle.setAllColor(...cue.color);return handle;
      },
      update(dt){
        if(!disposed&&Number.isFinite(dt)&&dt>0)context.update(Math.min(dt,.05)*60);
        if(streaming){const now=nowMs();if(now-lastSweep>=5000){lastSweep=now;evict();}}
      },
      draw(camera){if(disposed)return;context.setProjectionMatrix(camera.projectionMatrix.elements);context.setCameraMatrix(camera.matrixWorldInverse.elements);context.draw();},
      clear(){if(!disposed)context.stopAll();},
      dispose(){signal?.removeEventListener('abort',onAbort);close();},
      snapshot:()=>({disposed,pendingResources:pending,streaming,residentEffects:[...effects.keys()],loadingEffects:[...loads.keys()],queuedEffects:[...queue.keys()],fallbackPlays}),
    };
  }catch(error){close();throw error;}
  finally{clearTimeout(timeout);if(disposed){signal?.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',cancel);}}
}
