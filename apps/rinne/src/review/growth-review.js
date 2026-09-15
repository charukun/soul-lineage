import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';
import { LIFE_RULES, appearanceForAge } from '../../public/simulator/src/life-clock.js';
import './style.css';
import './growth-review.css';

const q = selector => document.querySelector(selector);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const VIEW_OFFSETS = Object.freeze({front:[0,.12,1],three:[.72,.26,.72],side:[1,.12,0],back:[0,.12,-1]});
const SHINO_PATH = SHINO_REVIEW.publicPath;
const GROWTH_MODELS = Object.freeze([
  {id:'SHINO',label:'SHINO',name:'Sendagaya Shino',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1,1,1]},
  {id:'SHINO_SLENDER',label:'SHINO_SLENDER',name:'Shino / 細身',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[.9,1.02,.92]},
  {id:'SHINO_STURDY',label:'SHINO_STURDY',name:'Shino / がっしり',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1.1,.98,1.08]},
  {id:'SHINO_COMPACT',label:'SHINO_COMPACT',name:'Shino / 小柄',path:SHINO_PATH,portrait:'SHINO',appearanceScale:[1.04,.94,1.03]},
  {id:'A',label:'A',name:'AvatarSample A',path:'./simulator/assets/A_review.vrm',portrait:'A',appearanceScale:[1,1,1]},
  {id:'B',label:'B',name:'AvatarSample B',path:'./simulator/assets/B_review.vrm',portrait:'B',appearanceScale:[1,1,1]},
  {id:'C',label:'C',name:'AvatarSample C',path:'./simulator/assets/C_review.vrm',portrait:'C',appearanceScale:[1,1,1]},
  {id:'TSUKU',label:'TSUKU',name:'Tsuku',path:'./simulator/assets/TSUKU_review.vrm',portrait:'TSUKU',appearanceScale:[1,1,1]},
]);
const MODEL_BY_ID = new Map(GROWTH_MODELS.map(model => [model.id, model]));
const grayTarget = new THREE.Color('#b9bab6');
const skinTarget = new THREE.Color('#d1b8a6');

function portraitPath(model){return `./simulator/assets/portrait_${model.portrait}.webp`;}
function formatWorldSeconds(seconds){const s=Math.max(0,Math.round(seconds));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function percent(value,max=1){return `${Math.round(clamp(value/max,0,1)*100)}%`;}
function disposeRoot(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
  geometries.forEach(value=>value.dispose?.());materials.forEach(value=>value.dispose?.());textures.forEach(value=>value.dispose?.());root?.removeFromParent();
}

async function humanoidBones(gltf){
  const json=gltf.parser?.json,vrm1=json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if(vrm1)return Object.fromEntries(await Promise.all(Object.entries(vrm1).map(async([name,row])=>[name,await gltf.parser.getDependency('node',row.node)])));
  const vrm0=json?.extensions?.VRM?.humanoid?.humanBones;
  if(Array.isArray(vrm0))return Object.fromEntries(await Promise.all(vrm0.filter(row=>row?.bone&&Number.isInteger(row.node)).map(async row=>[row.bone,await gltf.parser.getDependency('node',row.node)])));
  return {};
}

function snapshotMaterials(root){
  const rows=[],seen=new Set();
  root.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){
    if(seen.has(material)||!material.color)continue;seen.add(material);const name=`${material.name||''} ${node.name||''}`;
    rows.push({material,color:material.color.clone(),hair:/hair|髪/i.test(name),skin:/face.*skin|skin.*face|skin|肌/i.test(name)});
  }});
  return rows;
}

function installBackButton(){q('#growth-back')?.addEventListener('click',()=>{if(document.referrer&&new URL(document.referrer).origin===location.origin)history.back();else location.href='./';});}

