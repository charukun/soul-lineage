const nowMs=()=>globalThis.performance?.now?.()??Date.now();

function releaseOne(state,key){
  const effect=state.allocated.get(key);if(!effect)return false;
  if(effect?.isLoaded){try{state.context.releaseEffect(effect);}catch{}}
  state.effects.delete(key);state.allocated.delete(key);state.lastUsed.delete(key);return true;
}
function evict(state){
  if(!state.streaming||state.effects.size<=state.residentLimit||state.disposed())return;
  const protectedKeys=new Set([...state.fallbacks,...state.demanded]),now=nowMs();
  const candidates=[...state.effects.keys()].filter(key=>!protectedKeys.has(key)&&!state.loads.has(key)&&now-(state.lastUsed.get(key)||0)>=state.retention)
    .sort((a,b)=>(state.lastUsed.get(a)||0)-(state.lastUsed.get(b)||0));
  let changed=false;
  for(const key of candidates){if(state.effects.size<=state.residentLimit)break;changed=releaseOne(state,key)||changed;}
  if(changed&&state.loads.size===0)state.onEvict?.();
}
async function loadNow(state,key){
  const asset=state.effectDefinitions[key];if(!asset)throw Error('Unknown authored VFX: '+key);
  const bytes=await state.loadSource(key,asset);if(state.disposed())throw Error('VFX view disposed');
  let effect;
  const nativeReady=new Promise((resolve,reject)=>{
    effect=state.context.loadEffect(bytes,asset.scale,()=>resolve(effect),reason=>reject(Error(String(reason))),relative=>state.resourceUrl(relative,asset.path));
    state.allocated.set(key,effect);
  });
  await Promise.race([nativeReady,state.failurePromise]);
  if(state.disposed())throw Error('VFX view disposed');
  state.effects.set(key,effect);state.lastUsed.set(key,nowMs());return effect;
}
function loadOne(state,key){
  if(state.effects.has(key))return Promise.resolve(state.effects.get(key));
  if(state.loads.has(key))return state.loads.get(key);
  const promise=loadNow(state,key).finally(()=>state.loads.delete(key));state.loads.set(key,promise);return promise;
}
async function pump(state){
  if(state.pumping||state.disposed())return;state.pumping=true;
  try{
    while(state.queue.size&&!state.disposed()){
      const next=[...state.queue].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
      state.queue.delete(next[0]);await loadOne(state,next[0]);evict(state);
    }
  }catch(error){state.onError(error);}finally{state.pumping=false;}
}
function requestEffect(state,key,priority=0){
  if(state.disposed()||!state.streaming||state.effects.has(key)||state.loads.has(key)||!Object.hasOwn(state.effectDefinitions,key))return false;
  state.queue.set(key,Math.max(state.queue.get(key)||-Infinity,Number(priority)||0));void pump(state);return true;
}
function resolveCue(state,cue){
  let key=cue.effect,effect=state.effects.get(key);
  if(!effect&&state.streaming)requestEffect(state,key,120);
  if(!effect&&state.streaming){
    key=(String(cue.kind||'').includes('trail')&&state.effects.has('slash'))?'slash':state.effects.has('impact')?'impact':state.fallbacks.find(candidate=>state.effects.has(candidate));
    effect=key?state.effects.get(key):null;if(effect)state.fallbackPlays++;
  }
  if(effect)state.lastUsed.set(key,nowMs());return effect;
}
function createState(options){
  const keys=Object.keys(options.effectDefinitions||{}),fallbacks=[...new Set(options.fallbackEffects||[])].filter(key=>Object.hasOwn(options.effectDefinitions,key));
  if(!fallbacks.length&&keys.length)fallbacks.push(keys[0]);
  return{...options,keys,fallbacks,effects:new Map(),allocated:new Map(),loads:new Map(),queue:new Map(),lastUsed:new Map(),demanded:new Set(),pumping:false,fallbackPlays:0,
    residentLimit:Math.max(fallbacks.length,Number.isFinite(options.maxResident)?Math.max(1,Math.floor(options.maxResident)):24),
    retention:Number.isFinite(options.retentionMs)?Math.max(0,options.retentionMs):60_000};
}

export function createEffekseerEffectPool(options){
  const state=createState(options);
  return{
    async initialize(){const initial=state.streaming?state.fallbacks:state.keys;await Promise.race([Promise.all(initial.map(key=>loadOne(state,key))),state.failurePromise]);},
    setDemand(rows=[]){state.demanded.clear();for(const row of Array.isArray(rows)?rows:[]){const key=typeof row==='string'?row:row?.effect,priority=typeof row==='string'?0:row?.priority;if(typeof key!=='string'||!Object.hasOwn(state.effectDefinitions,key))continue;state.demanded.add(key);requestEffect(state,key,priority);}evict(state);},
    resolve(cue){return resolveCue(state,cue);},
    sweep(){evict(state);},
    stopQueue(){state.queue.clear();},
    releaseAll(){for(const key of [...state.allocated.keys()])releaseOne(state,key);},
    snapshot(){return{residentEffects:[...state.effects.keys()],loadingEffects:[...state.loads.keys()],queuedEffects:[...state.queue.keys()],fallbackPlays:state.fallbackPlays};},
  };
}
