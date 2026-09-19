import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
export const WORLD_ASSETS=['road','crypt-large','crypt-large-roof','crypt-large-door','pillar-obelisk','column-large','cross-column','altar-stone','candle-multiple','fire-basket','gravestone-bevel','gravestone-cross-large','gravestone-decorative','gravestone-broken','iron-fence','iron-fence-damaged','iron-fence-border-column','pine','pine-crooked','pine-fall','rocks','rocks-tall','trunk-long','debris','lantern-glass'];
export const CHARACTER_ASSETS=['Characters_Captain_Barbarossa','Characters_Anne','Characters_Henry','Characters_Skeleton','Characters_Skeleton_Headless','Characters_Sharky','Characters_Tentacle'];
export class Assets {
  constructor(){this.models=new Map();this.manifest=null;this.loaded=0;this.total=0;}
  async load(onProgress){
    const response=await fetch('assets-manifest.json');if(!response.ok)throw Error('素材記録を取得できませんでした');this.manifest=await response.json();
    if(this.manifest.generatedModels!==0)throw Error('3D素材ポリシーに一致しません');
    const keys=[...WORLD_ASSETS.map(n=>'graveyard/'+n),...CHARACTER_ASSETS.map(n=>'pirate/'+n),'pirate/Environment_Cliff1','pirate/Environment_Rock_2','pirate/Environment_LargeBones','pirate/Prop_Chest_Closed'];
    this.total=keys.length;const loader=new GLTFLoader();let cursor=0;
    const worker=async()=>{while(cursor<keys.length){const key=keys[cursor++],record=this.manifest.models[key];if(!record)throw Error('素材が見つかりません: '+key);const gltf=await loader.loadAsync(record.url);gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=!o.isSkinnedMesh;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.map)m.map.anisotropy=4;m.roughness=.84;m.metalness=0;}}});this.models.set(key,gltf);this.loaded++;onProgress(this.loaded/this.total,key);}};
    await Promise.all(Array.from({length:4},worker));
  }
  instance(key){const source=this.models.get(key);if(!source)throw Error('未読込の素材: '+key);return clone(source.scene);}
  bounds(key){return new THREE.Box3().setFromObject(this.models.get(key).scene);}
}
