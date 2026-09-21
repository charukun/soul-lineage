import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='session-evidence';mkdirSync(out,{recursive:true});
const sourceSha=process.env.SOURCE_SHA,url=process.env.PREVIEW_URL;
const version=await(await fetch(new URL('version.json',url))).json();
if(version.commit!==sourceSha)throw new Error(`immutable commit mismatch ${version.commit}`);
const evidence={sourceSha,url,version,observedAt:new Date().toISOString(),conditions:{viewport:[673,841],deviceScaleFactor:1,hasTouch:true,renderer:'Chromium SwiftShader',profile:'fresh',route:'native brand tap > confirm gate hidden > begin > native steering towards nearest traveller > idle combat/devour > pause > lineage'},stages:[],errors:[],failedRequests:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:673,height:841},deviceScaleFactor:1,hasTouch:true});
const page=await context.newPage();page.setDefaultTimeout(120000);
page.on('pageerror',e=>evidence.errors.push(e.message));page.on('requestfailed',r=>evidence.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
const snapshot=()=>page.evaluate(()=>window.__NIGHT_HUNT__?.snapshot?.());
const save=()=>writeFileSync(`${out}/observation.json`,JSON.stringify(evidence,null,2));
const capture=async(name,image=true)=>{const value=await page.evaluate(()=>({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).map(x=>({id:x.id,text:x.innerText,disabled:x.disabled})),snapshot:window.__NIGHT_HUNT__?.snapshot?.(),presentation:window.__NIGHT_HUNT__?.presentationSnapshot?.()}));evidence.stages.push({name,at:new Date().toISOString(),...value});save();if(image)await page.screenshot({path:`${out}/${name}.png`,timeout:90000});console.log('OBSERVATION',name,JSON.stringify(value));};
const tap=async selector=>{await page.locator(selector).first().click({timeout:120000});};
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>document.querySelector('#game')?.dataset.renderer==='ready',null,{timeout:120000});
 const gate=page.locator('#soul-brand-boot');
 if(await gate.isVisible()){await tap('#soul-brand-boot');await gate.waitFor({state:'hidden',timeout:120000});}
 await capture('01-title');
 await tap('#begin');await page.waitForFunction(()=>window.__NIGHT_HUNT__?.snapshot().mode==='hunt',null,{timeout:120000});await capture('02-hunt-entry');
 let held=false,sawCombat=false,lastEaten=0;
 for(let i=0;i<24;i++){
  const s=await snapshot();if(s.finished)break;
  const target=s.npcs.filter(n=>!n.eaten&&n.role==='traveller').sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  if(s.combat||s.devouring||!target||Math.hypot(target.x-s.player.x,target.z-s.player.z)<1.2){if(held){await page.mouse.up();held=false;}}
  else{if(!held){await page.mouse.move(330,520);await page.mouse.down();held=true;}const dx=target.x-s.player.x,dz=target.z-s.player.z,d=Math.hypot(dx,dz);await page.mouse.move(330+60*(Math.cos(.33)*dx-Math.sin(.33)*dz)/d,520+60*(Math.sin(.33)*dx+Math.cos(.33)*dz)/d,{steps:3});}
  await page.waitForTimeout(6000);
  const after=await snapshot(),important=(!sawCombat&&!!after.combat)||after.eaten>lastEaten;
  await capture(`03-play-${String(i).padStart(2,'0')}`,important||i%4===0);sawCombat||=!!after.combat;lastEaten=after.eaten;
  if(after.eaten>=2||after.finished)break;
 }
 if(held)await page.mouse.up();
 if(await page.locator('#pause').isVisible()){await tap('#pause');await capture('04-pause');if(await page.locator('#settings-memory').isVisible()){await tap('#settings-memory');await capture('05-lineage');}}
 evidence.success=true;
}catch(e){evidence.success=false;evidence.failure=e.stack;await capture('failure').catch(()=>{});process.exitCode=1;}
finally{save();await browser.close();console.log('SUMMARY',JSON.stringify({sourceSha,url,success:evidence.success,failure:evidence.failure,stages:evidence.stages.map(s=>s.name),errors:evidence.errors}));}
