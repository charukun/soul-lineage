import './machine-review.js';
import { GLTFLoader } from '@soul/rendering';
import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets as baseReviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from './reference-character-models.js';
import { MOTION_LIBRARY_MODELS, MOTION_LIBRARY_RAW_BASE, motionLibraryModel, motionLibraryModelURL } from './motion-library-models.js';
import { attachReferenceCharacterController } from '@soul/rendering/master-character-reference';
import { ARCANIST_ATLAS_STUDY_ID, attachArcanistAtlasStudy } from '@soul/rendering/arcanist-atlas-study';

const MOTION_LIBRARY_PRESETS=Object.freeze(MOTION_LIBRARY_MODELS.map(row=>Object.freeze({
  id:row.presetId,label:`Motion Library / ${row.label}`,name:`Motion Library / ${row.label}`,kind:'character',source:'motion-library'
})));

export const reviewPresets=Object.freeze([
  baseReviewPresets[0],
  ...REVIEW_REFERENCE_MODELS,
  ...baseReviewPresets.slice(1),
  ...MOTION_LIBRARY_PRESETS
]);
export { reviewWeapons, disposeLoaded };

function sourcePresetId(presetId){
  return reviewReferenceModel(presetId)?.sourcePresetId||presetId;
}

function installRuntimeReference(loaded,reference){
  const actor={root:loaded.root,visual:loaded.root,bones:loaded.bones,sample(){},destroy(){}};
  const controller=attachReferenceCharacterController(actor);
  controller.setIdentity(reference);
  const study=reference.id===ARCANIST_ATLAS_STUDY_ID?attachArcanistAtlasStudy(actor,reference):null;
  const dispose=loaded.dispose.bind(loaded);let disposed=false;
  loaded.dispose=()=>{if(disposed)return;disposed=true;study?.destroy();controller.destroy();dispose();};
  loaded.label=study?`${reference.name} / BLOCKOUT Study / 全モーションソース`:`${reference.name} / Runtime Reference / 全モーションソース`;
  loaded.referenceModel=reference;
  loaded.referenceDiagnostics=()=>({
    ...controller.diagnostics(),
    ...(study?{study:{id:study.id,stage:study.stage,modelingMode:study.modelingMode,productionReady:study.productionReady,meshCount:study.meshCount}}:{})
  });
  return loaded;
}

function installMotionLibraryPickerPolish(){
  const list=document.querySelector('.model-picker-list');
  if(!list||list.dataset.motionLibraryPolish)return;
  list.dataset.motionLibraryPolish='true';
  if(!document.querySelector('#motion-library-picker-style')){
    const style=document.createElement('style');
    style.id='motion-library-picker-style';
    style.textContent='.motion-library-model-badge{width:38px;height:38px;justify-self:center;display:grid!important;place-items:center;border:1px solid #d6bd8442;border-radius:9px;background:linear-gradient(145deg,#24272b,#111419);color:#d7c58f!important;font:800 8px/1 ui-sans-serif,system-ui;letter-spacing:.08em;box-shadow:0 5px 14px #0008}.model-picker-item[data-motion-library="true"] small{color:#b7a979}@media(max-width:430px){.motion-library-model-badge{width:32px;height:32px}}';
    document.head.append(style);
  }
  const mark=()=>{for(const button of list.querySelectorAll('.model-picker-item')){const label=button.querySelector('small')?.textContent||'';if(!label.startsWith('Motion Library /'))continue;button.dataset.motionLibrary='true';const image=button.querySelector('img');if(image){const badge=document.createElement('span');badge.className='motion-library-model-badge';badge.textContent='3D';badge.setAttribute('aria-hidden','true');image.replaceWith(badge);}}};
  new MutationObserver(mark).observe(list,{childList:true});mark();
}

async function loadMotionLibraryPreset({presetId,signal,onProgress}){
  const model=motionLibraryModel(presetId);
  if(!model)throw new Error(`Motion Library model not found: ${presetId}`);
  onProgress?.(`Motion Library / ${model.label} を読み込み中`);
  const response=await fetch(motionLibraryModelURL(model),{cache:'force-cache',signal});
  if(!response.ok)throw new Error(`Motion Library HTTP ${response.status}: ${model.label}`);
  const bytes=await response.arrayBuffer();
  if(signal?.aborted)throw new DOMException('Model load aborted','AbortError');
  const gltf=await new GLTFLoader().parseAsync(bytes,`${MOTION_LIBRARY_RAW_BASE}/`);
  const clips=[...gltf.animations].filter(clip=>clip?.name&&Number.isFinite(clip.duration)&&clip.duration>0);
  if(!clips.length){disposeLoaded(gltf.scene);throw new Error(`${model.label} に収録モーションがありません`);}
  const clipMap=new Map(clips.map(clip=>[clip.name,clip]));
  const rest=[];
  gltf.scene.traverse(node=>{rest.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()});if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
  const label=`${model.label} / Motion Library / KayKit CC0`;
  const names=clips.map(clip=>clip.name);
  const motionMeta=new Map(names.map(name=>[name,{id:name,source:label,category:'external',loop:true}]));
  onProgress?.(`${model.label}: ${clips.length}モーション`);
  return {
    root:gltf.scene,
    clipNames:names,
    clipGroups:[{label:'Motion Library / 埋め込みモーション',names}],
    label,
    summary:`Motion Library由来の${clips.length}モーションを使用できます。`,
    motionMeta,
    weaponReview:false,
    getClip:name=>clipMap.get(name)||null,
    resetPose(){for(const row of rest){row.node.position.copy(row.p);row.node.quaternion.copy(row.q);row.node.scale.copy(row.s);}},
    afterSample(){gltf.scene.updateMatrixWorld(true);},
    dispose(){disposeLoaded(gltf.scene);}
  };
}

export async function installReviewExtensions(options){
  const base=await installBase(options);
  installMotionLibraryPickerPolish();
  return {...base,async loadPreset(args){
    if(motionLibraryModel(args?.presetId))return loadMotionLibraryPreset(args);
    const reference=reviewReferenceModel(args?.presetId);
    let loaded=await base.loadPreset({...args,presetId:sourcePresetId(args?.presetId)});
    if(reference)loaded=installRuntimeReference(loaded,reference);
    return installPostureWeaponPreview(installWeaponReviewPolish(loaded));
  }};
}
