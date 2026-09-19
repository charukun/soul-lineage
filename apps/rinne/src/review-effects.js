import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAuthoredEffectPlayer} from './rebuild/authored-effect-player.js';
import {combatEffectBudget} from './rebuild/combat-effect-cues.js';
import {REVIEW_AUTHORED_EFFECTS,EFFECT_RUNTIME,EFFECT_SOURCE,REVIEW_EFFECT_SOURCE,REVIEW_VFX_LIBRARY_SOURCE} from './rebuild/authored-effect-manifest.js';
import {REVIEW_EFFECT_CATALOG,REVIEW_EFFECT_CATEGORIES,REVIEW_REAL_EFFECT_COUNT} from './review-effect-catalog.js';
import {authoredEffectBase,createEffekseerBackend} from './rebuild/effekseer-loader.js';
import './review-effects.css';

const q=id=>document.getElementById(id);
const effectName=key=>REVIEW_AUTHORED_EFFECTS[key]?.path?.split('/').pop()?.replace(/\.efkefc$/,'')||key;
const catalogById=new Map(REVIEW_EFFECT_CATALOG.map(entry=>[entry.id,entry]));
const REVIEW_CONTEXTS=Object.freeze({
  slash:Object.freeze({label:'SINGLE ATTACK',secondary:false,area:0,source:[-1.2,1.18,.08],impact:[1.48,1.15,.24]}),
  impact:Object.freeze({label:'IMPACT CHECK',secondary:false,area:0,source:[1.15,1.12,.08],impact:[1.55,1.16,.25]}),
  finisher:Object.freeze({label:'AREA FINISHER',secondary:true,area:1.45,source:[-.95,1.16,.06],impact:[1.55,1.08,.24]}),
  storm:Object.freeze({label:'MULTI TARGET',secondary:true,area:2.05,source:[-.95,1.16,.06],impact:[1.55,1.08,.24]}),
});

