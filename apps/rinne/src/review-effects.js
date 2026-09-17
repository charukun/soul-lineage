import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {createAuthoredEffectPlayer} from './rebuild/authored-effect-player.js';
import {combatEffectBudget} from './rebuild/combat-effect-cues.js';
import {EFFECT_RUNTIME,EFFECT_SOURCE,REVIEW_AUTHORED_EFFECTS} from './rebuild/authored-effect-manifest.js';
import {authoredEffectBase,createEffekseerBackend} from './rebuild/effekseer-loader.js';
import {createKaykitCharacterPools} from './rebuild/kaykit-character-pool.js';
import {REVIEW_EFFECT_CATALOG,REVIEW_EFFECT_CATEGORIES,REVIEW_EFFECT_SCENARIOS,effectsForCategory,reviewEffectById,reviewScenarioById} from './review-effects-catalog.js';
import './review-effects.css';

const q=id=>document.getElementById(id),mobile=Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches);
const canvas=q('fx-stage'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
const scene=new THREE.Scene();scene.background=new THREE.Color('#080d0c');scene.fog=new THREE.Fog('#080d0c',9,22);
const camera=new THREE.PerspectiveCamera(39,1,.05,60);camera.position.set(4.6,3.0,6.4);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.target.set(0,1,0);controls.minDistance=3;controls.maxDistance=12;
scene.add(new THREE.HemisphereLight('#e9f3ed','#263631',2.2));const key=new THREE.DirectionalLight('#fff0ca',3.8);key.position.set(-4,7,5);scene.add(key);const rim=new THREE.DirectionalLight('#83b6c2',1.45);rim.position.set(5,4,-4);scene.add(rim);
const stageRoot=new THREE.Group();scene.add(stageRoot);
const ground=new THREE.Mesh(new THREE.CircleGeometry(5.1,64),new THREE.MeshStandardMaterial({color:'#17211e',roughness:.94,metalness:.02}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;stageRoot.add(ground);
const contactRing=new THREE.Mesh(new THREE.RingGeometry(.6,.64,64),new THREE.MeshBasicMaterial({color:'#66756e',transparent:true,opacity:.28,side:THREE.DoubleSide,depthWrite:false}));contactRing.rotation.x=-Math.PI/2;contactRing.position.y=.01;stageRoot.add(contactRing);

function fallbackHumanoid(color){
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({color,roughness:.66,metalness:.04});
  const part=(geometry,x,y,z,rx=0,rz=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.set(rx,0,rz);root.add(mesh);return mesh;};
  part(new THREE.BoxGeometry(.5,.72,.3),0,1.17,0);part(new THREE.SphereGeometry(.23,20,14),0,1.72,0);
  part(new THREE.BoxGeometry(.17,.67,.17),-.37,1.17,0,0,.12);part(new THREE.BoxGeometry(.17,.67,.17),.37,1.17,0,0,-.12);
  part(new THREE.BoxGeometry(.2,.78,.22),-.17,.43,0,0,.04);part(new THREE.BoxGeometry(.2,.78,.22),.17,.43,0,0,-.04);
  root.userData.fallbackMaterial=material;return root;
}
const fallbackHero=fallbackHumanoid('#d8c48f'),fallbackEnemy=fallbackHumanoid('#8fb1b8');fallbackHero.position.x=-1.35;fallbackEnemy.position.x=1.35;fallbackHero.rotation.y=Math.PI/2;fallbackEnemy.rotation.y=-Math.PI/2;stageRoot.add(fallbackHero,fallbackEnemy);

const heroPosition=new THREE.Vector3(-1.35,0,0),enemyPosition=new THREE.Vector3(1.35,0,0);
const state={id:'visual-review-vfx',zone:'frontier',phase:'alive',interior:null,position:{x:heroPosition.x,y:1,z:heroPosition.z}},front={stage:1,enemies:[{id:'target',x:enemyPosition.x,y:1,z:enemyPosition.z}]};
let runtime=null,hero=null,enemy=null,heroAppearance=null,enemyAppearance=null,modelReady=false,disposed=false;
function reviewerCharacter(id,seed){return createCharacter({id,seed,ageMs:28*YEAR_MS});}
function addGuard(bones,side){if(bones.spine)bones.spine.rotation.x-=.045;if(bones.leftUpperArm){bones.leftUpperArm.rotation.x-=.18;bones.leftUpperArm.rotation.z+=side==='hero'?-.18:.18;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.25;bones.rightUpperArm.rotation.z+=side==='hero'?.16:-.16;}}
function animateActor(actor,appearance,side,time,attackAmount){if(!actor)return;actor.sample(appearance,time,bones=>{addGuard(bones,side);if(attackAmount>0){const sign=side==='hero'?1:-1,arc=Math.sin(Math.min(1,attackAmount)*Math.PI);if(bones.spine)bones.spine.rotation.y+=sign*.24*arc;if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.7*arc;bones.rightUpperArm.rotation.z+=sign*.5*arc;}if(bones.leftUpperArm)bones.leftUpperArm.rotation.x+=.22*arc;}});actor.updateAttachments();}
async function loadModels(){
  try{
    runtime=await createKaykitCharacterPools(renderer,{onProgress:s=>{if(s?.state==='loading')q('fx-model-status').textContent='実モデル読込中';}});
    if(disposed){runtime.dispose();return;}
    runtime.manifestation.focusModel('kaykit.rogue.v1',320);runtime.manifestation.focusModel('kaykit.knight.v1',315);
    hero=runtime.pool.spawn('review-effects-hero','kaykit.rogue.v1');enemy=runtime.pool.spawn('review-effects-enemy','kaykit.knight.v1');
    hero.root.position.copy(heroPosition);enemy.root.position.copy(enemyPosition);hero.root.rotation.y=Math.PI/2;enemy.root.rotation.y=-Math.PI/2;
    stageRoot.add(hero.root,hero.attachments,enemy.root,enemy.attachments);heroAppearance=appearanceForCharacter(reviewerCharacter('review-effects-hero',0x51f15e));enemyAppearance=appearanceForCharacter(reviewerCharacter('review-effects-enemy',0x91cafe));
    fallbackHero.visible=false;fallbackEnemy.visible=false;modelReady=true;q('fx-model-status').textContent='実ランタイムモデル';canvas.dataset.effectModels='runtime-models';
  }catch(error){q('fx-model-status').textContent='モデル読込失敗 · シルエット表示';canvas.dataset.effectModels='explicit-fallback';console.warn('Review VFX model fallback',error);}
}

const abort=new AbortController(),player=createAuthoredEffectPlayer({mobile,onError:error=>{q('fx-status').textContent=`VFX停止: ${error}`;}});
let selected=reviewEffectById('laser02'),scenario=reviewScenarioById(selected.scenario),category='all',serial=0,lastTrigger=-Infinity,attackStarted=-Infinity,speed=1,tier=0,reduced=false;
const candidateKey='rinne-review-vfx-candidates-v1';
let candidates=new Set();try{candidates=new Set(JSON.parse(localStorage.getItem(candidateKey)||'[]'));}catch{}
const categoryLabel=id=>REVIEW_EFFECT_CATEGORIES.find(row=>row.id===id)?.label||id;
const sourceName=path=>path.split('/').pop()?.replace(/\.efkefc$/,'')||path;

function scenarioPoints(row){
  const attacker=row.attacker==='enemy'?enemyPosition:heroPosition,defender=row.attacker==='enemy'?heroPosition:enemyPosition;
  const anchor=row.anchor==='hero'?heroPosition:row.anchor==='enemy'?enemyPosition:new THREE.Vector3().lerpVectors(attacker,defender,.56);
  return {attacker,defender,anchor};
}
function cuesFor(entry,row){
  const {attacker,defender,anchor}=scenarioPoints(row),yaw=Math.atan2(defender.x-attacker.x,defender.z-attacker.z)+(row.rotationOffset||0),count=reduced?1:row.count;
  return Array.from({length:count},(_,index)=>{
    const spread=(index-(count-1)/2)*(row.spacing||0),position={x:anchor.x,y:entry.category==='finisher'?1.15:1.0,z:anchor.z+spread};
    return {effect:entry.effect,position,rotation:{x:0,y:yaw,z:0},scale:entry.cueScale*row.scale,lifetime:Math.max(entry.lifetime,REVIEW_AUTHORED_EFFECTS[entry.effect].lifetime),color:entry.color,priority:3,kind:'review-authored'};
  });
}
function trigger(){
  serial++;lastTrigger=performance.now();attackStarted=lastTrigger;player.presentCues(cuesFor(selected,scenario));
  q('fx-status').textContent=`原本再生 · ${sourceName(selected.source)}`;
}
function resetCamera(){camera.position.set(4.6,3.0,6.4);controls.target.set(0,1,0);controls.update();}
function saveCandidates(){try{localStorage.setItem(candidateKey,JSON.stringify([...candidates]));}catch{}}
function syncCandidateButton(){const active=candidates.has(selected.id),button=q('fx-candidate');button.setAttribute('aria-pressed',String(active));button.textContent=active?'★ 採用候補':'☆ 採用候補';}
function selectEntry(id,{play=true}={}){selected=reviewEffectById(id);scenario=reviewScenarioById(selected.scenario);renderCatalog();renderScenarios();syncSelectedCopy();syncCandidateButton();if(play)trigger();}
function selectScenario(id){scenario=reviewScenarioById(id);renderScenarios();trigger();}
function syncSelectedCopy(){q('fx-category-label').textContent=categoryLabel(selected.category);q('fx-title').textContent=selected.label;q('fx-use').textContent=selected.use;q('fx-summary').textContent=selected.summary;q('fx-source').textContent=`${selected.author} · ${selected.source}`;}
function renderCategories(){
  const root=q('fx-categories');root.replaceChildren(...REVIEW_EFFECT_CATEGORIES.map(row=>{const button=document.createElement('button');button.type='button';button.textContent=row.label;button.classList.toggle('active',row.id===category);button.addEventListener('click',()=>{category=row.id;renderCategories();renderCatalog();});return button;}));
}
function renderCatalog(){
  const rows=effectsForCategory(category),root=q('fx-catalog');q('fx-count').textContent=`${rows.length} / ${REVIEW_EFFECT_CATALOG.length} authored`;
  root.replaceChildren(...rows.map(row=>{const button=document.createElement('button');button.type='button';button.className='effect-card';button.classList.toggle('active',row.id===selected.id);button.classList.toggle('candidate',candidates.has(row.id));button.dataset.effect=row.id;
    const top=document.createElement('span');top.className='card-top';const kind=document.createElement('span');kind.className='card-category';kind.textContent=categoryLabel(row.category);const strong=document.createElement('strong');strong.textContent=row.label;const use=document.createElement('span');use.className='card-use';use.textContent=row.use;top.append(kind,strong,use);const source=document.createElement('span');source.className='card-source';source.textContent=sourceName(row.source);button.append(top,source);button.addEventListener('click',()=>selectEntry(row.id));return button;}));
}
function renderScenarios(){const root=q('fx-scenarios');root.replaceChildren(...REVIEW_EFFECT_SCENARIOS.map(row=>{const button=document.createElement('button');button.type='button';button.textContent=row.label;button.classList.toggle('active',row.id===scenario.id);button.addEventListener('click',()=>selectScenario(row.id));return button;}));}

q('fx-replay').addEventListener('click',trigger);q('fx-clear').addEventListener('click',()=>player.clear());q('fx-camera').addEventListener('click',resetCamera);
q('fx-candidate').addEventListener('click',()=>{candidates.has(selected.id)?candidates.delete(selected.id):candidates.add(selected.id);saveCandidates();syncCandidateButton();renderCatalog();});
for(const id of ['fx-speed','fx-tier','fx-reduced'])q(id).addEventListener('change',()=>{speed=Number(q('fx-speed').value)||1;tier=Number(q('fx-tier').value)||0;reduced=q('fx-reduced').checked;});
q('fx-provenance').textContent=`${EFFECT_SOURCE.repository}@${EFFECT_SOURCE.revision} / ${EFFECT_SOURCE.license} · Effekseer WebGL ${EFFECT_RUNTIME.version} / ${EFFECT_RUNTIME.license} · authored originals ${Object.keys(REVIEW_AUTHORED_EFFECTS).length}`;
renderCategories();renderCatalog();renderScenarios();syncSelectedCopy();syncCandidateButton();

const observer=new ResizeObserver(()=>{const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});observer.observe(canvas);
let last=performance.now();
function frame(now){
  if(disposed)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;controls.update();
  player.frame(state,front,dt*speed,{level:tier,reduced,hidden:document.hidden});
  if(q('fx-loop').checked&&now-lastTrigger>Math.max(1050,selected.lifetime*1000)/Math.max(.25,speed))trigger();
  const attackAge=Math.max(0,(now-attackStarted)/680),pulse=attackAge<1?attackAge:0,attacker=scenario.attacker;
  if(modelReady){animateActor(hero,heroAppearance,'hero',now/1000,attacker==='hero'?pulse:0);animateActor(enemy,enemyAppearance,'enemy',now/1000,attacker==='enemy'?pulse:0);}
  renderer.render(scene,camera);player.draw(camera);renderer.resetState();
  const snapshot=player.snapshot();q('fx-metrics').textContent=`backend ${snapshot.phase} · active ${snapshot.active}/${snapshot.budget.maxActive} · played ${snapshot.played} · dropped ${snapshot.dropped} · tier ${tier} · ${reduced?'reduced':'full motion'}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

Promise.allSettled([
  loadModels(),
  createEffekseerBackend({renderer,document,baseUrl:authoredEffectBase(document),signal:abort.signal,budget:combatEffectBudget(0,mobile,false),effectDefinitions:REVIEW_AUTHORED_EFFECTS})
    .then(backend=>{if(player.attach(backend)){q('fx-status').textContent=`原本再生可能 · ${REVIEW_EFFECT_CATALOG.length}種`;trigger();}})
    .catch(error=>player.fail(error))
]);
window.addEventListener('pagehide',()=>{disposed=true;abort.abort();observer.disconnect();controls.dispose();player.dispose();runtime?.dispose();ground.geometry.dispose();ground.material.dispose();contactRing.geometry.dispose();contactRing.material.dispose();for(const root of [fallbackHero,fallbackEnemy]){for(const child of root.children)child.geometry?.dispose();root.userData.fallbackMaterial?.dispose();}renderer.dispose();},{once:true});
