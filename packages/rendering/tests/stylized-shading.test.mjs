import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyStylizedShading,
  createStylizedShadingController,
  stylizedShadingProfile
} from '../src/stylized-shading.js';

test('RINNE toon shader installs banded light, ink contour and rim uniforms',()=>{
  const material=new THREE.MeshStandardMaterial({color:0xc59a7b});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),material);
  const root=new THREE.Group();root.add(mesh);
  const result=applyStylizedShading(root,'hero');
  assert.equal(result.shaderModel,'rinne-banded-toon-v2');
  assert.equal(result.materials,1);
  assert.equal(material.userData.soulStylizedShader.profileId,'hero');
  const shader={uniforms:{},fragmentShader:'#include <lights_fragment_end>'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.soulToonBands.value,3);
  assert.equal(shader.uniforms.soulToonStrength.value,stylizedShadingProfile('hero').toonStrength);
  assert.match(shader.fragmentShader,/soulBandLuma/);
  assert.match(shader.fragmentShader,/soulInkKeep/);
  assert.match(shader.fragmentShader,/soulRim/);
  mesh.geometry.dispose();material.dispose();
});

test('character profiles stay more graphic than the environment',()=>{
  const hero=stylizedShadingProfile('hero'),world=stylizedShadingProfile('environment');
  assert.ok(hero.toonStrength>world.toonStrength);
  assert.ok(hero.inkStrength>world.inkStrength);
  assert.ok(hero.rimStrength>world.rimStrength);
  assert.ok(hero.bands<=world.bands);
});

test('inspiration pulse changes render uniforms without recompiling materials',()=>{
  const material=new THREE.MeshStandardMaterial();
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  applyStylizedShading(root,'npc');
  const shader={uniforms:{},fragmentShader:'#include <lights_fragment_end>'};
  material.onBeforeCompile(shader);
  const compileHook=material.onBeforeCompile,controller=createStylizedShadingController(root,{hold:.05,release:.2});
  const pulse=controller.pulse(.9);
  assert.equal(pulse.materials,1);
  assert.equal(shader.uniforms.soulInspiration.value,.9);
  controller.update(.1);
  assert.ok(shader.uniforms.soulInspiration.value>0&&shader.uniforms.soulInspiration.value<.9);
  controller.update(.1);controller.update(.1);controller.update(.1);
  assert.equal(shader.uniforms.soulInspiration.value,0);
  assert.equal(material.onBeforeCompile,compileHook);
  assert.equal(controller.snapshot().pulses,1);
  controller.dispose();root.children[0].geometry.dispose();material.dispose();
});


test('material clones reinstall the shader hook instead of trusting cloned userData',()=>{
  const source=new THREE.MeshStandardMaterial();
  const sourceRoot=new THREE.Group();sourceRoot.add(new THREE.Mesh(new THREE.BoxGeometry(),source));
  applyStylizedShading(sourceRoot,'hero');
  const clone=source.clone();
  assert.equal(clone.userData.soulStylizedShader.profileId,'hero');
  const cloneRoot=new THREE.Group();cloneRoot.add(new THREE.Mesh(new THREE.BoxGeometry(),clone));
  const result=applyStylizedShading(cloneRoot,'npc');
  assert.equal(result.materials,1);
  const shader={uniforms:{},fragmentShader:'#include <lights_fragment_end>'};
  clone.onBeforeCompile(shader);
  assert.equal(shader.uniforms.soulToonBands.value,stylizedShadingProfile('npc').bands);
  assert.equal(shader.uniforms.soulToonStrength.value,stylizedShadingProfile('npc').toonStrength);
  assert.match(shader.fragmentShader,/soulInkKeep/);
  sourceRoot.children[0].geometry.dispose();cloneRoot.children[0].geometry.dispose();source.dispose();clone.dispose();
});

test('reapplying a different role updates live toon uniforms without stacking hooks',()=>{
  const material=new THREE.MeshStandardMaterial();
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  applyStylizedShading(root,'hero');
  const hook=material.onBeforeCompile,shader={uniforms:{},fragmentShader:'#include <lights_fragment_end>'};
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.soulToonBands.value,stylizedShadingProfile('hero').bands);
  const changed=applyStylizedShading(root,'environment');
  assert.equal(changed.materials,0);
  assert.equal(material.onBeforeCompile,hook);
  assert.equal(shader.uniforms.soulToonBands.value,stylizedShadingProfile('environment').bands);
  assert.equal(shader.uniforms.soulInkStrength.value,stylizedShadingProfile('environment').inkStrength);
  assert.equal(material.userData.soulStylizedShader.profileId,'environment');
  root.children[0].geometry.dispose();material.dispose();
});
