import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAuthoredEffectPlayer} from './rebuild/authored-effect-player.js';
import {combatEffectBudget} from './rebuild/combat-effect-cues.js';
import {AUTHORED_EFFECTS,EFFECT_RUNTIME,EFFECT_SOURCE} from './rebuild/authored-effect-manifest.js';
import {authoredEffectBase,createEffekseerBackend} from './rebuild/effekseer-loader.js';
import './review-effects.css';

const q=id=>document.getElementById(id);
const CATEGORY_LABELS=Object.freeze({attack:'攻撃',impact:'被弾',finisher:'大技',combo:'複合'});
const effectName=key=>AUTHORED_EFFECTS[key]?.path?.split('/').pop()?.replace(/\.efkefc$/,'')||key;
const REVIEW_CATALOG=Object.freeze([
  Object.freeze({id:'slash',label:'斬撃＋命中',category:'attack',effects:['impact','slash'],tags:['斬撃','近接','命中','剣']}),
  Object.freeze({id:'impact',label:'被弾',category:'impact',effects:['impact'],tags:['被弾','ヒット','衝撃']}),
  Object.freeze({id:'finisher',label:'急・大技',category:'finisher',effects:['finisher','slash'],tags:['急','大技','フィニッシャー','光']}),
  Object.freeze({id:'storm',label:'派手さ確認',category:'combo',effects:['finisher','impact','slash'],tags:['複合','派手','ストレステスト']}),
]);
const catalogById=new Map(REVIEW_CATALOG.map(entry=>[entry.id,entry]));

