import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';

const root=path.resolve(new URL('../../..',import.meta.url).pathname);
const chrome=()=>{
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  }
  return null;
};

test('Battle2 Johakyu renderer compiles the shared RINNE toon law in Chromium',{timeout:210000},async()=>{
  const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5176','--strictPort'],{
    cwd:path.join(root,'apps/review'),stdio:'pipe'
  });
  let browser,log='';
  for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-12000);});
  try{
    let ready=false;
    for(let i=0;i<100;i++){
      try{if((await fetch('http://127.0.0.1:5176/battle2?evidence=1')).ok){ready=true;break;}}catch{}
      await delay(250);
    }
    assert.ok(ready,'Review Battle2 server started');
    const executable=chrome();
    browser=await chromium.launch(executable?{executablePath:executable,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
    const page=await browser.newPage({viewport:{width:915,height:412}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error'&&/WebGL|shader|GLSL|WebGLProgram|VALIDATE_STATUS|compile/i.test(message.text()))errors.push(message.text());
    });
    await page.goto('http://127.0.0.1:5176/battle2?evidence=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__BATTLE2__?.metrics?.ready===true,null,{timeout:90000});
    await page.locator('#battle2-start').click();
    await page.waitForFunction(()=>window.__BATTLE2__?.started===true&&window.__BATTLE2__?.metrics?.toon?.materials>0,null,{timeout:45000});
    await page.waitForTimeout(500);
    const evidence=await page.evaluate(()=>{
      const canvas=document.getElementById('world'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),metrics=window.__BATTLE2__.metrics;
      return {
        state:window.__BATTLE2__.state,
        sourceSha:window.__BATTLE2__.sourceSha,
        toon:metrics.toon,
        frames:metrics.frames,
        drawCalls:metrics.drawCalls,
        triangles:metrics.triangles,
        width:canvas.width,
        height:canvas.height,
        hasContext:Boolean(gl),
        glError:gl?gl.getError():null,
        renderer:gl?gl.getParameter(gl.RENDERER):null
      };
    });
    assert.equal(evidence.hasContext,true);
    assert.equal(evidence.glError,0);
    assert.ok(evidence.width>0&&evidence.height>0);
    assert.equal(evidence.toon.shaderModel,'rinne-banded-toon-v2');
    assert.ok(evidence.toon.materials>0,'Battle2 scene has toon-controlled materials');
    assert.ok(evidence.frames>0);
    assert.ok(evidence.drawCalls>0);
    assert.ok(evidence.triangles>0);
    assert.deepEqual(errors,[],`Battle2 WebGL console errors: ${errors.join(' | ')}`);
    console.log('BATTLE2_TOON_BROWSER_EVIDENCE '+JSON.stringify(evidence));
  }catch(error){
    console.error(log);
    throw error;
  }finally{
    await browser?.close();
    server.kill('SIGTERM');
  }
});
