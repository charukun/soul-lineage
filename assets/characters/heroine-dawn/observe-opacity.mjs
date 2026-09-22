/** Explicit specialist observation of the delivered GLB in the real Studio. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
const root=process.cwd(), out=path.resolve(process.argv[2]);
const source=JSON.parse(await readFile('apps/review/public/library/provenance/heroine-dawn-v1.json','utf8'));
const original=JSON.parse(await readFile('apps/review/public/library/provenance/female-protagonist-rogue-v1.json','utf8'));
const url=source.runtimeOrigin+source.path.split('/library/')[1];
await mkdir(out,{recursive:true});
const probe=path.join(root,'apps/character-studio/heroine-motion-probe.js');
await writeFile(probe,`import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let gltf,mixer,rest,selected,action;
export async function sample(url,name,fraction){
 const root=window.masterCharacterReview.actors[0].root;
 if(!gltf){gltf=await new GLTFLoader().loadAsync(url);rest=[];root.traverse(o=>{if(o.isBone)rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});mixer=new THREE.AnimationMixer(root);}
 if(name!==selected){mixer.stopAllAction();for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}selected=name;const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw Error('Missing clip '+name);action=mixer.clipAction(clip);action.play();}
 mixer.setTime(action.getClip().duration*fraction);root.updateMatrixWorld(true);
 let changedBones=0,sampledVertices=0;const bounds=new THREE.Box3();
 for(const[o,p,q]of rest)if(o.position.distanceTo(p)>1e-5||1-Math.abs(o.quaternion.dot(q))>1e-5)changedBones++;
 root.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();o.computeBoundingBox();const a=o.geometry.attributes.position;
 for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/64))){const v=new THREE.Vector3().fromBufferAttribute(a,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Nonfinite vertex');bounds.expandByPoint(v);sampledVertices++;}});
 return {clip:name,time:action.getClip().duration*fraction,duration:action.getClip().duration,fraction,changedBones,sampledVertices,bounds:[bounds.min.toArray(),bounds.max.toArray()],clipCount:gltf.animations.length};
}
export async function play(url,name){
 const first=await sample(url,name,0),start=performance.now();let frames=0;
 await new Promise((resolve,reject)=>{const step=async now=>{try{const elapsed=(now-start)/1000;await sample(url,name,Math.min(.999,elapsed/first.duration));frames++;if(elapsed<first.duration)requestAnimationFrame(step);else resolve();}catch(e){reject(e);}};requestAnimationFrame(step);});
 return {clip:name,speed:1,frames,wallSeconds:(performance.now()-start)/1000,duration:first.duration};
}`);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1,recordVideo:{dir:path.join(out,'video'),size:{width:960,height:700}}});
await context.tracing.start({screenshots:true,snapshots:true});
const page=await context.newPage(),errors=[],warnings=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
await context.route('https://soul-lineage-*.c-okamoto.workers.dev/**',async route=>{
 const u=new URL(route.request().url());let base,relative;
 if(u.pathname.startsWith('/library/')){base=path.join(root,'apps/review/public/library');relative=u.pathname.slice(9);}
 else if(u.pathname.startsWith('/simulator/assets/kaykit/')){base=path.join(root,'apps/character-studio/public/simulator/assets/kaykit');relative=u.pathname.slice('/simulator/assets/kaykit/'.length);}
 else return route.continue();
 const file=path.resolve(base,decodeURIComponent(relative));assert.ok(file.startsWith(base+path.sep));requests.push({url:u.href,file:path.relative(root,file)});
 try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.json')?'application/json':'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});}catch(e){errors.push(e.message);await route.abort();}
});
const poses=[],matrix=[],playback=[];
const setPose=async(name,fraction)=>page.evaluate(async({url,name,fraction})=>(await import('/heroine-motion-probe.js')).sample(url,name,fraction),{url,name,fraction});
const shot=async(view,file)=>{await page.evaluate(v=>window.masterCharacterReview.aim(v==='three-quarter'?'overview':v),view);await page.waitForTimeout(220);await page.locator('#stage').screenshot({path:path.join(out,file+'.png')});};
try{
 await page.goto('http://127.0.0.1:5177/',{waitUntil:'networkidle',timeout:90000});
 await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.characterStudio,null,{timeout:90000});
 await page.locator('.character-model-card[data-model-key="protagonist.villager.female.v1"]').click();
 await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.masterCharacterReview.audit?.modelId==='protagonist.villager.female.v1',null,{timeout:60000});
 await page.evaluate(()=>window.masterCharacterReview.configure({paused:true,rotate:false,view:'single'}));
 for(const view of ['front','three-quarter','side','back','face'])await shot(view,view);
 const audit=await page.evaluate(()=>({audit:window.masterCharacterReview.audit,errors:window.masterCharacterReview.errors,measure:window.masterCharacterReview.measure(),modelId:window.masterCharacterReview.displayModelId}));
 assert.equal(audit.audit.approved,true);assert.equal(audit.audit.source.sha256,source.sha256);assert.deepEqual(audit.errors,[]);
 const materials=await page.evaluate(()=>{const rows=[];window.masterCharacterReview.actors[0].root.traverse(o=>{if(o.isMesh)for(const m of(Array.isArray(o.material)?o.material:[o.material]))rows.push({mesh:o.name,name:m.name,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,depthTest:m.depthTest,side:m.side});});return rows;});
 for(const m of materials){assert.equal(m.transparent,false,m.mesh);assert.equal(m.opacity,1,m.mesh);assert.equal(m.depthWrite,true,m.mesh);assert.equal(m.depthTest,true,m.mesh);}
 for(const [name,fraction]of [['Idle',.5],['Walking_A',.28],['Walking_A',.72],['1H_Melee_Attack_Chop',.47],['Block',.5],['Hit_A',.4]]){const result=await setPose(name,fraction);assert.ok(result.changedBones>0);assert.equal(result.clipCount,76);poses.push(result);await shot('three-quarter',`motion-${name}-${Math.round(fraction*100)}`);}
 for(const name of ['Idle','Walking_A','1H_Melee_Attack_Chop','Hit_A']){
  for(const fraction of [.02,.25,.5,.75,.98]){
   const result=await setPose(name,fraction);assert.ok(result.changedBones>0);assert.equal(result.clipCount,76);
   for(const view of ['front','three-quarter','side','back']){const file=`matrix-${name}-${Math.round(fraction*100)}-${view}`;await shot(view,file);matrix.push({...result,view,file:file+'.png'});}
  }
  await page.evaluate(()=>window.masterCharacterReview.aim('overview'));
  playback.push(await page.evaluate(async({url,name})=>(await import('/heroine-motion-probe.js')).play(url,name),{url,name}));
 }
 // The opposite profile exposes the other collar, cuff, ear and bow joins.
 await setPose('1H_Melee_Attack_Chop',.47);await page.evaluate(()=>window.masterCharacterReview.actors[0].root.rotation.y=Math.PI);await shot('side','opposite-side-attack');
 await page.evaluate(()=>window.masterCharacterReview.actors[0].root.rotation.y=0);
 await page.screenshot({path:path.join(out,'studio-ui.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await setPose('Idle',.5);await shot('front','mobile-390');
 const receipt={schema:'rinne-heroine-runtime-observation',sourceSha:process.env.GITHUB_SHA,modelSha256:source.sha256,beforeSha256:original.sha256,comparisonBaselineSha256:'777f0c4f7f910edf85ab66011fddf961b7144a4a129212cf8a0b5a1b73937678',assetPath:source.path,app:'apps/character-studio',renderer:'actual repository Character Studio / Chromium SwiftShader',originMode:'exact checked-out first-party asset bytes at their project-origin routes; not deployed DEV',views:['front','three-quarter','side','back','face','mobile-390'],poses,opacityReview:{materials,matrix,playback,oppositeProfile:'opposite-side-attack.png'},audit,errors,warnings,requests,hardwareAcceptance:'not-measured',visualApproval:'pending',productionReady:false};
 await writeFile(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({sha256:source.sha256,poses:poses.length,matrix:matrix.length,playback,errors}));
}catch(e){await writeFile(path.join(out,'failure.json'),JSON.stringify({message:e.message,errors,warnings},null,2));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e;}
finally{await context.tracing.stop({path:path.join(out,'trace.zip')});await context.close();await browser.close();await rm(probe,{force:true});}
