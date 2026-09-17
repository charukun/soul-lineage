import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createAuthoredEffectPlayer} from './rebuild/authored-effect-player.js';
import {combatEffectBudget} from './rebuild/combat-effect-cues.js';
import {AUTHORED_EFFECTS,EFFECT_RUNTIME,EFFECT_SOURCE} from './rebuild/authored-effect-manifest.js';
import {authoredEffectBase,createEffekseerBackend} from './rebuild/effekseer-loader.js';
import './review-effects.css';

const q=id=>document.getElementById(id);
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
const mobile=Boolean(matchMedia?.('(pointer: coarse)').matches);let paused=false,speed=1,tier=0,reduced=false,selected='slash',serial=0,lastTrigger=-Infinity,disposed=false;
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
function trigger(preset=selected){
  selected=preset;serial++;lastTrigger=performance.now();
  player.present(eventsFor(preset),{state,front,eventKey:`review:${preset}:${serial}`});
  for(const button of document.querySelectorAll('[data-preset]'))button.classList.toggle('primary',button.dataset.preset===preset);
}
function resetCamera(){camera.position.set(4.8,3.2,6.2);controls.target.set(0,1,0);controls.update();}
function syncControls(){speed=Number(q('fx-speed').value)||1;tier=Number(q('fx-tier').value)||0;reduced=q('fx-reduced').checked;}
for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>trigger(button.dataset.preset));
for(const id of ['fx-speed','fx-tier','fx-reduced'])q(id).addEventListener('change',syncControls);
q('fx-pause').addEventListener('click',()=>{paused=!paused;q('fx-pause').textContent=paused?'再開':'一時停止';});
q('fx-clear').addEventListener('click',()=>player.clear());q('fx-camera').addEventListener('click',resetCamera);
q('fx-provenance').textContent=`${EFFECT_SOURCE.repository}@${EFFECT_SOURCE.revision} / ${EFFECT_SOURCE.license} · Effekseer WebGL ${EFFECT_RUNTIME.version} / ${EFFECT_RUNTIME.license} · ${Object.keys(AUTHORED_EFFECTS).join(' / ')}`;

const observer=new ResizeObserver(()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(canvas);
let last=performance.now();
function frame(now){
  if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;syncControls();controls.update();
  if(!paused){player.frame(state,front,dt*speed,{level:tier,reduced,hidden:document.hidden});if(q('fx-loop').checked&&now-lastTrigger>1500/Math.max(.25,speed))trigger(selected);}
  renderer.render(scene,camera);player.draw(camera);renderer.resetState();
  const snapshot=player.snapshot();q('fx-metrics').textContent=`backend ${snapshot.phase} · active ${snapshot.active}/${snapshot.budget.maxActive} · played ${snapshot.played} · dropped ${snapshot.dropped} · trails ${snapshot.budget.trails?'ON':'OFF'} · tier ${tier}`;
  if(snapshot.phase==='ready')q('fx-status').textContent=`原本再生可能 · ${selected==='finisher'||selected==='storm'?'Light / ToonHit / Ribbon':'ToonHit / Ribbon'}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createEffekseerBackend({renderer,document,baseUrl:authoredEffectBase(document),signal:abort.signal,budget:combatEffectBudget(0,mobile,false)})
  .then(backend=>{if(player.attach(backend)){q('fx-status').textContent='原本再生可能';trigger('slash');}})
  .catch(error=>player.fail(error));
window.addEventListener('pagehide',()=>{disposed=true;abort.abort();observer.disconnect();controls.dispose();player.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
