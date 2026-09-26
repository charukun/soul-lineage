import {applyStylizedShading} from '@soul/rendering/stylized-shading';
export function createCombatTerrainPresentation({THREE,frontRoot,mat}){
  const root=new THREE.Group();root.name='CombatTerrain';frontRoot.add(root);let key='';
  function clear(){for(const child of [...root.children]){child.removeFromParent();child.geometry?.dispose?.();for(const material of Array.isArray(child.material)?child.material:[child.material])material?.dispose?.();}}
  function sync(front){const rows=front?.terrain?.obstacles||[],next=`${front?.stage??'none'}:${rows.map(r=>`${r.id}:${r.x}:${r.z}:${r.w}:${r.d}:${r.h}`).join('|')}`;if(next===key)return;key=next;clear();for(const row of rows){const geometry=new THREE.BoxGeometry(row.w,row.h,row.d),material=mat(row.h<.8?0x756a70:0x655d70,{roughness:.9,metalness:0}),mesh=new THREE.Mesh(geometry,material);mesh.name=`CombatCover:${row.id}`;mesh.position.set(row.x,row.h/2,row.z);mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.combatObstacleId=row.id;applyStylizedShading(mesh,'environment');root.add(mesh);}}
  function dispose(){clear();root.removeFromParent();}
  return{sync,dispose};
}
