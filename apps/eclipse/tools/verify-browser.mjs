import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.env.ECLIPSE_PUBLIC_URL?'test-results/eclipse-public':'test-results/eclipse');await mkdir(out,{recursive:true});
const root=resolve('dist/eclipse');const errors=[];const results={checks:[],screenshots:[],commit:process.env.ECLIPSE_HEAD_SHA||process.env.GITHUB_SHA,publicUrl:process.env.ECLIPSE_PUBLIC_URL||null};
let server,currentPage;
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.glb':'model/gltf-binary','.svg':'image/svg+xml'};
if(!process.env.ECLIPSE_PUBLIC_URL){server=createServer(async(req,res)=>{try{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const path=resolve(root,'.'+name);if(!path.startsWith(root+'/'))throw new Error('invalid path');res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end('not found');}});await new Promise(r=>server.listen(8087,'127.0.0.1',r));}
const base=process.env.ECLIPSE_PUBLIC_URL||'http://127.0.0.1:8087/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const snapshot=page=>page.evaluate(()=>window.__ECLIPSE__?.snapshot());
const shot=async(page,name)=>{console.log('Capturing',name,await snapshot(page));await page.screenshot({path:resolve(out,name+'.png'),timeout:60000,animations:'disabled'});results.screenshots.push(name+'.png');};
async function waitForBattle(page){
 for(let i=0;i<30;i++){await page.waitForTimeout(1000);const s=await snapshot(page);console.log('Live battle',s);assert.equal(s.hidden,false,'test page must stay visible');assert.equal(s.state,'playing',`unexpected live state: ${JSON.stringify(s)}`);if(s.time>6)return s;}
 throw new Error('Live game failed to advance six seconds in thirty seconds');
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});const page=await context.newPage();currentPage=page;page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?test=1',{waitUntil:'networkidle',timeout:90000});await page.waitForFunction(()=>window.__ECLIPSE__?.snapshot().loaded===33,null,{timeout:90000});await page.waitForTimeout(1800);assert.equal(await page.locator('#fatal').isVisible(),false);results.render=await page.evaluate(()=>({software:window.__ECLIPSE_TEST__.world.software,info:window.__ECLIPSE__.snapshot()}));await shot(page,'desktop-title');results.checks.push('33 original models loaded; WebGL2 title rendered');
 await page.locator('#start-button').click();console.log('Immediately after start',await snapshot(page));results.early=await waitForBattle(page);assert.ok(results.early.enemies>0);assert.notEqual(results.early.hero.animation,'T-Pose');await shot(page,'desktop-battle');
 await page.locator('#auto-button').click();const before=await snapshot(page);await page.keyboard.down('d');
 try{await page.waitForFunction(t=>window.__ECLIPSE__.snapshot().time>=t+1.5,before.time,{timeout:60000});}finally{await page.keyboard.up('d');}
 const after=await snapshot(page);assert.ok(Math.hypot(after.hero.x-before.hero.x,after.hero.z-before.hero.z)>.5);results.checks.push('manual WASD movement responds even during attack animation');await page.locator('#auto-button').click();
 await page.locator('[data-action=pause]').click();const t=(await snapshot(page)).time;await page.waitForTimeout(600);assert.equal((await snapshot(page)).time,t);assert.equal((await snapshot(page)).audio,'suspended');await shot(page,'desktop-pause');await page.locator('[data-action=resume]').click();results.checks.push('pause freezes simulation and suspends audio; resume works');
 await page.evaluate(()=>{window.__ECLIPSE_TEST__.stopRender();window.__ECLIPSE_TEST__.sound.suspend();window.__ECLIPSE_TEST__.game.start();});
 results.simulation=[];for(let i=0;i<24;i++){const s=await page.evaluate(()=>window.__ECLIPSE_TEST__.step(15));results.simulation.push(s);console.log('Combat',s.state,s.wave,s.kills,Math.round(s.hp));if(s.wave===5&&s.state==='playing'&&!results.bossCaptured){await shot(page,'desktop-boss');results.bossCaptured=true;}if(s.state==='result')break;}
 results.final=await snapshot(page);await shot(page,'desktop-result');assert.equal(results.final.state,'result');assert.equal(results.final.win,true,'default fully automatic run must defeat boss');assert.equal(results.final.kills,73);results.checks.push('fully autonomous five-wave run including final boss reaches victory');
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const m=await mobile.newPage();currentPage=m;m.on('pageerror',e=>errors.push(String(e)));await m.goto(base+'?test=1',{waitUntil:'networkidle',timeout:90000});await m.waitForFunction(()=>window.__ECLIPSE__?.snapshot().loaded===33,null,{timeout:90000});await m.waitForTimeout(1000);await shot(m,'mobile-title');await m.locator('#start-button').tap();results.mobile=await waitForBattle(m);await shot(m,'mobile-battle');assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await m.locator('[data-skill="2"]').isVisible(),true);assert.equal(results.mobile.quality,'low');
 await m.locator('[data-action=pause]').tap();await m.locator('#pause-screen [data-action=settings]').tap();await m.locator('#quality-setting').selectOption('high');await m.locator('[data-action=close-settings]').tap();await m.locator('[data-action=resume]').tap();await m.waitForTimeout(500);results.checks.push('390px touch layout, skills, settings, no horizontal overflow');await mobile.close();
 assert.deepEqual(errors,[]);results.checks.push('no browser runtime errors');results.success=true;
}catch(e){results.success=false;results.failure=String(e);console.error(e);try{results.failureState=await snapshot(currentPage);console.error('Failure state:',results.failureState);await shot(currentPage,'failure');}catch(captureError){results.captureError=String(captureError);}process.exitCode=1;}finally{results.errors=errors;await writeFile(resolve(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();server?.close();}
