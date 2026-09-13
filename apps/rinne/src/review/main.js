import { THREE, GLTFLoader, OrbitControls } from '@soul/rendering';
import { reviewPresets, installReviewExtensions, disposeLoaded } from './review-adapter.js';
import { REVIEW_ASSET_REVISION, REVIEW_MOTION_FAMILIES, classifyMotion } from '@soul/assets/review-catalog';
import { createPlayback, markerAge } from './playback.js';
import { sequenceDuration, sequenceFrame } from './review-contract.js';
import {SWORD_MOVES} from '../../public/simulator/src/authored-sword.js';
import {createSwordSequence,swordSequenceFrame} from '../../public/simulator/src/sword-sequence.js';
import './style.css';
import { readReviewState, reviewStateURL, applyMotionPolicy } from './review-state.js';
import { installFocusedReviewUI } from './review-controls.js';
import './review-controls.css';
import { sampleRawClip } from './pose-transfer.js';
const q = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const state=readReviewState(params);
const clock=Object.assign(createPlayback(),{time:state.time,speed:state.speed,loop:state.loop,playing:state.playing});
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
  installFocusedReviewUI();
  const build=typeof __BUILD_INFO__ === 'object'?__BUILD_INFO__:{commit:'local',branch:'local'};
  q('#build-label').textContent=`${String(build.commit).slice(0,12)} / ${REVIEW_ASSET_REVISION}`;
  let body=null,mixer=null,action=null,activeClip=null,loading=null,generation=0;
  let sequence=[],sequenceNames=[],sequenceIndex=-1,restoringSequence=false,swordSequence=null;
  let skeleton=null,bounds=null,cameraName='three',last=performance.now(),frames=[];
  const disposeHelper=helper=>{if(!helper)return;helper.removeFromParent();helper.geometry?.dispose();helper.material?.dispose();};
  function clearHelpers(){disposeHelper(skeleton);disposeHelper(bounds);skeleton=null;bounds=null;}
  function clearBody(){swordSequence=null;sequence=[];sequenceNames=[];sequenceIndex=-1;clearHelpers();mixer?.stopAllAction();if(body)mixer?.uncacheRoot(body.root);body?.dispose();body=null;mixer=null;action=null;activeClip=null;clock.time=0;clock.duration=0;clock.playing=false;q('#clip').replaceChildren(new Option('素材未読込',''));q('#source-label').textContent='No source';q('#clip-label').textContent='No clip';}
  function refreshHelpers(){
    clearHelpers();if(!body)return;
    if(q('#skeleton-toggle').checked){skeleton=new THREE.SkeletonHelper(body.root);scene.add(skeleton);}
    if(q('#bounds-toggle').checked){bounds=new THREE.Box3Helper(new THREE.Box3().setFromObject(body.root),0xffcc66);scene.add(bounds);}
  }
  function wireframe(){body?.root.traverse(node=>{for(const mat of Array.isArray(node.material)?node.material:node.material?[node.material]:[])if('wireframe'in mat)mat.wireframe=q('#wireframe-toggle').checked;});}
  function frameModel(name='three'){
    if(!body)return;cameraName=name;state.camera=name;body.root.updateMatrixWorld(true);
    const box=new THREE.Box3();body.root.traverseVisible(node=>{if(node.isMesh)box.union(new THREE.Box3().setFromObject(node));});if(box.isEmpty())throw new Error('The selected asset has no visible mesh');
    const sphere=box.getBoundingSphere(new THREE.Sphere()),d=Math.max(sphere.radius*3.2,1.5),center=sphere.center;
    const offset=({front:[0,d*.15,d],back:[0,d*.15,-d],left:[-d,d*.15,0],right:[d,d*.15,0],top:[0,d,.001],three:[d*.72,d*.3,d*.72]})[name]||[d*.72,d*.3,d*.72];
    camera.position.copy(center).add(new THREE.Vector3(...offset));controls.target.copy(center);camera.near=.01;camera.far=Math.max(100,d*20);camera.updateProjectionMatrix();controls.update();
  }
  function currentState(){return{...state,sequence:[...sequenceNames],time:clock.time,speed:clock.speed,loop:clock.loop,playing:clock.playing};}
  function metaFor(name=state.clip){return body?.motionMeta?.get(name);}
  function reviewFrame(){
    if(!swordSequence)return sequenceFrame(sequence,clock.time);
    const f=swordSequenceFrame(swordSequence,clock.time);
    return {...f,time:f.current.phase*sequence[f.index].duration,duration:sequence[f.index].duration};
  }
  function syncControls(){
    q('#weapon-select').value=state.weaponId;q('#weapon-toggle').checked=state.weaponEnabled;
    for(const [key,id]of [['weaponScale','#weapon-scale'],['weaponX','#weapon-x'],['weaponY','#weapon-y'],['weaponZ','#weapon-z']])q(id).value=String(state[key]);
    q('#loop-toggle').checked=clock.loop;q('#speed').value=String(clock.speed);q('#in-place').checked=state.inPlace;
    q('#overlay-time').value=String(state.marker);q('#overlay-toggle').checked=state.vfx;
    for(const button of document.querySelectorAll('[data-combat-mode]')){const on=button.dataset.combatMode===state.mode;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}
    for(const button of document.querySelectorAll('[data-weapon]'))button.classList.toggle('active',button.dataset.weapon===(state.weaponEnabled?state.weaponId:'none'));
  }
  function weapon(){const current=body;if(!current?.setWeapon)return;Promise.resolve(current.setWeapon({enabled:state.weaponEnabled,id:state.weaponId,scale:state.weaponScale,x:state.weaponX,y:state.weaponY,z:state.weaponZ})).catch(error=>{if(body===current)setStatus('武器読込失敗: '+error.message,'error');});}
  function sample(){
    if(body?.suspendSampling)return;
    const frame=reviewFrame();
    if(frame&&frame.index!==sequenceIndex){
      const subsequent=sequenceIndex>=0;
      mixer.stopAllAction();sequenceIndex=frame.index;activeClip=sequence[frame.index];state.clip=sequenceNames[frame.index];
      if(subsequent&&!restoringSequence){const loop=clock.loop;Object.assign(state,applyMotionPolicy(state,metaFor(state.clip)));state.loop=loop;}
      action=mixer.clipAction(activeClip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.reset().play();
      q('#clip').value=state.clip;q('#clip-label').textContent=state.clip;syncControls();
      document.dispatchEvent(new CustomEvent('review-sequence-frame',{detail:{index:frame.index,names:[...sequenceNames]}}));
    }
    body?.resetPose?.();
    const localTime=frame?.time||0;
    if(action){action.enabled=true;action.paused=false;action.time=localTime;mixer.update(0);if(body.resetPose){if(frame.previous)sampleRawClip(sequence[frame.previous.index],body.root,frame.previous.phase*sequence[frame.previous.index].duration);sampleRawClip(activeClip,body.root,localTime,frame.previous?frame.weight:1);}}
    weapon();body?.afterSample?.(localTime,state.clip,state);body?.root.updateMatrixWorld(true);
    const age=state.vfx&&activeClip?markerAge(localTime,state.marker,activeClip.duration,clock.loop&&sequence.length===1):Infinity;
    body?.sampleEffects?.(age);
    q('#timeline').max=String(clock.duration||1);q('#timeline').value=String(clock.time);
    q('#current-time').textContent=`${clock.time.toFixed(3)}s`;q('#duration').textContent=`${clock.duration.toFixed(3)}s`;
    q('#play-toggle').textContent=clock.playing?'一時停止':'再生';
    if(bounds&&body)bounds.box.setFromObject(body.root);
    document.dispatchEvent(new CustomEvent('review-state-change',{detail:{state:currentState(),meta:metaFor(),problems:body?.assetProblems||[],weapon:body?.weaponDiagnostics||null,loaded:!!body}}));
  }
  function playSequence(names,autoplay=true,restore=false){
    if(!body)throw new Error('モデルの読み込み完了後に再生してください');
    if(!Array.isArray(names)||names.length>3||names.some(name=>typeof name!=='string'||!name))throw new Error('再生モーションの指定が不正です');
    // Resolve every stage before touching current playback; never skip missing stages.
    const clips=names.map(name=>{const clip=body.getClip(name,{inPlace:state.inPlace});if(!clip)throw new Error(`Source animation not found: ${name}`);return clip;});
    const kinds=names.map(name=>metaFor(name)?.weapon==='sword'?metaFor(name)?.kind:null);
    const nextSwordSequence=names.length>1&&kinds.every(kind=>SWORD_MOVES[kind])?createSwordSequence(kinds):null;
    const duration=nextSwordSequence?.duration??sequenceDuration(clips);
    if(!restore){Object.assign(state,applyMotionPolicy(state,metaFor(names[0])));clock.loop=names.length>1?false:state.loop;state.loop=clock.loop;}
    mixer.stopAllAction();action=null;activeClip=null;sequence=clips;swordSequence=nextSwordSequence;sequenceNames=[...names];sequenceIndex=-1;
    state.sequence=[...names];state.clip=names[0]||'';clock.time=0;clock.duration=duration;clock.playing=autoplay&&clips.length>0;
    if(!names.length){q('#clip').value='';q('#clip-label').textContent='元モデル静止比較';document.dispatchEvent(new CustomEvent('review-sequence-frame',{detail:{index:0,names:[]}}));}
    restoringSequence=restore;syncControls();sample();restoringSequence=false;
  }
  function playClip(name,autoplay=true,restore=false){playSequence(name?[name]:[],autoplay,restore);}
  function restoreSelection(){
    const names=state.sequence?.length?[...state.sequence]:state.clip?[state.clip]:[];
    if(!names.every(n=>body.clipNames.includes(n)))return false;
    const savedTime=state.time,playing=state.playing;
    playSequence(names,playing,true);clock.time=Math.min(savedTime,clock.duration);
    restoringSequence=true;sample();restoringSequence=false;return true;
  }
  function attach(next){
    body=next;scene.add(body.root);mixer=new THREE.AnimationMixer(body.root);
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
    if(!body.poseTransfer&&!state.shared&&!body.clipNames.includes(state.clip)){state.clip=body.clipNames[0]||'';state.sequence=[];}
    if(!restoreSelection()){clock.playing=false;setStatus('指定モーションを読み込み中');}
    wireframe();refreshHelpers();frameModel(state.camera);syncControls();sample();
    document.dispatchEvent(new CustomEvent('review-model-loaded',{detail:{presetId:state.preset}}));
    setStatus('基本素材を表示中。追加素材は準備状況から確認できます。');

  }
  async function loadPreset(presetId=q('#preset').value||reviewPresets[0].id){
    if(body){state.sequence=[...sequenceNames];}state.time=clock.time;state.playing=clock.playing;const token=++generation;loading?.abort();loading=new AbortController();clearBody();setStatus('実素材を読み込み中');
    q('#preset').value=presetId;state.preset=presetId;q('#model-url').value='';
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
  q('#clip').addEventListener('change',wrap(()=>{state.shared=false;state.time=0;playClip(q('#clip').value);}));
  new MutationObserver(()=>{if(body&&!activeClip)restoreSelection();}).observe(q('#clip'),{childList:true,subtree:true});
  document.addEventListener('review-play-sequence',wrap(event=>{state.shared=false;playSequence(event.detail?.names);}));
  q('#rest-pose').addEventListener('click',wrap(()=>playClip('',false)));
  q('#play-toggle').addEventListener('click',()=>{if(!action)return;if(clock.time>=clock.duration)clock.time=0;clock.playing=!clock.playing;sample();});
  q('#restart').addEventListener('click',()=>{clock.seek(0);sample();});
  q('#step-back').addEventListener('click',()=>{clock.step(-1 / 60);sample();});
  q('#step-forward').addEventListener('click',()=>{clock.step(1 / 60);sample();});
  q('#timeline').addEventListener('input',()=>{clock.seek(numeric('#timeline'));sample();});
  q('#loop-toggle').addEventListener('change',()=>{clock.loop=q('#loop-toggle').checked;state.loop=clock.loop;sample();});
  q('#speed').addEventListener('change',()=>{clock.speed=Math.max(.1,Math.min(2,numeric('#speed',1)));state.speed=clock.speed;});
  q('#in-place').addEventListener('change',wrap(()=>{state.inPlace=q('#in-place').checked;const t=clock.time;playSequence([...sequenceNames],clock.playing,true);clock.time=t;restoringSequence=true;sample();restoringSequence=false;}));
  for(const id of ['#skeleton-toggle','#bounds-toggle'])q(id).addEventListener('change',refreshHelpers);
  q('#wireframe-toggle').addEventListener('change',wireframe);
  q('#grid-toggle').addEventListener('change',()=>{grid.visible=q('#grid-toggle').checked;ground.visible=grid.visible;});
  for(const id of ['#weapon-toggle','#weapon-select','#weapon-scale','#weapon-x','#weapon-y','#weapon-z','#overlay-toggle','#overlay-time'])q(id).addEventListener('input',()=>{
    state.weaponEnabled=q('#weapon-toggle').checked;state.weaponId=q('#weapon-select').value;
    state.weaponScale=Math.max(.1,Math.min(1,numeric('#weapon-scale',.5)));state.weaponX=Math.max(-360,Math.min(360,numeric('#weapon-x')));state.weaponY=Math.max(-360,Math.min(360,numeric('#weapon-y')));state.weaponZ=Math.max(-360,Math.min(360,numeric('#weapon-z')));state.vfx=q('#overlay-toggle').checked;state.marker=numeric('#overlay-time',.42);syncControls();sample();
  });
  document.addEventListener('review-combat-mode',event=>{state.mode=event.detail.mode==='combat'?'combat':'normal';state.time=0;playClip(state.mode==='combat'?'Tidebreak / Idle':'通常 / 自然体',true,true);clock.loop=true;syncControls();sample();});
  document.addEventListener('review-phase',event=>{const phases=metaFor()?.phases||[],index=Number(event.detail.index);if(phases[index]){clock.seek((reviewFrame()?.offset||0)+phases[index][1]);sample();}});
  q('#trigger-overlay').addEventListener('click',()=>{if(!activeClip)return;q('#overlay-toggle').checked=true;state.vfx=true;clock.seek((reviewFrame()?.offset||0)+Math.min(activeClip.duration,numeric('#overlay-time',.42)+.02));sample();});
  document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',wrap(()=>frameModel(button.dataset.camera))));
  function stateText(){return ['輪廻転焦 Visual Review Lab',`Source: ${body?.label||'none'}`,`Clip: ${activeClip?.name||'rest'}`,`Sequence: ${sequenceNames.join(' → ')||'rest'}`,`Time: ${clock.time.toFixed(3)} / ${clock.duration.toFixed(3)}`,`Speed: ${clock.speed}`,`In place: ${q('#in-place').checked}`,`Marker: ${q('#overlay-time').value} (preview only)`,`Posture: ${state.mode}`,`Loop: ${clock.loop}`,`Weapon: ${state.weaponId} / ${state.weaponEnabled} / scale ${q('#weapon-scale').value} / XYZ ${q('#weapon-x').value},${q('#weapon-y').value},${q('#weapon-z').value}`,`Note: ${q('#review-note').value}`,`Build: ${build.commit} / ${build.branch}`,`Assets: ${REVIEW_ASSET_REVISION}`].join('\n');}
  async function copy(text){await navigator.clipboard.writeText(text);setStatus('レビュー情報をコピーしました');}
  // notebook.js owns the editable feedback dialog, including its explicit Copy action.
  q('#copy-link').addEventListener('click',wrap(()=>{
    const url=reviewStateURL(location.href,currentState());
    if(q('#model-url').value)url.searchParams.set('model',q('#model-url').value);
    history.replaceState(null,'',url);return copy(url.href);
  }));
  q('#capture').addEventListener('click',wrap(async()=>{
    renderer.render(scene,camera);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('スクリーンショット取得に失敗しました');
    try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);setStatus('画像をコピーしました');}
    catch{const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`rinne-review-${String(build.commit).slice(0,8)}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);setStatus('画像を保存しました');}
  }));
  const resize=()=>{const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(canvas);resize();
  syncControls();
  window.__reviewLab={snapshot:()=>({loaded:Boolean(body),clip:activeClip?.name||null,time:clock.time,source:body?.label||null,build:build.commit,state:currentState(),metadata:body?.motionMeta?[...body.motionMeta]:[],assetProblems:body?.assetProblems||[],weapon:body?.weaponDiagnostics||null,poseTransfer:body?.poseTransfer||null,worldPose:body?.bones?Object.fromEntries(['rightHand','leftHand','rightLowerArm','rightUpperArm','leftFoot','rightFoot'].map(n=>[n,body.bones[n].getWorldPosition(new THREE.Vector3()).toArray()])):null,
    sequence:[...sequenceNames],sequenceIndex,playing:clock.playing,duration:clock.duration,loop:clock.loop,speed:clock.speed,localTime:reviewFrame()?.time||0,posture:body?.postureDiagnostics||null,animations:body?.clipNames||[],calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
    pose:body?.bones?Object.fromEntries(Object.entries(body.bones).map(([name,bone])=>[name,[...bone.position.toArray(),...bone.quaternion.toArray()]])):null}),stateText,stateURL:()=>reviewStateURL(location.href,currentState()).href,metadata:()=>body?.motionMeta?[...body.motionMeta]:[],seek:time=>{clock.seek(time);sample();},frame:frameModel};
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();clock.playing=false;setStatus('WebGLコンテキストが失われました。再読み込みしてください。','error');});
  function tick(now){const raw=Math.max(0,(now-last)/1000);last=now;controls.update();if(!document.hidden){clock.update(raw);sample();renderer.render(scene,camera);frames.push(raw);if(frames.length>60)frames.shift();const avg=frames.reduce((a,b)=>a+b,0)/frames.length;q('#fps').textContent=avg?`${Math.round(1/avg)} FPS`:'0 FPS';}requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
  if(params.get('model')){q('#model-url').value=params.get('model');await loadManual(params.get('model'));}else await loadPreset();
}
startReview().catch(error=>{console.error(error);setStatus(`Review初期化失敗: ${error.message}`,'error');});
