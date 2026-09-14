const CACHE_PREFIX='soul-assets';
const memory=new Map();
const safeHash=value=>String(value||'dev').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,96);

export function assetCacheName(version='dev'){return `${CACHE_PREFIX}-${safeHash(version)}`;}

export function createAssetResidencyCache({version='dev',fetchImpl=globalThis.fetch,cachesImpl=globalThis.caches,maxEntries=160}={}){
  const name=assetCacheName(version);let hits=0,misses=0,puts=0,evictions=0;
  async function cache(){return cachesImpl?.open?cachesImpl.open(name):null;}
  async function keyFor(url,hash=''){const u=new URL(url,globalThis.location?.href||'https://local.invalid/');if(hash)u.searchParams.set('__soul_hash',safeHash(hash));return u.href;}
  async function trim(store){if(!store?.keys)return;const keys=await store.keys();if(keys.length<=maxEntries)return;for(const req of keys.slice(0,keys.length-maxEntries)){await store.delete(req);evictions++;}}
  return {
    async fetch(url,{hash='',requestInit={}}={}){
      const key=await keyFor(url,hash);
      if(memory.has(key)){hits++;return memory.get(key).clone();}
      const store=await cache();
      const cached=await store?.match?.(key);
      if(cached){hits++;memory.set(key,cached.clone());return cached.clone();}
      misses++;
      const response=await fetchImpl(url,requestInit);
      if(!response.ok)throw new Error(`Asset HTTP ${response.status}: ${url}`);
      const copy=response.clone();memory.set(key,copy.clone());
      if(store){await store.put(key,copy);puts++;await trim(store);}
      return response;
    },
    async arrayBuffer(url,options){return (await this.fetch(url,options)).arrayBuffer();},
    async invalidate(){memory.clear();if(cachesImpl?.delete)await cachesImpl.delete(name);},
    snapshot(){return Object.freeze({name,version,hits,misses,puts,evictions,memoryEntries:memory.size,persistent:Boolean(cachesImpl?.open)});},
  };
}

export async function pruneOldAssetCaches({keepVersion='dev',cachesImpl=globalThis.caches}={}){
  if(!cachesImpl?.keys)return{removed:0};const keep=assetCacheName(keepVersion);let removed=0;
  for(const name of await cachesImpl.keys())if(name.startsWith(`${CACHE_PREFIX}-`)&&name!==keep){if(await cachesImpl.delete(name))removed++;}
  return{removed};
}
