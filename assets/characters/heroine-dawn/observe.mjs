/** Explicit task-only real Character Studio observation; never an automatic gate. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
const root=process.cwd(),out=path.resolve(process.argv[2]||'generated/heroine-dawn');
const integration=JSON.parse(await readFile(path.join(out,'integration.json'),'utf8'));
const original=JSON.parse(await readFile('apps/review/public/library/provenance/female-protagonist-rogue-v1.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1050},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],warnings=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
await context.route('https://soul-lineage-*.c-okamoto.workers.dev/**',async route=>{
  const u=new URL(route.request().url());let base,relative;
  if(u.pathname.startsWith('/library/')){base=path.join(root,'apps/review/public/library');relative=u.pathname.slice('/library/'.length);}
  else if(u.pathname.startsWith('/simulator/assets/kaykit/')){base=path.join(root,'apps/character-studio/public/simulator/assets/kaykit');relative=u.pathname.slice('/simulator/assets/kaykit/'.length);}
  else return route.continue();
  const file=path.resolve(base,decodeURIComponent(relative));assert.ok(file.startsWith(base+path.sep));requests.push({url:u.href,file:path.relative(root,file)});
  try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.json')?'application/json':'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});}catch(e){errors.push(`Asset missing ${file}: ${e.message}`);await route.abort();}
});
await context.route('**/qa-before-rogue.asset.json',route=>route.fulfill({json:{id:'qa.before.rogue',assetId:'qa.before.rogue.asset',sha256:original.sha256,bytes:original.bytes,humanoidRig:'kaykit.Rig_Medium.v1',license:{spdx:'CC0-1.0'}}}));
const motionModule=`import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let gltf,mixer,rest;
export async function pose(url,name,fraction){
 const r=window.masterCharacterReview,root=r.actors[0].root;
 if(!gltf){gltf=await new GLTFLoader().loadAsync(url);rest=[];root.traverse(o=>{if(o.isBone)rest.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);});}
 mixer?.stopAllAction();for(const[o,p,q,s]of rest){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}
 const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw Error('Missing actual clip '+name);
 mixer=new THREE.AnimationMixer(root);mixer.clipAction(clip).play();mixer.setTime(clip.duration*fraction);root.updateMatrixWorld(true);
 const bounds=new THREE.Box3();let samples=0,changedBones=0;
 for(const[o,p,q]of rest)if(o.position.distanceTo(p)>1e-5||1-Math.abs(o.quaternion.dot(q))>1e-5)changedBones++;
 root.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();o.computeBoundingBox();const a=o.geometry.attributes.position;
 for(let i=0;i<a.count;i+=Math.max(1,Math.floor(a.count/64))){const v=new THREE.Vector3().fromBufferAttribute(a,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);if(![v.x,v.y,v.z].every(Number.isFinite))throw Error('Non-finite posed vertex');bounds.expandByPoint(v);samples++;}});
 return {clip:name,duration:clip.duration,time:clip.duration*fraction,changedBones,sampledVertices:samples,bounds:[bounds.min.toArray(),bounds.max.toArray()],clipCount:gltf.animations.length};
}`;
const probe=path.join(root,'apps/character-studio/heroine-motion-probe.js');await writeFile(probe,motionModule);
const shots=path.join(out,'runtime');await mkdir(shots,{recursive:true});
try{
 await page.goto('http://127.0.0.1:5177/',{waitUntil:'networkidle',timeout:90000});
 await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.characterStudio,{timeout:90000});
 await page.evaluate(async original=>{await window.masterCharacterReview.loadReferenceModel({kind:'dcc-character-model',id:'qa.before.rogue',assetId:'qa.before.rogue.asset',label:'比較元 Rogue',integrityPath:'/qa-before-rogue.asset.json',assetPath:'https://soul-lineage-review-dev.c-okamoto.workers.dev/library/model/'+original.gitBlobSha+'/Rogue.glb',sourceDisplay:{excludeMeshNodes:['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']}});window.masterCharacterReview.configure({paused:true,rotate:false,view:'single'});},original);
 await page.waitForFunction(()=>window.masterCharacterReview.ready&&window.masterCharacterReview.audit?.modelId==='qa.before.rogue',{timeout:60000});
 for(const view of ['front','three-quarter','side','back','face']){await page.evaluate(v=>window.masterCharacterReview.aim(v==='three-quarter'?'overview':v),view);await page.waitForTimeout(400);await page.locator('#stage').screenshot({path:path.join(shots,'before-'+view+'.png')});}
 await page.locator('[data-character-model="protagonist.villager.female.v1"]').click();
 await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.masterCharacterReview?.audit?.modelId==='protagonist.villager.female.v1',{timeout:60000});
 await page.evaluate(()=>window.masterCharacterReview.configure({paused:true,rotate:false,view:'single'}));
 const canvas=page.locator('#stage');await canvas.scrollIntoViewIfNeeded();
 for(const view of ['front','three-quarter','side','back','face']){await page.evaluate(v=>window.masterCharacterReview.aim(v==='three-quarter'?'overview':v),view);await page.waitForTimeout(450);await canvas.screenshot({path:path.join(shots,view+'.png')});}
 const audit=await page.evaluate(()=>({audit:window.masterCharacterReview.audit,errors:window.masterCharacterReview.errors,measure:window.masterCharacterReview.measure(),modelId:window.masterCharacterReview.displayModelId}));
 assert.equal(audit.audit.approved,true);assert.equal(audit.audit.source.sha256,integration.modelSha256);assert.deepEqual(audit.errors,[]);
 const poses=[];
 for(const [name,fraction]of [['Idle',.5],['Walking_A',.28],['Walking_A',.72],['1H_Melee_Attack_Chop',.47],['Block',.50],['Hit_A',.4]]){
  const result=await page.evaluate(async({url,name,fraction})=>{const m=await import('/heroine-motion-probe.js');return m.pose(url,name,fraction);},{url:integration.assetUrl,name,fraction});
  assert.ok(result.changedBones>0,`${name}: no actual animation pose change`);assert.equal(result.clipCount,76);poses.push(result);await page.evaluate(()=>window.masterCharacterReview.aim('overview'));await page.waitForTimeout(300);await canvas.screenshot({path:path.join(shots,`motion-${name}-${Math.round(fraction*100)}.png`)});
 }
 await page.screenshot({path:path.join(shots,'studio-ui.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.masterCharacterReview.aim('front'));await page.waitForTimeout(600);await canvas.screenshot({path:path.join(shots,'mobile-390.png')});
 const receipt={schema:'rinne-heroine-runtime-observation',sourceSha:process.env.GITHUB_SHA,modelSha256:integration.modelSha256,beforeSha256:original.sha256,assetPath:integration.meshPath,app:'apps/character-studio',renderer:'actual repository Character Studio (Vite / Chromium SwiftShader)',originMode:'checked-out first-party asset bytes served through exact project-origin request routes; not deployed DEV',views:['front','three-quarter','side','back','face','mobile-390'],poses,audit,errors,warnings,requests,hardwareAcceptance:'not-measured',visualApproval:'pending',productionReady:false};await writeFile(path.join(shots,'receipt.json'),JSON.stringify(receipt,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({modelSha256:integration.modelSha256,views:receipt.views,poses:poses.length,errors:errors.length}));
}catch(error){await writeFile(path.join(out,'browser-failure.json'),JSON.stringify({message:error.message,errors,warnings,state:await page.evaluate(()=>({ready:window.masterCharacterReview?.ready,audit:window.masterCharacterReview?.audit,errors:window.masterCharacterReview?.errors})).catch(()=>null)},null,2));await page.screenshot({path:path.join(out,'browser-failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
