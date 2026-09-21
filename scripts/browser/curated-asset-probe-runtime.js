// Browser-only specialist probe. Served by the manual Playwright harness, never an app entry.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {fetchCuratedAssetBytes} from '../../packages/assets/src/curated-library.js';

const canvas=document.createElement('canvas');document.body.append(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(256,256);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#111716');
scene.add(new THREE.HemisphereLight('#fff2d5','#4f6872',2.6));
const key=new THREE.DirectionalLight('#ffe0b5',3.2);key.position.set(-4,8,6);scene.add(key);
const fill=new THREE.DirectionalLight('#8dcbe1',1.7);fill.position.set(5,4,-5);scene.add(fill);
const camera=new THREE.PerspectiveCamera(38,1,.01,100);
const loader=new GLTFLoader();
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
let audioContext;
const finite=values=>Array.from(values).every(Number.isFinite);
const pose=root=>{
  root.updateMatrixWorld(true);const result=[];
  root.traverse(node=>{if(node.isBone)result.push(...node.matrixWorld.elements);});return result;
};
function dispose(root){
  const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.skeleton)skeletons.add(node.skeleton);
    for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}
  });
  root.removeFromParent();skeletons.forEach(item=>item.dispose());geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());
  textures.forEach(item=>{item.dispose();item.source?.data?.close?.();});
}
function render(root){
  root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root,true),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  assert(finite([...box.min,...box.max])&&!box.isEmpty(),'Invalid render bounds');
  const radius=Math.max(size.x,size.y,size.z);
  assert(radius>1e-6&&radius<1e6,'Invalid geometry scale');
  camera.near=Math.max(.001,radius/1000);camera.far=Math.max(10,radius*20);camera.updateProjectionMatrix();
  camera.position.copy(center).add(new THREE.Vector3(radius*.75,radius*.48,radius*2.1));camera.lookAt(center);
  renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(256*256*4);
  gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  assert(gl.getError()===gl.NO_ERROR,'WebGL error');
  const background=pixels.slice(0,3);let visiblePixels=0;
  for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-background[0])+Math.abs(pixels[i+1]-background[1])+Math.abs(pixels[i+2]-background[2])>14)visiblePixels++;
  assert(visiblePixels>30,'Blank model render');
  return {visiblePixels,drawCalls:renderer.info.render.calls,renderedTriangles:renderer.info.render.triangles,bounds:{min:box.min.toArray(),max:box.max.toArray()}};
}

