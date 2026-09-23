import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {RINNE_MOTION_REVIEW_DEFAULT_MODEL,RINNE_MOTION_REVIEW_MODELS} from './models.js';
import {createHumanoidPreview} from '@soul/rendering/humanoid-preview';
import {createHumanoidPreviewConstraints} from '@soul/rendering/humanoid-preview-constraints';
import {createReviewCameraPresetController,createReviewRenderer,disposeReviewObject,normalizeReviewSubject,positionReviewCamera} from '@soul/rendering';
import {buildMotionReviewCatalog,filterMotionReviewCatalog,REVIEW_MOTION_CATEGORY_LABELS,reviewMotionDisplayName} from './catalog.js';
import {buildReviewMotionRegistry,motionRegistryCount,externalMotionRecords,dedupeSourceMotions} from './registry.js';
import {loadPinnedMotionSource,loadPinnedReviewTarget,discoverPinnedMotionLibraryClips,disposePinnedMotionSources} from './source-runtime.js';
import {resolveReviewHumanoidDescriptor,createRigRequiredDccRoute} from './humanoid-calibrations.js';
import {hideEmbeddedCombatProps} from '../shared/combat-equipment.js';
import {MOTION_REVIEW_WEAPON_OPTIONS,keepMotionReviewWeaponAboveFloor,loadMotionReviewWeapon} from './equipment.js';
import './library.css';
import './preview.css';
import {createRuntimeThumbnail,scheduleRuntimeThumbnail,clearRuntimeThumbnailQueue} from '../shared/runtime-thumbnail.js';
import {mountRinneReviewShell} from '../shared/lab-shell.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {createReviewSvgThumbnail} from '@soul/shared-ui/review-thumbnail';
import {setReviewStatus} from '@soul/shared-ui/review-status';