const canvas=q('fx-stage'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#090d0d');scene.fog=new THREE.Fog('#090d0d',10,24);
const camera=new THREE.PerspectiveCamera(42,1,.05,60);camera.position.set(4.8,3.2,6.2);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,1,0);controls.minDistance=3;controls.maxDistance=14;
scene.add(new THREE.HemisphereLight('#e9f3ed','#283632',2.1));const key=new THREE.DirectionalLight('#fff0cb',3.4);key.position.set(-4,7,5);scene.add(key);
const ground=new THREE.Mesh(new THREE.CircleGeometry(5.4,64),new THREE.MeshStandardMaterial({color:'#18211f',roughness:.92,metalness:.03}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);

const reviewDisposables=[];
const remember=object=>{reviewDisposables.push(object);return object;};
function material(color,{opacity=1,emissive='#000000',emissiveIntensity=0}={}){
  return remember(new THREE.MeshStandardMaterial({color,roughness:.66,metalness:.04,transparent:opacity<1,opacity,emissive,emissiveIntensity}));
}
function basic(color,opacity=.7){
  return remember(new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));
}
function mesh(geometry,mat){
  remember(geometry);
  return new THREE.Mesh(geometry,mat);
}
function createReviewMannequin({body,accent,ring,opacity=1,label}){
  const root=new THREE.Group();root.userData.label=label;
  const bodyMat=material(body,{opacity}),accentMat=material(accent,{opacity});
  const torso=mesh(new THREE.BoxGeometry(.5,.72,.3),bodyMat);torso.position.y=1.16;root.add(torso);
  const pelvis=mesh(new THREE.BoxGeometry(.38,.22,.27),accentMat);pelvis.position.y=.72;root.add(pelvis);
  const head=mesh(new THREE.IcosahedronGeometry(.23,2),bodyMat);head.position.y=1.72;root.add(head);
  for(const side of [-1,1]){
    const arm=mesh(new THREE.BoxGeometry(.14,.62,.15),accentMat);arm.position.set(.34*side,1.12,0);arm.rotation.z=-.1*side;root.add(arm);
    const leg=mesh(new THREE.BoxGeometry(.17,.7,.19),accentMat);leg.position.set(.12*side,.31,0);root.add(leg);
    const foot=mesh(new THREE.BoxGeometry(.2,.12,.38),bodyMat);foot.position.set(.12*side,.02,.08);root.add(foot);
  }
  const base=mesh(new THREE.RingGeometry(.34,.4,48),basic(ring,.55));base.rotation.x=-Math.PI/2;base.position.y=.012;root.add(base);
  return root;
}
function createPointGuide(color){
  const root=new THREE.Group();
  const ring=mesh(new THREE.TorusGeometry(.12,.018,8,32),basic(color,.92));root.add(ring);
  const core=mesh(new THREE.SphereGeometry(.035,12,12),basic(color,.95));root.add(core);
  return root;
}
function createImpactGuide(color){
  const root=new THREE.Group();
  const ring=mesh(new THREE.TorusGeometry(.16,.02,8,36),basic(color,.9));root.add(ring);
  const lineMat=remember(new THREE.LineBasicMaterial({color,transparent:true,opacity:.8,depthTest:false}));
  const horizontal=new THREE.Line(remember(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.22,0,0),new THREE.Vector3(.22,0,0)])),lineMat);
  const vertical=new THREE.Line(remember(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.22,0),new THREE.Vector3(0,.22,0)])),lineMat);
  root.add(horizontal,vertical);return root;
}
function createAreaGuide(color){
  const root=new THREE.Group();
  const ring=mesh(new THREE.RingGeometry(.92,1,72),basic(color,.42));ring.rotation.x=-Math.PI/2;root.add(ring);
  const inner=mesh(new THREE.CircleGeometry(.92,72),basic(color,.06));inner.rotation.x=-Math.PI/2;inner.position.y=-.002;root.add(inner);
  return root;
}
const attacker=createReviewMannequin({body:'#d9c990',accent:'#a99358',ring:'#d7c18e',label:'ATTACKER'});attacker.position.set(-1.55,0,0);scene.add(attacker);
const primary=createReviewMannequin({body:'#c6d8d8',accent:'#86a9ad',ring:'#9bbac0',label:'PRIMARY'});primary.position.set(1.55,0,0);scene.add(primary);
const secondaryB=createReviewMannequin({body:'#9fb3b5',accent:'#6f8d91',ring:'#8ba7b0',opacity:.62,label:'SECONDARY-B'});secondaryB.position.set(1.1,0,1.7);scene.add(secondaryB);
const secondaryC=createReviewMannequin({body:'#9fb3b5',accent:'#6f8d91',ring:'#8ba7b0',opacity:.62,label:'SECONDARY-C'});secondaryC.position.set(1.1,0,-1.7);scene.add(secondaryC);
const sourceGuide=createPointGuide('#f3d477');scene.add(sourceGuide);
const impactGuide=createImpactGuide('#ffffff');scene.add(impactGuide);
const areaGuide=createAreaGuide('#d8b75e');areaGuide.position.set(1.55,.014,0);scene.add(areaGuide);

const state={id:'visual-review-vfx',zone:'frontier',phase:'alive',interior:null,position:{x:-1.55,y:1,z:0}};
const front={stage:1,enemies:[{id:'target',x:1.55,y:1,z:0},{id:'target-b',x:1.1,y:1,z:1.7},{id:'target-c',x:1.1,y:1,z:-1.7}]};
const mobile=Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);let paused=false,speed=1,tier=0,reduced=false,selected='slash',serial=0,lastTrigger=-Infinity,disposed=false,activeFilter='all';
const abort=new AbortController();
const player=createAuthoredEffectPlayer({mobile,onError:error=>{q('fx-status').textContent=`VFX停止: ${error}`;}});

