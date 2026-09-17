import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { batchStaticWorldMeshes, createStaticBatchController } from '../src/static-world-batch.js';
import { createMiniatureFocus, miniatureFocusBand } from '../src/miniature-focus.js';

function staticPair(){
  const root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();
  const owners=[];
  for(const x of[-3,4]){const owner=new T.Group(),mesh=new T.Mesh(geometry,material);owner.userData.staticBatchEligible=true;owner.position.x=x;owner.add(mesh);root.add(owner);owners.push({owner,mesh});}
  root.updateMatrixWorld(true);return{root,geometry,material,owners};
}

test('static world batching consolidates exact repeats across transform owners and restores sources',()=>{
  const {root,geometry,material,owners}=staticPair(),result=batchStaticWorldMeshes(root,{minInstances:2});
  assert.equal(result.batches,1);assert.equal(result.instances,2);assert.equal(result.savedDrawCalls,1);
  const batch=root.children.find(node=>node.userData?.staticWorldBatch);assert.ok(batch?.isInstancedMesh);
  assert.equal(owners[0].mesh.visible,false);assert.equal(owners[1].mesh.visible,false);
  const matrix=new T.Matrix4();batch.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],-3);batch.getMatrixAt(1,matrix);assert.equal(matrix.elements[12],4);
  result.restore();assert.equal(owners[0].mesh.visible,true);assert.equal(owners[1].mesh.visible,true);assert.equal(root.children.some(node=>node.userData?.staticWorldBatch),false);
  geometry.dispose();material.dispose();
});

test('static world controller rebuilds only at explicit mutation boundaries',()=>{
  const {root,geometry,material,owners}=staticPair(),controller=createStaticBatchController({roots:[root]});
  const first=controller.refresh();assert.equal(first.generation,1);assert.equal(first.instances,2);assert.equal(owners[0].mesh.visible,false);
  controller.beforeMutation();assert.equal(owners[0].mesh.visible,true);owners[0].owner.position.x=9;root.updateMatrixWorld(true);
  const second=controller.refresh();assert.equal(second.generation,2);const batch=root.children.find(node=>node.userData?.staticWorldBatch),matrix=new T.Matrix4();batch.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],9);
  controller.dispose();geometry.dispose();material.dispose();
});

test('static world batching rejects transparent and non-opted owners',()=>{
  const root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial({transparent:true,opacity:.8});
  for(let i=0;i<3;i++){const owner=new T.Group();owner.userData.staticBatchEligible=i!==2;owner.add(new T.Mesh(geometry,material));root.add(owner);}
  const result=batchStaticWorldMeshes(root,{minInstances:2});assert.equal(result.batches,0);result.restore();geometry.dispose();material.dispose();
});

function fakeRenderer(){let target=null,ratio=1;return{extensions:{has:()=>true},capabilities:{maxSamples:4},info:{autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=0;this.render.triangles=0;}},calls:[],getDrawingBufferSize:v=>v.set(400*ratio,800*ratio),getPixelRatio:()=>ratio,getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},render(scene){this.calls.push({scene,target});this.info.render.calls++;}};}

test('shared miniature focus preserves custom band controls and bypasses work when strength is zero',()=>{
  const band=miniatureFocusBand({focusY:.48,clear:.12,fade:.32,strength:.7});assert.equal(band.center,.48);assert.equal(band.clear,.12);assert.equal(band.fade,.32);assert.equal(band.strength,.7);
  const renderer=fakeRenderer(),focus=createMiniatureFocus(renderer),scene=new T.Scene(),camera=new T.Camera();focus.render(scene,camera,{strength:0});assert.equal(renderer.calls.length,1);assert.equal(focus.snapshot().extraPasses,0);focus.dispose();
});
