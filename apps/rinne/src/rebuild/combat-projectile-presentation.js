import {applyStylizedShading} from '@soul/rendering/stylized-shading';
export function createCombatProjectilePresentation({THREE,frontRoot,mat}){
  const root=new THREE.Group();root.name='CombatProjectiles';frontRoot.add(root);const meshes=new Map();
  function make(id){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),mat(0xa9e8f0,{emissive:0x4b9dab,emissiveIntensity:1.1,roughness:.35,metalness:.05}));mesh.name=`CombatProjectile:${id}`;applyStylizedShading(mesh,'prop');root.add(mesh);meshes.set(id,mesh);return mesh;}
  function rows(actor){return(actor?.rangedCombat?.projectiles||[]).map(row=>({...row,ownerId:actor.id}));}
  function sync(life,peers=[]){const active=life?.zone==='frontier'?[...rows(life),...peers.filter(peer=>peer.zone==='frontier'&&peer.front===life.front).flatMap(rows)]:[],ids=new Set();for(const row of active){const id=`${row.ownerId}:${row.id}`;ids.add(id);const mesh=meshes.get(id)||make(id);mesh.position.set(Number(row.x)||0,1.12,Number(row.z)||0);mesh.visible=true;}for(const [id,mesh]of meshes)if(!ids.has(id)){mesh.removeFromParent();mesh.geometry?.dispose?.();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material?.dispose?.();meshes.delete(id);}}
  function dispose(){for(const mesh of meshes.values()){mesh.removeFromParent();mesh.geometry?.dispose?.();for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material?.dispose?.();}meshes.clear();root.removeFromParent();}
  return{sync,dispose};
}
