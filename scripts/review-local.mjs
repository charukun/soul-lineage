/** Local, same-process Lab observation. No deployment, external model or approval. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';

const {values}=parseArgs({options:{mode:{type:'string',default:'sequence'},time:{type:'string',default:'3.33'},out:{type:'string',default:'artifacts/review-local-motion'},playback:{type:'boolean',default:false}}});
const durations={sequence:30,combination:4,single:.66,posture:18};
assert.ok(Object.hasOwn(durations,values.mode),'Use sequence, combination, single or posture');
const time=Number(values.time);assert.ok(Number.isFinite(time)&&time>=0&&time<=durations[values.mode],'time is outside the selected motion');
const output=resolve(values.out);await mkdir(output,{recursive:true});
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const paths=['authored-slash.js','authored-sword.js','sword-sequence.js','sword-performance.js','humanoid.js','motion-review.js'];
const hashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(resolve('apps/rinne/public/simulator/src',path))).digest('hex')])));
const report={schema:'rinne-local-motion-review',version:1,revision,sourceHashes:hashes,mode:values.mode,time,model:'SHINO_review.vrm',renderer:'software-WebGL',stage:'start',passed:false,visualApproval:'pending',normalSpeedReview:'not-observed',physicalDeviceFps:'not-measured',captures:[],errors:[]};
let server,browser,context;
try{
  // Start the server and its client together. Separate shell calls may have
  // separate network namespaces; a cloud browser cannot necessarily see either.
  report.stage='server';
  server=await createServer({configFile:resolve('apps/rinne/vite.config.js'),root:resolve('apps/rinne'),base:'/',logLevel:'error',server:{host:'127.0.0.1',port:0,strictPort:false,open:false}});
  await server.listen();const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  report.url=`${base}/simulator/motion-review.html?mode=${values.mode}`;
  assert.equal((await fetch(report.url)).status,200,'Local Lab HTTP entry did not load');
  report.stage='browser';
  const executable=[process.env.REVIEW_CHROMIUM_PATH,chromium.executablePath(),resolve('node_modules/.cache/rinne-review-browser/chromium'),'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome'].find(path=>path&&existsSync(path));
  if(!executable)throw Error('Local Chromium is missing. Run npm run review:local:setup, then rerun review:local.');
  browser=await chromium.launch({headless:true,executablePath:executable,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],timeout:30000});
  context=await browser.newContext({viewport:{width:960,height:900},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)report.errors.push(`HTTP ${response.status()} ${response.url()}`);});
  report.stage='model';await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('#play').disabled||document.querySelector('#motion-status').textContent.includes('表示できませんでした'),null,{timeout:90000});
  assert.equal(await page.locator('#play').isEnabled(),true,await page.locator('#motion-status').textContent());
  await page.locator('#play').click();
  report.stage='webgl';
  report.webgl=await page.locator('#motion-stage').evaluate(canvas=>{const gl=canvas.getContext('webgl2');return gl?{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),width:canvas.width,height:canvas.height,lost:gl.isContextLost()}:null;});
  assert.ok(report.webgl&&!report.webgl.lost&&report.webgl.width>0,'The actual Lab canvas must have a live WebGL2 context');
  report.stage='capture';
  for(const view of ['front','side','three','back']){
    await page.locator(`[data-view="${view}"]`).click();
    await page.locator('#timeline').evaluate((node,time)=>{node.value=String(time);node.dispatchEvent(new Event('input',{bubbles:true}));},time);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const file=`${view}-${time.toFixed(3)}.png`;await page.locator('#motion-stage').screenshot({path:resolve(output,file)});report.captures.push({file,view,time});
  }
  if(values.playback){
    report.stage='playback';await page.locator('#repeat').evaluate(node=>{node.checked=false;node.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('#speed').selectOption('1');await page.locator('[data-view="three"]').click();
    // Record the actual canvas without a second downloaded FFmpeg executable.
    await page.locator('#motion-stage').evaluate(canvas=>{
      const stream=canvas.captureStream(30),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
      const done=new Promise(resolve=>{recorder.onstop=async()=>{for(const track of stream.getTracks())track.stop();const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};});
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      window.__localReviewRecording={recorder,done};recorder.start(1000);
    });
    await page.locator('#restart').click();const started=Date.now();
    await page.waitForFunction(end=>Number(document.querySelector('#timeline').value)>=end,durations[values.mode],{timeout:Math.max(60000,durations[values.mode]*4000)});
    const video=await page.evaluate(async()=>{const recording=window.__localReviewRecording;recording.recorder.stop();const data=await recording.done;delete window.__localReviewRecording;return data;});
    await writeFile(resolve(output,'playback.webm'),Buffer.from(video,'base64'));
    report.playback={file:'playback.webm',speed:1,timelineSeconds:durations[values.mode],wallSeconds:(Date.now()-started)/1000,observed:false};
    report.normalSpeedReview='recorded-not-observed';
  }
  assert.deepEqual(report.errors,[],'Lab browser errors');report.passed=true;report.stage='complete';
}catch(error){report.failure=error.stack||String(error);process.exitCode=1;}
finally{
  await context?.close();await browser?.close();await server?.close();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('LOCAL_LAB_REVIEW '+JSON.stringify(report));
}
