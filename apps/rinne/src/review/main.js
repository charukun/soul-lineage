import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { reviewPresets, installReviewExtensions, disposeLoaded } from './review-adapter.js';
import { REVIEW_ASSET_REVISION, REVIEW_MOTION_FAMILIES, classifyMotion } from '@soul/assets/review-catalog';
import { createPlayback, markerAge } from './playback.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import './style.css';
const q = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const clock = createPlayback();
const numeric = (id,fallback=0) => {const value=Number(q(id).value);return Number.isFinite(value)?value:fallback;};
const setStatus = (text,kind='') => {q('#review-status').textContent=text;q('#review-status').dataset.kind=kind;};
const wrap = fn => (...args) => Promise.resolve().then(()=>fn(...args)).catch(error=>{console.error(error);setStatus(error.message,'error');});
async function startReview() {
  const canvas=q('#review-canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101217');
  const camera=new THREE.PerspectiveCamera(36,1,.01,300);camera.position.set(3.2,2.2,5.2);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=.4;controls.maxDistance=30;
  scene.add(new THREE.HemisphereLight('#dfe8ff','#312b24',1.7));
  const key=new THREE.DirectionalLight('#fff4da',3.2);key.position.set(4,7,4);key.castShadow=true;scene.add(key);
  const rim=new THREE.DirectionalLight('#8aa7ff',1.2);rim.position.set(-5,3,-4);scene.add(rim);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#22262c',roughness:.95}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(30,60,'#65707c','#343b43');grid.position.y=.002;scene.add(grid);
  const extensions=await installReviewExtensions({scene});
  const build=typeof __BUILD_INFO__ === 'object'?__BUILD_INFO__:{commit:'local',branch:'local'};
  q('#build-label').textContent=`${String(build.commit).slice(0,12)} / ${REVIEW_ASSET_REVISION}`;
  let body=null,mixer=null,action=null,activeClip=null,loading=null,generation=0,reviewMode='normal';
  let skeleton=null,bounds=null,cameraName='three',last=performance.now(),frames=[];
  const disposeHelper=helper=>{if(!helper)return;helper.removeFromParent();helper.geometry?.dispose();helper.material?.dispose();};
  function clearHelpers(){disposeHelper(skeleton);disposeHelper(bounds);skeleton=null;bounds=null;}
  function clearBody(){clearHelpers();mixer?.stopAllAction();if(body)mixer?.uncacheRoot(body.root);body?.dispose();body=null;mixer=null;action=null;activeClip=null;clock.time=0;clock.duration=0;clock.playing=false;q('#clip').replaceChildren(new Option('素材未読込',''));q('#source-label').textContent='No source';q('#clip-label').textContent='No clip';}
  function refreshHelpers(){
    clearHelpers();if(!body)return;
    if(q('#skeleton-toggle').checked){skeleton=new THREE.SkeletonHelper(body.root);scene.add(skeleton);}
    if(q('#bounds-toggle').checked){bounds=new THREE.Box3Helper(new THREE.Box3().setFromObject(body.root),0xffcc66);scene.add(bounds);}
  }
  function wireframe(){body?.root.traverse(node=>{for(const mat of Array.isArray(node.material)?node.material:node.material?[node.material]:[])if('wireframe'in mat)mat.wireframe=q('#wireframe-toggle').checked;});}
  function frameModel(name='three'){
    if(!body)return;cameraName=name;body.root.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(body.root);if(box.isEmpty())throw new Error('The selected asset has no visible mesh');
    const sphere=box.getBoundingSphere(new THREE.Sphere()),d=Math.max(sphere.radius*3.2,1.5),center=sphere.center;
    const offset=({front:[0,d*.15,d],back:[0,d*.15,-d],left:[-d,d*.15,0],right:[d,d*.15,0],top:[0,d,.001],three:[d*.72,d*.3,d*.72]})[name]||[d*.72,d*.3,d*.72];
    camera.position.copy(center).add(new THREE.Vector3(...offset));controls.target.copy(center);camera.near=.01;camera.far=Math.max(100,d*20);camera.updateProjectionMatrix();controls.update();
  }
  function weapon(){body?.setWeapon?.({enabled:q('#weapon-toggle').checked,id:q('#weapon-select')?.value||null,scale:numeric('#weapon-scale',.5),x:numeric('#weapon-x'),y:numeric('#weapon-y'),z:numeric('#weapon-z')});}
  function sample(){
    if(action){action.enabled=true;action.paused=false;action.time=clock.time;mixer.update(0);}
    weapon();body?.afterSample?.();body?.root.updateMatrixWorld(true);
    const age=q('#overlay-toggle').checked&&activeClip?markerAge(clock.time,numeric('#overlay-time',.42),clock.duration,clock.loop):Infinity;
    body?.sampleEffects?.(age);
    q('#timeline').max=String(clock.duration||1);q('#timeline').value=String(clock.time);
    q('#current-time').textContent=`${clock.time.toFixed(3)}s`;q('#duration').textContent=`${clock.duration.toFixed(3)}s`;
    q('#play-toggle').textContent=clock.playing?'一時停止':'再生';
    if(bounds&&body)bounds.box.setFromObject(body.root);
  }
  function playClip(name,autoplay=true){
    if(!body)return;
    mixer.stopAllAction();action=null;activeClip=null;clock.time=0;clock.duration=0;clock.playing=false;
    if(name){
      activeClip=body.getClip(name,{inPlace:q('#in-place').checked});
      if(!activeClip)throw new Error(`Source animation not found: ${name}`);
      if(name==='技 / 流し斬り'){
        activeClip=activeClip.clone();for(const track of activeClip.tracks)track.scale(1.28);activeClip.resetDuration();
      }
      const technique=name.startsWith('技 / ');if(technique){q('#loop-toggle').checked=false;clock.loop=false;}
      action=mixer.clipAction(activeClip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
      clock.duration=activeClip.duration;clock.playing=autoplay;
    }
    q('#clip').value=name||'';q('#clip-label').textContent=name||'元モデル静止比較';sample();
  }
  function attach(next){
    body=installWeaponReviewPolish(next);scene.add(body.root);mixer=new THREE.AnimationMixer(body.root);
    body.root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
    q('#source-label').textContent=body.label;
    q('#weapon-controls').hidden=body.weaponReview===false;
    const selector=q('#clip');selector.replaceChildren(new Option('元モデル（静止比較）',''));
    if(body.clipGroups?.length){
      for(const row of body.clipGroups){const group=document.createElement('optgroup');group.label=row.label;for(const name of row.names)group.append(new Option(name,name));selector.append(group);}
    }else{
      const families=[...REVIEW_MOTION_FAMILIES,{id:'other',label:'その他の収録動作'}];
      for(const family of families){
        const names=body.clipNames.filter(name=>classifyMotion(name)===family.id);
        const group=document.createElement('optgroup');group.label=family.label;
        if(!names.length){const option=new Option('未収録 / 自動代用なし','');option.disabled=true;group.append(option);}
        for(const name of names)group.append(new Option(name,name));selector.append(group);
      }
    }
    const absent=REVIEW_MOTION_FAMILIES.filter(row=>!body.clipNames.some(name=>classifyMotion(name)===row.id)).map(row=>row.label);
    q('#family-summary').textContent=body.summary||`収録 ${body.clipNames.length}動作。${absent.length?'未収録: '+absent.join('・'):'6系統の候補を検出'}。動作名は配布元のまま。`;
    const wanted=params.get('clip'),first=body.clipNames.includes(wanted)?wanted:body.clipNames.includes('Idle_Loop')?'Idle_Loop':body.clipNames.includes('Idle')?'Idle':body.clipNames[0];
    playClip(params.get('rest')==='1'?'':first||'',true);
    if(params.has('t'))clock.seek(Math.max(0,Number(params.get('t'))||0));
    wireframe();refreshHelpers();frameModel(params.get('camera')||'three');sample();setStatus('実素材読込済み / 見た目の承認待ち');
  }
  async function loadPreset(presetId=q('#preset').value||reviewPresets[0].id){
    const token=++generation;loading?.abort();loading=new AbortController();clearBody();setStatus('実素材を読み込み中');
    q('#preset').value=presetId;q('#model-url').value='';
    try{
      const result=await extensions.loadPreset({presetId,signal:loading.signal,onProgress:message=>{if(token===generation)setStatus(message);}});
      if(token!==generation){result.dispose();return;}attach(result);
    }catch(error){if(token===generation){clearBody();setStatus(`${error.message} / 再試行できます`,'error');console.error(error);}}
  }
  async function loadManual(url,label=url){
    const token=++generation;loading?.abort();clearBody();setStatus('手動素材を読み込み中');q('#preset').value='';
    const parsed=new URL(url,location.href);if(!['https:','http:','blob:'].includes(parsed.protocol))throw new Error('Unsupported model URL');
    let gltf;
    try{
      gltf=await new GLTFLoader().loadAsync(parsed.href);
      if(token!==generation){disposeLoaded(gltf.scene);return;}
      attach({root:gltf.scene,clipNames:gltf.animations.map(clip=>clip.name),label:`手動素材（台帳未登録）: ${label}`,getClip:name=>gltf.animations.find(clip=>clip.name===name),dispose:()=>disposeLoaded(gltf.scene)});
    }catch(error){if(token===generation){if(gltf)disposeLoaded(gltf.scene);clearBody();setStatus(`${error.message} / 代用モデルは表示しません`,'error');console.error(error);}}
  }
  for(const preset of reviewPresets)q('#preset').add(new Option(preset.label,preset.id));
  if(params.has('preset')&&reviewPresets.some(row=>row.id===params.get('preset')))q('#preset').value=params.get('preset');else q('#preset').value=reviewPresets[0].id;
  q('#preset').addEventListener('change',wrap(()=>{if(q('#preset').value)return loadPreset(q('#preset').value);}));
  q('#retry').addEventListener('click',wrap(()=>q('#model-url').value.trim()?loadManual(q('#model-url').value.trim()):loadPreset()));
  q('#load-url').addEventListener('click',wrap(()=>{const url=q('#model-url').value.trim();if(!url)throw new Error('モデルURLを入力してください');return loadManual(url);}));
  q('#model-file').addEventListener('change',wrap(async()=>{
    const file=q('#model-file').files?.[0];if(!file)return;
    if(!/\.(glb|vrm)$/i.test(file.name)||file.size>25*1024*1024)throw new Error('単一GLB/VRM、25 MiB以下を選んでください');
    const url=URL.createObjectURL(file);try{await loadManual(url,file.name);}finally{URL.revokeObjectURL(url);q('#model-file').value='';}
  }));
  q('#clip').addEventListener('change',wrap(()=>playClip(q('#clip').value)));
  q('#rest-pose').addEventListener('click',wrap(()=>playClip('',false)));
  q('#play-toggle').addEventListener('click',()=>{if(!action)return;if(clock.time>=clock.duration)clock.time=0;clock.playing=!clock.playing;sample();});
  q('#restart').addEventListener('click',()=>{clock.seek(0);sample();});
  q('#step-back').addEventListener('click',()=>{clock.step(-1 / 60);sample();});
  q('#step-forward').addEventListener('click',()=>{clock.step(1 / 60);sample();});
  q('#timeline').addEventListener('input',()=>{clock.seek(numeric('#timeline'));sample();});
  q('#loop-toggle').addEventListener('change',()=>{clock.loop=q('#loop-toggle').checked;sample();});
  q('#speed').addEventListener('change',()=>{clock.speed=Math.max(.1,Math.min(2,numeric('#speed',1)));});
  q('#in-place').addEventListener('change',wrap(()=>playClip(activeClip?.name||'',clock.playing)));
  for(const id of ['#skeleton-toggle','#bounds-toggle'])q(id).addEventListener('change',refreshHelpers);
  q('#wireframe-toggle').addEventListener('change',wireframe);
  q('#grid-toggle').addEventListener('change',()=>{grid.visible=q('#grid-toggle').checked;ground.visible=grid.visible;});
  for(const id of ['#weapon-toggle','#weapon-select','#weapon-scale','#weapon-x','#weapon-y','#weapon-z','#overlay-toggle','#overlay-time'])q(id).addEventListener('input',sample);
  document.addEventListener('review-combat-mode',wrap(async event=>{
    reviewMode=event.detail?.mode==='combat'?'combat':'normal';
    if(reviewMode==='normal'){const idle=body?.clipNames.find(name=>name==='Tidebreak / Idle'||/Idle|待機/.test(name));play