const el=id=>document.getElementById(id),canvas=el('motion-stage');
const status=message=>{if(el('motion-status').textContent!==message)setReviewStatus(el('motion-status'),message);};
const renderer=createReviewRenderer(canvas,{exposure:1.05});
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1110);scene.fog=new THREE.Fog(0x0b1110,9,22);
const camera=new THREE.PerspectiveCamera(38,1,.04,60),controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=1;controls.maxDistance=12;
scene.add(new THREE.HemisphereLight(0xe3ece8,0x27312d,2.4));
const key=new THREE.DirectionalLight(0xffe7bc,3.1);key.position.set(-4,7,5);scene.add(key);
const rim=new THREE.DirectionalLight(0x9ac8d5,1.35);rim.position.set(5,4,-4);scene.add(rim);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.5,64),new THREE.MeshStandardMaterial({color:0x1a2420,roughness:.96,metalness:.01}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.005;scene.add(ground);
const stage=new THREE.Group();scene.add(stage);
const REVIEW_MODELS=RINNE_MOTION_REVIEW_MODELS;
let selectedModel=RINNE_MOTION_REVIEW_DEFAULT_MODEL,subject=null,targetScene=null,targetAdapter=null,targetConstraints=null,targetCalibration=null,targetDccRoute=null,mixer=null,action=null,targetClips=[],catalog=[],selected=null;
let filter='all',playing=false,speed=1,loop=true,last=performance.now(),loadSerial=0,selectSerial=0;
let externalSource=null,externalTime=0,selectedDuration=0,ready=false,rootMotion='in-place',constraintMode='raw',stopped=false;
let selectedWeapon='none',equippedWeapon=null,weaponSerial=0;
const motionFailures=new Map(),thumbnailModelPromises=new Map(),categoryOrder=['all','recommended','life','move','parkour','combat','reaction','other'];
const categoryLabel=category=>REVIEW_MOTION_CATEGORY_LABELS[category]||category;
const isExternal=()=>selected?.runtime?.kind==='pinned-motion-source';
const playbackTime=()=>isExternal()?externalTime:Math.max(0,action?.time||0);

// One selected-item explanation; no extra microcopy on every thumbnail.
const quality=document.createElement('output');quality.id='motion-quality';quality.className='motion-quality';quality.setAttribute('aria-live','polite');
canvas.closest('.motion-stage').append(quality);
const compatibility=document.createElement('section');compatibility.className='motion-compatibility';compatibility.dataset.reviewStageControl='true';
compatibility.innerHTML='<div class="motion-setting-grid"><label><span>キャラモデル</span><select id="motion-model" aria-label="キャラクターモデル"></select></label><label><span>武器</span><select id="motion-weapon" aria-label="武器"></select></label><label><span>腰の移動</span><select id="motion-root-policy" aria-label="腰の移動"><option value="in-place">その場</option><option value="free">移動を反映</option><option value="locked">腰を固定</option></select></label><label><span>接地補正</span><select id="motion-constraint-policy" aria-label="接地補正"><option value="raw">補正なし</option><option value="assisted">接地・接触を補助</option></select></label></div><details class="motion-diagnostics"><summary>技術詳細</summary><pre id="motion-binding-report"></pre></details>';
el('motion-meta').closest('details').before(compatibility);
for(const model of REVIEW_MODELS)el('motion-model').add(new Option(model.label,model.id));
el('motion-model').value=selectedModel.id;
for(const option of MOTION_REVIEW_WEAPON_OPTIONS)el('motion-weapon').add(new Option(option.label,option.id));
el('motion-weapon').value=selectedWeapon;
canvas.closest('.motion-stage').dataset.reviewStagePanelHost='.motion-library-primary';
mountRinneReviewShell('motion');
let lastReport='';
function showCompatibility(result,source=externalSource){
  const labels={PLAYABLE:'再生可能',DEGRADED:'近似再生',RIG_REQUIRED:'骨・ウェイトの準備が必要',UNSUPPORTED:'データを確認してください',LOADING:'読み込み中',NATIVE:'原版再生'};
  const code=result?.status||targetAdapter?.descriptor.status||'LOADING';
  if(quality.dataset.state!==code){quality.value=labels[code]||code;quality.dataset.state=code;canvas.dataset.motionCompatibility=code;}
  const summary={status:code,applied:result?.applied,reasons:result?.reasons,rootMotion:result?.rootMotion,constraintMode,constraints:result?.constraints};
  const signature=(targetAdapter?.descriptor.assetHash||'')+(source?.id||'')+JSON.stringify(summary);
  if(signature!==lastReport){el('motion-binding-report').textContent=JSON.stringify({target:targetAdapter?.descriptor,calibration:targetCalibration,dccRoute:targetDccRoute,source:source?.compatibility||null,result:summary},null,2);lastReport=signature;}
}
function disposeEquippedWeapon(){
  weaponSerial++;
  if(!equippedWeapon)return;
  disposeReviewObject(equippedWeapon);equippedWeapon=null;
}
async function syncWeapon(){
  const serial=++weaponSerial;
  if(equippedWeapon){disposeReviewObject(equippedWeapon);equippedWeapon=null;}
  canvas.dataset.motionWeapon=selectedWeapon;
  if(selectedWeapon==='none'||!targetAdapter)return;
  const anchor=targetAdapter.bones?.rightHand;
  if(!anchor){status('右手の武器スロットが見つかりません。');return;}
  try{
    const loaded=await loadMotionReviewWeapon(selectedWeapon);
    if(serial!==weaponSerial||stopped||!targetAdapter){if(loaded.root)disposeReviewObject(loaded.root);return;}
    if(!loaded.root)return;
    anchor.add(loaded.root);equippedWeapon=loaded.root;keepMotionReviewWeaponAboveFloor(equippedWeapon);canvas.dataset.motionWeapon=loaded.option.id;
  }catch(error){
    if(serial!==weaponSerial||stopped)return;
    canvas.dataset.motionWeapon='error';status('武器読込失敗: '+String(error?.message||error));
  }
}
function disposeSubject(){
  disposeEquippedWeapon();
  if(mixer&&targetScene){mixer.stopAllAction();mixer.uncacheRoot(targetScene);}
  if(subject)disposeReviewObject(subject);
  subject=null;targetScene=null;targetAdapter=null;targetConstraints=null;targetCalibration=null;targetDccRoute=null;mixer=null;action=null;targetClips=[];
}
const motionCameraPresets=createReviewCameraPresetController({
  selector:'[data-motion-camera]',
  datasetKey:'motionCamera',
  initialPreset:'three-quarter',
  applyPreset:id=>{if(subject)positionReviewCamera({camera,controls,root:subject,preset:id,padding:1.75,minDistance:1,maxDistance:12});},
});
function setCameraPreset(id){motionCameraPresets.set(id);}
function syncPlaybackUI(){
  const time=Math.min(selectedDuration,playbackTime());
  const playLabel=playing?'一時停止':'▶ 再生';if(el('motion-play').textContent!==playLabel)el('motion-play').textContent=playLabel;
  el('motion-play').setAttribute('aria-pressed',String(playing));el('motion-loop').checked=loop;
  for(const id of ['motion-play','motion-restart','motion-time','motion-prev-frame','motion-next-frame'])el(id).disabled=!ready;
  el('motion-time').max=String(Math.max(selectedDuration,.0001));if(document.activeElement!==el('motion-time'))el('motion-time').value=String(time);
  el('motion-time-label').value=time.toFixed(2)+' / '+selectedDuration.toFixed(2)+'秒';
  const subtitle=categoryLabel(selected?.category||'other')+' · '+selectedModel.label+(selectedDuration?' · '+selectedDuration.toFixed(2)+'s':'');
  if(el('motion-source').textContent!==subtitle)el('motion-source').textContent=subtitle;
}
function syncMotionCards(){
  for(const b of el('motion-grid').querySelectorAll('[data-motion-identity]')){
    const identity=b.dataset.motionIdentity;b.setAttribute('aria-pressed',String(selected?.sourceIdentity===identity));b.dataset.previewState=motionFailures.has(identity)?'error':'available';
  }
}
function syncSelectedMeta(){
  if(!selected)return;const row=selected;
  el('motion-selected').textContent=row.displayName||reviewMotionDisplayName(row.name,row.index);
  el('motion-meta').textContent=`source ${row.sourceRepository} @ ${row.sourceRevision} / ${row.sourcePath} / clip ${row.upstreamClipIndex}「${row.displayName||reviewMotionDisplayName(row.name,row.index)}」 / ${row.immutableHash} / ${row.author} / ${row.license}`;
  el('motion-license').href=row.licenseEvidence||row.licenseUrl||'./simulator/licenses/REVIEW_MOTION_SOURCES.txt';
  el('motion-origin').href=row.originalSource||'./simulator/licenses/REVIEW_MOTION_SOURCES.txt';
  canvas.dataset.motionName=row.displayName||reviewMotionDisplayName(row.name,row.index);canvas.dataset.motionUpstreamName=row.upstreamClipName;canvas.dataset.motionCategory=row.category;canvas.dataset.motionIdentity=row.sourceIdentity;
}
function applyExternal(time){
  const result=targetAdapter.apply(externalSource.sample(selected.upstreamClipIndex,time),{rootMotion,mode:'preview'});
  if(!result.applied){showCompatibility(result);throw new Error(result.reasons.join(', '));}
  const constraints=targetConstraints?.apply({clipName:selected?.name||selected?.upstreamClipName||'',mode:constraintMode})||{mode:'raw',corrections:[],reasons:[]};
  const reasons=[...(result.reasons||[]),...(constraints.reasons||[])];
  const combined={...result,status:reasons.length?'DEGRADED':result.status,reasons,constraints};
  showCompatibility(combined);
}
async function selectMotion(record){
  if(!record||!mixer||!targetAdapter)return;
  const serial=++selectSerial,modelSerial=loadSerial;playing=false;ready=false;selected=record;selectedDuration=0;externalTime=0;externalSource=null;
  mixer.stopAllAction();action=null;targetAdapter.reset();syncSelectedMeta();syncMotionCards();syncPlaybackUI();showCompatibility({status:'LOADING'});
  try{
    if(record.runtime.kind==='kaykit-embedded'){
      const clip=targetClips.find(item=>item.name===record.upstreamClipName);if(!clip)throw new Error('Source clip not present on this target');
      selectedDuration=clip.duration;action=mixer.clipAction(clip);action.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;action.play();
      showCompatibility({status:'NATIVE',applied:true});
    }else if(record.runtime.kind==='pinned-motion-source'){
      status('モーションを読み込んでいます。');
      const source=await loadPinnedMotionSource(record.sourceId,{preview:true});
      if(serial!==selectSerial||modelSerial!==loadSerial||stopped)return;
      externalSource=source;selectedDuration=source.duration(record.upstreamClipIndex);applyExternal(0);
    }else throw new Error('Unknown motion source');
    if(!(selectedDuration>0)||!Number.isFinite(selectedDuration))throw new Error('Invalid clip duration');
    motionFailures.delete(record.sourceIdentity);ready=true;playing=true;status('');
  }catch(error){
    if(serial!==selectSerial||modelSerial!==loadSerial||stopped)return;
    const message=String(error?.message||error);motionFailures.set(record.sourceIdentity,message);ready=false;playing=false;
    status('この動きは読み込めません。別の動きを選択するか、同じ候補を押して再試行できます。');
    showCompatibility({status:targetAdapter.descriptor.status==='RIG_REQUIRED'?'RIG_REQUIRED':'UNSUPPORTED',applied:false,reasons:[message]});
  }
  syncMotionCards();syncPlaybackUI();
}
const createStaticThumbnail=(url,label='')=>createReviewSvgThumbnail(url,{label});
function createModelThumbnail(model){
  if(model.thumbnailUrl){
    if(model.legacyVersion)return createStaticThumbnail(model.thumbnailUrl,model.label);
    const image=document.createElement('img');image.className='review-static-thumbnail';
    image.src=model.thumbnailUrl;image.alt=model.label;image.loading='lazy';image.decoding='async';
    image.width=288;image.height=184;return image;
  }
  const thumbnail=createRuntimeThumbnail(model.label);
  scheduleRuntimeThumbnail(thumbnail,`motion-model:v1:${model.id}`,async()=>cloneSkeleton((await loadReviewModelForThumbnail(model)).scene),{disposeAfter:false});
  return thumbnail;
}
function renderModelGrid(){
  const grid=el('motion-model-grid');grid.replaceChildren();
  for(const model of REVIEW_MODELS){const b=document.createElement('button');b.type='button';b.className='review-choice-card';b.dataset.motionModel=model.id;b.append(createModelThumbnail(model));b.setAttribute('aria-label',model.label);b.title=model.label;b.setAttribute('aria-pressed',String(model.id===selectedModel.id));b.addEventListener('click',()=>{if(model.id!==selectedModel.id)void loadModel(model);});grid.append(b);}
}
function renderFilters(){
  const root=el('motion-filters');root.replaceChildren();
  for(const id of categoryOrder){const b=document.createElement('button');b.type='button';b.textContent=categoryLabel(id);b.dataset.motionFilter=id;b.setAttribute('aria-pressed',String(id===filter));b.addEventListener('click',()=>{filter=id;renderFilters();renderMotionGrid();});root.append(b);}
}
async function loadReviewModelForThumbnail(model){
  if(!thumbnailModelPromises.has(model.id))thumbnailModelPromises.set(model.id,loadPinnedReviewTarget(model).catch(error=>{thumbnailModelPromises.delete(model.id);throw error;}));
  return thumbnailModelPromises.get(model.id);
}
function renderMotionGrid(){
  const root=el('motion-grid'),model=selectedModel,rows=filterMotionReviewCatalog(catalog,filter);root.replaceChildren();
  if(!rows.length){const empty=document.createElement('p');empty.className='motion-empty';empty.textContent=targetAdapter?'この分類のモーションはありません。':'モデルを準備しています。';root.append(empty);return;}
  for(const record of rows){
    const button=document.createElement('button');button.type='button';button.classList.add('review-choice-card');button.dataset.motionIdentity=record.sourceIdentity;button.dataset.recommended=String(record.recommended);
    const label=record.displayName||reviewMotionDisplayName(record.name,record.index),thumbnail=createRuntimeThumbnail(label);button.setAttribute('aria-label',label);button.title=label;button.append(thumbnail);
    scheduleRuntimeThumbnail(thumbnail,`motion-pose:v1:${model.id}:${record.sourceIdentity}`,async()=>{
      const gltf=await loadReviewModelForThumbnail(model),poseRoot=cloneSkeleton(gltf.scene);
      if(record.runtime.kind==='kaykit-embedded'){
        const clip=gltf.animations.find(c=>c.name===record.upstreamClipName);if(!clip)throw new Error('Source pose unavailable');
        const mix=new THREE.AnimationMixer(poseRoot);mix.clipAction(clip).play();mix.setTime(clip.duration*.38);
        // Do not stopAllAction here: Three restores the rest pose before the screenshot.
      }else{
        const source=await loadPinnedMotionSource(record.sourceId,{preview:true}),calibration=resolveReviewHumanoidDescriptor(model),wrapper=createHumanoidPreview(poseRoot,{role:'target',assetHash:model.source?.gitBlobSha,basis:calibration.basis,mapping:calibration.mapping});
        const result=wrapper.apply(source.sample(record.upstreamClipIndex,source.duration(record.upstreamClipIndex)*.38));
        thumbnail.dataset.poseStatus=result.status;if(!result.applied)throw new Error(result.status);
      }
      return poseRoot;
    },{disposeAfter:false});
    button.addEventListener('click',()=>void selectMotion(record));root.append(button);
  }
  syncMotionCards();
}
function seek(value){
  if(!ready)return;const time=Math.min(selectedDuration,Math.max(0,Number(value)||0));
  try{if(isExternal()){externalTime=time;applyExternal(time);}else if(action){action.paused=false;action.time=time;mixer.update(0);}}
  catch(error){playing=false;ready=false;status(String(error?.message||error));}
  syncPlaybackUI();
}
function rebuildCatalog(discovered={}){
  // A valid target need not contain any animation. Do not invent an Idle clip/count.
  const registry=targetClips.length?buildReviewMotionRegistry(targetClips,discovered):dedupeSourceMotions(externalMotionRecords(discovered).records);
  catalog=buildMotionReviewCatalog(registry.motions,{perCategory:8});const count=motionRegistryCount(registry);canvas.dataset.motionCount=String(count);el('motion-count-value').textContent=String(count);renderMotionGrid();
}
async function loadModel(model){
  const serial=++loadSerial; ++selectSerial;
  const previousIdentity=selected?.sourceIdentity;selectedModel=model;el('motion-model').value=model.id;motionFailures.clear();playing=false;ready=false;selected=null;externalSource=null;selectedDuration=0;
  clearRuntimeThumbnailQueue();disposeSubject();renderModelGrid();catalog=[];renderMotionGrid();syncPlaybackUI();status(model.label+' を読み込んでいます。');el('motion-load').hidden=false;el('motion-load').removeAttribute('value');
  try{
    const gltf=await loadPinnedReviewTarget(model);
    if(serial!==loadSerial||stopped){disposeReviewObject(gltf.scene);return;}
    hideEmbeddedCombatProps(gltf.scene);
    const wrapper=new THREE.Group();wrapper.name='MotionReview:'+model.id;wrapper.add(gltf.scene);
    normalizeReviewSubject(wrapper);subject=wrapper;targetScene=gltf.scene;stage.add(subject);
    targetCalibration=resolveReviewHumanoidDescriptor(model);
    targetAdapter=createHumanoidPreview(gltf.scene,{role:'target',assetHash:model.source?.gitBlobSha,basis:targetCalibration.basis,mapping:targetCalibration.mapping});
    targetConstraints=createHumanoidPreviewConstraints({root:gltf.scene,bones:targetAdapter.bones,profile:targetAdapter.profile,groundY:0});
    targetDccRoute=createRigRequiredDccRoute(model,targetAdapter.descriptor);
    void syncWeapon();
    targetClips=gltf.animations||[];mixer=new THREE.AnimationMixer(gltf.scene);mixer.addEventListener('finished',()=>{playing=false;syncPlaybackUI();});
    const legacy=el('motion-legacy');legacy.replaceChildren(new Option('原版クリップを選択',''));targetClips.forEach((c,i)=>legacy.add(new Option(reviewMotionDisplayName(c.name,i),String(i))));legacy.disabled=!targetClips.length;
    rebuildCatalog();canvas.dataset.motionSource='source-registry';canvas.dataset.motionModel=model.id;el('motion-load').value=1;el('motion-load').hidden=true;setCameraPreset('three-quarter');showCompatibility({status:targetAdapter.descriptor.status});
    const first=catalog.find(r=>r.sourceIdentity===previousIdentity)||catalog.find(r=>r.runtime.kind==='kaykit-embedded'&&/idle/i.test(r.name))||catalog[0];
    if(['PLAYABLE','DEGRADED'].includes(targetAdapter.descriptor.status))await selectMotion(first);
    else status('モデルは表示できますが、骨・ウェイトの準備が必要です。');
    const discovered=await discoverPinnedMotionLibraryClips({preview:true,onFailure:(id,message)=>{if(serial===loadSerial)motionFailures.set(id,message);}});
    if(serial!==loadSerial||stopped)return;rebuildCatalog(discovered);
  }catch(error){
    if(serial!==loadSerial||stopped)return;playing=false;ready=false;el('motion-load').value=0;status('読込失敗: '+String(error?.message||error));canvas.dataset.motionSource='error';showCompatibility({status:'UNSUPPORTED',reasons:[String(error?.message||error)]});syncPlaybackUI();
  }
}
el('motion-play').addEventListener('click',()=>{if(ready){playing=!playing;syncPlaybackUI();}});
el('motion-restart').addEventListener('click',()=>{if(ready){seek(0);playing=ready;syncPlaybackUI();}});
el('motion-speed').addEventListener('change',e=>{speed=Number(e.target.value)||1;});
el('motion-loop').addEventListener('change',e=>{loop=e.target.checked;if(action){action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;}syncPlaybackUI();});
el('motion-time').addEventListener('input',e=>{playing=false;seek(Number(e.target.value));});
el('motion-prev-frame').addEventListener('click',()=>{playing=false;seek(playbackTime()-1/60);});
el('motion-next-frame').addEventListener('click',()=>{playing=false;seek(playbackTime()+1/60);});
el('motion-root-policy').addEventListener('change',e=>{rootMotion=e.target.value;if(ready&&isExternal())seek(playbackTime());});
el('motion-constraint-policy').addEventListener('change',e=>{constraintMode=e.target.value;if(ready&&isExternal())seek(playbackTime());});
el('motion-model').addEventListener('change',e=>{const model=REVIEW_MODELS.find(item=>item.id===e.target.value);if(model&&model.id!==selectedModel.id)void loadModel(model);});
el('motion-weapon').addEventListener('change',e=>{selectedWeapon=e.target.value;void syncWeapon();});
el('motion-legacy').addEventListener('change',e=>{
  const index=Number(e.target.value);if(e.target.value===''||!targetClips[index]||!mixer)return;
  ++selectSerial;selected=null;externalSource=null;mixer.stopAllAction();targetAdapter.reset();externalTime=0;const clip=targetClips[index];selectedDuration=clip.duration;
  action=mixer.clipAction(clip);action.reset().setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=!loop;action.play();ready=true;playing=true;
  el('motion-selected').textContent=reviewMotionDisplayName(clip.name,index);const source=selectedModel.source;
  el('motion-meta').textContent=`source ${source.repository} @ ${source.revision} / ${source.path} / clip ${index}「${reviewMotionDisplayName(clip.name,index)}」 / git-sha1:${source.gitBlobSha} / ${selectedModel.license}`;
  el('motion-license').href='https://creativecommons.org/publicdomain/zero/1.0/';el('motion-origin').href='https://kaylousberg.com/game-assets/characters-adventurers';
  canvas.dataset.motionName=reviewMotionDisplayName(clip.name,index);canvas.dataset.motionUpstreamName=clip.name;canvas.dataset.motionIdentity='legacy:'+index+':'+clip.name;status('');showCompatibility({status:'NATIVE',applied:true});syncMotionCards();syncPlaybackUI();
});
const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();motionCameraPresets.apply();},render:()=>renderer.render(scene,camera)});
let frameId=0;
function frame(now){
  if(stopped)return;frameId=requestAnimationFrame(frame);
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(document.hidden)return;
  try{
    if(ready&&playing){
      if(isExternal()&&externalSource){externalTime+=dt*speed;if(externalTime>=selectedDuration){if(loop)externalTime%=selectedDuration;else{externalTime=selectedDuration;playing=false;}}applyExternal(externalTime);}
      else if(mixer&&action)mixer.update(dt*speed);
    }
    if(equippedWeapon)keepMotionReviewWeaponAboveFloor(equippedWeapon);
    controls.update();renderer.render(scene,camera);syncPlaybackUI();
  }catch(error){playing=false;ready=false;status('再生を停止しました: '+String(error?.message||error));syncPlaybackUI();}
}
renderFilters();renderModelGrid();setCameraPreset('three-quarter');frameId=requestAnimationFrame(frame);void loadModel(selectedModel);
window.addEventListener('pagehide',event=>{if(event.persisted)return;stopped=true;++loadSerial;++selectSerial;cancelAnimationFrame(frameId);clearRuntimeThumbnailQueue();stageLifecycle.destroy();motionCameraPresets.destroy();disposeSubject();disposePinnedMotionSources();for(const promise of thumbnailModelPromises.values())void promise.then(g=>disposeReviewObject(g.scene)).catch(()=>{});thumbnailModelPromises.clear();ground.geometry.dispose();ground.material.dispose();controls.dispose();renderer.dispose();},{once:true});
