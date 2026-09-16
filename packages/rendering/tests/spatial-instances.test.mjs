import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {partitionStaticInstances,instanceDensityIndex} from '../src/spatial-instances.js';

function fixture(){
 const mesh=new T.InstancedMesh(new T.BoxGeometry(3,8,3),new T.MeshStandardMaterial(),256),m=new T.Matrix4();
 mesh.position.set(3,0,-2);mesh.rotation.y=.12;mesh.castShadow=true;mesh.receiveShadow=true;
 mesh.userData.forestItems=[];
 for(let i=0;i<mesh.count;i++){
  const x=(i%16-8)*12,z=(Math.floor(i/16)-8)*12;
  m.makeRotationY(i*.1);m.setPosition(x,0,z);mesh.setMatrixAt(i,m);mesh.setColorAt(i,new T.Color(i/256,.4,.7));mesh.userData.forestItems.push({x,z,s:1,yaw:i*.1});
 }
 mesh.computeBoundingSphere();mesh.updateMatrixWorld(true);return mesh;
}
test('spatial batches preserve transforms, colors, density selection and shared resource ownership',()=>{
 const source=fixture(),chunks=partitionStaticInstances(source,{THREE:T,cellSize:32}),seen=new Set(),a=new T.Matrix4(),b=new T.Matrix4(),ca=new T.Color(),cb=new T.Color();
 assert.ok(chunks.length>1);assert.equal(chunks.reduce((sum,m)=>sum+m.count,0),source.count);
 for(const chunk of chunks){assert.equal(chunk.geometry,source.geometry);assert.equal(chunk.material,source.material);assert.equal(chunk.castShadow,true);assert.deepEqual(chunk.position.toArray(),source.position.toArray());
  for(let i=0;i<chunk.count;i++){const index=chunk.userData.instanceSourceIndices[i];assert.ok(!seen.has(index));seen.add(index);source.getMatrixAt(index,a);chunk.getMatrixAt(i,b);assert.deepEqual(b.elements,a.elements);source.getColorAt(index,ca);chunk.getColorAt(i,cb);assert.deepEqual(ca,cb);assert.equal(chunk.userData.forestItems[i],source.userData.forestItems[index]);for(const multiplier of[17,31])assert.equal(instanceDensityIndex(chunk,i,multiplier),index+source.id*multiplier);}
 }
 let disposed=0;source.geometry.addEventListener('dispose',()=>disposed++);source.material.addEventListener('dispose',()=>disposed++);source.dispose();for(const c of chunks)c.dispose();assert.equal(disposed,0);
});
test('cell bounds cull most distant instances without dropping an intersecting source instance',()=>{
 const source=fixture(),chunks=partitionStaticInstances(source,{THREE:T,cellSize:32});
 const camera=new T.PerspectiveCamera(43,412/915,.08,650);camera.position.set(10.5,12.65,14.5);camera.lookAt(0,1.15,0);camera.updateMatrixWorld();
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const visibleIndices=new Set(),m=new T.Matrix4(),box=new T.Box3();source.geometry.computeBoundingBox();
 for(const chunk of chunks){chunk.updateMatrixWorld(true);if(frustum.intersectsObject(chunk))for(const index of chunk.userData.instanceSourceIndices)visibleIndices.add(index);}
 assert.ok(frustum.intersectsObject(source));assert.ok(visibleIndices.size<source.count*.6);
 for(let i=0;i<source.count;i++){source.getMatrixAt(i,m);m.premultiply(source.matrixWorld);box.copy(source.geometry.boundingBox).applyMatrix4(m);if(frustum.intersectsBox(box))assert.ok(visibleIndices.has(i),`visible instance ${i} lost`);}
 // Density hides and restores instances without tightening the conservative full-size bounds.
 const chunk=chunks[0],bounds=chunk.boundingSphere.clone(),original=new T.Matrix4();chunk.getMatrixAt(0,original);chunk.setMatrixAt(0,new T.Matrix4().makeScale(0,0,0));chunk.setMatrixAt(0,original);assert.deepEqual(chunk.boundingSphere,bounds);
});
test('transparent, morphing, explicitly unculled and small batches keep their original path',()=>{
 const mesh=fixture();mesh.material.transparent=true;assert.deepEqual(partitionStaticInstances(mesh,{THREE:T}),[mesh]);mesh.material.transparent=false;
 mesh.morphTexture={};assert.deepEqual(partitionStaticInstances(mesh,{THREE:T}),[mesh]);mesh.morphTexture=null;mesh.frustumCulled=false;assert.deepEqual(partitionStaticInstances(mesh,{THREE:T}),[mesh]);mesh.frustumCulled=true;mesh.count=2;assert.deepEqual(partitionStaticInstances(mesh,{THREE:T}),[mesh]);
});
