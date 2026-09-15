import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShaderWarmupManager } from '../src/shader-warmup.js';
import { createResourceLifetimeManager, createResourceLeakSentinel, markLifetimeOwned } from '../src/resource-lifetime.js';
import { installWebGLContextRecovery } from '../src/context-recovery.js';
import { createStylizedLightProbe, applyAuthoredBakedLighting } from '../src/baked-lighting.js';
import { installSilhouetteImpostorLOD } from '../src/impostor-lod.js';
import { createThermalTrendGovernor } from '../src/thermal-governor.js';
import { applyVisualQualityFloor, markVisualQualityPriority } from '../src/visual-quality-floor.js';

test('shader warmup compiles hidden variants and restores presentation flags', async () => {
  const material = { uuid:'m1' };
  const child = { material, visible:false, frustumCulled:true, traverse(fn){fn(this);} };
  const scene = { traverse(fn){fn(this); child.traverse(fn);} };
  const renderer = { calls:0, async compileAsync(){this.calls++;} };
  const warmup=createShaderWarmupManager(renderer,{maxVariants:4});
  warmup.registerPass('main',scene,{}, {exposeRoots:[child]});
  const result=await warmup.warmup('test');
  assert.equal(renderer.calls,1); assert.equal(result.compiledVariants,1);
  assert.equal(child.visible,false); assert.equal(child.frustumCulled,true);
});

test('resource lifetime disposes only explicitly-owned resources at final release',()=>{
  let disposed=0;const resource=markLifetimeOwned({userData:{},dispose(){disposed++;}},'test');
  const manager=createResourceLifetimeManager();manager.retain('a',resource);manager.retain('b',resource);
  manager.release('a');assert.equal(disposed,0);manager.release('b');assert.equal(disposed,1);
});

test('resource leak sentinel compares repeated stable-scene renderer memory',()=>{
  const renderer={info:{memory:{geometries:10,textures:4},programs:[1,2]}};
  const gate=createResourceLeakSentinel({renderer,warmupSamples:1,limits:{maxGeometryGrowth:2,maxTextureGrowth:1,maxProgramGrowth:1}});
  assert.equal(gate.observe('same').pass,true);
  renderer.info.memory.geometries=14;
  assert.equal(gate.observe('same').pass,false);
  assert.equal(gate.snapshot().errors[0].metric,'geometries');
});

test('context recovery preserves app state boundary and runs restore callback',async()=>{
  const listeners=new Map(),canvas={dataset:{},addEventListener(k,fn){listeners.set(k,fn);},removeEventListener(k){listeners.delete(k);}};
  const renderer={shadowMap:{needsUpdate:false}};let restored=0,prevented=0;
  const recovery=installWebGLContextRecovery({canvas,renderer,onRestore:async()=>{restored++;}});
  listeners.get('webglcontextlost')({preventDefault(){prevented++;}});assert.equal(recovery.snapshot().state,'lost');
  listeners.get('webglcontextrestored')({});await recovery.settled();
  assert.equal(prevented,1);assert.equal(restored,1);assert.equal(recovery.snapshot().state,'ready');assert.equal(renderer.shadowMap.needsUpdate,true);
  recovery.dispose();
});

test('stylized light probe and authored baked-lighting hints stay PBR-compatible',()=>{
  const probe=createStylizedLightProbe();assert.equal(probe.isLightProbe,true);
  const material=new THREE.MeshStandardMaterial();material.lightMap=new THREE.Texture();material.aoMap=new THREE.Texture();
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
  const audit=applyAuthoredBakedLighting(root,{lightMapIntensity:.7,aoMapIntensity:.5});
  assert.equal(audit.lightMapped,1);assert.equal(audit.aoMapped,1);assert.equal(material.lightMapIntensity,.7);assert.equal(material.userData.soulBakedLighting,true);
});

function fakeCanvas(){return{width:0,height:0,getContext(){return{clearRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},set fillStyle(v){this._fill=v;},get fillStyle(){return this._fill;}};}};}

test('far static groups switch to silhouette impostor and restore source visibility',()=>{
  const root=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,6,3),new THREE.MeshBasicMaterial({color:0x78906a}));root.add(mesh);
  const controller=installSilhouetteImpostorLOD(root,{distance:10,views:8,size:32,canvasFactory:fakeCanvas});
  assert.ok(controller);const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,30);camera.updateMatrixWorld(true);root.updateMatrixWorld(true);
  controller.update(camera);assert.equal(mesh.visible,false);assert.equal(controller.sprite.visible,true);
  camera.position.set(0,0,2);camera.updateMatrixWorld(true);controller.update(camera);assert.equal(mesh.visible,true);assert.equal(controller.sprite.visible,false);
  controller.dispose();mesh.geometry.dispose();mesh.material.dispose();
});

test('thermal trend governor infers sustained degradation without claiming temperature',()=>{
  const thermal=createThermalTrendGovernor({sampleEverySeconds:1,baselineSamples:3,windowSamples:4,warmRatio:1.1,hotRatio:1.25,recoverRatio:1.05,confirmations:2});
  for(let i=0;i<3;i++)thermal.observe(1,16,10);
  assert.equal(thermal.snapshot().inferred,true);assert.equal(thermal.snapshot().state,'stable');
  for(let i=0;i<5;i++)thermal.observe(1,24,18);
  assert.ok(thermal.snapshot().recommendedMinLevel>=1);
});

test('visual quality floor keeps hero and enemy readability above survival settings',()=>{
  const low={vfxScale:.3,textureAnisotropy:1};
  const hero=applyVisualQualityFloor(low,'hero'),enemy=applyVisualQualityFloor(low,'enemy');
  assert.ok(hero.vfxScale>=.88);assert.ok(hero.textureAnisotropy>=4);assert.ok(enemy.vfxScale>=.74);
  const root=new THREE.Group();root.add(new THREE.Object3D());markVisualQualityPriority(root,'hero');
  root.traverse(node=>{assert.equal(node.userData.occlusionDisabled,true);assert.equal(node.userData.impostorDisabled,true);});
});
