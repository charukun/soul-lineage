import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './review-object-library.css';
import {mountRinneReviewShell} from './review-lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {createMuraModels} from '@soul/rendering/mura';
import {createReviewRenderer,measureReviewSubject,normalizeReviewSubject,positionReviewCamera} from '@soul/rendering';
import {curatedAssetById,fetchCuratedAssetBytes,projectAssetUrl,CURATED_PROVENANCE_PATH} from '@soul/assets';
import {RINNE_OBJECT_REVIEW_CATALOG as OBJECTS} from './review-object-catalog.js';
mountRinneReviewShell('objects');

const runtimeEnvironment=typeof __BUILD_INFO__==='undefined'?'dev':__BUILD_INFO__.environment;
const q=selector=>document.querySelector(selector);
const canvas=q('#object-stage');
const loader=new GLTFLoader();
const renderer=createReviewRenderer(canvas,{exposure:1.15});
const scene=new THREE.Scene();scene.background=new THREE.Color('#111716');
const camera=new THREE.PerspectiveCamera(38,1,.01,80);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.minDistance=.35;controls.maxDistance=18;
scene.add(new THREE.HemisphereLight('#fff2d5','#4f6872',2.6));
const key=new THREE.DirectionalLight('#ffe0b5',3.2);key.position.set(-4,8,6);scene.add(key);
const fill=new THREE.DirectionalLight('#8dcbe1',1.7);fill.position.set(5,4,-5);scene.add(fill);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.8,64),new THREE.MeshStandardMaterial({color:'#263431',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.006;scene.add(ground);
const models=createMuraModels(THREE,{createCanvas:()=>document.createElement('canvas'),textileFibers:1800,textileBlotches:40});
const CATEGORY_OPTIONS=Object.freeze([{id:'all',label:'すべて'},{id:'props',label:'小物'},{id:'outdoor',label:'屋外'},{id:'furniture',label:'家具'},{id:'training',label:'訓練'},{id:'weapons',label:'武器'},{id:'creatures',label:'魔物・動物'}]);
let objectRoot=null,frameId=0,loadSequence=0,selected=OBJECTS[0].id,selectedCategory='all',searchText='';
let mixer=null,animationRoot=null,clips=[],action=null,loadAbort=null,lastFrame=0;

function status(message,error=false){q('#object-status').textContent=message;q('#object-status').dataset.error=String(error);}
function disposeRoot(root){
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    if(node.skeleton)skeletons.add(node.skeleton);
    for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
      materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  root.removeFromParent();skeletons.forEach(value=>value.dispose?.());geometries.forEach(value=>value.dispose?.());materials.forEach(value=>value.dispose?.());
  textures.forEach(value=>{value.dispose?.();value.source?.data?.close?.();});
}
function releaseAnimation(){
  mixer?.stopAllAction();if(mixer&&animationRoot)mixer.uncacheRoot(animationRoot);
  mixer=null;animationRoot=null;clips=[];action=null;
  const panel=q('#object-animation');if(panel)panel.hidden=true;
  delete canvas.dataset.nativeClip;delete canvas.dataset.loadedAsset;
}
function objectFrame(){return objectRoot?measureReviewSubject(objectRoot):null;}
function fitObject(root){normalizeReviewSubject(root,{targetLongest:1.75});}
function setCameraPreset(preset='full'){
  if(!objectRoot)return;
  positionReviewCamera({camera,controls,root:objectRoot,preset,padding:1.18,minDistance:.35,maxDistance:18});
  for(const button of document.querySelectorAll('[data-object-camera]'))button.setAttribute('aria-pressed',String(button.dataset.objectCamera===preset));
}
function visibleObjects(){
  const query=searchText.trim().toLocaleLowerCase();
  return OBJECTS.filter(item=>(selectedCategory==='all'||item.category===selectedCategory)&&(!query||`${item.label} ${item.id} ${item.source} ${item.provenance?.path||''}`.toLocaleLowerCase().includes(query)));
}
function renderSelection(){
  for(const button of q('#object-options').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.object===selected));
  for(const button of q('#object-categories').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.category===selectedCategory));
}
function createObjectThumbnail(item){
  if(item.curatedAssetId&&item.thumbnailUrl){
    const image=document.createElement('img');image.className='object-thumbnail';image.src=item.thumbnailUrl;
    image.alt='';image.loading='lazy';image.decoding='async';image.width=160;image.height=160;return image;
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('object-thumbnail');svg.setAttribute('viewBox','0 0 160 160');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',item.thumbnailUrl);svg.append(use);return svg;
}
function renderObjectOptions(){
  const items=visibleObjects();
  q('#object-options').replaceChildren(...items.map(item=>{
    const button=document.createElement('button');button.type='button';button.classList.add('review-choice-card');button.dataset.object=item.id;
    const thumbnail=createObjectThumbnail(item),label=document.createElement('span');label.textContent=item.label;
    button.append(thumbnail,label);button.addEventListener('click',()=>loadObject(item.id).catch(error=>{if(error.name!=='AbortError')status(error.message,true);}));return button;
  }));
  q('#object-result-count').textContent=`${items.length} / ${OBJECTS.length} 点`;
  renderSelection();
}
function selectCategory(id){
  if(!CATEGORY_OPTIONS.some(item=>item.id===id))return;
  selectedCategory=id;const items=visibleObjects();renderObjectOptions();
  if(!items.some(item=>item.id===selected)&&items[0])loadObject(items[0].id).catch(error=>{if(error.name!=='AbortError')status(error.message,true);});
}
function runtimeObject(item){
  if(item.kind==='prop')return models.prop(item.propKind,7);
  const g=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:0x735238,roughness:.9});
  const metal=new THREE.MeshStandardMaterial({color:0xc8cfcb,roughness:.28,metalness:.7});
  const cloth=new THREE.MeshStandardMaterial({color:0x9e7e68,roughness:.8});
  const mesh=(geo,material,x=0,y=0,z=0)=>{const node=new THREE.Mesh(geo,material);node.position.set(x,y,z);node.castShadow=node.receiveShadow=true;g.add(node);return node;};
  if(item.runtimeKind==='training-dummy'){
    mesh(new THREE.CylinderGeometry(.11,.14,2.4,8),wood,0,1.2);
    const arms=mesh(new THREE.CylinderGeometry(.08,.1,1.65,8),wood,0,1.65);arms.rotation.z=Math.PI/2;
    mesh(new THREE.BoxGeometry(.76,.82,.28),cloth,0,1.35);mesh(new THREE.SphereGeometry(.28,10,8),cloth,0,2.25);
  }else if(item.runtimeKind==='armor-stand'){
    mesh(new THREE.CylinderGeometry(.08,.1,2.15,8),wood,0,1.08);
    mesh(new THREE.CapsuleGeometry(.34,.55,5,9),metal,0,1.34);mesh(new THREE.BoxGeometry(.95,.2,.42),metal,0,1.72);
  }else{
    const long=item.weapon==='spear';
    mesh(new THREE.CylinderGeometry(.035,.045,long?1.45:.82,7),wood,0,long?.72:.44);
    mesh(item.weapon==='axe'?new THREE.BoxGeometry(.42,.34,.07):new THREE.ConeGeometry(item.weapon==='great'?.12:.08,item.weapon==='great'?.68:.38,5),metal,item.weapon==='axe'?.17:0,long?1.55:item.weapon==='great'?.98:.84);
  }
  return g;
}
function showProvenance(item){
  const target=q('#object-provenance');target.replaceChildren();
  if(item.curatedAssetId){
    const asset=curatedAssetById(item.curatedAssetId);
    const source=asset.source;
    target.append(document.createTextNode(`${asset.author} · ${asset.license}\n原典: ${asset.originalSource}\n取得: ${source.repository}@${source.revision}\n${source.path}\n${asset.byteLength.toLocaleString()} bytes · SHA-256 ${asset.sha256}\n${asset.kind==='creature'?'原版の骨格・専用モーション。人型への自動リターゲットは行いません。':'作者のgeometry・材質を維持。'}\n`));
    const link=document.createElement('a');link.href=projectAssetUrl(CURATED_PROVENANCE_PATH,{environment:runtimeEnvironment});link.textContent='出典・変換記録';link.target='_blank';link.rel='noopener';target.append(link);
  }else{
    const source=item.provenance;
    target.textContent=source?`${item.source} · ${source.repository}@${source.revision}\n${source.path||''}\n${source.license||''} · ${source.gitBlobSha||''}`:item.source;
  }
  target.style.whiteSpace='pre-wrap';target.style.overflowWrap='anywhere';
}
function playClip(index){
  const clip=clips[index];if(!mixer||!clip)return;
  mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopRepeat,Infinity).play();
  q('#object-clip').value=String(index);q('#object-animation-toggle').textContent='一時停止';q('#object-animation-toggle').setAttribute('aria-pressed','false');
  canvas.dataset.nativeClip=clip.name;
}
async function loadObject(id){
  const item=OBJECTS.find(row=>row.id===id);if(!item)throw new Error(`Unknown review object: ${id}`);
  const sequence=++loadSequence;selected=id;status(`${item.label} を読み込み中…`);renderSelection();
  loadAbort?.abort();loadAbort=new AbortController();const signal=loadAbort.signal;
  releaseAnimation();disposeRoot(objectRoot);objectRoot=null;
  let gltf=null,root=null;
  try{
    if(item.curatedAssetId){
      const data=await fetchCuratedAssetBytes(item.curatedAssetId,{environment:runtimeEnvironment,signal});
      gltf=await loader.parseAsync(data,'');
    }else if(item.kind==='gltf')gltf=await loader.loadAsync(new URL(item.url,location.href).href);
    // A wrapper carries review framing; authored root animation tracks stay untouched.
    root=new THREE.Group();root.add(gltf?gltf.scene:runtimeObject(item));
    if(sequence!==loadSequence||signal.aborted){disposeRoot(root);return;}
    objectRoot=root;objectRoot.name=`ReviewObject:${item.id}`;
    objectRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    scene.add(objectRoot);fitObject(objectRoot);setCameraPreset('full');renderSelection();showProvenance(item);
    if(gltf?.animations.length){
      animationRoot=gltf.scene;clips=gltf.animations;mixer=new THREE.AnimationMixer(animationRoot);
      const select=q('#object-clip');select.replaceChildren(...clips.map((clip,index)=>new Option(clip.name||`Motion ${index+1}`,String(index))));
      q('#object-animation').hidden=false;playClip(Math.max(0,clips.findIndex(clip=>/idle/i.test(clip.name))));
    }
    canvas.dataset.loadedAsset=id;status(`${item.label} · ${item.source}${clips.length?` · ${clips.length} モーション`:''}`);
  }catch(error){
    if(sequence===loadSequence){releaseAnimation();disposeRoot(root);objectRoot=null;}
    else disposeRoot(root);
    if(error.name!=='AbortError'&&sequence===loadSequence)throw error;
  }
}
function populate(){
  const searchLabel=document.createElement('label');searchLabel.textContent='素材を探す';
  const search=document.createElement('input');search.id='object-search';search.type='search';search.placeholder='名前・作者・原典ファイル名';
  search.addEventListener('input',()=>{searchText=search.value;renderObjectOptions();});searchLabel.append(search);
  const count=document.createElement('output');count.id='object-result-count';count.setAttribute('aria-live','polite');
  const animation=document.createElement('fieldset');animation.id='object-animation';animation.hidden=true;
  const legend=document.createElement('legend');legend.textContent='原版モーション';
  const select=document.createElement('select');select.id='object-clip';select.setAttribute('aria-label','モーション');select.addEventListener('change',()=>playClip(Number(select.value)));
  const toggle=document.createElement('button');toggle.type='button';toggle.id='object-animation-toggle';toggle.textContent='一時停止';
  toggle.addEventListener('click',()=>{if(!action)return;action.paused=!action.paused;toggle.textContent=action.paused?'再生':'一時停止';toggle.setAttribute('aria-pressed',String(action.paused));});
  animation.append(legend,select,toggle);q('#object-options').before(searchLabel,count,animation);
  q('#object-categories').replaceChildren(...CATEGORY_OPTIONS.map(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.dataset.category=item.id;button.addEventListener('click',()=>selectCategory(item.id));return button;}));
  renderObjectOptions();
  for(const button of document.querySelectorAll('[data-object-camera]'))button.addEventListener('click',()=>setCameraPreset(button.dataset.objectCamera));
  controls.addEventListener('start',()=>{for(const button of document.querySelectorAll('[data-object-camera]'))button.setAttribute('aria-pressed','false');});
}
const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});
function frame(now){
  const delta=lastFrame?Math.min(.1,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
  if(!document.hidden)mixer?.update(delta);
  controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(frame);
}
frameId=requestAnimationFrame(frame);populate();loadObject(selected).catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{loadSequence++;loadAbort?.abort();cancelAnimationFrame(frameId);releaseAnimation();stageLifecycle.destroy();controls.dispose();disposeRoot(objectRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
