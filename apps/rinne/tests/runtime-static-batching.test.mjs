import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createMiniatureLighting } from '../src/rebuild/miniature-lighting.js';

test('Rinne batches only caller-declared static scenery across cloned owners',()=>{
  const scene=new T.Scene(),root=new T.Group(),geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial();scene.add(root);
  for(const x of[-4,5]){const owner=new T.Group(),mesh=new T.Mesh(geometry,material);owner.position.x=x;owner.add(mesh);root.add(owner);}
  const lighting=createMiniatureLighting({renderer:{shadowMap:{}},scene,staticRoots:[root]});
  assert.equal(lighting.snapshot().staticBatch.instances,2);assert.ok(root.children.some(node=>node.userData?.staticWorldBatch));
  const leaves=[];root.traverse(node=>{if(node.isMesh&&!node.isInstancedMesh)leaves.push(node);});assert.ok(leaves.every(node=>node.visible===false));
  lighting.dispose();assert.ok(leaves.every(node=>node.visible===true));geometry.dispose();material.dispose();
});
