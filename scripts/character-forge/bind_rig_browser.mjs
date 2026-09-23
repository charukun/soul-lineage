// UNVALIDATED PREPARATION: preserved at user-requested pause; not executed on Scout.
/** Attach actual pinned-plugin weights; capture neutral parity and expressions. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {withWorkspaceBrowser,loadReconstructionModule} from './browser_workspace.mjs';
const workspace=resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Workspace required');
const digest=b=>createHash('sha256').update(b).digest('hex');
const before=await readFile(join(workspace,'build/rig/meshes-before.json'));
const computed=JSON.parse(await readFile(join(workspace,'build/rig/weights.json'),'utf8'));
if(computed.meshPayloadSha256!==digest(before))throw Error('Weights belong to another frozen payload');
const out=join(workspace,'review/rig');await mkdir(out,{recursive:true});
const app=loadReconstructionModule+`
import {prepareAttachSpace,meshPayload,attachComputedRig,attachExpressionDeltas} from '/adapters/three_rig_adapter.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
root.rotation.y=0;root.updateMatrixWorld(true);prepareAttachSpace(THREE,root);
const contract=await(await fetch('/build/rig/rig-contract.json')).json(),computed=await(await fetch('/build/rig/weights.json')).json();
const rig=attachComputedRig(THREE,root,contract,computed);
const manifest=await(await fetch('/build/morph/manifest.json')).json(),sets={};
for(const [name,row]of Object.entries(manifest.meshes))sets[name]=await(await fetch('/'+row.path)).json();
attachExpressionDeltas(THREE,rig.meshes,sets);root.updateMatrixWorld(true);rig.skeleton.update();
await captureJson('meshes-after',meshPayload(root));
const helper=new THREE.SkeletonHelper(root);helper.visible=false;scene.add(helper);
const socketMarkers=new THREE.Group();socketMarkers.visible=false;scene.add(socketMarkers);
for(const [id,node]of Object.entries(rig.sockets)){const marker=new THREE.Mesh(new THREE.SphereGeometry(.014,10,8),new THREE.MeshBasicMaterial({color:0xf04692,depthTest:false}));marker.name=id;marker.userData.source=node;socketMarkers.add(marker);}
function debug(mode){helper.visible=mode==='skeleton';socketMarkers.visible=mode==='sockets';for(const mesh of rig.meshes)mesh.material.wireframe=mode==='wireframe';}
function expression(name){for(const mesh of rig.meshes)if(mesh.morphTargetInfluences){mesh.morphTargetInfluences.fill(0);if(name!=='neutral'){const index=mesh.morphTargetDictionary[name];if(index!==undefined)mesh.morphTargetInfluences[index]=1;}}}
window.forge={draw(view){draw(view);for(const marker of socketMarkers.children)marker.position.copy(marker.userData.source.getWorldPosition(new THREE.Vector3()));renderer.render(scene,camera);},debug,expression,async export(){
 expression('neutral');debug('none');root.rotation.y=0;root.updateMatrixWorld(true);
 // Keep only serializable, shared-contract metadata. Live Three node graphs
 // in sculptRuntime are not glTF extras; bone/socket identity is retained.
 const saved=new Map();root.traverse(n=>{saved.set(n,n.userData);n.userData=Object.fromEntries(Object.entries(n.userData).filter(([k])=>['forgeBone','socket'].includes(k)));});
 try{const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});const response=await fetch('/capture/rig/golden-neutral.glb',{method:'POST',body:glb});if(!response.ok)throw Error('GLB capture failed');return {bytes:glb.byteLength,bones:rig.skeleton.bones.length,meshes:rig.meshes.length,sockets:Object.keys(rig.sockets)};}finally{for(const[n,data]of saved)n.userData=data;}
}};window.ready=true;`;
const receipt=await withWorkspaceBrowser(workspace,app,async page=>{
 for(const view of ['front','side','back','front34','rear34','oppositeSide']){await page.evaluate(v=>window.forge.draw(v),view);await page.locator('canvas').screenshot({path:join(out,view+'.png')});}
 for(const mode of ['wireframe','skeleton','sockets']){await page.evaluate(m=>{window.forge.debug(m);window.forge.draw('front');},mode);await page.locator('canvas').screenshot({path:join(out,mode+'.png')});}
 await page.evaluate(()=>window.forge.debug('none'));
 for(const name of ['neutral','blink','smile','mouth-open']){await page.evaluate(n=>{window.forge.expression(n);window.forge.draw('front');},name);await page.locator('canvas').screenshot({path:join(out,'expression-'+name+'.png')});}
 return await page.evaluate(()=>window.forge.export());
});
await writeFile(join(out,'receipt.json'),JSON.stringify({...receipt,sourceHead:process.env.HEAD_SHA,meshPayloadSha256:digest(before),status:'Actual neutral rig/morph captures; frozen parity, animation gates, likeness and expression semantics still require review'},null,2));
