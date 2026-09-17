import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {miniatureFocusBudget,miniatureFocusBand,createMiniatureFocus} from '../src/rebuild/miniature-focus.js';
import {createMiniatureLighting,createActorContactShadows} from '../src/rebuild/miniature-lighting.js';

test('focus uses bounded low-res work and preserves a wide playable band',()=>{
  const full=miniatureFocusBudget(0,800,1200),mobile=miniatureFocusBudget(2,800,1200),off=miniatureFocusBudget(3,800,1200);
  assert.equal(full.width*full.height,800*1200/4);assert.equal(full.taps,9);
  assert.ok(mobile.width*mobile.height<full.width*full.height);assert.equal(mobile.taps,5);assert.equal(off.enabled,false);
  assert.equal(miniatureFocusBudget(0,3840,2160).enabled,false,'large HDR buffers must respect the pixel budget');
  for(const focusY of[.1,.5,.9])for(const combat of[false,true]){
    const band=miniatureFocusBand({focusY,combat});assert.ok(band.center>=.25&&band.center<=.75);assert.ok(band.clear>=.2);
    if(combat)assert.ok(band.clear>.3&&band.strength<.5);
  }
});

function fakeRenderer(supported=true){
  let target=null,ratio=1;
  return{extensions:{has:()=>supported},capabilities:{maxSamples:4},info:{autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=0;this.render.triangles=0;}},calls:[],
    getDrawingBufferSize:v=>v.set(400*ratio,800*ratio),getPixelRatio:()=>ratio,setPixelRatio:r=>{ratio=r;},getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},
    render(scene){this.calls.push({scene,target});this.info.render.calls++;}};
}

test('focus reuses targets, preserves renderer state, and bypasses unsupported/pressured devices',()=>{
  const renderer=fakeRenderer(),focus=createMiniatureFocus(renderer),scene=new T.Scene(),camera=new T.Camera(),external=new T.WebGLRenderTarget(4,4);
  renderer.setRenderTarget(external);focus.render(scene,camera,{});const first=renderer.calls.slice();
  assert.equal(first.length,3);assert.equal(first.filter(row=>row.scene===scene).length,1);assert.equal(renderer.getRenderTarget(),external);assert.equal(renderer.info.autoReset,true);
  renderer.calls.length=0;focus.render(scene,camera,{});assert.equal(renderer.calls[0].target,first[0].target);assert.equal(renderer.calls[1].target,first[1].target);
  renderer.setPixelRatio(1.5);focus.resize();assert.deepEqual(focus.snapshot().sceneSize,[600,1200]);assert.deepEqual(focus.snapshot().blurSize,[300,600]);
  focus.setLevel(3);renderer.calls.length=0;focus.render(scene,camera,{});assert.equal(renderer.calls.length,1);assert.equal(renderer.calls[0].target,external);
  focus.setLevel(0);renderer.render=()=>{throw Error('render interrupted');};assert.throws(()=>focus.render(scene,camera,{}),/render interrupted/);assert.equal(renderer.getRenderTarget(),external);assert.equal(renderer.info.autoReset,true);
  focus.dispose();focus.dispose();external.dispose();
  const fallbackRenderer=fakeRenderer(false),fallback=createMiniatureFocus(fallbackRenderer);fallback.render(scene,camera,{});assert.equal(fallbackRenderer.calls.length,1);assert.equal(fallback.snapshot().enabled,false);fallback.dispose();
});

test('cached sun excludes dynamic actors and refreshes only on region/visibility transitions',()=>{
  const scene=new T.Scene(),staticRoot=new T.Group(),building=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());staticRoot.add(building);scene.add(staticRoot);
  const renderer={shadowMap:{}},lighting=createMiniatureLighting({renderer,scene,staticRoots:[staticRoot]});
  const actor=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());actor.castShadow=true;scene.add(actor);
  lighting.update({x:0,z:0});assert.equal(actor.castShadow,false);assert.equal(building.castShadow,true);
  const sun=scene.children.find(node=>node.isDirectionalLight);sun.shadow.needsUpdate=false;const n=lighting.snapshot().shadowUpdates;
  for(let i=0;i<120;i++)lighting.update({x:1,z:2});assert.equal(lighting.snapshot().shadowUpdates,n);assert.equal(sun.shadow.needsUpdate,false);
  lighting.update({x:30,z:2});assert.equal(lighting.snapshot().shadowUpdates,n+1);
  lighting.update({x:30,z:2,inside:true});assert.equal(sun.castShadow,false);
  lighting.update({x:30,z:2});assert.equal(sun.castShadow,true);assert.equal(lighting.snapshot().shadowUpdates,n+2);
  lighting.update({level:2});assert.equal(sun.castShadow,false);lighting.dispose();
  building.geometry.dispose();building.material.dispose();actor.geometry.dispose();actor.material.dispose();
});

test('contact marks follow active grounded actors without leaving trails or cross-zone ghosts',()=>{
  const scene=new T.Scene(),front=new T.Group(),actor=new T.Group(),carried=new T.Group();
  actor.userData.characterModel='real-runtime';carried.userData.characterModel='real-runtime';carried.position.y=1;scene.add(actor,carried,front);
  const enemy=new T.Group();enemy.userData.characterModel='enemy';front.add(enemy);front.visible=false;
  const contacts=createActorContactShadows(scene,[scene,front],{capacity:4});contacts.update();assert.equal(contacts.snapshot().instances,1);
  actor.position.set(4,0,7);contacts.update();const mesh=scene.getObjectByName('ActorContactShadows'),matrix=new T.Matrix4();mesh.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],4);assert.equal(matrix.elements[14],7);
  actor.visible=false;front.visible=true;contacts.update();assert.equal(contacts.snapshot().instances,1);mesh.getMatrixAt(0,matrix);assert.equal(matrix.elements[12],0);
  front.visible=false;contacts.update();assert.equal(contacts.snapshot().instances,0);contacts.dispose();assert.equal(scene.getObjectByName('ActorContactShadows'),undefined);
});
