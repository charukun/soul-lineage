import { QA_FPS, QA_SEQUENCE, qaSequenceAt } from '@soul/animations';
import { buildReviewMotionRegistry } from './review-motion-registry.js';
import { parseKaykitMotionSource, loadPinnedMotionSource, disposePinnedMotionSources } from './review-motion-source-runtime.js';

export const WORKSHOP_MOTION_SOURCE_STATE='cc0-source-registry-v2';
const TARGET_REFERENCE_HEIGHT=2.02;
const MAX_CACHED_BANKS=8;

const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function cachePut(cache,key,value){
  if(cache.has(key))cache.delete(key);
  cache.set(key,value);
  while(cache.size>MAX_CACHED_BANKS)cache.delete(cache.keys().next().value);
}
async function bakeClip(source,record,{progress=()=>{}}={}){
  const fps=QA_FPS,index=record.upstreamClipIndex,duration=source.duration(index),frameCount=Math.max(2,Math.ceil(duration*fps)+1),frames=[];
  for(let frame=0;frame<frameCount;frame++){
    const seconds=Math.min(duration,frame/fps);
    frames.push(source.sample(index,seconds));
    if(frame&&frame%120===0){progress(frame/(frameCount-1));await yieldFrame();}
  }
  progress(1);
  return Object.freeze({
    version:2,fps,duration,revision:record.sourceIdentity,sourceHeight:TARGET_REFERENCE_HEIGHT,
    frames:Object.freeze(frames),qualityFrames:Object.freeze(frames),transitionRanges:Object.freeze([]),
    attachments:Object.freeze([]),socket:null,createSword:null,sources:Object.freeze([record.sourceIdentity]),record
  });
}
function pick(registry,patterns,fallback){
  const rows=registry.motions.filter(row=>row.runtime.kind==='kaykit-embedded');
  for(const pattern of patterns){const found=rows.find(row=>pattern.test(row.upstreamClipName));if(found)return found;}
  return fallback||rows[0];
}
function enbuSelection(registry){
  const idle=pick(registry,[/(^|[_\s-])idle([_\s-]|$)/i,/idle/i]);
  const walk=pick(registry,[/walk/i],idle);
  const run=pick(registry,[/run/i,/jog/i,/sprint/i],walk);
  const guard=pick(registry,[/guard|block/i,/sword.*idle|melee.*idle|1h.*idle/i],idle);
  const attack=pick(registry,[/sword.*attack|1h.*attack|attack.*1h/i,/melee.*attack/i,/attack|slash|chop/i],guard);
  const draw=pick(registry,[/draw|equip|unsheat/i],guard);
  const sheathe=pick(registry,[/sheath|holster/i],guard);
  return Object.freeze({idle,walk,run,draw,guard,slash:attack,sheathe,'idle-end':idle});
}
async function bakeEnbu(source,registry,{progress=()=>{}}={}){
  const selection=enbuSelection(registry),frames=[],sources=new Set(),duration=30;
  for(let frame=0;frame<=duration*QA_FPS;frame++){
    const seconds=frame/QA_FPS,row=qaSequenceAt(seconds),record=selection[row.id]||selection.idle;
    if(!record)throw new Error('KayKit source has no motion clip for the 30 second review');
    sources.add(record.sourceIdentity);
    const clipDuration=source.duration(record.upstreamClipIndex);
    const local=Math.max(0,row.localTime);
    const sampleTime=clipDuration>1/QA_FPS?Math.min(clipDuration,local%clipDuration):0;
    frames.push(source.sample(record.upstreamClipIndex,sampleTime));
    if(frame&&frame%120===0){progress(frame/(duration*QA_FPS));await yieldFrame();}
  }
  progress(1);
  return Object.freeze({
    version:2,fps:QA_FPS,duration,revision:`rinne-enbu-v2:${[...sources].map(value=>value.split('#')[1]).join('|')}`,
    sourceHeight:TARGET_REFERENCE_HEIGHT,frames:Object.freeze(frames),qualityFrames:Object.freeze(frames),
    transitionRanges:Object.freeze([]),attachments:Object.freeze([]),socket:null,createSword:null,
    sources:Object.freeze([...sources]),sequence:QA_SEQUENCE
  });
}

/**
 * License-clean motion library for the canonical character Workshop.
 * Catalog construction reads only the already-audited KayKit GLB JSON plus the
 * pinned external manifest. Animation frames are baked lazily per selected clip.
 */
export async function loadWorkshopMotionSource({sourceBytes,sourceDocument,progress=()=>{}}={}){
  if(!(sourceBytes instanceof ArrayBuffer))throw new Error('Audited KayKit motion source bytes are unavailable');
  if(!Array.isArray(sourceDocument?.animations)||!sourceDocument.animations.length)throw new Error('KayKit motion source has no animations');
  const registry=buildReviewMotionRegistry(sourceDocument.animations);
  progress(.05);
  const kaykit=await parseKaykitMotionSource(sourceBytes);
  progress(.18);
  const cache=new Map();
  let enbu=null;
  async function sourceFor(record){
    if(record.runtime.kind==='kaykit-embedded')return kaykit;
    if(record.runtime.kind==='pinned-motion-source')return loadPinnedMotionSource(record.sourceId);
    throw new Error(`Unknown motion runtime source: ${record.runtime.kind}`);
  }
  async function loadClip(identity,{onProgress=()=>{}}={}){
    const record=registry.byId[identity];
    if(!record)throw new Error('Unknown source motion identity');
    if(cache.has(identity)){
      const bank=cache.get(identity);cache.delete(identity);cache.set(identity,bank);return bank;
    }
    const source=await sourceFor(record);
    const bank=await bakeClip(source,record,{progress:onProgress});
    cachePut(cache,identity,bank);
    return bank;
  }
  async function loadEnbu({onProgress=()=>{}}={}){
    if(!enbu)enbu=await bakeEnbu(kaykit,registry,{progress:onProgress});
    return enbu;
  }
  progress(1);
  return Object.freeze({
    version:2,registry,loadClip,loadEnbu,
    get cacheSize(){return cache.size;},
    dispose(){kaykit.dispose();disposePinnedMotionSources();cache.clear();enbu=null;}
  });
}
