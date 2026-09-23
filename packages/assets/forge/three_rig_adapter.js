/** RINNE attachment/serialization boundary for pinned-plugin computed weights.
 * The plugin owns weight generation and all gates. This module never computes
 * replacement weights or reshapes the reference to a stock skeleton.
 */
export function meshPayload(root){
  const meshes=[];
  root.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material.opacity!==0){
    const geometry=mesh.geometry,attributes={};
    for(const name of ['position','normal','uv','skinIndex','skinWeight'])if(geometry.attributes[name])attributes[name]=Array.from(geometry.attributes[name].array);
    meshes.push({name:mesh.name,attributes,index:geometry.index?Array.from(geometry.index.array):null});
  }});
  return {meshes};
}

/** Run BEFORE the upstream freeze; preserve world-space appearance and topology. */
export function prepareAttachSpace(THREE,root){
  root.updateMatrixWorld(true);
  if(!root.matrixWorld.equals(new THREE.Matrix4()))throw Error('Reconstruction root must be identity before attachment preparation');
  const meshes=[];root.traverse(n=>{if(n.isMesh&&n.visible&&n.material.opacity!==0)meshes.push(n);});
  const metrics={meshes:meshes.length,maxPositionRoundingDelta:0,authority:'Three geometry transform only, before upstream freeze'};
  for(const mesh of meshes){
    if(mesh.isSkinnedMesh||mesh.geometry.userData.attachPrepared)throw Error('Refusing to re-prepare/bake an existing rig');
    if(mesh.children.length)throw Error('Attachment preparation requires leaf meshes');
    const geometry=mesh.geometry.clone(),matrix=mesh.matrixWorld.clone(),position=geometry.attributes.position,expected=new THREE.Vector3();
    geometry.applyMatrix4(matrix);
    for(let i=0;i<position.count;i++){
      expected.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);
      metrics.maxPositionRoundingDelta=Math.max(metrics.maxPositionRoundingDelta,expected.distanceTo(new THREE.Vector3().fromBufferAttribute(position,i)));
    }
    geometry.userData.attachPrepared=true;mesh.geometry=geometry;root.add(mesh);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);mesh.updateMatrixWorld(true);
  }
  return metrics;
}

export function attachComputedRig(THREE,root,contract,computed){
  if(computed.boneOrder.join('|')!==contract.bones.map(b=>b.id).join('|'))throw Error('Weight joint order differs from authored rig');
  root.updateMatrixWorld(true);const identity=new THREE.Matrix4();
  if(!root.matrixWorld.equals(identity))throw Error('Bind root must be identity');
  const originals=[];root.traverse(mesh=>{if(mesh.isMesh&&mesh.visible&&mesh.material.opacity!==0)originals.push(mesh);});
  if(originals.length!==Object.keys(computed.meshes).length)throw Error('Computed binding does not cover the frozen mesh set');
  const bones={},byId=new Map(contract.bones.map(b=>[b.id,b]));
  for(const row of contract.bones){
    if(row.parent&&!bones[row.parent])throw Error('Rig contract must order parents before children');
    const bone=new THREE.Bone();bone.name=row.id;bone.userData.forgeBone=row.id;
    const parent=row.parent?byId.get(row.parent).jointPos:[0,0,0];bone.position.fromArray(row.jointPos.map((v,i)=>v-parent[i]));
    (row.parent?bones[row.parent]:root).add(bone);bones[row.id]=bone;
  }
  root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(computed.boneOrder.map(id=>bones[id])),meshes=[];
  for(const mesh of originals){
    if(mesh.isSkinnedMesh||!mesh.matrixWorld.equals(identity))throw Error('Frozen attachment geometry must be unbound and in model space');
    const row=computed.meshes[mesh.name],count=mesh.geometry.attributes.position.count;
    if(!row||row.skinIndex.length!==count*4||row.skinWeight.length!==count*4)throw Error('Missing/misaligned actual skin buffers for '+mesh.name);
    mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(row.skinIndex,4));mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(row.skinWeight,4));
    const bound=new THREE.SkinnedMesh(mesh.geometry,mesh.material);bound.name=mesh.name;bound.bindMode=THREE.AttachedBindMode;root.add(bound);bound.bind(skeleton,identity);bound.frustumCulled=false;mesh.removeFromParent();meshes.push(bound);
  }
  const sockets={};
  for(const [name,row] of Object.entries(contract.sockets.definitions)){
    if(!bones[row.bone])throw Error('Socket joint missing: '+row.bone);
    const socket=new THREE.Object3D();socket.name='socket_'+name;socket.userData.socket=name;socket.position.fromArray(row.offset);bones[row.bone].add(socket);sockets[name]=socket;
  }
  root.updateMatrixWorld(true);skeleton.update();return {bones,skeleton,meshes,sockets};
}

export function attachExpressionDeltas(THREE,meshes,morphSets){
  for(const mesh of meshes){
    const set=morphSets[mesh.name];if(!set)continue;
    if(set.vertexCount!==mesh.geometry.attributes.position.count||set.morphTargetsRelative!==true||set.noOpTargets.length)throw Error('Upstream morph set does not correspond to the frozen mesh');
    mesh.geometry.morphAttributes.position=set.targets.map(target=>{
      const attribute=new THREE.Float32BufferAttribute(target.deltas.flat(),3);attribute.name=target.name;return attribute;
    });
    mesh.geometry.morphTargetsRelative=true;mesh.updateMorphTargets();mesh.morphTargetInfluences.fill(0);
  }
}