function eventsFor(preset){
  if(preset==='impact')return[{type:'enemy-hit',sourceId:'target',damage:18}];
  if(preset==='finisher')return[{type:'one-motion',targetId:'target',damage:48,manual:true,phase:'kyu'}];
  if(preset==='storm')return[
    {type:'one-motion',targetId:'target',damage:60,manual:true,phase:'kyu'},
    {type:'player-hit',targetId:'target-b',damage:24,phase:'ha'},
    {type:'enemy-hit',sourceId:'target-c',damage:16}
  ];
  return[{type:'player-hit',targetId:'target',damage:24,phase:'ha'}];
}
function effectLabel(preset){
  const entry=catalogById.get(preset);
  return entry?entry.effects.map(effectName).join(' + '):preset;
}
function applyReviewContext(preset){
  const entry=catalogById.get(preset);
  const context=REVIEW_CONTEXTS[entry?.context||preset]||REVIEW_CONTEXTS.slash;
  secondaryB.visible=context.secondary;secondaryC.visible=context.secondary;
  sourceGuide.position.set(...context.source);impactGuide.position.set(...context.impact);
  areaGuide.visible=context.area>0;
  if(context.area>0)areaGuide.scale.setScalar(context.area);
  q('fx-active-type').textContent=context.label;
}
function syncActiveCard(){
  for(const button of document.querySelectorAll('[data-preset]')){
    const active=button.dataset.preset===selected;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  const entry=catalogById.get(selected);if(!entry)return;
  q('fx-selected-label').textContent=entry.label;
  q('fx-selected-meta').textContent=effectLabel(entry.id);
  applyReviewContext(selected);
}
function rawCuesFor(entry){
  const context=REVIEW_CONTEXTS[entry.context]||REVIEW_CONTEXTS.slash;
  const dx=context.impact[0]-context.source[0],dz=context.impact[2]-context.source[2];
  const rotation={x:0,y:Math.atan2(dx,dz),z:0};
  return entry.cues.map(spec=>{
    const anchor=spec.anchor==='source'?context.source:context.impact;
    const [ox,oy,oz]=spec.offset;
    const definition=REVIEW_AUTHORED_EFFECTS[spec.effect];
    return {
      effect:spec.effect,
      position:{x:anchor[0]+ox,y:anchor[1]+oy,z:anchor[2]+oz},
      rotation,
      scale:spec.scale,
      lifetime:spec.lifetime??definition?.lifetime??1.5,
      color:[255,255,255,255],
      priority:spec.priority,
      kind:'review-original',
    };
  });
}
function trigger(preset=selected){
  const entry=catalogById.get(preset);if(!entry)return;
  if(selected!==preset)player.clear();
  selected=preset;serial++;lastTrigger=performance.now();
  applyReviewContext(preset);
  if(entry.mode==='combat')player.present(eventsFor(preset),{state,front,eventKey:`review:${preset}:${serial}`});
  else player.presentCues(rawCuesFor(entry));
  syncActiveCard();
}
function cardFor(entry){
  const wrap=document.createElement('div');wrap.setAttribute('role','listitem');
  const button=document.createElement('button');button.type='button';button.className='fx-option';button.dataset.preset=entry.id;button.setAttribute('aria-pressed',String(entry.id===selected));
  const category=document.createElement('span');category.className='fx-option-category';category.textContent=REVIEW_EFFECT_CATEGORIES[entry.category]||entry.category;
  const title=document.createElement('strong');title.textContent=entry.label;
  const origin=document.createElement('small');origin.className='fx-option-origin';origin.textContent=entry.realSource?'実素材':entry.kind==='original'?'原本':entry.kind==='composition'?'比較構成':'ゲーム採用';
  button.append(category,title,origin);button.addEventListener('click',()=>trigger(entry.id));wrap.append(button);return wrap;
}
function renderCatalog(){
  const needle=q('fx-search').value.trim().toLocaleLowerCase('ja');
  const visible=REVIEW_EFFECT_CATALOG.filter(entry=>{
    if(activeFilter==='original'&&entry.kind!=='original')return false;
    if(activeFilter!=='all'&&activeFilter!=='original'&&entry.category!==activeFilter)return false;
    if(!needle)return true;
    const haystack=[entry.label,REVIEW_EFFECT_CATEGORIES[entry.category],...entry.tags,...entry.effects.map(effectName)].join(' ').toLocaleLowerCase('ja');
    return haystack.includes(needle);
  });
  q('fx-catalog').replaceChildren(...visible.map(cardFor));
  q('fx-empty').hidden=visible.length!==0;
  syncActiveCard();
}
function resetCamera(){camera.position.set(4.8,3.2,6.2);controls.target.set(0,1,0);controls.update();}
function syncControls(){speed=Number(q('fx-speed').value)||1;tier=Number(q('fx-tier').value)||0;reduced=q('fx-reduced').checked;}

const loopToggle=q('fx-loop');
const ensureLoopDefaultOn=()=>{loopToggle.checked=true;};
ensureLoopDefaultOn();
window.addEventListener('pageshow',ensureLoopDefaultOn);

const discoveryNeeded=REVIEW_EFFECT_CATALOG.length>10;
q('fx-discovery-tools').hidden=!discoveryNeeded;
q('fx-search').addEventListener('input',renderCatalog);
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  for(const item of document.querySelectorAll('[data-filter]'))item.setAttribute('aria-pressed',String(item===button));
  renderCatalog();
});
for(const id of ['fx-speed','fx-tier','fx-reduced'])q(id).addEventListener('change',syncControls);
q('fx-pause').addEventListener('click',()=>{paused=!paused;q('fx-pause').textContent=paused?'再開':'一時停止';});
q('fx-clear').addEventListener('click',()=>player.clear());q('fx-camera').addEventListener('click',resetCamera);
q('fx-provenance').textContent=`実素材 ${REVIEW_REAL_EFFECT_COUNT}種 · ${REVIEW_VFX_LIBRARY_SOURCE.repository}@${REVIEW_VFX_LIBRARY_SOURCE.revision} / ${REVIEW_VFX_LIBRARY_SOURCE.license} · core ${EFFECT_SOURCE.repository}@${EFFECT_SOURCE.revision} / ${EFFECT_SOURCE.license} · review ${REVIEW_EFFECT_SOURCE.repository}@${REVIEW_EFFECT_SOURCE.revision} / ${REVIEW_EFFECT_SOURCE.license} · Effekseer WebGL ${EFFECT_RUNTIME.version}`;
renderCatalog();

