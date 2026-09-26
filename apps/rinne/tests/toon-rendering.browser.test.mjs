import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {chooseFamilyOrigin} from './family-origin.browser.mjs';

const root=process.cwd();
const browserPath=()=>{
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  }
  throw Error('Chromium is required for the selected toon browser test');
};
const waitForServer=async url=>{
  for(let i=0;i<450;i++){
    try{if((await fetch(url)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('RINNE Vite server did not start');
};

test('RINNE toon renderer compiles and presents the real game in Chromium',{timeout:180000},async()=>{
  const server=spawn('npm',['run','dev','--workspace','@soul/rinne'],{
    cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe'],
    detached:process.platform!=='win32'
  });
  let log='',browser;
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-12000);});
  try{
    await waitForServer('http://127.0.0.1:5173/');
    browser=await chromium.launch({headless:true,executablePath:browserPath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error'&&/WebGL|shader|GLSL|WebGLProgram|VALIDATE_STATUS|compile/i.test(message.text()))errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.ready==='true',null,{timeout:65000});
    if(await page.locator('#soul-brand-boot').count()){
      await page.waitForSelector('#soul-brand-boot.armed',{timeout:65000});
      await page.locator('#soul-brand-boot').click();
      await page.locator('#soul-brand-boot').waitFor({state:'detached'});
    }
    await page.waitForFunction(()=>document.getElementById('title-screen')?.dataset.intro==='idle',null,{timeout:30000});
    await page.locator('#new-life').click();
    await chooseFamilyOrigin(page);
    await page.waitForFunction(()=>document.getElementById('game')?.dataset.runtime==='active',null,{timeout:45000});
    await page.waitForTimeout(500);
    const snapshot=await page.locator('#game').evaluate(canvas=>{
      const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      return {
        runtime:canvas.dataset.runtime,
        renderQuality:canvas.dataset.renderQuality||null,
        worldSpace:canvas.dataset.worldSpace||null,
        width:canvas.width,
        height:canvas.height,
        hasContext:Boolean(gl),
        glError:gl?gl.getError():null,
        renderer:gl?gl.getParameter(gl.RENDERER):null
      };
    });
    assert.equal(snapshot.runtime,'active');
    assert.equal(snapshot.hasContext,true);
    assert.ok(snapshot.width>0&&snapshot.height>0);
    assert.equal(snapshot.glError,0);
    assert.ok(snapshot.renderQuality);
    assert.ok(snapshot.worldSpace);
    assert.deepEqual(errors,[],`RINNE WebGL console errors: ${errors.join(' | ')}`);
    console.log('RINNE_TOON_BROWSER_EVIDENCE '+JSON.stringify(snapshot));
    await context.close();
  }catch(error){
    console.error(log);
    throw error;
  }finally{
    await browser?.close();
    if(process.platform==='win32')server.kill('SIGTERM');
    else try{process.kill(-server.pid,'SIGTERM');}catch{}
  }
});
