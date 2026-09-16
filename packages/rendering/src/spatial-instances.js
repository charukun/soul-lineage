/** Split static, opaque instances into local-space cells for conservative frustum culling.
 * Geometry/materials remain caller-owned. Instance transforms and source indices are exact.
 * Bounds enclose the full-size instances; later density masking may only shrink them.
 */
export function partitionStaticInstances(mesh,{THREE:T,cellSize=64,minInstances=64}={}){
 if(!T||!mesh?.isInstancedMesh||!Number.isFinite(cellSize)||cellSize<=0)throw new Error('Invalid spatial instance partition');
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 if(mesh.count<minInstances||mesh.morphTexture||materials.some(m=>m.transparent)||mesh.frustumCulled===false)return[mesh];
 const cells=new Map(),matrix=new T.Matrix4();
 for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,matrix);const key=`${Math.floor(matrix.elements[12]/cellSize)},${Math.floor(matrix.elements[14]/cellSize)}`;
  let indices=cells.get(key);if(!indices){indices=[];cells.set(key,indices);}indices.push(i);
 }
 if(cells.size<2)return[mesh];
 const chunks=[],color=new T.Color(),sourceIndices=mesh.userData.instanceSourceIndices;
 for(const[key,indices]of cells){
  const chunk=new T.InstancedMesh(mesh.geometry,mesh.material,indices.length);
  chunk.name=`${mesh.name||'StaticInstances'}:${key}`;
  chunk.position.copy(mesh.position);chunk.quaternion.copy(mesh.quaternion);chunk.scale.copy(mesh.scale);chunk.matrix.copy(mesh.matrix);
  chunk.matrixAutoUpdate=mesh.matrixAutoUpdate;chunk.matrixWorldAutoUpdate=mesh.matrixWorldAutoUpdate;chunk.matrixWorld.copy(mesh.matrixWorld);chunk.visible=mesh.visible;chunk.layers.mask=mesh.layers.mask;
  chunk.castShadow=mesh.castShadow;chunk.receiveShadow=mesh.receiveShadow;chunk.renderOrder=mesh.renderOrder;
  chunk.userData={...mesh.userData,spatialCell:key,instanceSourceId:mesh.userData.instanceSourceId??mesh.id,instanceSourceIndices:indices.map(i=>sourceIndices?.[i]??i)};
  if(mesh.userData.forestItems)chunk.userData.forestItems=indices.map(i=>mesh.userData.forestItems[i]);
  for(let i=0;i<indices.length;i++){
   mesh.getMatrixAt(indices[i],matrix);chunk.setMatrixAt(i,matrix);
   if(mesh.instanceColor){mesh.getColorAt(indices[i],color);chunk.setColorAt(i,color);}
  }
  chunk.computeBoundingBox();chunk.computeBoundingSphere();chunk.instanceMatrix.needsUpdate=true;chunks.push(chunk);
 }
 return chunks;
}

/** Preserve density selection when a former global batch is partitioned. */
export function instanceDensityIndex(mesh,index,multiplier){
 return(mesh.userData.instanceSourceIndices?.[index]??index)+(mesh.userData.instanceSourceId??mesh.id)*multiplier;
}
