import test from 'node:test';
import assert from 'node:assert/strict';
import {authoredEffectBase,createEffekseerBackend,loadEffekseer} from '../src/rebuild/effekseer-loader.js';
import {EFFECT_ASSETS,AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
const baseUrl=new URL('https://game.test/dev/rinne/simulator/assets/effekseer/');
const budget={instanceMaxCount:512,squareMaxCount:512};
function harness({mode='normal',deferResource=false}={}){
  const calls={requests:[],nativeCallbacks:0,release:0,releaseEffect:0,updates:[],draws:0,reset:0,stop:0,played:[]};
  const urls=[];
  class Image {set src(value){this.value=value;if(value)queueMicrotask(()=>this.onload?.());}}
  const doc={baseURI:'https://game.test/dev/rinne/',defaultView:{Image,Blob,URL:{createObjectURL(){const url=`blob:image-${urls.length}`;urls.push(url);return url;},revokeObjectURL(url){urls.splice(urls.indexOf(url),1);}}}};
  let resourceLoader,sourceCount=0;
  const sdk={createContext:()=>context,releaseContext(){calls.release++;}};
  const context={
    init(gl,options){calls.options=options;if(mode==='init-fail')throw Error('context init failure');},
    setRestorationOfStatesFlag(value){calls.restore=value;},
    setResourceLoader(value){resourceLoader=value;},
    loadEffect(bytes,scale,onload,_onerror,redirect){
      assert.ok(bytes instanceof ArrayBuffer);const index=sourceCount++,effect={isLoaded:false,scale};
      const resources=['Texture/SwordLine01.png','Parts/ToonBase.efkmat','Parts/AuraTube.efkmat'];
      let resource=resources[index]||resources[resources.length-1];
      if(mode==='unlisted'&&index===1)resource='unreviewed.png';
      if(mode==='optional'&&index===1)resource='Parts/ToonBase.efkmatd';
      resourceLoader(redirect(resource),data=>{
        calls.nativeCallbacks++;if(mode==='optional'&&index===1)assert.equal(data,null);
        effect.isLoaded=true;onload();
      });return effect;
    },
    releaseEffect(){calls.releaseEffect++;},
    stopAll(){calls.stop++;},
    update(value){calls.updates.push(value);},
    setProjectionMatrix(value){calls.projection=value;},setCameraMatrix(value){calls.camera=value;},
    draw(){calls.draws++;},
    play(effect,x,y,z){
      calls.played.push({effect,x,y,z});return {setRotation(...args){calls.rotation=args;},setScale(...args){calls.scale=args;},setAllColor(...args){calls.color=args;},stop(){},exists:true};
    },
  };
  const fetchImpl=async(url,{signal}={})=>{
    const parsed=new URL(url),key=parsed.pathname.slice(baseUrl.pathname.length);calls.requests.push(parsed.href);
    const row=EFFECT_ASSETS.find(r=>r.path===key);assert.ok(row,`pinned request: ${key}`);
    if(deferResource&&!key.endsWith('.efkefc'))return new Promise((_,reject)=>{
      signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});
      if(signal.aborted)reject(Error('aborted'));
    });
    return {ok:true,arrayBuffer:async()=>new ArrayBuffer(row.byteLength)};
  };
  const renderer={getContext:()=>({}),resetState(){calls.reset++;}};
  const controller=new AbortController();
  const start=()=>createEffekseerBackend({renderer,document:doc,baseUrl,signal:controller.signal,budget,fetchImpl,sdkLoader:async()=>sdk});
  return {start,calls,controller,doc,urls,renderer,context,sdk};
}
test('asset URL respects app mount path and rejects cross-origin base',()=>{
  const doc={baseURI:'https://game.test/dev/rinne/index.html'};
  assert.equal(authoredEffectBase(doc).href,baseUrl.href);
  assert.throws(()=>authoredEffectBase(doc,'https://other.test/'),/same-origin/);
});
test('owned SDK loader prefetches originals and renders with state restoration and bounded particles',async()=>{
  const h=harness(),b=await h.start();assert.deepEqual(h.calls.options,budget);assert.equal(h.calls.restore,true);
  assert.equal(h.calls.requests.length,6);assert.equal(h.calls.nativeCallbacks,3);assert.equal(h.urls.length,0);
  const cue={effect:'impact',position:{x:2,y:1,z:4},rotation:{x:0,y:1,z:0},scale:1.8,color:[255,200,150,255]};
  b.play(cue);assert.equal(h.calls.played[0].effect.scale,AUTHORED_EFFECTS.impact.scale);assert.deepEqual(h.calls.scale,[1.8,1.8,1.8]);
  b.play({...cue,effect:'finisher',scale:1.15});assert.equal(h.calls.played[1].effect.scale,AUTHORED_EFFECTS.finisher.scale);assert.deepEqual(h.calls.scale,[1.15,1.15,1.15]);
  b.update(0);b.update(NaN);b.update(-1);assert.deepEqual(h.calls.updates,[]);b.update(.1);assert.deepEqual(h.calls.updates,[3]);
  b.draw({projectionMatrix:{elements:[1]},matrixWorldInverse:{elements:[2]}});assert.equal(h.calls.draws,1);
  b.dispose();b.dispose();await flush();assert.equal(h.calls.release,1);assert.equal(h.calls.releaseEffect,3);
});
test('optional material compilation cache returns an explicit miss without an unpinned request',async()=>{
  const h=harness({mode:'optional'}),b=await h.start();assert.equal(h.calls.requests.some(u=>u.endsWith('.efkmatd')),false);
  assert.equal(h.calls.nativeCallbacks,3);b.dispose();await flush();assert.equal(h.calls.release,1);
});
test('unknown material/texture dependency fails instead of silently downloading unreviewed data',async()=>{
  const h=harness({mode:'unlisted'});await assert.rejects(h.start(),/Unpinned/);await flush();
  assert.ok(h.calls.nativeCallbacks<=1);assert.equal(h.calls.release,1);
});
test('abort during resource loading suppresses every late native callback and releases context once',async()=>{
  const h=harness({deferResource:true});const promise=h.start();await flush();
  assert.equal(h.calls.requests.length,6);h.controller.abort();await assert.rejects(promise,/disposed/);await flush();
  assert.equal(h.calls.nativeCallbacks,0);assert.equal(h.calls.release,1);
});
test('abort before asynchronous SDK completion never creates a native context',async()=>{
  const h=harness();h.controller.abort();await assert.rejects(h.start(),/disposed/);assert.equal(h.calls.options,undefined);assert.equal(h.calls.release,0);
});
test('partial context initialization failure is contained and cleanup attempted',async()=>{
  const h=harness({mode:'init-fail'});await assert.rejects(h.start(),/init failure/);await flush();assert.equal(h.calls.release,1);
});
test('failed script is cached once and timers are cleaned up',async()=>{
  let appends=0,removed=0;
  const doc={defaultView:{},createElement:()=>({remove(){removed++;}}),head:{append(script){appends++;queueMicrotask(()=>script.onerror());}}};
  await assert.rejects(loadEffekseer(doc,baseUrl),/script unavailable/);
  await assert.rejects(loadEffekseer(doc,baseUrl),/script unavailable/);assert.equal(appends,1);assert.equal(removed,1);
});
test('script loader rejects an existing foreign runtime without replacing it',async()=>{
  const existing={},doc={defaultView:{effekseer:existing},createElement:()=>({remove(){}}),head:{append(){throw Error('must not append');}}};
  await assert.rejects(loadEffekseer(doc,baseUrl),/already owns/);assert.equal(doc.defaultView.effekseer,existing);
});
