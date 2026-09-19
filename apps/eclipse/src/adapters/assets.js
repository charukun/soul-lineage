import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
/** Every displayed mesh comes from a verified artist-authored download. */
export class Assets {
 constructor(){this.models=new Map();this.manifest=[];}
 async load(onProgress){const response=await fetch('./models/manifest.json');if(!response.ok)throw Error('アセットの一覧を読み込めませんでした。');this.manifest=await response.json();const queue=[...this.manifest];let completed=0;const worker=async()=>{const loader=new GLTFLoader();while(queue.length){const item=queue.shift();try{const model=await loader.loadAsync(`./${item.file}`);model.scene.userData.assetId=item.id;model.scene.userData.originalSource=item.source;model.scene.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=!o.isSkinnedMesh;o.userData.originalAsset=item.id;});this.models.set(item.id,model);onProgress(++completed,this.manifest.length,item.id);}catch(error){console.error('Asset load failed',item.id,error);throw Error(`${item.id} の読込に失敗しました。通信を確認して再読み込みしてください。`,{cause:error});}}};await Promise.all(Array.from({length:3},worker));}
 model(id){const value=this.models.get(id);if(!value)throw Error(`Missing original model: ${id}`);return value;}
 character(id){return clone(this.model(id).scene);}
 prop(id){return this.model(id).scene.clone(true);}
 weapon(){return this.prop('Sword');}
}
export function findNode(root,name){let found;const normalize=s=>s.replace(/[._]/g,'').toLowerCase();root.traverse(n=>{if(normalize(n.name)===normalize(name))found=n;});return found;}
