import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTitleCinematicController} from '../src/title-cinematic.js';
import {validateTitleManifest} from '../src/title-cinematic-media.js';
const manifest=JSON.parse(await readFile(new URL('../public/title-assets/cinematic/manifest.json',import.meta.url)));
const ready={...manifest,status:'ready',revision:'decoder-fixture',movie:'./title-assets/cinematic/opening.mp4',duration:8,livingLoop:{start:6,end:8}};
const pending={...manifest,status:'awaiting-generation',movie:null,webm:null};

class Element extends EventTarget{
  constructor(){super();this.dataset={};this.attributes={};this.hidden=false;}
  setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}
  querySelector(){return null;}
}
class Video extends Element{
  currentTime=0;readyState=4;paused=true;ended=false;playCalls=0;
  load(){}canPlayType(){return '';}
  play(){this.paused=false;this.playCalls++;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
  pause(){this.paused=true;}
  tick(t){this.currentTime=t;this.dispatchEvent(new Event('timeupdate'));}
}

test('manifest enforces timeline and local media contracts',()=>{
  assert.equal(validateTitleManifest(manifest).titleLandingTime,6);
  for(const mutation of [{duration:5},{firstVisitSkipTime:7},{movie:null},{poster:'https://invalid/x.webp'},{livingLoop:{start:5,end:8}},{fps:0}])assert.throws(()=>validateTitleManifest({...ready,...mutation}));
});

test('film lifecycle: first skip, exact landing, return, reduced motion, failure and disposal',async t=>{
  const doc=new Element(),storage=new Map(),motion=new Element();motion.matches=false;doc.hidden=false;
  t.mock.method(globalThis,'setTimeout',setTimeout);
  t.mock.timers.enable({apis:['setTimeout']});
  const originals={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
  globalThis.window={matchMedia:()=>motion};globalThis.document=doc;
  globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  const controllers=[];
  const make=async(m=ready)=>{
    const title=new Element(),menu=new Element(),poster={},video=new Video(),toggle=new Element();
    title.querySelector=s=>s==='.title-actions'?menu:s==='.title-world-base'?poster:null;
    let stops=0;const c=createTitleCinematicController({title,video,motionToggle:toggle,motionKey:'test-film',manifest:m,getPrepared:()=>({stopTitlePreview(){stops++;}})});
    controllers.push(c);await c.init();c.begin();return {c,title,menu,video,stops:()=>stops};
  };
  try{
    const first=await make();assert.equal(first.title.dataset.intro,'cinematic');assert.equal(first.menu.inert,true);
    first.video.tick(1.7);assert.equal(first.c.skip(),false);
    first.video.tick(1.8);assert.equal(first.c.skip(),true);assert.equal(first.video.currentTime,6);
    first.video.dispatchEvent(new Event('seeked'));t.mock.timers.tick(650);
    assert.equal(first.title.dataset.intro,'idle');assert.equal(first.menu.inert,false);assert.equal(first.title.dataset.media,'video');
    first.video.tick(7.99);assert.equal(first.video.currentTime,6,'only the authored living tail loops');
    first.c.pause();first.c.begin();assert.equal(first.title.dataset.intro,'idle');assert.equal(first.video.currentTime,6,'return never replays the opening');assert.ok(first.stops()>0);
    const revisit=await make();assert.equal(revisit.c.skip(),true,'a seen revision skips before playback advances');
    revisit.c.dispose();assert.equal(revisit.video.paused,true);
    const natural=await make();natural.video.tick(6);assert.equal(natural.title.dataset.intro,'settling');t.mock.timers.tick(650);assert.equal(natural.title.dataset.intro,'idle');
    const still=await make({...ready,revision:'no-loop',duration:6,livingLoop:null});still.video.tick(6);t.mock.timers.tick(650);assert.equal(still.title.dataset.intro,'idle');assert.equal(still.video.paused,true,'a six-second film holds its decoded final frame');
    const stillSkip=await make({...ready,revision:'no-loop',duration:6,livingLoop:null});assert.equal(stillSkip.c.skip(),true);assert.equal(stillSkip.video.currentTime,6-1/24);stillSkip.video.dispatchEvent(new Event('seeked'));assert.equal(stillSkip.video.paused,true);
    doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(natural.video.paused,true);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(natural.video.paused,false);
    natural.c.setMotion(false);assert.equal(natural.title.dataset.media,'poster');natural.c.setMotion(true);assert.equal(natural.video.currentTime,6);
    const missing=await make(pending);assert.equal(missing.video.playCalls,0);assert.equal(missing.title.dataset.intro,'idle');
    const broken=await make();broken.video.dispatchEvent(new Event('error'));broken.video.dispatchEvent(new Event('playing'));broken.c.begin();assert.equal(broken.title.dataset.media,'poster');assert.equal(broken.menu.inert,false);
    const stalled=await make();t.mock.timers.tick(4500);assert.equal(stalled.title.dataset.mediaStatus,'media-timeout');
    globalThis.fetch=async()=>{throw Error('offline');};const offline=await make(null);offline.c.begin();assert.equal(offline.title.dataset.intro,'idle','manifest failure cannot return to pending');
    const loading=await make();loading.video.readyState=0;assert.equal(loading.c.skip(),true);loading.video.readyState=4;loading.video.dispatchEvent(new Event('loadedmetadata'));assert.equal(loading.video.currentTime,6);
    motion.matches=true;const reduced=await make();assert.equal(reduced.video.playCalls,0);assert.equal(reduced.menu.inert,false);
  }finally{for(const c of controllers)c.dispose();Object.assign(globalThis,originals);}
});
