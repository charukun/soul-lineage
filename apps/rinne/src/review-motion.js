import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {KAYKIT_MODELS,KAYKIT_SOURCE_REVISION,KAYKIT_LICENSE,KAYKIT_RIG_ID} from '@soul/characters';
import {buildMotionReviewCatalog,filterMotionReviewCatalog,REVIEW_MOTION_CATEGORY_LABELS} from './review-motion-catalog.js';

const el=id=>document.getElementById(id);
const canvas=el('motion-stage');
const status=message=>{el('motion-status').textContent=message;};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio)||1,1.5));

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0b1110);
scene.fog=new THREE.Fog(0x0b1110,9,22);
const camera=new THREE.PerspectiveCamera(38,1,.04,60);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=.7;
controls.maxDistance=12;
scene.add(new THREE.HemisphereLight(0xe3ece8,0x27312d,2.4));
const key=new THREE.DirectionalLight(0xffe7bc,3.1);key.position.set(-4,7,5);scene.add(key);
const rim=new THREE.DirectionalLight(0x9ac8d5,1.35);rim.position.set(5,4,-4);scene.add(rim);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.5,64),new THREE.MeshStandardMaterial({color:0x1a2420,roughness:.96,metalness:.01}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.005;scene.add(ground);

const loader=new GLTFLoader();
const stage=new THREE.Group();scene.add(stage);
let subject=null,mixer=null,action=null,clips=[],catalog=[],selected=null,selectedModel=KAYKIT_MODELS[0],filter='recommended',playing=true,speed=1,loop=true,last=performance.now(),loadSerial=0,modelHeight=1.8;
const categoryOrder=['recommended','life','move','combat','reaction','all'];

function disposeSubject(){
  if(mixer){mixer.stopAllAction();if(subject?.children[0])mixer.uncacheRoot(subject.children[0]);mixer=null;}
  if(!subject)return;
  stage.remove(subject);
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  subject.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    if(node.skeleton)skeletons.add(node.skeleton);
    for(const material of Array.isArray(node.material)?node.material:[node.material]){
      if(!material)continue;materials.add(material);
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    }
  });
  geometries.forEach(value=>value.dispose());
  materials.forEach(value=>value.dispose());
  textures.forEach(value=>value.dispose());
  skeletons.forEach(value=>value.dispose());
  subject=null;
}

function formatName(name){return String(name).replaceAll('_',' ').replace(/\s+/g,' ').trim();}
function categoryLabel(category){return REVIEW_MOTION_CATEGORY_LABELS[category]||category;}
function selectedClip(){return selected ? clips[selected.index] : null;}

function setCameraPreset(id){
  const h=Math.max(.6,modelHeight),targetY=h*.52,d=Math.max(2.15,h*1.72);
  const target=id==='face'?new THREE.Vector3(0,h*.79,0):new THREE.Vector3(0,targetY,0);
  const positions={
    front:[0,id==='face'?h*.81:targetY,d],
    'three-quarter':[d*.72,targetY,d*.72],
    side:[d,targetY,0],
    back:[0,targetY,-d],
    face:[0,h*.81,d*.78]
  };
  const p=positions[id]||positions.front;
  camera.position.set(...p);controls.target.copy(target);controls.update();
  for(const button of document.querySelectorAll('[data-motion-camera]'))button.setAttribute('aria-pressed',String(button.dataset.motionCamera===id));
}

function syncPlaybackUI(){
  const clip=selectedClip(),duration=clip?.duration||0,time=action?Math.min(duration,Math.max(0,action.time||0)):0;
  el('motion-play').textContent=playing?'一時停止':'▶ 再生';
  el('motion-play').setAttribute('aria-pressed',String(playing));
  el('motion-loop').checked=loop;
  el('motion-time').max=String(Math.max(duration,.0001));
  if(document.activeElement!==el('motion-time'))el('motion-time').value=String(time);
  el('motion-time-label').value=time.toFixed(2)+' / '+duration.toFixed(2)+'秒';
}

function selectMotion(record){
  const clip=clips[record?.index];
  if(!clip||!mixer)return;
  mixer.stopAllAction();
  selected=record;
  action=mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
  action.clampWhenFinished=!loop;
  action.enabled=true;
  action.play();
  playing=true;
  el('motion-selected').textContent=formatName(record.name);
  canvas.dataset.motionName=record.name;
  canvas.dataset.motionCategory=record.category;
  renderMotionGrid();
  syncPlaybackUI();
}

function renderModelGrid(){
  const grid=el('motion-model-grid');grid.replaceChildren();
  for(const model of KAYKIT_MODELS){
    const button=document.createElement('button');button.type='button';button.textContent=model.label;
    button.dataset.motionModel=model.id;button.setAttribute('aria-pressed',String(model.id===selectedModel.id));
    button.addEventListener('click',()=>{if(model.id!==selectedModel.id)void loadModel(model);});
    grid.append(button);
  }
}

function renderFilters(){
  const root=el('motion-filters');root.replaceChildren();
  for(const id of categoryOrder){
    const button=document.createElement('button');button.type='button';button.textContent=categoryLabel(id);button.dataset.motionFilter=id;
    button.setAttribute('aria-pressed',String(id===filter));
    button.addEventListener('click',()=>{filter=id;renderFilters();renderMotionGrid();});
    root.append(button);
  }
}

