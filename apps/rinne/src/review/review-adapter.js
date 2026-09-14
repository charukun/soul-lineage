import { GLTFLoader } from '@soul/rendering';
import { installPostureWeaponPreview } from './posture-preview.js';
import { installWeaponReviewPolish } from './weapon-review-polish.js';
import { reviewPresets as baseReviewPresets, reviewWeapons, disposeLoaded, installReviewExtensions as installBase } from './review-adapter-base.js';
import { REVIEW_REFERENCE_MODELS, reviewReferenceModel } from './reference-character-models.js';
import { attachReferenceCharacterController } from '@soul/rendering/master-character-reference';

const DCC_BRANCH='feat/shino-reference-v2-dcc';
const DCC_RAW_ROOT=`https://raw.githubusercontent.com/charukun/soul-lineage/${DCC_BRANCH}/apps/rinne/public/simulator/assets/`;
const DCC_REVIEW_ROOT=`https://raw.githubusercontent.com/charukun/soul-lineage/${DCC_BRANCH}/docs/characters/qa/shino-reference-v2/`;
const DCC_SHINO=Object.freeze({
  id:'shino.reference.v2',
  label:'SHINO_REF_V2_DCC',
  name:'Shino Reference v2 / DCC PRIMARY',
  portrait:'SHINO',
  portraitPath:`${DCC_REVIEW_ROOT}front.png`,
  kind:'character',
  productionStage:'PRIMARY',
  modelingMode:'dcc-blender'
});
const runtimeReferences=REVIEW_REFERENCE_MODELS.filter(row=>row.id!==DCC_SHINO.id);

export const reviewPresets=Object.freeze([
  baseReviewPresets[0],
  DCC_SHINO,
  ...runtimeReferences,
  ...baseReviewPresets.slice(1)
]);
export { reviewWeapons, disposeLoaded };

function sourcePresetId(presetId){
  return reviewReferenceModel(presetId)?.sourcePresetId||presetId;
}

function hex(bytes){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}

async function loadDccShino({signal,onProgress}){
  onProgress?.('Shino Reference v2 DCCのintegrityを確認中');
  const integrityResponse=await fetch(`${DCC_RAW_ROOT}SHINO_REFERENCE_V2.asset.json`,{cache:'no-store',signal});
  if(!integrityResponse.ok)throw new Error(`DCC integrity HTTP ${integrityResponse.status}`);
  const integrity=await integrityResponse.json();
  if(integrity?.schema!=='character-asset-integrity'||integrity?.id!=='shino.reference.v2'||integrity?.productionStage!=='PRIMARY')throw new Error('Shino DCC integrity record is invalid');
  onProgress?.('Shino Reference v2 DCCモデルを読み込み中');
  const response=await fetch(`${DCC_RAW_ROOT}SHINO_REFERENCE_V2.vrm`,{cache:'no-store',signal});
  if(!response.ok)throw new Error(`Shino DCC HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==integrity.bytes)throw new Error(`Shino DCC size mismatch ${bytes.byteLength}/${integrity.bytes}`);
  const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
  if(digest!==integrity.sha256)throw new Error('Shino DCC SHA-256 mismatch');
  signal?.throwIfAborted?.();
  const loader=new GLTFLoader(),gltf=await loader.parseAsync(bytes,DCC_RAW_ROOT);
  signal?.throwIfAborted?.();
  gltf.scene.name='ShinoReferenceV2DCCReview';
  gltf.scene.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});
  return {
    root:gltf.scene,
    clipNames:[],
    clipGroups:[],
    label:'Shino Reference v2 / DCC PRIMARY / Blender実メッシュ',
    summary:'キャラクターリファレンスを正本にしたBlender DCC PRIMARYモデル。まず全周・シルエット・衣装形状を確認します。Motion/Deformation/Polish/Runtime Readyは未承認です。',
    weaponReview:false,
    assetProblems:[],
    motionMeta:new Map(),
    referenceModel:DCC_SHINO,
    productionStage:'PRIMARY',
    modelingMode:'dcc-blender',
    integrity,
    getClip(){return null;},
    dispose(){disposeLoaded(gltf.scene);}
  };
}

function installRuntimeReference(loaded,reference){
  const actor={root:loaded.root,visual:loaded.root,bones:loaded.bones,sample(){},destroy(){}};
  const controller=attachReferenceCharacterController(actor);
  controller.setIdentity(reference);
  const dispose=loaded.dispose.bind(loaded);let disposed=false;
  loaded.dispose=()=>{if(disposed)return;disposed=true;controller.destroy();dispose();};
  loaded.label=`${reference.name} / Runtime BLOCKOUT / 全モーションソース`;
  loaded.referenceModel=reference;
  loaded.productionStage='BLOCKOUT';
  loaded.referenceDiagnostics=()=>controller.diagnostics();
  return loaded;
}

export async function installReviewExtensions(options){
  const base=await installBase(options);
  return {...base,async loadPreset(args){
    if(args?.presetId===DCC_SHINO.id)return loadDccShino(args);
    const reference=reviewReferenceModel(args?.presetId);
    let loaded=await base.loadPreset({...args,presetId:sourcePresetId(args?.presetId)});
    if(reference)loaded=installRuntimeReference(loaded,reference);
    return installPostureWeaponPreview(installWeaponReviewPolish(loaded));
  }};
}
