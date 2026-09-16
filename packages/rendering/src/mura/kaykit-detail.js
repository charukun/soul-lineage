import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { defs } from '@soul/world/mura';

export const KAYKIT_VILLAGE_DETAIL_SOURCE=Object.freeze({
  repository:'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',
  commit:'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
  license:'CC0-1.0',
  files:Object.freeze(['barrel_small.gltf.glb','box_small.gltf.glb','rubble_large.gltf.glb','torch_lit.gltf.glb'])
});

function shadows(root){root.traverse?.(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=true;}});return root;}

/** Shared visual-detail runtime for MURAAAAAAA / Rinne. Gameplay collision and facility IDs stay authoritative elsewhere. */
export function createKaykitVillageDetailRuntime({THREE,rootURL}){
  if(!THREE||!rootURL)throw new Error('KayKit village detail runtime requires THREE and rootURL');
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);const templates=new Map(),groups=new Set();
  const load=file=>{if(!KAYKIT_VILLAGE_DETAIL_SOURCE.files.includes(file))return Promise.reject(new Error(`Unsupported KayKit detail: ${file}`));if(!templates.has(file))templates.set(file,loader.loadAsync(`${rootURL}/${file}`).then(gltf=>{if(!gltf?.scene)throw new Error(`KayKit scene missing: ${file}`);return gltf.scene;}).catch(error=>{templates.delete(file);throw error;}));return templates.get(file);};
  function attach(host,object,index=0){
    const d=defs[object?.kind];if(!host||object?.phase!=='built'||!d?.building)return()=>{};
    const group=new THREE.Group();group.name=`KayKitDetail:${object.id}`;Object.assign(group.userData,{visualOnly:true,source:KAYKIT_VILLAGE_DETAIL_SOURCE,objectId:object.id});host.add(group);groups.add(group);
    const depth=Math.max(1.1,d.d*.5),width=Math.max(1.2,d.w*.5),plan=[
      ['torch_lit.gltf.glb',[-Math.min(2.1,width*.46),1.05,depth+.38],.85,0],
      ['barrel_small.gltf.glb',[Math.min(2.2,width*.52),0,depth+.62],.95,.15],
      [index%2?'box_small.gltf.glb':'rubble_large.gltf.glb',[Math.min(3.1,width*.68),0,-Math.max(1.3,depth*.9)],index%2?.9:.58,.55]
    ];
    for(const [file,pos,scale,rotation] of plan){void load(file).then(template=>{if(!group.parent)return;const node=shadows(template.clone(true));node.position.set(...pos);node.scale.setScalar(scale);node.rotation.y=(index*.71+rotation)%Math.PI;Object.assign(node.userData,{visualOnly:true,source:KAYKIT_VILLAGE_DETAIL_SOURCE,assetFile:file});group.add(node);}).catch(error=>{group.userData.assetError=error?.message||String(error);});}
    return()=>{groups.delete(group);group.removeFromParent();};
  }
  function dispose(){for(const group of groups)group.removeFromParent();groups.clear();templates.clear();}
  return Object.freeze({attach,dispose,source:KAYKIT_VILLAGE_DETAIL_SOURCE});
}
