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
function finishProgress(detail){const wrap=document.querySelector('#load-progress-wrap'),bar=document.querySelector('#load-progress'),name=document.querySelector('#load-progress-label'),info=document.querySelector('#load-progress-detail');if(!wrap||!bar)return;bar.value=100;name.textContent='モーション読込完了';info.textContent=detail;setTimeout(()=>{wrap.hidden=true;},1200);}
function appendClip(groupLabel,value,label=value){
  const select=document.querySelector('#clip');if(!select||[...select.options].some(o=>o.value===value))return;
  let group=[...select.querySelectorAll('optgroup')].find(g=>g.label===groupLabel);if(!group){group=document.createElement('optgroup');group.label=groupLabel;select.append(group);}group.append(new Option(label,value));
}
function updateSummary(loaded,total){const node=document.querySelector('#family-summary');if(node)node.textContent=`${loaded}/${total} モーション読込済み。読み込めたものから即確認できます。`;}
function inPlaceClip(clip){if(!clip)return clip;for(const track of clip.tracks||[])if(track.name.endsWith('.position'))for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}return clip;}
async function loadAllSources({scene,rootUrl,assetUrl,signal,onProgress}){
  const vendorBase=new URL('./simulator/vendor/',rootUrl),simBase=new URL('./simulator/',rootUrl),js='.js';
  progressUI('キャラクターを読み込み中',0,100,'最初の確認画面を準備中');
  onProgress?.('キャラクターを読み込み中');
  const [loaderModule,vrmModule,motionsModule,vrmaModule,motionCatalogModule]=await Promise.all([
    import(/* @vite-ignore */ new URL('GLTFLoader'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('three-vrm.module'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('./src/motions'+js,simBase).href),
    import(/* @vite-ignore */ new URL('three-vrm-animation.module'+js,vendorBase).href),
    import(/* @vite-ignore */ new URL('./src/motion-catalog'+js,simBase).href),
  ]);
  signal.throwIfAborted();
  const vendorLoader=new loaderModule.GLTFLoader();vendorLoader.register(p=>new vrmModule.VRMLoaderPlugin(p));
  const modelBytes=await loadBytes(new URL(SHINO_REVIEW.publicPath,rootUrl),{signal,expectedSize:SHINO_REVIEW.size,sha256:SHINO_REVIEW.sha256,onProgress:(n,total)=>progressUI('キャラクターを読み込み中',n,total,'Tidebreak自作モーションを先に準備')});
  const gltf=await vendorLoader.parseAsync(modelBytes,rootUrl.href),vrm=gltf.userData.vrm;if(!vrm)throw new Error('VRM Humanoid情報がありません');
  vrmModule.VRMUtils.rotateVRM0(vrm);if(vrm.lookAt)vrm.lookAt.autoUpdate=false;vrm.update(0);vrm.scene.updateMatrixWorld(true);
  const authored=motionsModule.createRetargetedClips(vrm),clips=new Map();
  const authoredNames=['Idle','Walk','Run','Attack','Hit Reaction','T-Pose'];for(const name of authoredNames)clips.set(`Tidebreak / ${name}`,authored.clips[name]);
  let disposed=false,effects=null,externalRetarget=null;const weapons=new Map(),pendingWeapons=new Map();
  const body={root:vrm.scene,bones:authored.bones,clipNames:[...clips.keys()],label:'Shino / 全モーションソース',weaponReview:true,
    clipGroups:[{label:'ゲーム実装 / Tidebreak自作',names:[...clips.keys()]}],summary:'Tidebreak自作モーションを読込済み。残りを軽い順に読み込み中。',
    getClip:name=>clips.get(name)||null,afterSample(){vrm.update(0);vrm.scene.updateMatrixWorld(true);},setWeapon(){},sampleEffects(){},dispose(){disposed=true;effects?.dispose();externalRetarget?.dispose();for(const root of weapons.values())disposeLoaded(root);vrmModule.VRMUtils.deepDispose(vrm.scene);}};
  const motionCatalog=[...motionCatalogModule.default].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity));
  const externalWeight=6671104,totalUnits=motionCatalog.reduce((s,x)=>s+(x.bytes||0),0)+externalWeight;let completed=0,loaded=authoredNames.length,totalClips=authoredNames.length+motionCatalog.length+1;
  updateSummary(loaded,totalClips);finishProgress(`${loaded}/${totalClips} 使用可能`);
  setTimeout(async()=>{
    try{
      for(const item of motionCatalog){
        if(disposed||signal.aborted)return;const bytes=await loadBytes(new URL(item.file,simBase),{signal,expectedSize:item.bytes,onProgress:(n,total)=>progressUI(`共有モーション: ${item.label}`,completed+n,totalUnits,`${loaded}/${totalClips} 使用可能`)});
        const l=new loaderModule.GLTFLoader();l.register(p=>new vrmaModule.VRMAnimationLoaderPlugin(p));const parsed=await l.parseAsync(bytes,simBase.href),anim=parsed.userData.vrmAnimations?.[0];if(!anim)throw new Error(`VRMAを解析できません: ${item.id}`);
        const clip=vrmaModule.createVRMAnimationClip(anim,vrm);clip.name=item.id;if(['walk','run-slow'].includes(item.id))inPlaceClip(clip);const value=`共有VRMA / ${item.label}`;clips.set(value,clip);body.clipNames.push(value);appendClip('ゲーム共通 / VRMA',value,item.label);completed+=item.bytes||0;loaded++;updateSummary(loaded,totalClips);
      }
      if(disposed||signal.aborted)return;
      const manifestResponse=await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{signal,cache:'no-cache'});if(!manifestResponse.ok)throw new Error(`Asset manifest HTTP ${manifestResponse.status}`);const manifest=await manifestResponse.json();const row=manifest.files.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');
      const motionBytes=await loadBytes(new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{signal,expectedSize:row.size,sha256:row.sha256,onProgress:(n,total)=>progressUI('外部比較モーション / Quaternius',completed+n,totalUnits,`${loaded}/${totalClips} 使用可能`)});
      const qLoader=new GLTFLoader(),library=await qLoader.parseAsync(motionBytes,assetUrl.href);externalRetarget=await createQuaterniusRetargeter(library,gltf);effects=await createReviewEffects(scene,assetUrl);
      const externalNames=[];for(const name of externalRetarget.clipNames){const value=`外部 / ${name}`;clips.set(value,externalRetarget.getClip(name,{inPlace:true}));body.clipNames.push(value);externalNames.push(value);appendClip('外部Asset比較 / Quaternius',value,name);loaded++;}
      completed+=externalWeight;updateSummary(loaded,loaded);finishProgress(`${loaded} モーション使用可能`);
      const socket=new THREE.Group();socket.name='KayKitWeaponReviewSocket';externalRetarget.bones.rightHand.add(socket);let activeWeapon=null;
      async function selectWeapon(id='greatsword'){if(!reviewWeapons.some(row=>row.id===id))id='greatsword';for(const root of weapons.values())root.visible=false;if(!weapons.has(id)){if(!pendingWeapons.has(id)){const spec=reviewWeapons.find(row=>row.id===id);pendingWeapons.set(id,qLoader.loadAsync(KAYKIT_ROOT+spec.file).then(g=>{g.scene.name=`KayKit:${id}`;g.scene.scale.setScalar(.5);socket.add(g.scene);weapons.set(id,g.scene);pendingWeapons.delete(id);return g.scene;}));}await pendingWeapons.get(id);}for(const [key,root]of weapons)root.visible=key===id;return id;}
      body.setWeapon=async({enabled=false,id=null,scale=.5,x=0,y=0,z=0})=>{const requested=id||document.querySelector('#weapon-select')?.value||'greatsword';if(requested!==activeWeapon)activeWeapon=await selectWeapon(requested);socket.visible=enabled;const selected=weapons.get(activeWeapon);if(selected)selected.scale.setScalar(Math.max(.1,Math.min(1,scale)));socket.rotation.set(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180);};
      body.sampleEffects=age=>{const impact=externalRetarget.bones.rightHand.getWorldPosition(new THREE.Vector3()),left=externalRetarget.bones.leftFoot.getWorldPosition(new THREE.Vector3()),right=externalRetarget.bones.rightFoot.getWorldPosition(new THREE.Vector3()),ground=left.add(right).multiplyScalar(.5);impact.z+=.25;effects.sample(age,impact,ground);};
      disposeLoaded(library.scene);
    }catch(error){if(disposed||signal.aborted)return;console.error(error);progressUI('一部素材の読み込みに失敗',0,100,error.message);const node=document.querySelector('#family-summary');if(node)node.textContent=`${loaded} モーションは使用可能。残りの読み込みでエラー: ${error.message}`;}
  },0);
  return body;
}
export async function installReviewExtensions({scene}){
  const rootUrl=new URL('./',location.href),assetUrl=new URL('./asset-review/',rootUrl);
  return{async loadPreset({signal,onProgress}){return loadAllSources({scene,rootUrl,assetUrl,signal,onProgress});}};
}