async function start(){
  installBackButton();
  q('#growth-build-label').textContent=`GROWTH / ${REVIEW_ASSET_REVISION}`;
  const params=new URLSearchParams(location.search);
  const seek=q('#growth-seek');
  seek.max=String(LIFE_RULES.lifespanYears*LIFE_RULES.secondsPerYear);
  const paramAge=params.has('age')?Number(params.get('age')):NaN;
  seek.value=String(Number.isFinite(paramAge)?clamp(paramAge,0,LIFE_RULES.lifespanYears)*LIFE_RULES.secondsPerYear:22*LIFE_RULES.secondsPerYear);
  let selectedModel=MODEL_BY_ID.get(params.get('model'))||GROWTH_MODELS[0];

  const canvas=q('#growth-canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101217');
  const camera=new THREE.PerspectiveCamera(36,1,.01,200);const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=20;
  scene.add(new THREE.HemisphereLight('#dfe8ff','#312b24',1.7));
  const key=new THREE.DirectionalLight('#fff4da',3.2);key.position.set(4,7,4);key.castShadow=true;scene.add(key);
  const rim=new THREE.DirectionalLight('#8aa7ff',1.2);rim.position.set(-5,3,-4);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#22262c',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(30,60,'#65707c','#343b43');grid.position.y=.002;scene.add(grid);
  const resize=()=>{const rect=canvas.getBoundingClientRect(),width=Math.max(1,Math.floor(rect.width)),height=Math.max(1,Math.floor(rect.height));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(canvas);resize();

  let current=null,currentView='three',adultFrame=null,generation=0;

  function bounds(){if(!current)return new THREE.Box3();current.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(current.root);}
  function groundModel(){if(!current)return;current.root.position.copy(current.base.rootPosition);current.root.updateMatrixWorld(true);const box=bounds();if(Number.isFinite(box.min.y))current.root.position.y+=-box.min.y;current.root.updateMatrixWorld(true);}
  function resetAgeParts(){if(!current)return;const{bones,base,materials}=current;if(bones.head&&base.headScale)bones.head.scale.copy(base.headScale);if(bones.spine&&base.spineQ)bones.spine.quaternion.copy(base.spineQ);if(bones.chest&&base.chestQ)bones.chest.quaternion.copy(base.chestQ);if(bones.head&&base.headQ)bones.head.quaternion.copy(base.headQ);for(const row of materials)row.material.color.copy(row.color);}
  function applyAppearance(age){
    const appearance=appearanceForAge(age);if(!current)return appearance;resetAgeParts();const{root,bones,base,materials,model,direction}=current;
    root.scale.copy(base.rootScale).multiply(new THREE.Vector3(...model.appearanceScale)).multiplyScalar(appearance.scale);
    if(bones.head&&base.headScale)bones.head.scale.copy(base.headScale).multiplyScalar(appearance.headScale);
    if(appearance.stoop>0){const axis=new THREE.Vector3(1,0,0);if(bones.spine)bones.spine.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,direction*appearance.stoop*.62));if(bones.chest)bones.chest.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,direction*appearance.stoop*.38));if(bones.head)bones.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,-direction*appearance.stoop*.38));}
    for(const row of materials){row.material.color.copy(row.color);if(row.hair&&appearance.gray>0)row.material.color.lerp(grayTarget,appearance.gray*.72);if(row.skin&&appearance.skinAge>0)row.material.color.lerp(skinTarget,appearance.skinAge*.08).multiplyScalar(1-.045*appearance.skinAge);}
    groundModel();return appearance;
  }
  function frame(view=currentView){
    if(!current)return;currentView=view;current.root.updateMatrixWorld(true);const box=adultFrame?.clone()||bounds(),sphere=box.getBoundingSphere(new THREE.Sphere());if(!Number.isFinite(sphere.radius)||sphere.radius<=0)return;
    if(view==='face'&&current.bones.head){const head=current.bones.head.getWorldPosition(new THREE.Vector3()),d=Math.max(.46,sphere.radius*.58);camera.position.set(head.x+d*.56,head.y+d*.08,head.z+d);controls.target.copy(head);}else{const dir=VIEW_OFFSETS[view]||VIEW_OFFSETS.three,d=Math.max(sphere.radius*3.15,1.4),center=sphere.center;camera.position.set(center.x+dir[0]*d,center.y+dir[1]*d,center.z+dir[2]*d);controls.target.copy(center);}
    camera.near=.01;camera.far=100;camera.updateProjectionMatrix();controls.update();document.querySelectorAll('[data-growth-view]').forEach(button=>button.classList.toggle('active',button.dataset.growthView===view));
  }
  function metric(id,value,bar,barValue){q(id).textContent=value;q(bar).style.width=percent(barValue);}
  function syncURL(age){const url=new URL(location.href);url.searchParams.set('model',selectedModel.id);url.searchParams.set('age',age.toFixed(2).replace(/\.00$/,''));history.replaceState(null,'',url);}
  function renderAge(seconds,{sync=true}={}){
    const age=clamp(seconds/LIFE_RULES.secondsPerYear,0,LIFE_RULES.lifespanYears),appearance=applyAppearance(age);
    q('#growth-age').textContent=age.toFixed(1);q('#growth-period').textContent=appearance.stage;q('#growth-stage-name').textContent=`${age.toFixed(1)}歳 / ${appearance.stage}`;q('#growth-stage-meta').textContent=`${selectedModel.name} ・ 世界時間 ${formatWorldSeconds(seconds)} ・ 60秒で1年`;q('#growth-world-time').textContent=`${formatWorldSeconds(seconds)} / ${formatWorldSeconds(LIFE_RULES.lifespanYears*LIFE_RULES.secondsPerYear)}`;
    metric('#metric-scale',`${Math.round(appearance.scale*100)}%`,'#bar-scale',appearance.scale);metric('#metric-head',`${Math.round(appearance.headScale*100)}%`,'#bar-head',(appearance.headScale-1)/.22);metric('#metric-gray',`${Math.round(appearance.gray*100)}%`,'#bar-gray',appearance.gray);metric('#metric-stoop',`${Math.round(appearance.stoop/.25*100)}%`,'#bar-stoop',appearance.stoop/.25);metric('#metric-skin',`${Math.round(appearance.skinAge*100)}%`,'#bar-skin',appearance.skinAge);
    document.querySelectorAll('[data-age]').forEach(button=>button.classList.toggle('active',Math.abs(Number(button.dataset.age)-age)<.12));if(currentView==='face')frame('face');if(sync)syncURL(age);return appearance;
  }

  const picker=q('#growth-model-picker'),list=q('#growth-model-list'),trigger=q('#growth-model-trigger');
  function syncModelCopy(){q('#growth-model-name').textContent=selectedModel.name;q('#growth-model-label').textContent=selectedModel.label;q('#growth-model-thumb').src=portraitPath(selectedModel);q('#growth-source').textContent=`${selectedModel.name} / 実モデル`;}
  function renderModelPicker(){list.replaceChildren(...GROWTH_MODELS.map(model=>{const button=document.createElement('button');button.type='button';button.className='growth-model-option'+(model.id===selectedModel.id?' active':'');button.innerHTML=`<img src="${portraitPath(model)}" alt=""><span>${model.name}<small>${model.label}</small></span>`;button.addEventListener('click',async()=>{picker.hidden=true;if(model.id===selectedModel.id)return;await loadModel(model);});return button;}));}
  trigger.addEventListener('click',()=>{renderModelPicker();picker.hidden=false;});q('#growth-model-close').addEventListener('click',()=>picker.hidden=true);picker.addEventListener('click',event=>{if(event.target===picker)picker.hidden=true;});

  async function loadModel(model){
    const token=++generation;q('#growth-status').textContent=`${model.name}を読み込み中`;q('#growth-status').classList.remove('growth-error');
    let gltf;
    try{
      gltf=await new GLTFLoader().loadAsync(new URL(model.path,location.href).href);if(token!==generation){disposeRoot(gltf.scene);return;}
      const root=gltf.scene,isVRM0=Boolean(gltf.parser?.json?.extensions?.VRM&&!gltf.parser?.json?.extensions?.VRMC_vrm);if(isVRM0)root.rotation.y=Math.PI;
      root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});const bones=await humanoidBones(gltf);if(token!==generation){disposeRoot(root);return;}
      const materials=snapshotMaterials(root),base={rootScale:root.scale.clone(),rootPosition:root.position.clone(),headScale:bones.head?.scale.clone(),spineQ:bones.spine?.quaternion.clone(),chestQ:bones.chest?.quaternion.clone(),headQ:bones.head?.quaternion.clone()};
      const previous=current;current={root,bones,materials,base,model,direction:isVRM0?-1:1};selectedModel=model;scene.add(root);
      applyAppearance(22);adultFrame=bounds().clone();renderAge(Number(seek.value),{sync:false});frame(currentView);syncModelCopy();renderModelPicker();syncURL(Number(seek.value)/LIFE_RULES.secondsPerYear);q('#growth-status').textContent='世界時間を動かして成長を確認';if(previous)disposeRoot(previous.root);
    }catch(error){if(gltf?.scene&&token===generation)disposeRoot(gltf.scene);if(token===generation){console.error(error);q('#growth-status').textContent=`モデル読込失敗: ${error.message}`;q('#growth-status').classList.add('growth-error');}}
  }

  seek.addEventListener('input',()=>renderAge(Number(seek.value)));
  document.querySelectorAll('[data-age]').forEach(button=>button.addEventListener('click',()=>{seek.value=String(Number(button.dataset.age)*LIFE_RULES.secondsPerYear);renderAge(Number(seek.value));}));
  document.querySelectorAll('[data-growth-view]').forEach(button=>button.addEventListener('click',()=>frame(button.dataset.growthView)));

  syncModelCopy();renderAge(Number(seek.value),{sync:false});await loadModel(selectedModel);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
}

start().catch(error=>{console.error(error);const status=q('#growth-status');if(status){status.textContent=error.message;status.classList.add('growth-error');}});
