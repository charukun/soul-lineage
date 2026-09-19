import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
/** Displayed meshes and animations are downloaded originals; only texture delivery is resized. */
export class Assets {
 constructor(){this.models=new Map();this.manifest=[];}
 async load(onProgress){
  const [response,deliveryResponse]=await Promise.all([fetch('./models/manifest.json'),fetch('./models/delivery.json')]);
  if(!response.ok||!deliveryResponse.ok)throw Error('素材の一覧を読み込めませんでした。再読み込みしてください。');
  this.manifest=await response.json();this.delivery=await deliveryResponse.json();
  const base=new URL('./',location.href),manager=new LoadingManager();
  manager.setURLModifier(url=>{
   if(/^(data:|blob:)/.test(url))return url;
   const parsed=new URL(url,base);if(parsed.origin!==base.origin)return url;
   const key=decodeURIComponent(parsed.pathname.slice(base.pathname.length));
   const file=this.delivery.byOriginal[key];return file?new URL(file,base).href:url;
  });
  const queue=[...this.manifest];let completed=0;
  const worker=async()=>{const loader=new GLTFLoader(manager);while(queue.length){
   const item=queue.shift();try{
    const model=await loader.loadAsync(`./${item.file}`);
    if(item.additionalMotion){const motion=await loader.loadAsync(`./${item.additionalMotion.file}`);const clips=new Map(model.animations.map(c=>[c.name,c]));for(const clip of motion.animations)clips.set(clip.name,clip);model.animations=[...clips.values()];}
    model.scene.userData.assetId=item.id;model.scene.userData.originalSource=item.source;
    model.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=!o.isSkinnedMesh;o.userData.originalAsset=item.id;});
    this.models.set(item.id,model);onProgress(++completed,this.manifest.length,item.id);
   }catch(error){console.error('Asset load failed',item.id,error);throw Error(`${item.id} の読込に失敗しました。通信を確認して再読み込みしてください。`,{cause:error});}
  }};await Promise.all(Array.from({length:3},worker));
 }
 model(id){const value=this.models.get(id);if(!value)throw Error(`Missing original model: ${id}`);return value;}
 character(id){if(this.manifest.find(m=>m.id===id)?.role==='animation-only')throw Error('Animation mannequin must never be displayed');return clone(this.model(id).scene);}
 prop(id){if(this.manifest.find(m=>m.id===id)?.role==='animation-only')throw Error('Animation mannequin must never be displayed');return this.model(id).scene.clone(true);}
 weapon(){return this.prop('Sword');}
}
export function findNode(root,name){let found;const normalize=s=>s.replace(/[._]/g,'').toLowerCase();root.traverse(n=>{if(normalize(n.name)===normalize(name))found=n;});return found;}