const observer=new ResizeObserver(()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(canvas);
let last=performance.now();
function frame(now){
  if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;syncControls();controls.update();
  if(!paused){player.frame(state,front,dt*speed,{level:tier,reduced,hidden:document.hidden});if(loopToggle.checked&&now-lastTrigger>1700/Math.max(.25,speed))trigger(selected);}
  renderer.render(scene,camera);player.draw(camera);renderer.resetState();
  const snapshot=player.snapshot();q('fx-metrics').textContent=`backend ${snapshot.phase} · active ${snapshot.active}/${snapshot.budget.maxActive} · played ${snapshot.played} · dropped ${snapshot.dropped} · trails ${snapshot.budget.trails?'ON':'OFF'} · tier ${tier}`;
  if(snapshot.phase==='ready')q('fx-status').textContent=`実素材 ${REVIEW_REAL_EFFECT_COUNT}種 · ${effectLabel(selected)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createEffekseerBackend({renderer,document,baseUrl:authoredEffectBase(document),signal:abort.signal,budget:combatEffectBudget(0,mobile,false),effectDefinitions:REVIEW_AUTHORED_EFFECTS})
  .then(backend=>{if(player.attach(backend)){q('fx-status').textContent=`実素材 ${REVIEW_REAL_EFFECT_COUNT}種 · 再生可能`;trigger('slash');}})
  .catch(error=>player.fail(error));
window.addEventListener('pagehide',()=>{
  disposed=true;abort.abort();observer.disconnect();controls.dispose();player.dispose();
  ground.geometry.dispose();ground.material.dispose();
  for(const object of reviewDisposables)object.dispose?.();
  renderer.dispose();
},{once:true});