async function verifyModel(asset){
  const bytes=await fetchCuratedAssetBytes(asset);
  const gltf=await loader.parseAsync(bytes,'');const root=gltf.scene;scene.add(root);
  const result={id:asset.id,sha256:asset.sha256,byteLength:bytes.byteLength,status:'passed',meshes:0,triangles:0,textures:0,rig:{skins:0,joints:0},animations:[]};
  const uniqueTextures=new Set();let clone=null;
  try{
    root.traverse(node=>{
      if(!node.isMesh)return;
      result.meshes++;const geometry=node.geometry,position=geometry.getAttribute('position');
      assert(position&&finite(position.array),'Nonfinite positions: '+asset.id);
      result.triangles+=(geometry.index?.count||position.count)/3;
      if(node.isSkinnedMesh){
        result.rig.skins++;result.rig.joints+=node.skeleton.bones.length;
        const index=geometry.getAttribute('skinIndex'),weight=geometry.getAttribute('skinWeight');
        assert(index&&weight&&index.count===position.count&&weight.count===position.count,'Incomplete skin attributes');
        assert(finite(weight.array)&&Array.from(index.array).every(value=>Number.isInteger(value)&&value>=0&&value<node.skeleton.bones.length),'Invalid joint weights/indices');
        assert(node.skeleton.boneInverses.every(matrix=>finite(matrix.elements)),'Nonfinite inverse bind matrices');
      }
      for(const material of Array.isArray(node.material)?node.material:[node.material])for(const value of Object.values(material))if(value?.isTexture)uniqueTextures.add(value);
    });
    for(const texture of uniqueTextures){const image=texture.source.data;assert(image&&image.width>0&&image.height>0,'Texture decode failed');assert(Math.max(image.width,image.height)<=2048,'Texture budget exceeded');}
    result.textures=uniqueTextures.size;
    assert(result.meshes>0&&result.triangles<=30000,'Geometry budget exceeded');
    Object.assign(result,render(root));
    if(asset.kind==='creature'){
      assert(result.rig.skins>0&&gltf.animations.length>0,'Native creature rig/clips missing');
      // SkeletonUtils cloning is required for independent instances of the same creature.
      clone=cloneSkeleton(root);const originalBones=new Set();root.traverse(node=>{if(node.isBone)originalBones.add(node);});
      clone.traverse(node=>{if(node.isSkinnedMesh)assert(node.skeleton.bones.every(bone=>!originalBones.has(bone)),'Cloned creature shares live source bones');});
      const mixer=new THREE.AnimationMixer(root);
      try{
        for(const clip of gltf.animations){
          assert(clip.duration>0&&Number.isFinite(clip.duration)&&clip.validate(),'Invalid native animation clip: '+clip.name);
          for(const track of clip.tracks){
            const parsed=THREE.PropertyBinding.parseTrackName(track.name);
            assert(THREE.PropertyBinding.findNode(root,parsed.nodeName),'Unbound animation track '+track.name);
            assert(finite(track.times)&&finite(track.values),'Nonfinite animation samples');
          }
          mixer.stopAllAction();const action=mixer.clipAction(clip).reset().play();
          mixer.setTime(0);const initial=pose(root);let moved=false;
          for(const fraction of [.13,.31,.53,.79]){
            mixer.setTime(clip.duration*fraction);const sample=pose(root);
            assert(sample.length===initial.length&&finite(sample),'Nonfinite animated skeleton');
            moved ||= sample.some((value,index)=>Math.abs(value-initial[index])>1e-5);
            root.traverse(node=>{if(node.isSkinnedMesh){node.skeleton.update();assert(finite(node.skeleton.boneMatrices),'Nonfinite bone palette');}});
            render(root);
          }
          assert(moved,'Native animation does not deform its bound rig: '+clip.name);
          result.animations.push({name:clip.name,duration:clip.duration,tracks:clip.tracks.length,bindingsValid:true,finite:true,moved});
          action.stop();
        }
      }finally{mixer.stopAllAction();mixer.uncacheRoot(root);}
      result.rig.independentClone=true;
    }
    Object.assign(result,render(root));
    result.thumbnail=canvas.toDataURL('image/webp',.86);
    assert(result.thumbnail.startsWith('data:image/webp;base64,'),'WebP thumbnail encode failed');
    return result;
  }finally{
    // Clones share geometry/material, but not skeleton state. Dispose their bone textures only.
    clone?.traverse(node=>{if(node.isSkinnedMesh)node.skeleton.dispose();});
    dispose(root);renderer.renderLists.dispose();
  }
}
async function verifyAudio(asset){
  const bytes=await fetchCuratedAssetBytes(asset);
  audioContext ||= new AudioContext();await audioContext.resume();
  const buffer=await audioContext.decodeAudioData(bytes.slice(0));
  assert(buffer.duration>0&&buffer.duration<=120&&buffer.numberOfChannels>0,'Invalid audio duration/channels');
  let peak=0,sum=0,count=0;
  for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const sample of buffer.getChannelData(channel)){
    assert(Number.isFinite(sample),'Nonfinite decoded audio');peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;count++;
  }
  assert(peak>0,'Silent audio asset');
  const source=audioContext.createBufferSource();const gain=audioContext.createGain();gain.gain.value=0;
  source.buffer=buffer;source.connect(gain).connect(audioContext.destination);source.start();source.stop(audioContext.currentTime+.015);
  await new Promise(resolve=>{source.onended=resolve;});source.disconnect();gain.disconnect();
  return {id:asset.id,sha256:asset.sha256,byteLength:bytes.byteLength,status:'passed',audio:{duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,peak,rms:Math.sqrt(sum/count),playbackState:audioContext.state}};
}
window.curatedAssetProbe=Object.freeze({verify:asset=>asset.kind==='audio'?verifyAudio(asset):verifyModel(asset),
  versions:()=>({three:THREE.REVISION,webgl2:renderer.getContext() instanceof WebGL2RenderingContext,userAgent:navigator.userAgent}),
  close:async()=>{await audioContext?.close();renderer.dispose();}});
