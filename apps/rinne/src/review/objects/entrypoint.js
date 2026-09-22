import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './index.css';
import {mountRinneReviewShell} from '../shared/lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {createMuraModels} from '@soul/rendering/mura';
import {createReviewCameraPresetController,createReviewRenderer,disposeReviewObject,measureReviewSubject,normalizeReviewSubject,positionReviewCamera} from '@soul/rendering';
import {curatedAssetById,fetchCuratedAssetBytes,projectAssetUrl,CURATED_PROVENANCE_PATH} from '@soul/assets';
import {RINNE_OBJECT_REVIEW_CATALOG as OBJECTS} from './catalog.js';
import {createReviewSvgThumbnail} from '@soul/shared-ui/review-thumbnail';
import {setReviewStatus} from '@soul/shared-ui/review-status';
import {createReviewLoadController} from '@soul/shared-ui/review-load-controller';
import {createCharacterComparison} from './character-comparison.js';
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
const CATEGORY_OPTIONS=Object.freeze([{id:'all',label:'すべて'},{id:'characters',label:'人物'},{id:'props',label:'小物'},{id:'outdoor',label:'屋外'},{id:'furniture',label:'家具'},{id:'training',label:'訓練'},{id:'weapons',label:'武器'},{id:'creatures',label:'魔物・動物'}]);
const params=new URLSearchParams(location.search);
const generatedRequested=params.get('generated')==='1';
let selectedCategory=CATEGORY_OPTIONS.some(row=>row.id===params.get('category'))?params.get('category'):'all';
let objectRoot=null,frameId=0,selected=(generatedRequested?OBJECTS.find(item=>item.experimentalGenerated)?.id:null)||OBJECTS.find(row=>row.id===params.get('asset'))?.id||OBJECTS.find(row=>selectedCategory==='all'||row.category===selectedCategory)?.id||OBJECTS[0].id,searchText='';
const objectLoads=createReviewLoadController();
let mixer=null,animationRoot=null,clips=[],action=null,loadAbort=null,lastFrame=0;

