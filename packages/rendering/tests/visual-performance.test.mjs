import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAdaptiveQualityGovernor, adaptiveQualityProfile } from '../src/adaptive-quality.js';
import { animationLODForDistance, createAnimationLODScheduler } from '../src/animation-lod.js';
import { installAuthoredStylizedLOD } from '../src/authored-lod.js';
import { applyStylizedShading } from '../src/stylized-shading.js';
import { estimateTextureBytes, auditTextureBudget, applyTextureQuality } from '../src/texture-quality.js';
import { createWorldCellStreamingPlan, createVisualDistanceStreamer } from '../src/world-streaming.js';

test('adaptive quality degrades under sustained slow frames and can recover', () => {
  const governor=createAdaptiveQualityGovernor({targetFps:60,degradeFrames:3,recoverFrames:4,cooldownFrames:0});
  for(let i=0;i<8;i++)governor.observeFrame(1/25); assert.ok(governor.snapshot().level>=1);
  for(let i=0;i<80;i++)governor.observeFrame(1/90); assert.equal(governor.snapshot().level,0);
  const rows=[0,1,2,3].map(adaptiveQualityProfile);for(let i=1;i<rows.length;i++)assert.ok(rows[i].renderScale<rows[i-1].renderScale);
});

test('animation LOD preserves hero motion and throttles distant population work', () => {
  assert.equal(animationLODForDistance(999,{hero:true}).hz,60);assert.equal(animationLODForDistance(100).hz,8);
  const scheduler=createAnimationLODScheduler();scheduler.update(1/60,100,0);let samples=0;for(let i=0;i<6;i++)if(scheduler.update(1/60,100,0).shouldSample)samples++;assert.ok(samples<3);
});

test('authored LOD convention selects LOD1/LOD2 before proxy fallback', () => {
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
  const lod0=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),material);lod0.name='house_LOD0';
  const lod1=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),material);lod1.name='house_LOD1';
  const lod2=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);lod2.name='house_LOD2';root.add(lod0,lod1,lod2);
  assert.equal(installAuthoredStylizedLOD(root,'environment').authored,1);
  const camera=new THREE.PerspectiveCamera();camera.position.z=70;camera.updateMatrixWorld(true);root.updateMatrixWorld(true);lod0.onBeforeRender(null,null,camera,lod0.geometry,lod0.material,null);assert.equal(lod0.userData.stylizedLOD.current,'lod1');
  camera.position.z=140;camera.updateMatrixWorld(true);lod0.onBeforeRender(null,null,camera,lod0.geometry,lod0.material,null);assert.equal(lod0.userData.stylizedLOD.current,'lod2');
});

test('stylized shading installs a stable rim hook once',()=>{const material=new THREE.MeshStandardMaterial(),root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));assert.equal(applyStylizedShading(root,'hero').materials,1);assert.equal(applyStylizedShading(root,'hero').materials,0);assert.match(material.customProgramCacheKey(),/soul-rim:hero/);});

test('texture quality estimates memory and lowers anisotropy',()=>{const texture=new THREE.Texture({width:1024,height:512});texture.generateMipmaps=true;const material=new THREE.MeshStandardMaterial({map:texture}),root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));assert.equal(estimateTextureBytes(texture),Math.ceil(1024*512*4*4/3));assert.equal(auditTextureBudget(root).count,1);applyTextureQuality(root,{anisotropy:2});assert.equal(texture.anisotropy,2);});

test('world streaming plans cells and visual distance culling preserves critical roots',()=>{const plan=createWorldCellStreamingPlan({cellSize:10,preloadRadius:0,retainRadius:1});assert.deepEqual(plan.update(1,1).load,['0,0']);assert.ok(plan.update(35,1).unload.includes('0,0'));const root=new THREE.Group(),near=new THREE.Group(),far=new THREE.Group(),critical=new THREE.Group();near.position.x=5;far.position.x=200;critical.position.x=200;critical.userData.streamingCritical=true;root.add(near,far,critical);const result=createVisualDistanceStreamer({baseDistance:100}).update(root,{x:0,z:0},1);assert.equal(near.visible,true);assert.equal(far.visible,false);assert.equal(critical.visible,true);assert.equal(result.hidden,1);});