function renderMotionGrid(){
  const root=el('motion-grid'),rows=filterMotionReviewCatalog(catalog,filter);root.replaceChildren();
  if(!rows.length){const empty=document.createElement('p');empty.className='motion-empty';empty.textContent='この分類のモーションはありません。';root.append(empty);return;}
  for(const record of rows){
    const button=document.createElement('button');button.type='button';button.dataset.motionIndex=String(record.index);button.dataset.recommended=String(record.recommended);
    button.setAttribute('aria-pressed',String(selected?.index===record.index));
    const name=document.createElement('span');name.textContent=formatName(record.name);
    const meta=document.createElement('small');meta.className='motion-category';meta.textContent=categoryLabel(record.category)+' · '+record.duration.toFixed(2)+'s';
    button.append(name,meta);button.addEventListener('click',()=>selectMotion(record));root.append(button);
  }
}

function seek(time){
  if(!action)return;
  const clip=selectedClip(),duration=clip?.duration||0;
  action.time=Math.min(duration,Math.max(0,time));mixer.update(0);syncPlaybackUI();
}

async function loadModel(model){
  const serial=++loadSerial,previousName=selected?.name||'';
  selectedModel=model;renderModelGrid();status(model.label+' を読み込んでいます。');el('motion-load').removeAttribute('value');
  disposeSubject();selected=null;action=null;clips=[];catalog=[];renderMotionGrid();
  try{
    const gltf=await loader.loadAsync(model.runtime.url,onProgress=>{
      if(serial!==loadSerial)return;const total=Number(onProgress.total)||0,loaded=Number(onProgress.loaded)||0;
      if(total>0)el('motion-load').value=Math.min(1,loaded/total);
    });
    if(serial!==loadSerial){gltf.scene.traverse(node=>{node.geometry?.dispose?.();});return;}
    if(!Array.isArray(gltf.animations)||!gltf.animations.length)throw new Error(model.label+' に埋め込みモーションがありません');
    const wrapper=new THREE.Group();wrapper.name='MotionReview:'+model.id;wrapper.add(gltf.scene);
    const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    modelHeight=Math.max(.4,size.y);wrapper.position.set(-center.x,-box.min.y,-center.z);subject=wrapper;stage.add(subject);
    clips=gltf.animations;mixer=new THREE.AnimationMixer(gltf.scene);
    mixer.addEventListener('finished',()=>{playing=false;syncPlaybackUI();});
    catalog=buildMotionReviewCatalog(clips,{perCategory:6});
    const same=catalog.find(row=>row.name===previousName),firstRecommended=catalog.find(row=>row.recommended),first=same||firstRecommended||catalog[0];
    canvas.dataset.motionSource='kaykit-embedded';canvas.dataset.motionCount=String(clips.length);canvas.dataset.motionModel=model.id;
    el('motion-source').textContent='KayKit '+model.label+' · '+clips.length+' clips · '+KAYKIT_LICENSE;
    el('motion-meta').textContent='source '+model.source.repository+' @ '+KAYKIT_SOURCE_REVISION+' / '+model.source.path+' / '+KAYKIT_RIG_ID+' / '+KAYKIT_LICENSE+'. おすすめは生活・移動・戦闘・リアクションから最大24本を選定。すべてでは埋め込みクリップ全件をそのまま確認できます。';
    el('motion-load').value=1;status(model.label+' · '+clips.length+'モーション');
    setCameraPreset('three-quarter');selectMotion(first);
  }catch(error){
    el('motion-load').value=0;status('読込失敗: '+String(error?.message||error));canvas.dataset.motionSource='error';
  }
}

for(const button of document.querySelectorAll('[data-motion-camera]'))button.addEventListener('click',()=>setCameraPreset(button.dataset.motionCamera));
el('motion-play').addEventListener('click',()=>{if(!action)return;playing=!playing;syncPlaybackUI();});
el('motion-restart').addEventListener('click',()=>{seek(0);playing=true;syncPlaybackUI();});
el('motion-speed').addEventListener('change',event=>{speed=Number(event.target.value)||1;});
el('motion-loop').addEventListener('change',event=>{loop=event.target.checked;if(action){action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;}syncPlaybackUI();});
el('motion-time').addEventListener('input',event=>{playing=false;seek(Number(event.target.value));});
el('motion-prev-frame').addEventListener('click',()=>{playing=false;seek((action?.time||0)-1/60);});
el('motion-next-frame').addEventListener('click',()=>{playing=false;seek((action?.time||0)+1/60);});

let width=0,height=0;
function resize(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  if(w===width&&h===height)return;width=w;height=h;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
const observer=new ResizeObserver(resize);observer.observe(canvas);
function frame(now){
  resize();const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(mixer&&action&&playing)mixer.update(dt*speed);
  controls.update();renderer.render(scene,camera);syncPlaybackUI();requestAnimationFrame(frame);
}
renderFilters();renderModelGrid();setCameraPreset('three-quarter');requestAnimationFrame(frame);void loadModel(selectedModel);

window.addEventListener('pagehide',event=>{
  if(event.persisted)return;
  observer.disconnect();disposeSubject();ground.geometry.dispose();ground.material.dispose();controls.dispose();renderer.dispose();
},{once:true});
