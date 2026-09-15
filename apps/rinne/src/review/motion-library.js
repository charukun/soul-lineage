import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import './motion-library.css';

const REVISION='672074b73ba276876a19e8816ecdc5241817ab47';
const REPOSITORY='KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const RAW_BASE=`https://raw.githubusercontent.com/${REPOSITORY}/${REVISION}/addons/kaykit_character_pack_adventures/Characters/gltf`;
const MODELS=[
  {id:'knight',label:'Knight',file:'Knight.glb'},
  {id:'barbarian',label:'Barbarian',file:'Barbarian.glb'},
  {id:'mage',label:'Mage',file:'Mage.glb'},
  {id:'rogue',label:'Rogue',file:'Rogue.glb'},
  {id:'rogue-hooded',label:'Rogue Hooded',file:'Rogue_Hooded.glb'}
];
const STORAGE_KEY='rinne.motion-library.candidates.v1';
const q=s=>document.querySelector(s);
const finite=n=>Number.isFinite(n);

const canvas=q('#motion-library-canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#0b0f14');
const camera=new THREE.PerspectiveCamera(34,1,.01,200);
camera.position.set(3,2,4.8);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.minDistance=.5;
controls.maxDistance=20;
scene.add(new THREE.HemisphereLight('#eef4ff','#2a2520',1.8));
const key=new THREE.DirectionalLight('#fff1d8',3.0);key.position.set(4,7,4);key.castShadow=true;scene.add(key);
const rim=new THREE.DirectionalLight('#8ca8ff',1.1);rim.position.set(-4,3,-4);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshStandardMaterial({color:'#161b20',roughness:.98}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(24,48,'#38424c','#20272e');grid.position.y=.002;scene.add(grid);

let root=null,mixer=null,action=null,clips=[],modelId='knight',currentClip='',playing=true,speed=1,loadToken=0;
const candidates=new Set(readCandidates());

function readCandidates(){
  try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value.filter(v=>typeof v==='string'):[];}catch{return [];}
}
function saveCandidates(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...candidates]));}catch{}}
function candidateKey(name=currentClip){return name?`${modelId}:${name}`:'';}
function updateCandidate(){const key=candidateKey(),on=key&&candidates.has(key);q('#library-candidate').textContent=on?'★ 候補':'☆ 候補';q('#library-candidate').setAttribute('aria-pressed',String(Boolean(on)));}
function setStatus(text,error=false){const node=q('#library-status');node.textContent=text;node.dataset.error=error?'true':'false';}
function disposeRoot(){
  if(!root)return;
  root.traverse(node=>{node.geometry?.dispose?.();for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){for(const value of Object.values(material))if(value?.isTexture)value.dispose?.();material.dispose?.();}});
  root.removeFromParent();root=null;mixer=null;action=null;clips=[];currentClip='';updateCandidate();
}
function frame(){
  if(!root)return;
  root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return;
  const sphere=box.getBoundingSphere(new THREE.Sphere()),d=Math.max(1.8,sphere.radius*3.0);
  camera.position.copy(sphere.center).add(new THREE.Vector3(d*.72,d*.25,d*.72));controls.target.copy(sphere.center);camera.near=.01;camera.far=Math.max(100,d*16);camera.updateProjectionMatrix();controls.update();
}
function renderModels(){
  q('#library-models').replaceChildren(...MODELS.map(model=>{
    const b=document.createElement('button');b.type='button';b.className='library-model'+(model.id===modelId?' active':'');b.textContent=model.label;b.dataset.model=model.id;b.onclick=()=>loadModel(model.id);return b;
  }));
}
function normalize(text){return String(text||'').toLocaleLowerCase('ja').replace(/[\s_\-]+/g,' ');}
function filteredClips(){const keyword=normalize(q('#library-search').value).trim();if(!keyword)return clips;return clips.filter(clip=>normalize(clip.name).includes(keyword));}
function renderList(){
  const rows=filteredClips();q('#library-count').textContent=`${rows.length} motions`;
  q('#library-list').replaceChildren(...rows.map(clip=>{
    const candidate=candidates.has(candidateKey(clip.name));
    const button=document.createElement('button');button.type='button';button.className='motion-row'+(clip.name===currentClip?' active':'')+(candidate?' candidate':'');button.dataset.motion=clip.name;
    const copy=document.createElement('span');copy.className='motion-row-copy';const name=document.createElement('strong');name.textContent=clip.name||'Unnamed';const meta=document.createElement('small');meta.textContent=`${clip.duration.toFixed(2)}s`;copy.append(name,meta);
    const play=document.createElement('span');play.className='motion-row-play';play.textContent=candidate?'★':clip.name===currentClip?'●':'▶';button.append(copy,play);button.onclick=()=>playClip(clip.name,true);return button;
  }));
  if(!rows.length){const empty=document.createElement('p');empty.className='library-empty';empty.textContent='見つかりません';q('#library-list').replaceChildren(empty);}
}
function playClip(name,autoplay=true){
  const clip=clips.find(row=>row.name===name);if(!clip||!mixer)return;
  mixer.stopAllAction();action=mixer.clipAction(clip);action.reset().setLoop(THREE.LoopRepeat,Infinity).play();action.paused=!autoplay;playing=autoplay;currentClip=clip.name;
  q('#library-motion-name').textContent=clip.name||'Unnamed';q('#library-play').textContent=playing?'一時停止':'再生';updateCandidate();renderList();
}
async function loadModel(id){
  const model=MODELS.find(row=>row.id===id);if(!model||modelId===id&&root)return;
  const token=++loadToken;modelId=id;renderModels();q('#library-model-name').textContent=model.label;q('#library-motion-name').textContent='読み込み中';q('#library-list').replaceChildren();q('#library-count').textContent='読込中';setStatus(`${model.label} を読み込んでいます`);
  disposeRoot();
  try{
    const gltf=await new GLTFLoader().loadAsync(`${RAW_BASE}/${model.file}`);if(token!==loadToken){gltf.scene.traverse(node=>node.geometry?.dispose?.());return;}
    root=gltf.scene;root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});scene.add(root);mixer=new THREE.AnimationMixer(root);clips=[...gltf.animations].filter(clip=>clip?.name&&finite(clip.duration)&&clip.duration>0).sort((a,b)=>a.name.localeCompare(b.name));
    frame();renderModels();renderList();
    const preferred=clips.find(clip=>/attack|slash|sword|melee|strike/i.test(clip.name))||clips[0];
    if(preferred)playClip(preferred.name,true);else{q('#library-motion-name').textContent='モーションなし';setStatus('このモデルには埋め込みモーションがありません',true);return;}
    setStatus(`${clips.length}モーション · KayKit Adventurers · CC0`);
  }catch(error){console.error(error);setStatus(`読み込み失敗: ${error.message}`,true);q('#library-motion-name').textContent='読み込み失敗';}
}

q('#library-search').addEventListener('input',renderList);
q('#library-play').onclick=()=>{if(!action)return;playing=!playing;action.paused=!playing;q('#library-play').textContent=playing?'一時停止':'再生';};
q('#library-speed').onclick=()=>{speed=speed===1?0.5:1;q('#library-speed').textContent=`${speed}×`;};
q('#library-restart').onclick=()=>{if(!action)return;action.reset().play();action.paused=!playing;};
q('#library-candidate').onclick=()=>{const key=candidateKey();if(!key)return;if(candidates.has(key))candidates.delete(key);else candidates.add(key);saveCandidates();updateCandidate();renderList();};

const resize=()=>{const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
new ResizeObserver(resize).observe(canvas);resize();
const time=new THREE.Clock();
function tick(){requestAnimationFrame(tick);const dt=Math.min(.05,time.getDelta());if(mixer&&playing)mixer.update(dt*speed);controls.update();renderer.render(scene,camera);}tick();
renderModels();loadModel(modelId);
