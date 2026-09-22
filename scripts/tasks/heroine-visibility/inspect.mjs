/** Task-only diagnostic of the user-reported broken heroine, not a permanent gate. */
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const [url,label]=process.argv.slice(2),out=path.resolve('generated/heroine-visibility',label);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:393,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(/\.glb|\.asset\.json|version\.json/.test(r.url()))requests.push({url:r.url(),status:r.status()});});
if(label==='checkout')await page.route('https://soul-lineage-*.c-okamoto.workers.dev/**',async route=>{
 const u=new URL(route.request().url());let base,relative;
 if(u.pathname.startsWith('/library/')){base=path.resolve('apps/review/public/library');relative=u.pathname.slice('/library/'.length);}
 else if(u.pathname.startsWith('/simulator/assets/kaykit/')){base=path.resolve('apps/character-studio/public/simulator/assets/kaykit');relative=u.pathname.slice('/simulator/assets/kaykit/'.length);}
 else return route.continue();
 const file=path.resolve(base,decodeURIComponent(relative));if(!file.startsWith(base+path.sep))throw Error('Unsafe asset path');
 try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.json')?'application/json':'model/gltf-binary',headers:{'access-control-allow-origin':'*'}});}catch(e){errors.push(e.message);await route.abort();}
});
async function snapshot(name){
 await page.waitForTimeout(700);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 const state=await page.evaluate(async()=>{
  const r=window.masterCharacterReview,meshes=[];
  r?.actors?.[0]?.root.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,type:o.type,visible:o.visible,parent:o.parent?.name,count:o.geometry.attributes.position.count,material:o.material.name,color:o.material.color?.getHexString(),map:o.material.map?.name,opacity:o.material.opacity,frustum:o.frustumCulled,skin:o.skeleton?.bones.length,bind:o.bindMatrix?.toArray(),scale:o.scale.toArray(),box:o.boundingBox?{min:o.boundingBox.min.toArray(),max:o.boundingBox.max.toArray()}:null})});
  return{url:location.href,bodyClass:document.body.className,audit:r?.audit,settings:r?.settings,errors:r?.errors,measure:r?.measure?.(),meshes};
 });
 await writeFile(path.join(out,name+'.json'),JSON.stringify({...state,errors,requests,checkoutSha:process.env.GITHUB_SHA},null,2));
}
try{
 const response=await page.goto(url,{waitUntil:'networkidle',timeout:90000});
 await writeFile(path.join(out,'version.json'),await page.evaluate(async()=>{try{return await(await fetch('/version.json')).text();}catch(e){return e.message;}}));
 await page.waitForFunction(()=>window.masterCharacterReview?.ready,null,{timeout:90000});
 await snapshot('initial');
 const card=page.locator('.character-model-card[data-model-key="protagonist.villager.female.v1"]');
 await card.click();await page.waitForFunction(()=>window.masterCharacterReview?.ready&&window.masterCharacterReview?.audit?.modelId==='protagonist.villager.female.v1',null,{timeout:90000});
 await snapshot('female-native');
 await page.locator('[data-camera="front"]').first().click();await snapshot('female-front-native');
 await page.evaluate(()=>window.masterCharacterReview.configure({paused:true,rotate:false,view:'single'}));await snapshot('female-configured');
 await page.evaluate(()=>window.masterCharacterReview.refresh());await snapshot('female-refreshed');
 await page.setViewportSize({width:1440,height:1050});await snapshot('female-desktop');
 console.log(JSON.stringify({label,status:response.status(),errors,requests}));
}catch(e){errors.push(e.stack);await snapshot('failure').catch(()=>{});console.error(e);process.exitCode=1;}
finally{await writeFile(path.join(out,'errors.json'),JSON.stringify({errors,requests},null,2));await browser.close();}
