import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as Three from '../public/simulator/vendor/three.js';
import {GLTFLoader} from '../public/simulator/vendor/GLTFLoader.js';
import {HumanoidRuntime} from '../public/simulator/src/humanoid.js';
import {SLASH_SECONDS,SLASH_REVISION} from '../public/simulator/src/authored-slash.js';
import {PERFORMANCE_SECONDS,PERFORMANCE_REVISION,SWORD_TIMINGS,applyPerformance} from '../public/simulator/src/sword-performance.js';
import {SWORD_MOVES,SWORD_REVISION} from '../public/simulator/src/authored-sword.js';
import {SHORT_SWORD_SECONDS,SHORT_SWORD_SEQUENCE,createSwordSequence,applySwordSequence} from '../public/simulator/src/sword-sequence.js';
import {createReviewSword} from '../public/simulator/src/review-sword.js';

// Exercise the actual viewer handlers and real model/rig. Only browser surfaces,
// texture decoding and GPU drawing are substituted; this does not assert visuals.
test('existing-motion viewer composes clips, selects individual techniques and synchronizes the reference',async()=>{
 const html=await readFile(new URL('../public/simulator/motion-review.html',import.meta.url),'utf8');
 const source=(await readFile(new URL('../public/simulator/src/motion-review.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('configure();start();','configure();await start();');
 const box={getBoundingClientRect:()=>({width:400,height:580})};
 class Element{
  constructor(){this.value='';this.checked=false;this.hidden=false;this.disabled=true;this.parentElement=box;this.paused=true;this.readyState=1;this.currentTime=0;this.listeners={};}
  setAttribute(k,v){this[k]=v;}getAttribute(k){return this[k]??null;}addEventListener(k,v){this.listeners[k]=v;}
  pause(){this.paused=true;}async play(){this.paused=false;}
 }
 const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 ids.speed.value='1';ids.repeat.checked=true;ids.trail.checked=true;
 const views=['three','front','side','back'].map(view=>Object.assign(new Element(),{dataset:{view}}));
 const document={hidden:false,listeners:{},getElementById:id=>ids[id],querySelectorAll:()=>views,addEventListener(k,v){this.listeners[k]=v;}};
 const location={href:'https://example.test/simulator/motion-review.html?mode=flow',search:'?mode=flow'};
 const window={listeners:{},history:{replaceState(_a,_b,url){location.href=String(url);}},addEventListener(k,v){this.listeners[k]=v;},assetBuffer:async id=>{const path=id.startsWith('motion:')?'motions/'+id.slice(7)+'.vrma':id+'_review.vrm';const b=await readFile(new URL('../public/simulator/assets/'+path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}};
 class Renderer{setPixelRatio(){}setSize(){}render(){}dispose(){}}
 class OrbitControls{constructor(){this.target=new Three.Vector3();}update(){}addEventListener(){}dispose(){}}
 let nextFrame,now=1000;const tick=ms=>{now+=ms;nextFrame(now);};
 const parse=GLTFLoader.prototype.parseAsync;
 GLTFLoader.prototype.parseAsync=function(data,path){this.register(()=>({name:'CpuViewerTextureStub',loadTexture:()=>Promise.resolve(new Three.Texture())}));return parse.call(this,data,path);};
 globalThis.window=window;globalThis.self=globalThis;
 const context={T:{...Three,WebGLRenderer:Renderer},OrbitControls,HumanoidRuntime,SLASH_SECONDS,SLASH_REVISION,PERFORMANCE_SECONDS,PERFORMANCE_REVISION,SWORD_TIMINGS,applyPerformance,SWORD_MOVES,SWORD_REVISION,SHORT_SWORD_SECONDS,SHORT_SWORD_SEQUENCE,createSwordSequence,applySwordSequence,createReviewSword,document,window,location,URL,URLSearchParams,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn;return 1;},cancelAnimationFrame(){}};
 try{
  await vm.runInNewContext('(async()=>{'+source+'})()',context);
  assert.equal(ids.play.disabled,false,ids['motion-status'].textContent);
  assert.equal(ids.mode.value,'combination');assert.equal(ids.timeline.max,'4');assert.equal(ids.repeat.checked,false);assert.equal(ids.trail.checked,false);
  tick(0);tick(100);assert.ok(Number(ids.timeline.value)>.09);
  ids.play.onclick();const paused=ids.timeline.value;tick(100);assert.equal(ids.timeline.value,paused);
  ids.speed.value='.5';ids.play.onclick();tick(100);tick(200);assert.ok(Math.abs(Number(ids.timeline.value)-.2)<1e-6);
  ids['compare-reference'].checked=true;ids['compare-reference'].onchange();assert.equal(ids['reference-panel'].hidden,false);assert.equal(ids['reference-video'].playbackRate,.5);
  ids.timeline.oninput({target:{value:'2.5'}});assert.equal(ids.timeline.value,'2.5');assert.equal(ids['reference-video'].currentTime,2.5);assert.equal(ids['reference-video'].paused,true);
  ids.speed.value='.25';ids.speed.onchange();assert.equal(ids['reference-video'].playbackRate,.25);
  ids['next-frame'].onclick();assert.ok(Math.abs(Number(ids.timeline.value)-2.5-1/60)<1e-8);
  ids.speed.value='.5';ids.speed.onchange();
  ids.mode.onchange({target:{value:'baseline'}});assert.equal(ids.mode.value,'baseline');assert.equal(ids.timeline.value,'0');assert.match(location.href,/mode=baseline/);
  ids.mode.onchange({target:{value:'combination'}});ids.timeline.oninput({target:{value:'3.95'}});ids.play.onclick();tick(100);tick(100);
  assert.equal(ids.timeline.value,'4');assert.equal(ids.play.textContent,'再生');assert.equal(ids['reference-video'].paused,true);
  ids.mode.onchange({target:{value:'single'}});assert.equal(ids.timeline.max,'0.66');assert.equal(ids['compare-reference'].disabled,true);assert.equal(ids['reference-panel'].hidden,true);
  for(const [kind,move] of Object.entries(SWORD_MOVES)){ids['single-kind'].onchange({target:{value:kind}});assert.equal(ids.timeline.max,String(move.seconds));assert.match(ids['motion-version'].textContent,new RegExp(move.label));}
  ids.mode.onchange({target:{value:'sequence'}});assert.equal(ids.timeline.max,'30');
  console.log('Actual viewer handlers: load, autoplay, pause, speed, seek, frame step, reference sync, mode switch and once endpoint passed.');
 }finally{window.listeners.pagehide?.({persisted:false});GLTFLoader.prototype.parseAsync=parse;delete globalThis.window;delete globalThis.self;}
});
