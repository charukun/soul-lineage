import { THREE, GLTFLoader } from '@soul/rendering';
import { createQuaterniusRetargeter } from '@soul/rendering/quaternius-retarget';
import { createReviewEffects } from '@soul/rendering/review-effects';
import { SHINO_REVIEW, REVIEW_ASSET_REVISION } from '@soul/assets/review-catalog';

export const reviewPresets = Object.freeze([
  {id:SHINO_REVIEW.id,label:'外部Asset比較 / Quaternius',kind:'quaternius',modelUrl:SHINO_REVIEW.publicPath},
  {id:'tidebreak.authored',label:'ゲーム実装 / Tidebreak自作',kind:'tidebreak',modelUrl:'simulator/assets/SHINO_review.vrm'},
]);
const KAYKIT_COMMIT='672074b73ba276876a19e8816ecdc5241817ab47';
const KAYKIT_ROOT=`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/${KAYKIT_COMMIT}/addons/kaykit_character_pack_adventures/Assets/gltf/`;
export const reviewWeapons=Object.freeze([
  {id:'greatsword',label:'大剣',file:'sword_2handed.gltf'},{id:'sword',label:'片手剣',file:'sword_1handed.gltf'},
  {id:'axe',label:'片手斧',file:'axe_1handed.gltf'},{id:'greataxe',label:'両手斧',file:'axe_2handed.gltf'},
  {id:'dagger',label:'短剣',file:'dagger.gltf'},{id:'crossbow',label:'クロスボウ',file:'crossbow_2handed.gltf'},
  {id:'staff',label:'杖',file:'staff.gltf'},{id:'wand',label:'ワンド',file:'wand.gltf'},
]);
export function disposeLoaded(root) {
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);Object.values(material).forEach(value=>{if(value?.isTexture)textures.add(value);});}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());root?.removeFromParent();
}
async function loadBytes(url,{signal,onProgress,expectedSize,sha256}={}){
  const response=await fetch(url,{signal});if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
  const reader=response.body.getReader(),parts=[];let length=0;for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>(expectedSize||25*1024*1024)){await reader.cancel();throw new Error('Asset exceeds its allowed byte count');}parts.push(value);onProgress?.(length,expectedSize||Number(response.headers.get('content-length'))||0);}
  if(expectedSize&&length!==expectedSize)throw new Error(`Truncated asset: ${length}/${expectedSize}`);const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}
  if(sha256){const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',result)),b=>b.toString(16).padStart(2,'0')).join('');if(digest!==sha256)throw new Error('Asset SHA-256 mismatch');}signal?.throwIfAborted();return result.buffer;
}
async function loadQuaternius({scene,rootUrl,assetUrl,signal,onProgress}){
  const loader=new GLTFLoader();let character,library,effects,retarget;const weapons=new Map(),pending=new Map();
  try{
    const manifestResponse=await fetch(new URL(`manifest.json?v=${REVIEW_ASSET_REVISION}`,assetUrl),{signal,cache:'no-cache'});if(!manifestResponse.ok)throw new Error(`Asset manifest HTTP ${manifestResponse.status}`);const manifest=await manifestResponse.json();if(manifest.revision!==REVIEW_ASSET_REVISION)throw new Error('Asset revision mismatch; reload this preview');
    const modelBytes=await loadBytes(new URL(SHINO_REVIEW.publicPath,rootUrl),{signal,expectedSize:SHINO_REVIEW.size,sha256:SHINO_REVIEW.sha256,onProgress:(n,total)=>onProgress?.(`Shino ${Math.round(n/total*100)}%`)});character=await loader.parseAsync(modelBytes,rootUrl.href);signal.throwIfAborted();
    const row=manifest.files.find(file=>file.id==='animation.quaternius.library');if(!row?.sha256||!row.size)throw new Error('Animation integrity record is missing');const motionBytes=await loadBytes(new URL(`AnimationLibrary.glb?v=${row.sha256}`,assetUrl),{signal,expectedSize:row.size,sha256:row.sha256,onProgress:(n,total)=>onProgress?.(`外部モーション ${Math.round(n/total*100)}%`)});library=await loader.parseAsync(motionBytes,assetUrl.href);signal.throwIfAborted();
    onProgress?.('骨格を照合中');retarget=await createQuaterniusRetargeter(library,character);effects=await createReviewEffects(scene,assetUrl);signal.throwIfAborted();
    const socket=new THREE.Group();socket.name='KayKitWeaponReviewSocket';retarget.bones.rightHand.add(socket);
    async function selectWeapon(id='greatsword'){
      if(!reviewWeapons.some(row=>row.id===id))id='greatsword';for(const root of weapons.values())root.visible=false;
      if(!weapons.has(id)){if(!pending.has(id)){const spec=reviewWeapons.find(row=>row.id===id);pending.set(id,loader.loadAsync(KAYKIT_ROOT+spec.file).then(gltf=>{signal.throwIfAborted();gltf.scene.name=`KayKit:${id}`;gltf.scene.scale.setScalar(.5);socket.add(gltf.scene);weapons.set(id,gltf.scene);pending.delete(id);return gltf.scene;}));}await pending.get(id);}
      for(const [key,root]of weapons)root.visible=key===id;return id;
    }
    await selectWeapon('greatsword');socket.visible=false;const impact=new THREE.Vector3(),ground=new THREE.Vector3();let activeWeapon='greatsword';
    return{root:character.scene,clipNames:retarget.clipNames,bones:retarget.bones,weapons:reviewWeapons,label:`外部Asset / ${SHINO_REVIEW.id}`,provenance:manifest,getClip:(name,options)=>retarget.getClip(name,options),
      summary:`Quaternius外部Asset ${retarget.clipNames.length}動作。ゲーム実装の確認は「ゲーム実装 / Tidebreak自作」へ切替。`,weaponReview:true,
      async setWeapon({enabled=false,id=null,scale=.5,x=0,y=0,z=0}){const requested=id||document.querySelector('#weapon-select')?.value||'greatsword';if(requested!==activeWeapon)activeWeapon=await selectWeapon(requested);socket.visible=enabled;const selected=weapons.get(activeWeapon);if(selected)selected.scale.setScalar(Math.max(.1,Math.min(1,scale)));socket.rotation.set(x*Math.PI/180,y*Math.PI/180,z*Math.PI/180);},
      sampleEffects(age){retarget.bones.rightHand.getWorldPosition(impact);impact.z+=.25;const left=retarget.bones.leftFoot.getWorldPosition(ground),right=retarget.bones.rightFoot.getWorldPosition(new THREE.Vector3());ground.copy(left).add(right).multiplyScalar(.5);effects.sample(age,impact,ground);},
      dispose(){effects.dispose();retarget.dispose();for(const root of weapons.values())disposeLoaded(root);disposeLoaded(character.scene);disposeLoaded(library.scene);}};
  }catch(error){effects?.dispose();retarget?.dispose();for(const root of weapons.values())disposeLoaded(root);disposeLoaded(character?.scene);disposeLoaded(library?.scene);throw error;}
}
async function loadTidebreak({rootUrl,signal,onProgress}){
  onProgress?.('Tidebreak自作モーションを読み込み中');
  const humanoidUrl=new URL('./simulator/src/humanoid.js',rootUrl).href;
  const catalogUrl=new URL('./simulator/src/motion-catalog.js',rootUrl).href;
  const [{HumanoidRuntime},motionModule]=await Promise.all([
    import(/* @vite-ignore */ humanoidUrl),
    import(/* @vite-ignore */ catalogUrl),
  ]);
  signal.throwIfAborted();
  const motionCatalog=motionModule.default;
  const previousAssetBuffer=window.assetBuffer;
  const fetchBuffer=async url=>{const response=await fetch(url,{signal});if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);return response.arrayBuffer();};
  window.assetBuffer=async key=>{
    const value=String(key);
    if(value.startsWith('motion:')){const id=value.slice(7),row=motionCatalog.find(item=>item.id===id);if(!row)throw new Error(`Unknown Tidebreak motion: ${id}`);return fetchBuffer(new URL(`./simulator/${row.file}`,rootUrl));}
    return fetchBuffer(new URL(`./simulator/assets/${value}_review.vrm`,rootUrl));
  };
  const runtime=new HumanoidRuntime({weapons:{},strikes:{},clips:{},windows:{},progress:()=>0,window:()=>null,hand:()=> 'right',echo:()=>{},attach:()=>{},status:message=>onProgress?.(message)});
  try{await runtime.load('SHINO');}finally{if(previousAssetBuffer===undefined)delete window.assetBuffer;else window.assetBuffer=previousAssetBuffer;}
  signal.throwIfAborted();
  const c=runtime.current;if(!c)throw new Error('Tidebreak Humanoid runtime did not load');
  const authored=['Idle','Walk','Run','Attack','Hit Reaction','Tidebreak_Death_Authored','T-Pose'];
  return{root:c.root,clipNames:authored,bones:c.bones,label:'ゲーム実装 / Tidebreak自作',weaponReview:false,
    clipGroups:[{label:'Tidebreak 自作モーション',names:authored}],
    summary:'Tidebreak時代の自作モーションをゲーム側と同じHumanoid実装から直接読込。外部Assetではありません。',
    getClip:name=>name==='Tidebreak_Death_Authored'?c.generated.Death:c.review.clips[name],
    afterSample(){c.vrm.update(0);c.root.updateMatrixWorld(true);},
    dispose(){runtime.dispose(c);}};
}
export async function installReviewExtensions({scene}){
  const rootUrl=new URL('./',location.href),assetUrl=new URL('./asset-review/',rootUrl);
  return{async loadPreset({presetId=reviewPresets[0].id,signal,onProgress}){
    const preset=reviewPresets.find(row=>row.id===presetId)||reviewPresets[0];
    if(preset.kind==='tidebreak')return loadTidebreak({rootUrl,signal,onProgress});
    return loadQuaternius({scene,rootUrl,assetUrl,signal,onProgress});
  }};
}