const canvas=q('fx-stage'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();scene.background=new THREE.Color('#090d0d');scene.fog=new THREE.Fog('#090d0d',10,24);
const camera=new THREE.PerspectiveCamera(42,1,.05,60);camera.position.set(4.8,3.2,6.2);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,1,0);controls.minDistance=3;controls.maxDistance=14;
scene.add(new THREE.HemisphereLight('#e9f3ed','#283632',2.1));const key=new THREE.DirectionalLight('#fff0cb',3.4);key.position.set(-4,7,5);scene.add(key);
const ground=new THREE.Mesh(new THREE.CircleGeometry(5.4,64),new THREE.MeshStandardMaterial({color:'#18211f',roughness:.92,metalness:.03}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
function marker(x,z,color,label){
  const root=new THREE.Group(),body=new THREE.Mesh(new THREE.CapsuleGeometry(.28,1.05,6,12),new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08}));body.position.y=.8;root.add(body);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.43,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;root.add(ring);root.position.set(x,0,z);root.userData.label=label;scene.add(root);return root;
}
marker(-1.55,0,'#d7c18e','HUMAN');marker(1.55,0,'#9bbac0','ENEMY');marker(1.1,1.7,'#8ba7b0','ENEMY-B');marker(1.1,-1.7,'#8ba7b0','ENEMY-C');

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
function syncActiveCard(){
  for(const button of document.querySelectorAll('[data-preset]')){
    const active=button.dataset.preset===selected;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  const entry=catalogById.get(selected);if(!entry)return;
  q('fx-active-type').textContent=CATEGORY_LABELS[entry.category]?.toUpperCase()||entry.category.toUpperCase();
  q('fx-active-title').textContent=entry.label;
  q('fx-active-meta').textContent=effectLabel(entry.id);
}
function trigger(preset=selected){
  if(!catalogById.has(preset))return;
  selected=preset;serial++;lastTrigger=performance.now();
  player.present(eventsFor(preset),{state,front,eventKey:`review:${preset}:${serial}`});
  syncActiveCard();
}
function cardFor(entry){
  const wrap=document.createElement('div');wrap.setAttribute('role','listitem');
  const button=document.createElement('button');button.type='button';button.className='fx-card';button.dataset.preset=entry.id;button.setAttribute('aria-pressed',String(entry.id===selected));
  const top=document.createElement('span');top.className='fx-card-top';
  const category=document.createElement('span');category.className='fx-card-category';category.textContent=CATEGORY_LABELS[entry.category]||entry.category;
  const replay=document.createElement('span');replay.className='fx-card-replay';replay.textContent='再生';
  top.append(category,replay);
  const title=document.createElement('strong');title.textContent=entry.label;
  const meta=document.createElement('small');meta.textContent=entry.effects.map(effectName).join(' + ');
  const tags=document.createElement('span');tags.className='fx-card-tags';tags.textContent=entry.tags.slice(0,3).join(' · ');
  button.append(top,title,meta,tags);button.addEventListener('click',()=>trigger(entry.id));wrap.append(button);return wrap;
}
function renderCatalog(){
  const needle=q('fx-search').value.trim().toLocaleLowerCase('ja');
  const visible=REVIEW_CATALOG.filter(entry=>{
    if(activeFilter!=='all'&&entry.category!==activeFilter)return false;
    if(!needle)return true;
    const haystack=[entry.label,CATEGORY_LABELS[entry.category],...entry.tags,...entry.effects.map(effectName)].join(' ').toLocaleLowerCase('ja');
    return haystack.includes(needle);
  });
  q('fx-catalog').replaceChildren(...visible.map(cardFor));
  q('fx-count').textContent=`${visible.length} / ${REVIEW_CATALOG.length}`;
  q('fx-empty').hidden=visible.length!==0;
  syncActiveCard();
}
function resetCamera(){camera.position.set(4.8,3.2,6.2);controls.target.set(0,1,0);controls.update();}
function syncControls(){speed=Number(q('fx-speed').value)||1;tier=Number(q('fx-tier').value)||0;reduced=q('fx-reduced').checked;}

q('fx-search').addEventListener('input',renderCatalog);
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{
  activeFilter=button.dataset.filter;
  for(const item of document.querySelectorAll('[data-filter]'))item.setAttribute('aria-pressed',String(item===button));
  renderCatalog();
});
for(const id of ['fx-speed','fx-tier','fx-reduced'])q(id).addEventListener('change',syncControls);
q('fx-pause').addEventListener('click',()=>{paused=!paused;q('fx-pause').textContent=paused?'再開':'一時停止';});
q('fx-clear').addEventListener('click',()=>player.clear());q('fx-camera').addEventListener('click',resetCamera);
q('fx-provenance').textContent=`${EFFECT_SOURCE.repository}@${EFFECT_SOURCE.revision} / ${EFFECT_SOURCE.license} · Effekseer WebGL ${EFFECT_RUNTIME.version} / ${EFFECT_RUNTIME.license} · ${Object.keys(AUTHORED_EFFECTS).join(' / ')}`;
renderCatalog();

const observer=new ResizeObserver(()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(canvas);
let last=performance.now();
function frame(now){
  if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;syncControls();controls.update();
  if(!paused){player.frame(state,front,dt*speed,{level:tier,reduced,hidden:document.hidden});if(q('fx-loop').checked&&now-lastTrigger>1500/Math.max(.25,speed))trigger(selected);}
  renderer.render(scene,camera);player.draw(camera);renderer.resetState();
  const snapshot=player.snapshot();q('fx-metrics').textContent=`backend ${snapshot.phase} · active ${snapshot.active}/${snapshot.budget.maxActive} · played ${snapshot.played} · dropped ${snapshot.dropped} · trails ${snapshot.budget.trails?'ON':'OFF'} · tier ${tier}`;
  if(snapshot.phase==='ready')q('fx-status').textContent=`原本再生可能 · ${effectLabel(selected)}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createEffekseerBackend({renderer,document,baseUrl:authoredEffectBase(document),signal:abort.signal,budget:combatEffectBudget(0,mobile,false)})
  .then(backend=>{if(player.attach(backend)){q('fx-status').textContent='原本再生可能';trigger('slash');}})
  .catch(error=>player.fail(error));
window.addEventListener('pagehide',()=>{disposed=true;abort.abort();observer.disconnect();controls.dispose();player.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