function status(message,error=false){setReviewStatus(q('#object-status'),message,{error});}
function disposeRoot(root){disposeReviewObject(root);}
const comparison=createCharacterComparison({THREE,loader,canvas,renderer,environment:runtimeEnvironment,dispose:disposeRoot,refit:()=>setCameraPreset('full'),status});
function releaseAnimation(){
  comparison.detach();mixer?.stopAllAction();if(mixer&&animationRoot)mixer.uncacheRoot(animationRoot);
  mixer=null;animationRoot=null;clips=[];action=null;
  const panel=q('#object-animation');if(panel)panel.hidden=true;
  delete canvas.dataset.nativeClip;delete canvas.dataset.loadedAsset;delete canvas.dataset.characterModel;
}
function objectFrame(){return objectRoot?measureReviewSubject(objectRoot):null;}
function fitObject(root){normalizeReviewSubject(root,{targetLongest:1.75});}
const objectCameraPresets=createReviewCameraPresetController({
  selector:'[data-object-camera]',datasetKey:'objectCamera',initialPreset:'full',
  applyPreset:preset=>{if(objectRoot)positionReviewCamera({camera,controls,root:objectRoot,preset,padding:1.18,minDistance:.35,maxDistance:18});},
});
function setCameraPreset(preset='full'){objectCameraPresets.set(preset);}
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
  return createReviewSvgThumbnail(item.thumbnailUrl,{className:'object-thumbnail',decorative:true});
}
function renderObjectOptions(){
  const items=visibleObjects();
  q('#object-options').replaceChildren(...items.map(item=>{
    const button=document.createElement('button');button.type='button';button.classList.add('review-choice-card');button.dataset.object=item.id;
    const thumbnail=createObjectThumbnail(item),label=document.createElement('span');label.textContent=item.label;
    button.append(thumbnail,label);button.addEventListener('click',()=>loadObject(item.id).catch(error=>{if(error.name!=='AbortError')status(error.message,true);}));return button;
  }));
  q('#object-result-count').textContent=`${items.length} / ${OBJECTS.length} 点`;renderSelection();
}
function selectCategory(id){
  if(!CATEGORY_OPTIONS.some(item=>item.id===id))return;
  selectedCategory=id;const items=visibleObjects();renderObjectOptions();
  if(!items.some(item=>item.id===selected)&&items[0])loadObject(items[0].id).catch(error=>{if(error.name!=='AbortError')status(error.message,true);});
}
function runtimeObject(item){
  if(item.kind==='prop')return models.prop(item.propKind,7);
  const g=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:0x735238,roughness:.9}),metal=new THREE.MeshStandardMaterial({color:0xc8cfcb,roughness:.28,metalness:.7}),cloth=new THREE.MeshStandardMaterial({color:0x9e7e68,roughness:.8});
  const mesh=(geo,material,x=0,y=0,z=0)=>{const node=new THREE.Mesh(geo,material);node.position.set(x,y,z);node.castShadow=node.receiveShadow=true;g.add(node);return node;};
  if(item.runtimeKind==='training-dummy'){
    mesh(new THREE.CylinderGeometry(.11,.14,2.4,8),wood,0,1.2);const arms=mesh(new THREE.CylinderGeometry(.08,.1,1.65,8),wood,0,1.65);arms.rotation.z=Math.PI/2;
    mesh(new THREE.BoxGeometry(.76,.82,.28),cloth,0,1.35);mesh(new THREE.SphereGeometry(.28,10,8),cloth,0,2.25);
  }else if(item.runtimeKind==='armor-stand'){
    mesh(new THREE.CylinderGeometry(.08,.1,2.15,8),wood,0,1.08);mesh(new THREE.CapsuleGeometry(.34,.55,5,9),metal,0,1.34);mesh(new THREE.BoxGeometry(.95,.2,.42),metal,0,1.72);
  }else{
    const long=item.weapon==='spear';mesh(new THREE.CylinderGeometry(.035,.045,long?1.45:.82,7),wood,0,long?.72:.44);
    mesh(item.weapon==='axe'?new THREE.BoxGeometry(.42,.34,.07):new THREE.ConeGeometry(item.weapon==='great'?.12:.08,item.weapon==='great'?.68:.38,5),metal,item.weapon==='axe'?.17:0,long?1.55:item.weapon==='great'?.98:.84);
  }
  return g;
}
function showProvenance(item){
  const target=q('#object-provenance');target.replaceChildren();
  if(item.curatedAssetId){
    const asset=curatedAssetById(item.curatedAssetId),source=asset.source;
    const native=['creature','character'].includes(asset.kind);
    target.append(document.createTextNode(`${asset.author} · ${asset.license}\n原典: ${asset.originalSource}\n取得: ${source.repository}@${source.revision}\n${source.path}\n${asset.byteLength.toLocaleString()} bytes · SHA-256 ${asset.sha256}\n${native?'原版の骨格・専用モーション。KayKitへの自動リターゲットは行いません。':'作者のgeometry・材質を維持。'}\n${asset.modelId?`Model ID: ${asset.modelId}\nRig: ${asset.rig.id} · ${asset.rig.jointCount} bones\n比較用 / 本編・Production未承認\n`:''}`));
    const link=document.createElement('a');link.href=projectAssetUrl(asset.provenancePath||CURATED_PROVENANCE_PATH,{environment:runtimeEnvironment});link.textContent='出典・変換記録';link.target='_blank';link.rel='noopener';target.append(link);
  }else{
    const source=item.provenance;target.textContent=source?`${item.source} · ${source.repository}@${source.revision}\n${source.path||''}\n${source.license||''} · ${source.gitBlobSha||''}`:item.source;
  }
  target.style.whiteSpace='pre-wrap';target.style.overflowWrap='anywhere';
}
function playClip(index){
  const clip=clips[index];if(!mixer||!clip)return;
  mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopRepeat,Infinity).play();
  q('#object-clip').value=String(index);q('#object-animation-toggle').textContent='一時停止';q('#object-animation-toggle').setAttribute('aria-pressed','false');canvas.dataset.nativeClip=clip.name;
}
async function loadObject(id){
  const item=OBJECTS.find(row=>row.id===id);if(!item)throw new Error(`Unknown review object: ${id}`);
  const loadToken=objectLoads.begin();selected=id;status(`${item.label} を読み込み中…`);q('#object-selected').textContent=item.label;q('#object-selected-source').textContent='読み込み中…';renderSelection();
  loadAbort?.abort();loadAbort=new AbortController();const signal=loadAbort.signal;
  releaseAnimation();disposeRoot(objectRoot);objectRoot=null;
  let gltf=null,root=null;
  try{
    const asset=item.curatedAssetId?curatedAssetById(item.curatedAssetId):null;
    if(asset){const data=await fetchCuratedAssetBytes(asset,{environment:runtimeEnvironment,signal});gltf=await loader.parseAsync(data,'');}
    else if(item.kind==='gltf')gltf=await loader.loadAsync(new URL(item.url,location.href).href);
    root=new THREE.Group();root.add(gltf?gltf.scene:runtimeObject(item));
    if(!objectLoads.isCurrent(loadToken)||signal.aborted){disposeRoot(root);return;}
    objectRoot=root;objectRoot.name=`ReviewObject:${item.id}`;objectRoot.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
    scene.add(objectRoot);if(asset?.kind!=='character')fitObject(objectRoot);renderSelection();showProvenance(item);
    if(gltf?.animations.length){
      animationRoot=gltf.scene;clips=asset?.availableReviewClips?gltf.animations.filter(clip=>asset.availableReviewClips.includes(clip.name)):gltf.animations;
      mixer=new THREE.AnimationMixer(animationRoot);const select=q('#object-clip');select.replaceChildren(...clips.map((clip,index)=>new Option(clip.name||`Motion ${index+1}`,String(index))));
      q('#object-animation').hidden=!clips.length;playClip(Math.max(0,clips.findIndex(clip=>/^idle$/i.test(clip.name)||/idle/i.test(clip.name))));
    }
    await comparison.present(objectRoot,item,gltf);
    if(!objectLoads.isCurrent(loadToken)||signal.aborted)return;
    setCameraPreset('full');canvas.dataset.loadedAsset=id;q('#object-selected-source').textContent=item.source+(clips.length?` · ${clips.length} モーション`:'');
    const url=new URL(location.href);url.searchParams.set('asset',id);url.searchParams.set('category',selectedCategory);history.replaceState(null,'',url);
    status(`${item.label} · ${item.source}${clips.length?` · ${clips.length} モーション`:''}`);
  }catch(error){
    if(objectLoads.isCurrent(loadToken)){releaseAnimation();disposeRoot(root);objectRoot=null;}else disposeRoot(root);
    if(error.name!=='AbortError'&&objectLoads.isCurrent(loadToken))throw error;
  }
}
function populate(){
  const searchLabel=document.createElement('label');searchLabel.className='object-search review-workbench__search';searchLabel.innerHTML='<span>検索</span>';
  const search=document.createElement('input');search.id='object-search';search.type='search';search.placeholder='名前・作者・原典ファイル名';search.addEventListener('input',()=>{searchText=search.value;renderObjectOptions();});searchLabel.append(search);
  const count=document.createElement('output');count.id='object-result-count';count.className='review-workbench__grid-title';count.setAttribute('aria-live','polite');
  const animation=document.createElement('fieldset');animation.id='object-animation';animation.hidden=true;
  const legend=document.createElement('legend');legend.textContent='原版モーション';
  const select=document.createElement('select');select.id='object-clip';select.setAttribute('aria-label','モーション');select.addEventListener('change',()=>playClip(Number(select.value)));
  const toggle=document.createElement('button');toggle.type='button';toggle.id='object-animation-toggle';toggle.textContent='一時停止';toggle.addEventListener('click',()=>{if(!action)return;action.paused=!action.paused;toggle.textContent=action.paused?'再生':'一時停止';toggle.setAttribute('aria-pressed',String(action.paused));});
  animation.append(legend,select,toggle);q('#object-options').before(searchLabel,count,animation);
  q('#object-categories').replaceChildren(...CATEGORY_OPTIONS.map(item=>{const button=document.createElement('button');button.type='button';button.textContent=item.label;button.dataset.category=item.id;button.addEventListener('click',()=>selectCategory(item.id));return button;}));
  renderObjectOptions();controls.addEventListener('start',()=>objectCameraPresets.clear());
}
const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});
function frame(now){
  const delta=lastFrame?Math.min(.1,Math.max(0,(now-lastFrame)/1000)):0;lastFrame=now;
  if(!document.hidden){mixer?.update(delta);comparison.update(delta,now);}
  controls.update();renderer.render(scene,camera);frameId=requestAnimationFrame(frame);
}
frameId=requestAnimationFrame(frame);populate();loadObject(selected).catch(error=>status(error.message,true));
window.addEventListener('pagehide',()=>{objectLoads.invalidate();loadAbort?.abort();cancelAnimationFrame(frameId);releaseAnimation();comparison.destroy();stageLifecycle.destroy();objectCameraPresets.destroy();controls.dispose();disposeRoot(objectRoot);ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
