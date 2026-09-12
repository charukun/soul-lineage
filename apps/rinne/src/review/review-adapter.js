import { THREE, GLTFLoader } from '@soul/rendering';
import { createQuaterniusRetargeter } from '@soul/rendering/quaternius-retarget';
import { createReviewEffects } from '@soul/rendering/review-effects';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';
import { installReviewUX } from './review-ux.js';

const MODELS=Object.freeze({
  SHINO:{id:'model.SHINO',label:'SHINO',name:'Sendagaya Shino',path:SHINO_REVIEW.publicPath,size:SHINO_REVIEW.size,sha256:SHINO_REVIEW.sha256},
  A:{id:'model.A',label:'A',name:'AvatarSample A',path:'./simulator/assets/A_review.vrm',size:14268444},
  B:{id:'model.B',label:'B',name:'AvatarSample B',path:'./simulator/assets/B_review.vrm',size:15354384},
  C:{id:'model.C',label:'C',name:'AvatarSample C',path:'./simulator/assets/C_review.vrm',size:12104076},
  TSUKU:{id:'model.TSUKU',label:'TSUKU',name:'Tsuku',path:'./simulator/assets/TSUKU_review.vrm',size:12688044},
});
export const reviewPresets=Object.freeze(Object.values(MODELS).map(row=>({id:row.id,label:row.label,name:row.name,kind:'character'})));
const KAYKIT_COMMIT='672074b73ba276876a19e8816ecdc5241817ab47';
const KAYKIT_ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${KAYKIT_COMMIT}/addons/kaykit_character_pack_adventures/Assets/gltf/`;
export const reviewWeapons=Object.freeze([
  {id:'greatsword',label:'大剣',file:'sword_2handed.gltf'},{id:'sword',label:'片手剣',file:'sword_1handed.gltf'},
  {id:'axe',label:'片手斧',file:'axe_1handed.gltf'},{id:'greataxe',label:'両手斧',file:'axe_2handed.gltf'},
  {id:'dagger',label:'短剣',file:'dagger.gltf'},{id:'crossbow',label:'クロスボウ',file:'crossbow_2handed.gltf'},
  {id:'staff',label:'杖',file:'staff.gltf'},{id:'wand',label:'ワンド',file:'wand.gltf'}
]);
const TIDEBREAK_TECHNIQUES=Object.freeze([
  ['thrust','突き'],['straight','直突き'],['heavy','強撃'],['sweep','薙ぎ'],['spin','回転斬り'],['round','横薙ぎ'],['wheel','車輪斬り'],['pommel','柄打ち'],['uppercut','斬り上げ'],['back','返し'],['leap','跳躍斬り'],['meteor','隕石斬り'],['spearwheel','槍車輪']
]);
const bytesCache=new Map(),inflight=new Map();
let preloadStarted=false,preloadPromise=null,externalManifest=null;

export function disposeLoaded(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());root?.removeFromParent();
}
async function rawBytes(url,{onProgress,expectedSize,sha256,maxBytes=25*1024*1024}={}){
  const response=await fetch(url,{cache:'force-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
  const total=expectedSize||Number(response.headers.get('content-length'))||0,reader=response.body.getReader(),parts=[];let length=0;
  for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>(expectedSize||maxBytes)){await reader.cancel();throw new Error('Asset exceeds its allowed byte count');}parts.push(value);onProgress?.(length,total);}
  if(expectedSize&&length!==expectedSize)throw new Error(`Truncated asset: ${length}/${expectedSize}`);
  const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}
  if(sha256){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',result)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==sha256)throw new Error('Asset SHA-256 mismatch');}
  return result.buffer;
}
async function cachedBytes(key,url,options={}){
  if(bytesCache.has(key)){options.onProgress?.(options.expectedSize||bytesCache.get(key).byteLength,options.expectedSize||bytesCache.get(key).byteLength);return bytesCache.get(key);}
  if(!inflight.has(key))inflight.set(key,rawBytes(url,options).then(bytes=>{bytesCache.set(key,bytes);inflight.delete(key);return bytes;}).catch(error=>{inflight.delete(key);throw error;}));
  const bytes=await inflight.get(key);options.onProgress?.(options.expectedSize||bytes.byteLength,options.expectedSize||bytes.byteLength);return bytes;
}
function progressUI(label,done,total,detail=''){
  const wrap=document.querySelector('#load-progress-wrap'),bar=document.querySelector('#load-progress'),name=document.querySelector('#load-progress-label'),info=document.querySelector('#load-progress-detail');
  if(!wrap||!bar||!name||!info)return;const pct=total?Math.max(0,Math.min(100,Math.round(done/total*100))):0;wrap.hidden=false;bar.value=pct;name.textContent=label;info.textContent=detail||`${pct}%`;
}
function finishProgress(detail){const wrap=document.querySelector('#load-progress-wrap'),bar=document.querySelector('#load-progress'),name=document.querySelector('#load-progress-label'),info=document.querySelector('#load-progress-detail');if(!wrap||!bar)return;bar.value=100;name.textContent='全素材先読み完了';info.textContent=detail;setTimeout(()=>{wrap.hidden=true;},1800);}
function appendClip(groupLabel,value,label=value){const select=document.querySelector('#clip');if(!select||[...select.options].some(o=>o.value===value))return;let group=[...select.querySelectorAll('optgroup')].find(g=>g.label===groupLabel);if(!group){group=document.createElement('optgroup');group.label=groupLabel;select.append(group);}group.append(new Option(label,value));}
function updateSummary(loaded,total=null,failed=0){const node=document.querySelector('#family-summary');if(node)node.textContent=total?`${loaded}/${total} モーション読込済み${failed?`（${failed}件スキップ）`:''}`:`${loaded} モーション使用可能${failed?`（${failed}件スキップ）`:''}。残りを先読み中`;}
function inPlaceClip(clip){if(!clip)return clip;for(const track of clip.tracks||[])if(track.name.endsWith('.position'))for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}return clip;}
function remapClip(sourceClip,sourceBones,targetBones,name=sourceClip.name){
  const sourceByUuid=new Map(Object.entries(sourceBones).map(([human,bone])=>[bone.uuid,human])),tracks=[];
  for(const track of sourceClip.tracks||[]){const dot=track.name.lastIndexOf('.'),uuid=track.name.slice(0,dot),prop=track.name.slice(dot+1),human=sourceByUuid.get(uuid),target=human&&targetBones[human];if(!target)continue;const times=Array.from(track.times),values=Array.from(track.values),targetName=`${target.uuid}.${prop}`;if(prop==='quaternion')tracks.push(new THREE.QuaternionKeyframeTrack(targetName,times,values));else if(prop==='position')tracks.push(new THREE.VectorKeyframeTrack(targetName,times,values));}
  return new THREE.AnimationClip(name,sourceClip.duration,tracks);
}
async function visibleHumanoidBones(gltf){
  const json=gltf.parser?.json,vrm1=json?.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if(vrm1)return Object.fromEntries(await Promise.all(Object.entries(vrm1).map(async([name,row])=>[name,await gltf.parser.getDependency('node',row.node)])));
  const vrm0=json?.extensions?.VRM?.humanoid?.humanBones;
  if(Array.isArray(vrm0))return Object.fromEntries(await Promise.all(vrm0.filter(row=>row?.bone&&Number.isInteger(row.node)).map(async row=>[row.bone,await gltf.parser.getDependency('node',row.node)])));
  throw new Error('VRM humanoid metadata missing');
}
function modelForPreset(presetId){return Object.values(MODELS).find(row=>row.id===presetId)||MODELS.SHINO;}

async function startGlobalPreload({rootUrl,assetUrl,motionCatalog}){
  if(preloadStarted)return preloadPromise;preloadStarted=true;
  preloadPromise=(async()=>{
    let done=0,failed=0;
    const models=Object.values(MODELS),motions=[...motionCatalog].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity));
    const total=motions.length+models.length+reviewWeapons.length+1;
    const mark=(label)=>progressUI(`先読み: ${label}`,done,total,`${done}/${total} 完了${failed?` / ${failed}件失敗`:''}`);
    for(const item of motions){try{mark(item.label);await cachedBytes('motion:'+item.id,new URL(item.file,new URL('./simulator/',rootUrl)),{expectedSize:item.bytes});}catch(error){failed++;console.warn('preload motion failed',item.id,error);}done++;}
    for(const model of models){try{mark(model.name);await cachedBytes('model:'+model.label,new URL(model.path,rootUrl),{expectedSize:model.size,sha256:model.sha256});}catch(error){failed++;console.warn('preload model failed',model.label,error);}done++;}
    for(const weapon of reviewWeapons){try{mark(weapon.label);await cachedBytes('weapon:'+weapon.id,new URL(KAYKIT_ROOT+weapon.file),{});}catch(error){failed++;console.warn('preload weapon failed',weapon.id,error);}done++;}
    try{
      mark('外部比較モーション');
      const response=await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{cache:'force-cache'});if(!response.ok)throw new Error(`Asset manifest HTTP ${response.status}`);externalManifest=await response.json();const row=externalManifest.files.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');await cachedBytes('external:quaternius',new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{expectedSize:row.size,sha256:row.sha256});
    }catch(error){failed++;console.warn('preload external failed',error);}done++;
    finishProgress(`${done-failed}/${total} 成功${failed?` / ${failed}件失敗`:''}`);
    return{done,failed,total};
  })();
  return preloadPromise;
}

async function loadAllSources({scene,rootUrl,assetUrl,signal,onProgress,presetId,motionCatalogModule,loaderModule,vrmModule,motionsModule,vrmaModule,humanoidModule}){
  const model=modelForPreset(presetId),simBase=new URL('./simulator/',rootUrl),motionCatalog=[...motionCatalogModule.default].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity));
  progressUI(`${model.name}`,0,100,'表示モデルを読み込み中');onProgress?.(`${model.name}を読み込み中`);
  const modelBytes=await cachedBytes('model:'+model.label,new URL(model.path,rootUrl),{expectedSize:model.size,sha256:model.sha256,onProgress:(n,total)=>progressUI(`${model.name}`,n,total,'表示モデルを読み込み中')});signal.throwIfAborted();
  const visibleLoader=new GLTFLoader(),visible=await visibleLoader.parseAsync(modelBytes,rootUrl.href),targetBones=await visibleHumanoidBones(visible);visible.scene.name=`${model.label}ReviewVisible`;visible.scene.updateMatrixWorld(true);
  const vendorLoader=new loaderModule.GLTFLoader();vendorLoader.register(p=>new vrmModule.VRMLoaderPlugin(p));const vendorGltf=await vendorLoader.parseAsync(modelBytes,rootUrl.href),vrm=vendorGltf.userData.vrm;if(!vrm)throw new Error('VRM Humanoid情報がありません');vrmModule.VRMUtils.rotateVRM0(vrm);if(vrm.lookAt){vrm.lookAt.autoUpdate=false;const proxy=new vrmaModule.VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='ReviewLookAtProxy';vrm.scene.add(proxy);}vrm.update(0);vrm.scene.updateMatrixWorld(true);
  const authored=motionsModule.createRetargetedClips(vrm),clips=new Map(),authoredNames=['Idle','Walk','Run','Attack','Hit Reaction','T-Pose'];
  for(const name of authoredNames){const value=`Tidebreak / ${name}`;clips.set(value,remapClip(authored.clips[name],authored.bones,targetBones,value));}
  let disposed=false,effects=null,externalRetarget=null,library=null,failed=0;const weapons=new Map(),pendingWeapons=new Map();
  const body={root:visible.scene,bones:targetBones,clipNames:[...clips.keys()],label:`${model.name} / 全モーションソース`,weaponReview:true,clipGroups:[{label:'ゲーム実装 / Tidebreak自作',names:[...clips.keys()]}],summary:'Tidebreak自作モーションを使用可能。残りを優先順に読み込み中。',getClip:name=>clips.get(name)||null,afterSample(){visible.scene.updateMatrixWorld(true);},setWeapon(){},sampleEffects(){},dispose(){disposed=true;effects?.dispose();externalRetarget?.dispose();for(const root of weapons.values())disposeLoaded(root);disposeLoaded(library?.scene);disposeLoaded(visible.scene);vrmModule.VRMUtils.deepDispose(vrm.scene);}};
  let loaded=authoredNames.length;updateSummary(loaded);startGlobalPreload({rootUrl,assetUrl,motionCatalog:motionCatalogModule.default});
  setTimeout(async()=>{
    for(const item of motionCatalog){if(disposed||signal.aborted)return;try{const bytes=await cachedBytes('motion:'+item.id,new URL(item.file,simBase),{expectedSize:item.bytes,onProgress:(n,total)=>progressUI(`共有: ${item.label}`,n,total,`${loaded} 使用可能`)});const l=new loaderModule.GLTFLoader();l.register(p=>new vrmaModule.VRMAnimationLoaderPlugin(p));const parsed=await l.parseAsync(bytes,simBase.href),anim=parsed.userData.vrmAnimations?.[0];if(!anim)throw new Error(`VRMAを解析できません: ${item.id}`);const vendorClip=vrmaModule.createVRMAnimationClip(anim,vrm);vendorClip.name=item.id;if(['walk','run-slow'].includes(item.id))inPlaceClip(vendorClip);const value=`共有VRMA / ${item.label}`,clip=remapClip(vendorClip,authored.bones,targetBones,value);clips.set(value,clip);body.clipNames.push(value);appendClip('ゲーム共通 / VRMA',value,item.label);loaded++;}catch(error){failed++;console.warn(`Shared VRMA skipped: ${item.id}`,error);}updateSummary(loaded,null,failed);}
    if(disposed||signal.aborted)return;
    const previousAssetBuffer=window.assetBuffer;
    try{
      progressUI('Tidebreak実戦技',0,1,'既存戦闘ロジックから生成中');
      window.assetBuffer=async id=>{if(bytesCache.has('model:'+id))return bytesCache.get('model:'+id);const motionId=String(id).replace(/^motion:/,'');if(bytesCache.has('motion:'+motionId))return bytesCache.get('motion:'+motionId);const row=motionCatalog.find(x=>x.id===motionId);if(row)return cachedBytes('motion:'+motionId,new URL(row.file,simBase),{expectedSize:row.bytes});throw new Error(`Review asset not found: ${id}`);};
      const runtime=new humanoidModule.HumanoidRuntime({weapons:{},strikes:{},clips:{},windows:{},progress:()=>0,window:()=>null,hand:()=> 'right',echo:()=>{},status:()=>{},attach:()=>{}});await runtime.load(model.label);
      const generated=[...TIDEBREAK_TECHNIQUES.map(([kind,label])=>({kind,label,weapon:'sword'})),{kind:'parry',label:'パリィ',weapon:'sword'},{kind:'ready',label:'戦闘構え',weapon:'sword'}];
      for(const row of generated){const source=runtime.bakeArmed(runtime.current,row.weapon,row.kind),value=`Tidebreak技 / ${row.label}`;clips.set(value,remapClip(source,runtime.current.bones,targetBones,value));body.clipNames.push(value);appendClip('Tidebreak実戦技',value,row.label);loaded++;}
      runtime.dispose(runtime.current);progressUI('Tidebreak実戦技',1,1,`${generated.length} 技追加済み`);
    }catch(error){failed++;console.error('Tidebreak technique generation failed',error);progressUI('Tidebreak実戦技の生成に失敗',0,1,error.message);}finally{window.assetBuffer=previousAssetBuffer;updateSummary(loaded,null,failed);}
    if(disposed||signal.aborted)return;
    try{
      const response=externalManifest?null:await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{cache:'force-cache'});const manifest=externalManifest||(response?.ok?await response.json():null);const row=manifest?.files?.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');
      const motionBytes=await cachedBytes('external:quaternius',new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{expectedSize:row.size,sha256:row.sha256,onProgress:(n,total)=>progressUI('外部比較 / Quaternius',n,total,`${loaded} 使用可能`)});library=await visibleLoader.parseAsync(motionBytes,assetUrl.href);externalRetarget=await createQuaterniusRetargeter(library,visible);effects=await createReviewEffects(scene,assetUrl);
      for(const name of externalRetarget.clipNames){const value=`外部 / ${name}`;clips.set(value,externalRetarget.getClip(name,{inPlace:true}));body.clipNames.push(value);appendClip('外部Asset比較 / Quaternius',value,name);loaded++;}
      const socket=new THREE.Group();socket.name='KayKitWeaponReviewSocket';(externalRetarget.bones.rightHand||targetBones.rightHand).add(socket);let activeWeapon=null;
      async function selectWeapon(id='greatsword'){
        if(!reviewWeapons.some(row=>row.id===id))id='greatsword';for(const root of weapons.values())root.visible=false;
        if(!weapons.has(id)){if(!pendingWeapons.has(id)){const spec=reviewWeapons.find(row=>row.id===id);pendingWeapons.set(id,cachedBytes('weapon:'+id,new URL(KAYKIT_ROOT+spec.file),{}).then(bytes=>visibleLoader.parseAsync(bytes,KAYKIT_ROOT)).then(g=>{g.scene.name=`KayKit:${id}`;g.scene.scale.setScalar(.5);socket.add(g.scene);weapons.set(id,g.scene);pendingWeapons.delete(id);return g.scene;}));}await pendingWeapons.get(id);}
        for(const [key,root]of weapons)root.visible=key===id;return id;
      }
      body.setWeapon=async({enabled=false,id=null,scale=.5,x=0,y=0,z=0})=>{if(!enabled){socket.visible=false;return;}const requested=id||document.querySelector('#weapon-select')?.value||'greatsword';if(requested!==activeWeapon||!weapons.has(requested))activeWeapon=await selectWeapon(requested);socket.visible=true;const selected=weapons.get(activeWeapon);if(selected)selected.scale.setScalar(Math.max(.1,Math.min(1,scale)));socket.rotation.set(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180);};
      body.sampleEffects=age=>{const hand=externalRetarget.bones.rightHand||targetBones.rightHand,lf=externalRetarget.bones.leftFoot||targetBones.leftFoot,rf=externalRetarget.bones.rightFoot||targetBones.rightFoot,impact=hand.getWorldPosition(new THREE.Vector3()),left=lf.getWorldPosition(new THREE.Vector3()),right=rf.getWorldPosition(new THREE.Vector3()),ground=left.add(right).multiplyScalar(.5);impact.z+=.25;effects.sample(age,impact,ground);};
      updateSummary(loaded,loaded+failed,failed);
    }catch(error){failed++;console.error(error);progressUI('外部比較モーション読込失敗',0,1,error.message);updateSummary(loaded,null,failed);}
  },0);
  return body;
}

export async function installReviewExtensions({scene}){
  const rootUrl=new URL('./',location.href),assetUrl=new URL('./asset-review/',rootUrl),vendorBase=new URL('./simulator/vendor/',rootUrl),simBase=new URL('./simulator/',rootUrl),js='.js';
  const [loaderModule,vrmModule,motionsModule,vrmaModule,motionCatalogModule,humanoidModule]=await Promise.all([
    import(/* @vite-ignore */ new URL('GLTFLoader'+js,vendorBase).href),import(/* @vite-ignore */ new URL('three-vrm.module'+js,vendorBase).href),import(/* @vite-ignore */ new URL('./src/motions'+js,simBase).href),import(/* @vite-ignore */ new URL('three-vrm-animation.module'+js,vendorBase).href),import(/* @vite-ignore */ new URL('./src/motion-catalog'+js,simBase).href),import(/* @vite-ignore */ new URL('./src/humanoid'+js,simBase).href)
  ]);
  installReviewUX({reviewPresets,reviewWeapons});startGlobalPreload({rootUrl,assetUrl,motionCatalog:motionCatalogModule.default});
  return{async loadPreset({presetId,signal,onProgress}){return loadAllSources({scene,rootUrl,assetUrl,signal,onProgress,presetId,loaderModule,vrmModule,motionsModule,vrmaModule,motionCatalogModule,humanoidModule});}};
}
