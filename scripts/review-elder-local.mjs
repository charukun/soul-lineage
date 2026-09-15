/** Observe the actual Lab and original elder asset, without changing its render contract. */
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.argv[2]||'artifacts/elder-local');await mkdir(out,{recursive:true});
const asset='apps/rinne/public/simulator/assets/ELDER_REFERENCE_V1.vrm';
const hash=async()=>createHash('sha256').update(await readFile(asset)).digest('hex');
const report={schema:'elder-lab-observation',version:1,asset,assetSha256:await hash(),visualApproval:'pending',physicalDevicePerformance:'not-measured',errors:[],captures:[]};
let server,browser;
try{
 const reviewAssets=resolve('dist/rinne/asset-review');
 assert.ok(existsSync(resolve(reviewAssets,'manifest.json')),'Run build:review to prepare audited comparison assets first');
 server=await createServer({configFile:resolve('apps/rinne/vite.config.js'),root:resolve('apps/rinne'),base:'/',logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'local-verified-review-assets',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/asset-review/'))return next();const path=req.url.split('?')[0].slice('/asset-review/'.length);if(path.includes('..'))return next();try{const bytes=await readFile(resolve(reviewAssets,path));res.setHeader('Content-Type',path.endsWith('.json')?'application/json':path.endsWith('.png')?'image/png':'application/octet-stream');res.end(bytes);}catch{return next();}});}}]});
 await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
 const executable=process.env.REVIEW_CHROMIUM_PATH||resolve('node_modules/.cache/rinne-review-browser/chromium');
 browser=await chromium.launch({headless:true,executablePath:executable,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:960},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(`HTTP ${r.status()} ${r.url()}`);});
 report.url=`${base}/review.html?machine=1&preset=model.ELDER_DCC&clip=${encodeURIComponent('通常 / 自然体')}&playing=0&camera=front`;
 await page.goto(report.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__reviewMachine?.ready(),null,{timeout:90000});
 report.webgl=await page.locator('#review-canvas').evaluate(c=>{const gl=c.getContext('webgl2');return gl?{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),lost:gl.isContextLost(),width:c.width,height:c.height}:null;});
 assert.ok(report.webgl&&!report.webgl.lost);assert.equal(await page.locator('#preset').inputValue(),'model.ELDER_DCC');
 // Exercise the same picker used by a person, switching from Shino to the DCC mesh.
 await page.locator('[data-review-nav="model"]').click();await page.locator('.model-picker-item').filter({hasText:'Sendagaya Shino'}).first().click();
 await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded&&window.__reviewLab.snapshot().state.preset==='model.SHINO',null,{timeout:90000});
 await page.locator('[data-review-nav="model"]').click();await page.locator('.model-picker-item').filter({hasText:'老人男性（リファレンス造形）'}).click();
 await page.waitForFunction(()=>window.__reviewLab?.snapshot().loaded&&window.__reviewLab.snapshot().state.preset==='model.ELDER_DCC',null,{timeout:90000});report.pickerRoundTrip=true;await page.screenshot({path:resolve(out,'lab-ui.png')});
 // Allow the existing shared-source loading path to install its real motion bakes.
 await page.waitForFunction(()=>[...document.querySelector('#clip').options].some(o=>o.value==='構え / 自然体')||window.__reviewLab.snapshot().assetProblems.length>0,null,{timeout:90000});
 for(const [clip,time,name] of [['通常 / 自然体',0,'idle'],['体 / 歩行',.35,'walk'],['体 / ダッシュ',.24,'run'],['技 / 流し斬り',.3,'slash']]){
  await page.locator('#clip').evaluate((el,clip)=>{el.value=clip;el.dispatchEvent(new Event('change',{bubbles:true}));},clip);
  const set=await page.evaluate(async(time)=>window.__reviewMachine.captureSet({views:['front','three','right','back'],time,restore:false,settleFrames:3}),time);
  for(const item of set.captures){const file=`${name}-${item.recipe.view||item.recipe.camera||report.captures.length}.png`;await writeFile(resolve(out,file),Buffer.from(item.image.split(',')[1],'base64'));report.captures.push({file,clip,time,recipe:item.recipe});}
 }
 report.final=await page.evaluate(()=>window.__reviewLab.snapshot());
 assert.equal(await hash(),report.assetSha256,'Source asset changed during observation');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.final.assetProblems,[]);
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await server?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,webgl:report.webgl,pickerRoundTrip:report.pickerRoundTrip,captures:report.captures.length,errors:report.errors,failure:report.failure}));}
