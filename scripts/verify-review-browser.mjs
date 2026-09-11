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
  const server=createServer(async(req,res)=>{
    try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep))throw new Error('path');if((await stat(path)).isDirectory())path=resolve(path,'index.html');const bytes=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-cache'});res.end(bytes);}catch{res.writeHead(404);res.end('not found');}
  });
  if(!publicUrl)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=publicUrl?new URL(publicUrl).href:`http://127.0.0.1:${server.address().port}/`;let browser;
  const report={kind:'targeted-software-WebGL-smoke',url:base,expectedCommit,physicalPixelFold:false,visualApproval:false,passed:false,errors:[]};
  try{
    const chrome=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome'].find(existsSync);
    if(!chrome&&!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','chromium'],{stdio:'inherit',timeout:120000});
    browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded||document.querySelector('#review-status').dataset.kind==='error',null,{timeout:90000});
    assert.equal(await page.locator('#review-status').getAttribute('data-kind'),'','Initial load failed: '+await page.locator('#review-status').textContent());
    await page.waitForFunction(()=>window.__reviewLab.snapshot().triangles>100,null,{timeout:15000});
    const snapshot=()=>page.evaluate(()=>window.__reviewLab.snapshot());
    const seek=async(time)=>page.locator('#timeline').evaluate((node,time)=>{node.value=String(time);node.dispatchEvent(new Event('input',{bubbles:true}));},time);
    const openTab=async name=>{await page.locator(`[data-tab="${name}"]`).click();await page.locator(`[data-page="${name}"]`).waitFor({state:'visible'});};
    const first=await snapshot();assert.match(first.source,/character\.sendagaya-shino/);assert.ok(first.triangles>100);
    if(expectedCommit)assert.equal(first.build,expectedCommit,'The served JavaScript must match the requested commit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile page must not overflow horizontally');
    // The default surface is deliberately simple and must expose the reviewer-facing controls.
    await page.locator('[data-page="simple"]').waitFor({state:'visible'});
    await page.locator('#skill-fire').waitFor({state:'visible'});
    await page.locator('#copy-motion').waitFor({state:'visible'});
    await page.selectOption('#clip','Walk_Loop');
    assert.equal(await page.locator('#motion-name').textContent(),'Walk_Loop');
    await page.click('#skill-fire');
    // Technical frame controls live behind the advanced tab. Verify them there instead of assuming they are visible by default.
    await openTab('advanced');
    await seek(.1);const a=await snapshot();await seek(.4);const b=await snapshot();assert.notDeepEqual(a.pose,b.pose,'Walk must change raw-bone pose');
    await page.click('#step-forward');const c=await snapshot();assert.ok(Math.abs(c.time-(.4+1/60))<.001,'Paused frame stepping must work');
    const manifest=await (await page.request.get(base+'asset-review/manifest.json')).json();
    if(expectedCommit)assert.equal(manifest.buildCommit,expectedCommit,'The asset manifest must match the requested commit');
    report.families=manifest.families;report.testedClips=[];
    for(const row of manifest.families){
      if(!row.clips.length)continue;const name=row.clips[0];await page.selectOption('#clip',name);await seek(.2);const state=await snapshot();
      assert.equal(state.clip,name);assert.ok(Object.values(state.pose).flat().every(Number.isFinite));report.testedClips.push(name);
    }
    await page.selectOption('#clip','Walk_Loop');await seek(.4);await openTab('simple');await page.screenshot({path:resolve(evidence,'shino-mobile.png')});
    await openTab('advanced');await page.check('#weapon-toggle');await page.locator('#trigger-overlay').evaluate(node=>node.click());await page.screenshot({path:resolve(evidence,'sword-vfx-candidate.png')});
    await page.setViewportSize({width:1280,height:800});await openTab('simple');await page.screenshot({path:resolve(evidence,'shino-desktop.png')});
    // An actual missing URL must remain an error, never a fabricated rig.
    await openTab('advanced');await page.fill('#model-url',base+'deliberately-missing.glb');await page.locator('#load-url').evaluate(node=>node.click());
    await page.waitForFunction(()=>document.querySelector('#review-status').dataset.kind==='error');assert.equal((await snapshot()).loaded,false);
    await page.selectOption('#preset','character.sendagaya-shino.v1');await page.waitForFunction(()=>window.__reviewLab.snapshot().loaded,null,{timeout:90000});
    await openTab('simple');
    report.final=await snapshot();delete report.final.pose;delete report.final.animations;
    assert.deepEqual(report.errors,[]);report.passed=true;
  }catch(error){report.failure=error.stack||String(error);throw error;}
  finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await writeFile(resolve(evidence,'validation.json'),JSON.stringify(report,null,2));console.log('REVIEW_BROWSER_RESULT '+JSON.stringify(report));}
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await verifyReviewBrowser(process.argv[2]||'dist/rinne');
