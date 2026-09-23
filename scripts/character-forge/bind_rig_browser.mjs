/** Attach Golden Base to actual pinned-plugin weights; capture motion evidence. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {withWorkspaceBrowser,loadReconstructionModule} from './browser_workspace.mjs';
const workspace=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Workspace required');
const digest=b=>createHash('sha256').update(b).digest('hex');
const before=await readFile(join(workspace,'build/rig/meshes-before.json'));
const computed=JSON.parse(await readFile(join(workspace,'build/rig/weights.json'),'utf8'));
if(computed.meshPayloadSha256!==digest(before))throw Error('Weights belong to another frozen payload');
const motionProvenance=JSON.parse(await readFile(join(workspace,'build/rig/golden-motion-provenance.json'),'utf8'));
if(digest(await readFile(join(workspace,'build/rig/golden-motion-source.glb')))!==motionProvenance.sha256)throw Error('Animation donor bytes changed');
const out=join(workspace,'review/rig');await mkdir(out,{recursive:true});
const app=loadReconstructionModule+`
import {prepareAttachSpace,meshPayload,attachComputedRig,attachExpressionDeltas} from '/adapters/three_rig_adapter.js';
import {retargetGoldenClips,measureGoldenMixer} from '/adapters/three_animation_adapter.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
root.rotation.y=0;root.updateMatrixWorld(true);prepareAttachSpace(THREE,root);
const contract=await(await fetch('/build/rig/rig-contract.json')).json(),computed=await(await fetch('/build/rig/weights.json')).json();
const rig=attachComputedRig(THREE,root,contract,computed);
const manifest=await(await fetch('/build/morph/manifest.json')).json(),sets={};
for(const [name,row]of Object.entries(manifest.meshes))sets[name]=await(await fetch('/'+row.path)).json();
attachExpressionDeltas(THREE,rig.meshes,sets);root.updateMatrixWorld(true);rig.skeleton.update();
const donor=await new GLTFLoader().loadAsync('/build/rig/golden-motion-source.glb');
const retargeted=retargetGoldenClips(THREE,donor.animations,rig.bones);
const measured=measureGoldenMixer(THREE,root,retargeted,rig.bones);
await captureJson('mixer-gate-r1',measured);
await captureJson('animation-provenance',{donorSha256:'${motionProvenance.sha256}',mapping:retargeted.provenance});
await captureJson('meshes-after',meshPayload(root));
const helper=new THREE.SkeletonHelper(root);helper.visible=false;scene.add(helper);
const socketMarkers=new THREE.Group();socketMarkers.visible=false;scene.add(socketMarkers);
for(const [id,node]of Object.entries(rig.sockets)){const marker=new THREE.Mesh(new THREE.SphereGeometry(.014,10,8),new THREE.MeshBasicMaterial({color:0xf04692,depthTest:false}));marker.name=id;marker.userData.source=node;socketMarkers.add(marker);}
function debug(mode){helper.visible=mode==='skeleton';socketMarkers.visible=mode==='sockets';for(const mesh of rig.meshes)mesh.material.wireframe=mode==='wireframe';}
function expression(name){for(const mesh of rig.meshes)if(mesh.morphTargetInfluences){mesh.morphTargetInfluences.fill(0);if(name!=='neutral'){const index=mesh.morphTargetDictionary[name];if(index!==undefined)mesh.morphTargetInfluences[index]=1;}}}
let activeMixer;
function playClip(name,ratio){activeMixer?.stopAllAction();activeMixer?.uncacheRoot(root);for(const b of Object.values(rig.bones))b.quaternion.identity();
 const clip=retargeted.clips.find(c=>c.name===name);if(!clip)throw Error('Unknown clip '+name);
 activeMixer=new THREE.AnimationMixer(root);activeMixer.clipAction(clip).play();activeMixer.setTime(clip.duration*ratio);root.updateMatrixWorld(true);}
function stopClip(){activeMixer?.stopAllAction();activeMixer?.uncacheRoot(root);activeMixer=null;for(const b of Object.values(rig.bones))b.quaternion.identity();root.updateMatrixWorld(true);}
window.forge={draw(view){draw(view);for(const marker of socketMarkers.children)marker.position.copy(marker.userData.source.getWorldPosition(new THREE.Vector3()));renderer.render(scene,camera);},debug,expression,playClip,stopClip,async export(){
 stopClip();expression('neutral');debug('none');root.rotation.y=0;root.updateMatrixWorld(true);
 // Keep only serializable, shared-contract metadata. Live Three node graphs
 // in sculptRuntime are not glTF extras; bone/socket identity is retained.
 const saved=new Map();root.traverse(n=>{saved.set(n,n.userData);n.userData=Object.fromEntries(Object.entries(n.userData).filter(([k])=>['forgeBone','socket'].includes(k)));});
 try{const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,animations:retargeted.clips});const response=await fetch('/capture/rig/golden-neutral.glb',{method:'POST',body:glb});if(!response.ok)throw Error('GLB capture failed');return {bytes:glb.byteLength,bones:rig.skeleton.bones.length,meshes:rig.meshes.length,sockets:Object.keys(rig.sockets),clips:retargeted.clips.map(c=>c.name),mixerGateR1:measured};}finally{for(const[n,data]of saved)n.userData=data;}
}};window.ready=true;`;
const receipt=await withWorkspaceBrowser(workspace,app,async page=>{
 for(const view of ['front','side','back','front34','rear34','oppositeSide']){await page.evaluate(v=>window.forge.draw(v),view);await page.locator('canvas').screenshot({path:join(out,view+'.png')});}
 for(const mode of ['wireframe','skeleton','sockets']){await page.evaluate(m=>{window.forge.debug(m);window.forge.draw('front');},mode);await page.locator('canvas').screenshot({path:join(out,mode+'.png')});}
 await page.evaluate(()=>window.forge.debug('none'));
 for(const name of ['neutral','blink','smile','mouth-open']){await page.evaluate(n=>{window.forge.expression(n);window.forge.draw('front');},name);await page.locator('canvas').screenshot({path:join(out,'expression-'+name+'.png')});}
 await page.evaluate(()=>window.forge.expression('neutral'));
 for(const name of ['Idle','Walk','Talk','Attack','Hit','Rest']){await page.evaluate(n=>{window.forge.playClip(n,.37);window.forge.draw('front');},name);await page.locator('canvas').screenshot({path:join(out,'animation-'+name+'.png')});}
 await page.evaluate(()=>window.forge.stopClip());
 return await page.evaluate(()=>window.forge.export());
});
await writeFile(join(out,'receipt.json'),JSON.stringify({...receipt,sourceHead:process.env.HEAD_SHA,motionDonorSha256:motionProvenance.sha256,meshPayloadSha256:digest(before),status:'Actual neutral and six animation captures; other plugin gates, visual likeness and native Lab still require review'},null,2));
