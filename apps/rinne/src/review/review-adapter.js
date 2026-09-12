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

// Source of truth: the skill simulator's STRIKES / weapon arts.
const SKILL_SIM_TECHNIQUES=Object.freeze([
  {kind:'slash',label:'流し斬り',weapon:'sword'},{kind:'back',label:'斬り返し',weapon:'sword'},{kind:'thrust',label:'刺し貫く',weapon:'sword'},{kind:'heavy',label:'叩き斬る',weapon:'sword'},
  {kind:'dash',label:'駆け抜け斬り',weapon:'sword'},{kind:'spin',label:'旋回斬り',weapon:'sword'},{kind:'leap',label:'飛び込み斬り',weapon:'sword'},{kind:'retreat',label:'退いて構える',weapon:'sword'},
  {kind:'uppercut',label:'斬り上げる',weapon:'sword'},{kind:'sweep',label:'足元を薙ぐ',weapon:'sword'},{kind:'diagonal',label:'袈裟に断つ',weapon:'sword'},{kind:'crosscut',label:'十字に斬り結ぶ',weapon:'sword'},
  {kind:'round',label:'一回転の大薙ぎ',weapon:'sword'},{kind:'pierce',label:'渾身の貫き',weapon:'sword'},{kind:'sky',label:'跳躍突き',weapon:'spear'},{kind:'pommel',label:'柄で打ち崩す',weapon:'sword'},
  {kind:'bash',label:'盾・鍔で押し返す',weapon:'sword'},{kind:'bullrush',label:'猛進・吹き飛ばし',weapon:'sword'},{kind:'meteor',label:'流星の強襲',weapon:'sword'},
  {kind:'jab',label:'左の牽制拳',weapon:'fist'},{kind:'straight',label:'右の正拳',weapon:'fist'},{kind:'hook',label:'回し拳',weapon:'fist'},{kind:'bodyblow',label:'腹打ち',weapon:'fist'},
  {kind:'risingfist',label:'突き上げ拳',weapon:'fist'},{kind:'oneinch',label:'寸勁',weapon:'fist'},{kind:'barrage',label:'連環双拳',weapon:'fist'},{kind:'rushfist',label:'崩山・突進拳',weapon:'fist'},
  {kind:'katanaDraw',label:'居合い抜き',weapon:'katana'},{kind:'katanaKesa',label:'袈裟の一太刀',weapon:'katana'},{kind:'katanaReturn',label:'逆袈裟の返し',weapon:'katana'},{kind:'katanaThrust',label:'切っ先で貫く',weapon:'katana'},
  {kind:'spearwheel',label:'風車の連旋',weapon:'spear'}
]);
const SKILL_SIM_DEFENSE=Object.freeze([
  {kind:'guard',label:'堅く防ぐ',weapon:'sword',defense:'guard'},{kind:'parry',label:'刃を弾く',weapon:'sword',defense:'parry'},{kind:'counter',label:'受け流して反撃',weapon:'sword',defense:'counter'},
  {kind:'ward',label:'守りの結界',weapon:'sword',defense:'ward'},{kind:'slip',label:'身をかわして返す',weapon:'sword',defense:'slip'},{kind:'brace',label:'踏ん張って受ける',weapon:'sword',defense:'brace'},
  {kind:'ready',label:'構えを整える',weapon:'sword'}
]);
const SKILL_SIM_STANCES=Object.freeze([
  {id:'balanced',label:'自然体',cfg:{}},{id:'assault',label:'攻め主体',cfg:{lean:.07,lower:.025,weight:.07}},{id:'defensive',label:'守り主体',cfg:{lean:-.04,lower:.05,weight:-.06,high:true}},
  {id:'patient',label:'後の先',cfg:{lean:-.015,lower:.025,weight:-.04,half:.16}},{id:'counter',label:'見切り重視',cfg:{lean:-.03,lower:.05,weight:-.03,half:.23,high:true}},
  {id:'elusive',label:'回避重視',cfg:{lower:.02,half:.18,light:true}},{id:'steadfast',label:'不動',cfg:{lower:.06,wide:.05}},{id:'survival',label:'生存優先',cfg:{lean:-.03,lower:.04,high:true}},
  {id:'escort',label:'護衛優先',cfg:{lower:.065,wide:.04,high:true}},{id:'boxer',label:'拳闘のリズム',cfg:{lower:.025,half:.12,light:true,boxing:true}},
  {id:'sideways',label:'半身の構え',cfg:{lower:.065,half:.24}},{id:'draw',label:'静の構え',cfg:{lower:.04,draw:true}}
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
  if(bytesCache.has(key)){const bytes=bytesCache.get(key);options.onProgress?.(options.expectedSize||bytes.byteLength,options.expectedSize||bytes.byteLength);return bytes;}
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
function poseClip(name,bones){
  const tracks=[];for(const [human,bone] of Object.entries(bones)){if(!bone)continue;const q=bone.quaternion.toArray();tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`,[0,1],[...q,...q]));if(human==='hips'){const p=bone.position.toArray();tracks.push(new THREE.VectorKeyframeTrack(`${bone.uuid}.position`,[0,1],[...p,...p]));}}
  return new THREE.AnimationClip(name,1,tracks);
}
function applyStance(runtime,c,row){
  runtime.resetRoot(c);runtime.resetBones(c);runtime.combatPose(c,row.id==='boxer'?'fist':'sword',null,0,0);const b=c.bones,m=row.cfg||{},unit=Math.max(.7,c.legLength||1);
  if(b.hips){b.hips.position.y-=(m.lower||0)*unit;b.hips.position.x+=(m.weight||0)*unit;}
  if(b.spine){b.spine.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((m.lean||0),m.half||0,0)));}
  if(m.high){for(const side of ['left','right'])b[side+'UpperArm']?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.35,0,side==='left'?.28:-.28)));}
  if(m.boxing){b.leftUpperArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.65,0,.55)));b.rightUpperArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.58,0,-.52)));b.leftLowerArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.78,0,0)));b.rightLowerArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.72,0,0)));}
  if(m.draw){b.spine?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-.18,0)));b.rightUpperArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.20,-.15,-.55)));b.leftUpperArm?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.12,.15,.38)));}
  if(m.light){b.hips?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,.10,0)));}
  c.root.updateMatrixWorld(true);
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
    let done=0,failed=0;const models=Object.values(MODELS),motions=[...motionCatalog].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity)),total=motions.length+models.length+reviewWeapons.length+1;
    const mark=label=>progressUI(`先読み: ${label}`,done,total,`${done}/${total} 完了${failed?` / ${failed}件失敗`:''}`);
    for(const item of motions){try{mark(item.label);await cachedBytes('motion:'+item.id,new URL(item.file,new URL('./simulator/',rootUrl)),{expectedSize:item.bytes});}catch(error){failed++;console.warn('preload motion failed',item.id,error);}done++;}
    for(const model of models){try{mark(model.name);await cachedBytes('model:'+model.label,new URL(model.path,rootUrl),{expectedSize:model.size,sha256:model.sha256});}catch(error){failed++;console.warn('preload model failed',model.label,error);}done++;}
    for(const weapon of reviewWeapons){try{mark(weapon.label);await cachedBytes('weapon:'+weapon.id,new URL(KAYKIT_ROOT+weapon.file),{});}catch(error){failed++;console.warn('preload weapon failed',weapon.id,error);}done++;}
    try{mark('外部比較モーション');const response=await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{cache:'force-cache'});if(!response.ok)throw new Error(`Asset manifest HTTP ${response.status}`);externalManifest=await response.json();const row=externalManifest.files.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');await cachedBytes('external:quaternius',new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{expectedSize:row.size,sha256:row.sha256});}catch(error){failed++;console.warn('preload external failed',error);}done++;
    finishProgress(`${done-failed}/${total} 成功${failed?` / ${failed}件失敗`:''}`);return{done,failed,total};
  })();return preloadPromise;
}

async function loadAllSources({scene,rootUrl,assetUrl,signal,onProgress,presetId,motionCatalogModule,loaderModule,vrmModule,motionsModule,vrmaModule,humanoidModule}){
  const model=modelForPreset(presetId),simBase=new URL('./simulator/',rootUrl),motionCatalog=[...motionCatalogModule.default].sort((a,b)=>(a.bytes||Infinity)-(b.bytes||Infinity));
  progressUI(`${model.name}`,0,100,'表示モデルを読み込み中');onProgress?.(`${model.name}を読み込み中`);
  const modelBytes=await cachedBytes('model:'+model.label,new URL(model.path,rootUrl),{expectedSize:model.size,sha256:model.sha256,onProgress:(n,total)=>progressUI(`${model.name}`,n,total,'表示モデルを読み込み中')});signal.throwIfAborted();
  const visibleLoader=new GLTFLoader(),visible=await visibleLoader.parseAsync(modelBytes,rootUrl.href),targetBones=await visibleHumanoidBones(visible);visible.scene.name=`${model.label}ReviewVisible`;visible.scene.updateMatrixWorld(true);
  const vendorLoader=new loaderModule.GLTFLoader();vendorLoader.register(p=>new vrmModule.VRMLoaderPlugin(p));const vendorGltf=await vendorLoader.parseAsync(modelBytes,rootUrl.href),vrm=vendorGltf.userData.vrm;if(!vrm)throw new Error('VRM Humanoid情報がありません');vrmModule.VRMUtils.rotateVRM0(vrm);if(vrm.lookAt){vrm.lookAt.autoUpdate=false;const proxy=new vrmaModule.VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='ReviewLookAtProxy';vrm.scene.add(proxy);}vrm.update(0);vrm.scene.updateMatrixWorld(true);
  const authored=motionsModule.createRetargetedClips(vrm),clips=new Map(),authoredNames=['Idle','Walk','Run','Attack','Hit Reaction','T-Pose'];for(const name of authoredNames){const value=`Tidebreak / ${name}`;clips.set(value,remapClip(authored.clips[name],authored.bones,targetBones,value));}
  const bodyAliases=[['体 / 歩行','Tidebreak / Walk','歩行'],['体 / ダッシュ','Tidebreak / Run','ダッシュ'],['体 / 被弾','Tidebreak / Hit Reaction','被弾']];for(const [value,source,label] of bodyAliases){clips.set(value,clips.get(source));appendClip('心技体 / 体',value,label);}
  let disposed=false,effects=null,externalRetarget=null,library=null,failed=0;const weapons=new Map(),pendingWeapons=new Map();
  const weaponSocket=new THREE.Group();weaponSocket.name='ReviewWeaponSocket';targetBones.rightHand?.add(weaponSocket);let activeWeapon=null;
  async function selectWeapon(id='greatsword'){
    if(!reviewWeapons.some(row=>row.id===id))id='greatsword';for(const root of weapons.values())root.visible=false;
    if(!weapons.has(id)){if(!pendingWeapons.has(id)){const spec=reviewWeapons.find(row=>row.id===id);pendingWeapons.set(id,cachedBytes('weapon:'+id,new URL(KAYKIT_ROOT+spec.file),{}).then(bytes=>visibleLoader.parseAsync(bytes,KAYKIT_ROOT)).then(g=>{g.scene.name=`KayKit:${id}`;g.scene.scale.setScalar(.5);weaponSocket.add(g.scene);weapons.set(id,g.scene);pendingWeapons.delete(id);return g.scene;}));}await pendingWeapons.get(id);}
    for(const [key,root]of weapons)root.visible=key===id;return id;
  }
  const body={root:visible.scene,bones:targetBones,clipNames:[...clips.keys()],label:`${model.name} / 全モーションソース`,weaponReview:true,clipGroups:[{label:'ゲーム実装 / Tidebreak自作',names:[...clips.keys()]}],summary:'Tidebreak自作モーションを使用可能。残りを優先順に読み込み中。',getClip:name=>clips.get(name)||null,afterSample(){visible.scene.updateMatrixWorld(true);},async setWeapon({enabled=false,id=null,scale=.5,x=0,y=0,z=0}={}){if(!weaponSocket.parent||!enabled){weaponSocket.visible=false;return;}const requested=id||document.querySelector('#weapon-select')?.value||'greatsword';if(requested!==activeWeapon||!weapons.has(requested))activeWeapon=await selectWeapon(requested);weaponSocket.visible=true;const selected=weapons.get(activeWeapon);if(selected)selected.scale.setScalar(Math.max(.1,Math.min(1,scale)));weaponSocket.rotation.set(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180);},sampleEffects(){},dispose(){disposed=true;effects?.dispose();externalRetarget?.dispose();for(const root of weapons.values())disposeLoaded(root);disposeLoaded(library?.scene);disposeLoaded(visible.scene);vrmModule.VRMUtils.deepDispose(vrm.scene);}};
  let loaded=authoredNames.length+bodyAliases.length;updateSummary(loaded);startGlobalPreload({rootUrl,assetUrl,motionCatalog:motionCatalogModule.default});
  setTimeout(async()=>{
    for(const item of motionCatalog){if(disposed||signal.aborted)return;try{const bytes=await cachedBytes('motion:'+item.id,new URL(item.file,simBase),{expectedSize:item.bytes,onProgress:(n,total)=>progressUI(`共有: ${item.label}`,n,total,`${loaded} 使用可能`)});const l=new loaderModule.GLTFLoader();l.register(p=>new vrmaModule.VRMAnimationLoaderPlugin(p));const parsed=await l.parseAsync(bytes,simBase.href),anim=parsed.userData.vrmAnimations?.[0];if(!anim)throw new Error(`VRMAを解析できません: ${item.id}`);const vendorClip=vrmaModule.createVRMAnimationClip(anim,vrm);vendorClip.name=item.id;if(['walk','run-slow'].includes(item.id))inPlaceClip(vendorClip);const value=`共有VRMA / ${item.label}`,clip=remapClip(vendorClip,authored.bones,targetBones,value);clips.set(value,clip);body.clipNames.push(value);appendClip('ゲーム共通 / VRMA',value,item.label);loaded++;}catch(error){failed++;console.warn(`Shared VRMA skipped: ${item.id}`,error);}updateSummary(loaded,null,failed);}
    if(disposed||signal.aborted)return;
    const previousAssetBuffer=window.assetBuffer;
    try{
      progressUI('スキルシミュレータ技・構え',0,1,'既存戦闘ロジックから生成中');
      window.assetBuffer=async id=>{if(bytesCache.has('model:'+id))return bytesCache.get('model:'+id);const motionId=String(id).replace(/^motion:/,'');if(bytesCache.has('motion:'+motionId))return bytesCache.get('motion:'+motionId);const row=motionCatalog.find(x=>x.id===motionId);if(row)return cachedBytes('motion:'+motionId,new URL(row.file,simBase),{expectedSize:row.bytes});throw new Error(`Review asset not found: ${id}`);};
      const strikeMeta=Object.fromEntries([...SKILL_SIM_TECHNIQUES,...SKILL_SIM_DEFENSE].map(row=>[row.kind,row.defense?{defense:row.defense}:{}]));
      const runtime=new humanoidModule.HumanoidRuntime({weapons:{},strikes:strikeMeta,clips:{},windows:{},progress:()=>0,window:()=>null,hand:()=> 'right',echo:()=>{},status:()=>{},attach:()=>{}});await runtime.load(model.label);
      for(const row of SKILL_SIM_TECHNIQUES){let source;if(row.weapon==='fist'&&typeof runtime.bakeFist==='function')source=runtime.bakeFist(runtime.current,row.kind);else source=runtime.bakeArmed(runtime.current,row.weapon,row.kind);const value=`技 / ${row.label}`;clips.set(value,remapClip(source,runtime.current.bones,targetBones,value));body.clipNames.push(value);appendClip('スキルシミュレータ / 技',value,row.label);loaded++;}
      for(const row of SKILL_SIM_DEFENSE){const source=runtime.bakeArmed(runtime.current,row.weapon,row.kind),value=`技 / ${row.label}`,mapped=remapClip(source,runtime.current.bones,targetBones,value);clips.set(value,mapped);body.clipNames.push(value);appendClip('スキルシミュレータ / 防御',value,row.label);loaded++;if(row.defense){const alias=`パリィ / ${row.label}`;clips.set(alias,mapped);body.clipNames.push(alias);appendClip('パリィ候補',alias,row.label);loaded++;}}
      for(const row of SKILL_SIM_STANCES){applyStance(runtime,runtime.current,row);const source=poseClip(`stance:${row.id}`,runtime.current.bones),mapped=remapClip(source,runtime.current.bones,targetBones,`構え / ${row.label}`),value=`構え / ${row.label}`;clips.set(value,mapped);body.clipNames.push(value);appendClip('スキルシミュレータ / 構え',value,row.label);const mind=`心 / ${row.label}`;clips.set(mind,mapped);body.clipNames.push(mind);appendClip('心技体 / 心',mind,row.label);loaded++;}
      runtime.dispose(runtime.current);progressUI('スキルシミュレータ技・構え',1,1,`${SKILL_SIM_TECHNIQUES.length}技 / ${SKILL_SIM_STANCES.length}構え追加済み`);
    }catch(error){failed++;console.error('Skill simulator motion generation failed',error);progressUI('スキルシミュレータ技・構えの生成に失敗',0,1,error.message);}finally{window.assetBuffer=previousAssetBuffer;updateSummary(loaded,null,failed);}
    if(disposed||signal.aborted)return;
    try{
      const response=externalManifest?null:await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{cache:'force-cache'});const manifest=externalManifest||(response?.ok?await response.json():null),row=manifest?.files?.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');
      const motionBytes=await cachedBytes('external:quaternius',new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{expectedSize:row.size,sha256:row.sha256,onProgress:(n,total)=>progressUI('外部比較 / Quaternius',n,total,`${loaded} 使用可能`)});library=await visibleLoader.parseAsync(motionBytes,assetUrl.href);externalRetarget=await createQuaterniusRetargeter(library,visible);effects=await createReviewEffects(scene,assetUrl);
      for(const name of externalRetarget.clipNames){const value=`外部 / ${name}`;clips.set(value,externalRetarget.getClip(name,{inPlace:true}));body.clipNames.push(value);appendClip('外部Asset比較 / Quaternius',value,name);loaded++;}
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
