import { THREE, GLTFLoader } from '@soul/rendering';
import { createQuaterniusRetargeter } from '@soul/rendering/quaternius-retarget';
import { createReviewEffects } from '@soul/rendering/review-effects';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';

export const reviewPresets = Object.freeze([{id:'all.review.motion.sources',label:'全モーションソース',kind:'all'}]);
const KAYKIT_COMMIT='672074b73ba276876a19e8816ecdc5241817ab47';
const KAYKIT_ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${KAYKIT_COMMIT}/addons/kaykit_character_pack_adventures/Assets/gltf/`;
export const reviewWeapons=Object.freeze([
  {id:'greatsword',label:'大剣',file:'sword_2handed.gltf'},{id:'sword',label:'片手剣',file:'sword_1handed.gltf'},
  {id:'axe',label:'片手斧',file:'axe_1handed.gltf'},{id:'greataxe',label:'両手斧',file:'axe_2handed.gltf'},
  {id:'dagger',label:'短剣',file:'dagger.gltf'},{id:'crossbow',label:'クロスボウ',file:'crossbow_2handed.gltf'},
  {id:'staff',label:'杖',file:'staff.gltf'},{id:'wand',label:'ワンド',file:'wand.gltf'},
]);
export function disposeLoaded(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());root?.removeFromParent();
}
async function loadBytes(url,{signal,onProgress,expectedSize,sha256,maxBytes=25*1024*1024}={}){
  const response=await fetch(url,{signal,cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
  const total=expectedSize||Number(response.headers.get('content-length'))||0,reader=response.body.getReader(),parts=[];let length=0;
  for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>(expectedSize||maxBytes)){await reader.cancel();throw new Error('Asset exceeds its allowed byte count');}parts.push(value);onProgress?.(length,total);}
  if(expectedSize&&length!==expectedSize)throw new Error(`Truncated asset: ${length}/${expectedSize}`);const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}
  if(sha256){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',result)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==sha256)throw new Error('Asset SHA-256 mismatch');}signal?.throwIfAborted();return result.buffer;
}
function progressUI(label,done,total,detail=''){
  const wrap=document.querySelector('#load-progress-wrap'),bar=document.querySelector('#load-progress'),name=document.querySelector('#load-progress-label'),info=document.querySelector('#load-progress-detail');
  if(!wrap||!bar||!name||!info)return;const pct=total?Math.max(0,Math.min(100,Math.round(done/total*100))):0;wrap.hidden=false;bar.value=pct;name.textContent=label;info.textContent=detail||`${pct}%`;
}
function finishProgress(detail){const wrap=document.querySelector('#load-progress-wrap'),bar=document.querySelector('#load-progress'),name=document.querySelector('#load-progress-label'),info=document.querySelector('#load-progress-detail');if(!wrap||!bar)return;bar.value=100;name.textContent='全モーション読込完了';info.textContent=detail;setTimeout(()=>{wrap.hidden=true;},2200);}
function appendClip(groupLabel,value,label=value){
  const select=document.querySelector('#clip');if(!select||[...select.options].some(o=>o.value===value))return;
  let group=[...select.querySelectorAll('optgroup')].find(g=>g.label===groupLabel);if(!group){group=document.createElement('optgroup');group.label=groupLabel;select.append(group);}group.append(new Option(label,value));
}
function updateSummary(loaded,total=null,failed=0){const node=document.querySelector('#family-summary');if(node)node.textContent=total?`${loaded}/${total} モーション読込済み${failed?`（${failed}件スキップ）`:''}`:`${loaded} モーション使用可能${failed?`（${failed}件スキップ）`:''}。残りを読込中`;}
function inPlaceClip(clip){if(!clip)return clip;for(const track of clip.tracks||[])if(track.name.endsWith('.position'))for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}return clip;}
function remapClip(sourceClip,sourceBones,targetBones,name=sourceClip.name){
  const sourceByUuid=new Map(Object.entries(sourceBones).map(([human,bone])=>[bone.uuid,human])),tracks=[];
  for(const track of sourceClip.tracks||[]){const dot=track.name.lastIndexOf('.'),uuid=track.name.slice(0,dot),prop=track.name.slice(dot+1),human=sourceByUuid.get(uuid),target=human&&targetBones[human];if(!target)continue;const times=Array.from(track.times),values=Array.from(track.values),targetName=`${target.uuid}.${prop}`;if(prop==='quaternion')tracks.push(new THREE.QuaternionKeyframeTrack(targetName,times,values));else if(prop==='position')tracks.push(new THREE.VectorKeyframeTrack(targetName,times,values));}
  return new THREE.AnimationClip(name,sourceClip.duration,tracks);
}
async function visibleHumanoidBones(gltf){
  const defs=gltf.parser?.json?.extensions?.VRMC_vrm?.humanoid?.humanBones;if(!defs)throw new Error('Shino VRM humanoid metadata missing');
  return Object.fromEntries(await Promise.all(Object.entries(defs).map(async([name,row])=>[name,await gltf.parser.getDependency('node',row.node)])));
}
async function loadAllSources({scene,rootUrl,assetUrl,signal,onProgress}){
  const vendorBase=new URL('./simulator/vendor/',rootUrl),simBase=new URL('./simulator/',rootUrl),js='.js';
  progressUI('Shinoモデル',0,100,'表示モデルを読み込み中');onProgress?.('Shinoモデルを読み込み中');
  const [loaderModule,vrmModule,motionsModule,vrmaModule,motionCatalogModule]=await Promise.all([
    import(/* @vite-ignore */ new URL('GLTFLoader'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('three-vrm.module'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('./src/motions'+js,simBase).href),
    import(/* @vite-ignore */ new URL('three-vrm-animation.module'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('./src/motion-catalog'+js,simBase).href),
  ]);
  signal.throwIfAborted();
  const modelBytes=await loadBytes(new URL(SHINO_REVIEW.publicPath,rootUrl),{signal,expectedSize:SHINO_REVIEW.size,sha256:SHINO_REVIEW.sha256,onProgress:(n,total)=>progressUI('Shinoモデル',n,total,'表示モデルを読み込み中')});
  const visibleLoader=new GLTFLoader(),visible=await visibleLoader.parseAsync(modelBytes,rootUrl.href),targetBones=await visibleHumanoidBones(visible);
  visible.scene.name='ShinoReviewVisible';visible.scene.updateMatrixWorld(true);
  const vendorLoader=new loaderModule.GLTFLoader();vendorLoader.register(p=>new vrmModule.VRMLoaderPlugin(p));
  const vendorGltf=await vendorLoader.parseAsync(modelBytes,rootUrl.href),vrm=vendorGltf.userData.vrm;if(!vrm)throw new Error('VRM Humanoid情報がありません');
  vrmModule.VRMUtils.rotateVRM0(vrm);if(vrm.lookAt){vrm.lookAt.autoUpdate=false;const proxy=new vrmaModule.VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='ReviewLookAtProxy';vrm.scene.add(proxy);}vrm.update(0);vrm.scene.updateMatrixWorld(true);
  const authored=motionsModule.createRetargetedClips(vrm),clips=new Map(),authoredNames=['Idle','Walk','Run','Attack','Hit Reaction','T-Pose'];
  for(const name of authoredNames){const value=`Tidebreak / ${name}`;clips.set(value,remapClip(authored.clips[name],authored.bones,targetBones,value));}
  let disposed=false,effects=null,externalRetarget=null,library=null,failed=0;const weapons=new Map(),pendingWeapons=new Map();
  const body={root:visible.scene,bones:targetBones,clipNames:[...clips.keys()],label:'Shino / 全モーションソース',weaponReview:true,
    clipGroups:[{label:'ゲーム実装 / Tidebreak自作',names:[...clips.keys()]}],summary:'Tidebreak自作モーションを使用可能。残りを軽い順に読み込み中。',
    getClip:name=>clips.get(name)||null,afterSample(){visible.scene.updateMatrixWorld(true);},setWeapon(){},sampleEffects(){},
    dispose(){disposed=true;effects?.dispose();externalRetarget?.dispose();for(const root of weapons.values())disposeLoaded(root);disposeLoaded(library?.scene);disposeLoaded(visible.scene);vrmModule.VRMUtils.deepDispose(vrm.scene);}};
  const motionCatalog=[...motionCatalogModule.default].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity));
  const externalWeight=6671104,totalUnits=motionCatalog.reduce((s,x)=>s+(x.bytes||0),0)+externalWeight;let completed=0,loaded=authoredNames.length;
  updateSummary(loaded);progressUI('共有モーション読込',0,totalUnits,`${loaded} 使用可能`);
  setTimeout(async()=>{
    for(const item of motionCatalog){
      if(disposed||signal.aborted)return;
      try{
        const bytes=await loadBytes(new URL(item.file,simBase),{signal,expectedSize:item.bytes,onProgress:n=>progressUI(`共有: ${item.label}`,completed+n,totalUnits,`${loaded} 使用可能`)});
        const l=new loaderModule.GLTFLoader();l.register(p=>new vrmaModule.VRMAnimationLoaderPlugin(p));const parsed=await l.parseAsync(bytes,simBase.href),anim=parsed.userData.vrmAnimations?.[0];if(!anim)throw new Error(`VRMAを解析できません: ${item.id}`);
        const vendorClip=vrmaModule.createVRMAnimationClip(anim,vrm);vendorClip.name=item.id;if(['walk','run-slow'].includes(item.id))inPlaceClip(vendorClip);const value=`共有VRMA / ${item.label}`,clip=remapClip(vendorClip,authored.bones,targetBones,value);clips.set(value,clip);body.clipNames.push(value);appendClip('ゲーム共通 / VRMA',value,item.label);loaded++;
      }catch(error){failed++;console.warn(`Shared VRMA skipped: ${item.id}`,error);}
      completed+=item.bytes||0;updateSummary(loaded,null,failed);
    }
    if(disposed||signal.aborted)return;
    try{
      const manifestResponse=await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{signal,cache:'no-cache'});if(!manifestResponse.ok)throw new Error(`Asset manifest HTTP ${manifestResponse.status}`);const manifest=await manifestResponse.json(),row=manifest.files.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');
      const motionBytes=await loadBytes(new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{signal,expectedSize:row.size,sha256:row.sha256,onProgress:n=>progressUI('外部比較 / Quaternius',completed+n,totalUnits,`${loaded} 使用可能`)});
      library=await visibleLoader.parseAsync(motionBytes,assetUrl.href);externalRetarget=await createQuaterniusRetargeter(library,visible);effects=await createReviewEffects(scene,assetUrl);
      for(const name of externalRetarget.clipNames){const value=`外部 / ${name}`;clips.set(value,externalRetarget.getClip(name,{inPlace:true}));body.clipNames.push(value);appendClip('外部Asset比較 / Quaternius',value,name);loaded++;}
      const socket=new THREE.Group();socket.name='KayKitWeaponReviewSocket';externalRetarget.bones.rightHand.add(socket);let activeWeapon=null;const toggle=document.querySelector('#weapon-toggle');if(toggle)toggle.checked=false;
      async function selectWeapon(id='greatsword'){if(!reviewWeapons.some(row=>row.id===id))id='greatsword';for(const root of weapons.values())root.visible=false;if(!weapons.has(id)){const spec=reviewWeapons.find(row=>row.id===id);progressUI(`武器: ${spec.label}`,0,100,'必要時のみ読み込み');const loadedWeapon=await visibleLoader.loadAsync(KAYKIT_ROOT+spec.file);loadedWeapon.scene.name=`KayKit:${id}`;loadedWeapon.scene.scale.setScalar(.5);socket.add(loadedWeapon.scene);weapons.set(id,loadedWeapon.scene);}for(const [key,root]of weapons)root.visible=key===id;return id;}
      body.setWeapon=async({enabled=false,id=null,scale=.5,x=0,y=0,z=0})=>{if(!enabled){socket.visible=false;return;}const requested=id||document.querySelector('#weapon-select')?.value||'greatsword';if(requested!==activeWeapon)activeWeapon=await selectWeapon(requested);socket.visible=true;const selected=weapons.get(activeWeapon);if(selected)selected.scale.setScalar(Math.max(.1,Math.min(1,scale)));socket.rotation.set(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180);};
      body.sampleEffects=age=>{const impact=externalRetarget.bones.rightHand.getWorldPosition(new THREE.Vector3()),left=externalRetarget.bones.leftFoot.getWorldPosition(new THREE.Vector3()),right=externalRetarget.bones.rightFoot.getWorldPosition(new THREE.Vector3()),ground=left.add(right).multiplyScalar(.5);impact.z+=.25;effects.sample(age,impact,ground);};
      completed+=externalWeight;updateSummary(loaded,loaded+failed,failed);finishProgress(`${loaded} モーション使用可能${failed?` / ${failed}件スキップ`:''}`);
    }catch(error){console.error(error);progressUI('外部比較モーション読込失敗',completed,totalUnits,error.message);updateSummary(loaded,null,failed+1);}
  },0);
  return body;
}
export async function installReviewExtensions({scene}){
  const rootUrl=new URL('./',location.href),assetUrl=new URL('./asset-review/',rootUrl);
  return{async loadPreset({signal,onProgress}){return loadAllSources({scene,rootUrl,assetUrl,signal,onProgress});}};
}
