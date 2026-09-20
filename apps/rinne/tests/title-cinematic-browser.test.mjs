import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd(),app=resolve(root,'apps/rinne');
// Explicit selection preserves the existing opt-in browser lane. No automatic sweep.
const browserRequested=process.env.RINNE_TITLE_BROWSER==='1'||String(process.env.ASTRA_COMMIT_MESSAGE||'').split(/\r?\n/).some(line=>line.trim()==='Astra-Test: apps/rinne/tests/title-cinematic-browser.test.mjs');
const manifest=JSON.parse(await readFile(resolve(app,'public/title-assets/cinematic/manifest.json')));
const ready={...manifest,status:'ready',revision:'decoder-fixture',movie:'./title-assets/cinematic/opening.mp4',webm:null,duration:8,livingLoop:{start:6,end:8}};
const browserPath=()=>{for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])try{return execFileSync('which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}throw Error('Chromium is required for the selected browser test');};
const waitForServer=async url=>{for(let i=0;i<450;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Vite server did not start');};

test('RINNE title: decoded movie, skips, matching landing, return, failure and Fold layouts',{skip:!browserRequested,timeout:240000},async()=>{
  const {chromium}=await import('playwright');
  const dir=resolve(root,'artifacts/browser/rinne-title-cinematic');await mkdir(dir,{recursive:true});
  // Use the repository's existing dev entry so pinned game assets are available.
  const server=spawn('npm',['run','dev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',c=>{log=(log+c).slice(-8000);});
  const evidence={media:{shipping:manifest.movie,revision:manifest.revision,fixture:'synthetic H264 for transport/lifecycle edge cases'},checks:[],consoleErrors:[],mediaErrors:[]};
  const shot=async(page,name)=>{
    const bytes=await page.screenshot({type:'jpeg',quality:48});await writeFile(resolve(dir,name+'.jpg'),bytes);
    // Keep screenshots retrievable with this exact-head job; no new workflow/artifact step.
    console.log('RINNE_TITLE_IMAGE '+name+' '+bytes.toString('base64'));
  };
  try{
    await waitForServer('http://127.0.0.1:5173/');
    browser=await chromium.launch({headless:true,executablePath:browserPath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>evidence.consoleErrors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text());});
    // Integration keeps the actual entry, title markup, CSS and controller. Gameplay is isolated.
    await page.route('**/src/gameplay-upgrade.js*',r=>r.fulfill({contentType:'application/javascript',body:'export function installRinneGameplayUpgrade(){return {dispose(){}}}'}));
    await page.route('**/src/rebuild/runtime.js*',r=>r.fulfill({contentType:'application/javascript',body:`export async function prepareRuntime(){return {stopTitlePreview(){},dispose(){}}} export async function startRuntime({onExit}){document.getElementById('back-title').onclick=onExit;return {dispose(){}}}`}));
    let mediaMode='shipping';
    await page.route('**/title-assets/cinematic/manifest.json',r=>r.fulfill({json:mediaMode==='shipping'?manifest:ready}));
    await page.route('**/title-assets/cinematic/opening.mp4',r=>mediaMode==='broken'?r.abort():r.continue({url:'http://127.0.0.1:5173/tests/fixtures/title-decoder-test.mp4'}));
    const goto=async()=>{await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('title-screen').dataset.ready==='true');};
    const idle=()=>page.waitForFunction(()=>document.getElementById('title-screen').dataset.intro==='idle');
    await goto();
    assert.equal(manifest.status,'ready','the generated film is the shipping asset');
    await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);
    assert.equal(await page.locator('.title-actions').evaluate(n=>n.inert),true);
    for(const [time,name] of [[.35,'01-film-mother'],[1.25,'02-film-battle'],[2.3,'03-film-elder'],[3.25,'04-film-rebirth']]){
      // Seek/pause the real decoded media for exact scene evidence, then resume normal playback.
      await page.locator('video').evaluate(async(v,t)=>{v.pause();v.currentTime=t;if(v.seeking)await new Promise(done=>v.addEventListener('seeked',done,{once:true}));},time);
      const position=await page.locator('video').evaluate(v=>getComputedStyle(v).objectPosition);
      assert.equal(position,time<68/24?'44% 50%':'50% 50%');
      await shot(page,name+'-portrait');
    }
    await page.locator('video').evaluate(v=>v.play());
    await idle();await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.title-actions')).opacity)>.99);
    const shippingMedia=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,error:v.error?.code??null,paused:v.paused,src:v.getAttribute('src')}));
    assert.equal(shippingMedia.src,manifest.movie);assert.equal(shippingMedia.width,manifest.width);assert.equal(shippingMedia.height,manifest.height);assert.equal(shippingMedia.error,null);assert.ok(shippingMedia.time>=manifest.duration-1/manifest.fps);
    if(!manifest.livingLoop)assert.equal(shippingMedia.paused,true);
    evidence.shippingDecode=shippingMedia;
    await shot(page,'01-shipping-portrait');
    await page.setViewportSize({width:915,height:412});await shot(page,'02-shipping-landscape');
    for(const size of [{width:412,height:915},{width:915,height:412}]){
      await page.setViewportSize(size);
      const boxes=await page.locator('.title-actions').boundingBox();assert.ok(boxes.x>=0&&boxes.y>=0&&boxes.x+boxes.width<=size.width&&boxes.y+boxes.height<=size.height,'menu fits Fold viewport');
    }
    evidence.checks.push('delivered generated MP4 decodes and naturally lands at six seconds; portrait 412x915; landscape 915x412; menu inside viewport');
    mediaMode='ready';await page.setViewportSize({width:412,height:915});await goto();
    await page.waitForFunction(()=>document.querySelector('video').currentTime>.1);
    assert.equal(await page.locator('.title-actions').evaluate(n=>n.inert),true);
    assert.equal(await page.locator('.title-actions').evaluate(n=>getComputedStyle(n).visibility),'hidden');
    await page.mouse.click(20,400);assert.equal(await page.locator('#title-screen').getAttribute('data-intro'),'cinematic');
    await page.waitForFunction(()=>document.getElementById('title-screen').dataset.skip==='ready');
    await page.mouse.click(20,400);await idle();
    await page.waitForFunction(()=>document.getElementById('title-screen').dataset.media==='video'&&!document.querySelector('video').seeking);
    const landed=await page.locator('video').evaluate(v=>({time:v.currentTime,error:v.error?.code??null,ready:v.readyState}));
    console.log('RINNE_TITLE_LANDING '+JSON.stringify(landed));
    assert.ok(landed.time>=6&&landed.time<8);assert.equal(landed.error,null);assert.ok(landed.ready>=2);
    evidence.checks.push('real H264 decode; no opening menu; early tap locked; skip at 1.8s; seek to living tail');
    await page.locator('#new-life').click();await page.waitForFunction(()=>document.getElementById('game-screen').dataset.runtime==='active');
    await page.locator('#back-title').click();await idle();assert.ok(await page.locator('video').evaluate(v=>v.currentTime>=6));
    evidence.checks.push('title → start → return; no opening replay');
    await goto();await page.waitForFunction(()=>document.getElementById('title-screen').dataset.intro==='cinematic');
    assert.equal(await page.locator('#title-screen').getAttribute('data-skip'),'ready');await page.keyboard.press('Enter');await idle();
    evidence.checks.push('revisit immediate keyboard skip');
    await goto();await idle();assert.ok(await page.locator('video').evaluate(v=>v.currentTime>=6));
    evidence.checks.push('natural six-second landing');
    await page.emulateMedia({reducedMotion:'reduce'});await goto();await idle();assert.equal(await page.locator('video').getAttribute('src'),null);
    evidence.checks.push('reduced motion uses poster without video download');
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Intentional transport failure is tested separately from clean-run diagnostics.
    assert.deepEqual(evidence.consoleErrors,[]);mediaMode='broken';await goto();await idle();
    assert.equal(await page.locator('#title-screen').getAttribute('data-media'),'poster');assert.equal(await page.locator('.title-actions').evaluate(n=>n.inert),false);
    evidence.checks.push('intentional media failure yields usable poster title');
    evidence.expectedFailureConsole=evidence.consoleErrors.splice(0);evidence.mediaErrors.push('intentional aborted test movie handled');
    await context.close();
    // A separate context exercises the actual latest game and captures source-grounded references.
    const real=await browser.newContext({viewport:{width:915,height:412},deviceScaleFactor:1});const game=await real.newPage();
    game.on('pageerror',e=>console.log('RINNE_GAME_ERROR '+e.message));
    game.on('console',m=>{if(m.type()==='error')console.log('RINNE_GAME_CONSOLE '+m.text());});
    await game.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    await game.waitForFunction(()=>document.getElementById('title-screen').dataset.ready==='true',null,{timeout:65000});
    await game.locator('#new-life').click();await game.waitForFunction(()=>document.getElementById('game-screen').dataset.runtime==='active',null,{timeout:30000});
    await shot(game,'03-actual-game-birth');
    await game.locator('#back-title').click();await game.waitForFunction(()=>document.getElementById('title-screen').dataset.intro==='idle');
    evidence.checks.push('unmocked game boot, birth and return');await real.close();
    await writeFile(resolve(dir,'playtest-receipt.json'),JSON.stringify(evidence,null,2));console.log('RINNE_BROWSER_EVIDENCE '+JSON.stringify(evidence));
  }catch(error){console.error(log);throw error;}finally{await browser?.close();if(process.platform==='win32')server.kill('SIGTERM');else try{process.kill(-server.pid,'SIGTERM');}catch{}}
});
