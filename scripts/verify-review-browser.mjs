import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
export async function verifyReviewBrowser(output,{publicUrl=process.env.REVIEW_PUBLIC_URL,expectedCommit=process.env.GITHUB_SHA}={}){
  const root=resolve(output),evidence=resolve('artifacts',publicUrl?'review-public':'review-local');await mkdir(evidence,{recursive:true});
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.vrm':'model/gltf-binary','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain'};
  const server=createServer(async(req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep))throw new Error('path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-cache'});res.end(bytes);}catch{res.writeHead(404);res.end('not found');}});
  if(!publicUrl)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=publicUrl?new URL(publicUrl).href:`http://127.0.0.1:${server.address().port}/`;let browser;
  const report={kind:'targeted-software-WebGL-progressive-smoke',url:base,expectedCommit,physicalPixelFold:false,visualApproval:false,passed:false,errors:[]};
  try{
    const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome'].find(existsSync);
    if(!chrome&&!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','chromium'],{stdio:'inherit',timeout:120000});
    browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    page.on('pageerror',error=>report.errors.push(error.stack||error.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded||document.querySelector('#review-status').dataset.kind==='error',null,{timeout:90000});
    assert.equal(await page.locator('#review-status').getAttribute('data-kind'),'','Initial load failed: '+await page.locator('#review-status').textContent());
    await page.waitForFunction(()=>window.__reviewLab.snapshot().triangles>100,null,{timeout:15000});
    const snapshot=()=>page.evaluate(()=>window.__reviewLab.snapshot());
    const seek=async time=>page.locator('#timeline').evaluate((node,time)=>{node.value=String(time);node.dispatchEvent(new Event('input',{bubbles:true}));},time);
    const openTab=async name=>{await page.locator(`[data-tab="${name}"]`).evaluate(node=>node.click());await page.locator(`[data-page="${name}"]`).waitFor({state:'visible'});};
    const first=await snapshot();assert.match(first.source,/全モーションソース/);assert.ok(first.triangles>100);
    if(expectedCommit)assert.equal(first.build,expectedCommit,'The served JavaScript must match the requested commit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page must not overflow horizontally');
    assert.equal(await page.locator('link[rel="manifest"]').count(),0,'Review Lab must not expose PWA installation');
    await page.locator('#load-progress').waitFor({state:'attached'});
    await page.locator('[data-page="simple"]').waitFor({state:'visible'});
    await page.locator('#skill-fire').waitFor({state:'visible'});
    await page.waitForFunction(()=>[...document.querySelector('#clip').options].some(o=>o.value==='Tidebreak / Walk'),null,{timeout:30000});
    await page.selectOption('#clip','Tidebreak / Walk');await page.click('#skill-fire');
    await openTab('advanced');await seek(.1);const a=await snapshot();await seek(.4);const b=await snapshot();assert.notDeepEqual(a.pose,b.pose,'Tidebreak Walk must animate');
    await page.locator('#step-forward').evaluate(node=>node.click());const c=await snapshot();assert.ok(Math.abs(c.time-(.4+1/60))<.001,'Paused frame stepping must work');
    await openTab('simple');
    const sharedWalk='共有VRMA / Walk / 歩行';await page.waitForFunction(value=>[...document.querySelector('#clip').options].some(o=>o.value===value),sharedWalk,{timeout:90000});await page.selectOption('#clip',sharedWalk);await page.click('#skill-fire');
    await page.waitForFunction(()=>[...document.querySelector('#clip').options].some(o=>o.value==='外部 / Walk_Loop'),null,{timeout:120000});
    await page.selectOption('#clip','外部 / Walk_Loop');await page.click('#skill-fire');
    assert.equal(await page.locator('#weapon-toggle').isChecked(),false,'Weapon assets stay opt-in during motion review');
    await page.screenshot({path:resolve(evidence,'shino-mobile.png')});
    await page.setViewportSize({width:1280,height:800});await openTab('simple');await page.screenshot({path:resolve(evidence,'shino-desktop.png')});
    const manifest=await (await page.request.get(base+'asset-review/manifest.json')).json();if(expectedCommit)assert.equal(manifest.buildCommit,expectedCommit,'The asset manifest must match the requested commit');
    report.final=await snapshot();delete report.final.pose;report.loadedAnimations=report.final.animations?.length||0;delete report.final.animations;
    assert.deepEqual(report.errors,[]);report.passed=true;
  }catch(error){report.failure=error.stack||String(error);throw error;}
  finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await writeFile(resolve(evidence,'validation.json'),JSON.stringify(report,null,2));console.log('REVIEW_BROWSER_RESULT '+JSON.stringify(report));}
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await verifyReviewBrowser(process.argv[2]||'dist/rinne');
