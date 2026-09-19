import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const publicUrl=process.argv[2];let server;
if(!publicUrl){server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),p=resolve('dist','.'+(pathname==='/'?'/index.html':pathname));if(!p.startsWith(resolve('dist')+'/'))throw Error('path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg'};const data=await readFile(p);res.setHeader('Content-Type',types[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}});await new Promise(r=>server.listen(4179,'127.0.0.1',r));}
const base=publicUrl||'http://127.0.0.1:4179/';const tag=publicUrl?'public':'local';await mkdir('evidence',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const reports=[],diagnostics=[];let failed=false;
try{
  for(const config of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844},{name:'landscape',width:844,height:390}]){
    const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:1,isMobile:config.name!=='desktop',hasTouch:config.name!=='desktop'});
    const page=await context.newPage(),errors=[],badRequests=[];page.setDefaultTimeout(60000);diagnostics.push({device:config.name,errors,badRequests});
    page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE_ERROR',e.message);});
    page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|Shader|Uncaught|TypeError/i.test(m.text()))errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))badRequests.push({url:r.url(),status:r.status()});});
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>window.__ASHEN__?.ready||window.__ASHEN__?.error,{},{timeout:90000});
    assert.equal(await page.evaluate(()=>window.__ASHEN__.error),null);
    await page.waitForFunction(()=>window.__ASHEN__.frames>12,{},{timeout:30000});
    await page.screenshot({path:`evidence/${tag}-${config.name}-title.png`});
    assert.equal(await page.title(),'ASHEN VIGIL — 灰燼の誓い');
    if(config.name==='desktop'){await page.locator('[data-credits]').click();assert.ok(await page.locator('#credits').isVisible());await page.locator('#credits-close').click();}
    await page.locator('#start').click();
    // Observe completed autonomous attacks, not a timer that pauses at an early victory.
    await page.waitForFunction(()=>{const s=window.__ASHEN__.snapshot();return s.kills>=2&&s.damage>0&&s.state==='combat';},{},{timeout:90000});
    let snap=await page.evaluate(()=>window.__ASHEN__.snapshot());assert.ok(snap.damage>0&&snap.kills>=2,'Real autonomous combat must defeat enemies');assert.ok(snap.heroes.some((h,i)=>Math.hypot(h.x-(i-1)*2.25,h.z-(i===2?2.4:.7))>1),'Autonomous actors must actually move');assert.ok(snap.renderedActors>=4);assert.ok(snap.animations.includes('Sword'));assert.ok(snap.animations.includes('Run'));assert.ok(snap.triangles>50000,'Authored world and actor geometry must really render');
    await page.screenshot({path:`evidence/${tag}-${config.name}-battle.png`});
    await page.locator('#pause').click();const paused=await page.evaluate(()=>window.__ASHEN__.snapshot());assert.equal(paused.state,'paused');await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>window.__ASHEN__.snapshot())).time,paused.time);await page.locator('#resume').click();
    await page.locator('#speed').click();assert.equal(await page.locator('#speed').textContent(),'2×');
    if(await page.locator('#bell').isEnabled()){await page.locator('#bell').click();assert.ok((await page.evaluate(()=>window.__ASHEN__.snapshot())).bellCooldown>0);await page.screenshot({path:`evidence/${tag}-${config.name}-bell.png`});}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
    for(const id of ['pause','speed','bell']){const b=await page.locator('#'+id).boundingBox();assert.ok(b&&b.x>=0&&b.x+b.width<=config.width+1&&b.y+b.height<=config.height+1,id+' must be visible');}
    if(config.name==='desktop'){
      await page.waitForFunction(()=>['choice','win','lose'].includes(window.__ASHEN__.snapshot().state),{},{timeout:90000});
      const phase=await page.evaluate(()=>window.__ASHEN__.snapshot().state);
      if(phase==='choice'){await page.screenshot({path:`evidence/${tag}-boons.png`});await page.locator('.choice-card').nth(1).click();assert.ok((await page.evaluate(()=>window.__ASHEN__.snapshot())).wave>=2);}
    }
    snap=await page.evaluate(()=>window.__ASHEN__.snapshot());const manifest=await (await context.request.get(base+'assets-manifest.json')).json();assert.equal(manifest.generatedModels,0);assert.deepEqual(manifest.exclusionAudit.exactByteCollisions,[]);assert.ok(Object.keys(manifest.models).length>=40);
    const build=await (await context.request.get(base+'build.json')).json();if(process.env.GITHUB_SHA)assert.equal(build.sha,process.env.GITHUB_SHA,'Public build must match the exact validated source');
    assert.deepEqual(errors,[],'No uncaught browser or shader errors');assert.deepEqual(badRequests,[],'All self-hosted app assets must load');reports.push({device:config.name,viewport:config,url:base,build,snapshot:snap,errors,badRequests,assetCount:Object.keys(manifest.models).length,existing3DFilesAudited:manifest.exclusionAudit.trackedExisting3DFilesChecked});
    console.log('BROWSER_PASS',tag,config.name,JSON.stringify(snap));await context.close();
  }
}catch(error){failed=true;console.error('BROWSER_FAILURE',error);for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:`evidence/${tag}-failure.png`}).catch(()=>{});const snapshot=await page.evaluate(()=>window.__ASHEN__?.snapshot?.()||window.__ASHEN__).catch(()=>null);reports.push({snapshot});}reports.push({error:String(error),stack:error.stack,diagnostics});}
finally{await writeFile(`evidence/${tag}-report.json`,JSON.stringify({passed:!failed,checkedAt:new Date().toISOString(),url:base,reports},null,2));await browser.close();if(server)server.close();}
if(failed)process.exitCode=1;
