import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

test('the supplied chibi is selectable in Character Studio and retains side volume',{timeout:300000},async()=>{
  execFileSync('npm',['run','build','--workspace','@soul/character-studio'],{stdio:'inherit',timeout:120000});
  if(!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','--with-deps','chromium'],{stdio:'inherit',timeout:150000});
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','apps/character-studio/vite.config.js','--host','127.0.0.1','--port','5299','--strictPort'],{stdio:'ignore'});
  let browser;
  try{
    let reachable=false;
    for(let i=0;i<120;i++){
      try{if((await fetch('http://127.0.0.1:5299/')).ok){reachable=true;break;}}catch{}
      if(server.exitCode!==null)throw new Error('Character Studio preview stopped');
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(reachable,'preview must start');
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5299/');
    const option=page.locator('[data-model-key="reference-chibi-front-20260923"]');
    await option.waitFor({timeout:60000});await option.click();
    await page.waitForFunction(()=>window.masterCharacterReview?.displayModelId==='reference-chibi-front-20260923'&&Boolean(window.masterCharacterReview?.proceduralRoot));
    assert.equal(await option.getAttribute('aria-selected'),'true');
    const depth=await page.evaluate(()=>{
      const root=window.masterCharacterReview.proceduralRoot;
      const body=root.getObjectByName('Continuous grey sleeveless suit');
      body.geometry.computeBoundingBox();
      const bounds=body.geometry.boundingBox;
      return bounds.max.z-bounds.min.z;
    });
    assert.ok(depth>.42,'the torso must have visible front-to-back depth');
    await mkdir('test-results/character-chibi',{recursive:true});
    await page.locator('.review-surface__stage').screenshot({path:'test-results/character-chibi/front.png'});
    await page.locator('[data-camera="side"]').click();
    await page.locator('.review-surface__stage').screenshot({path:'test-results/character-chibi/side.png'});
    const side=await readFile('test-results/character-chibi/side.png');
    assert.ok(side.length>15000,'side screenshot should contain rendered content');
    if(side.length<200000)console.log('CHIBI_SIDE_MEDIA '+side.toString('base64'));
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();server.kill('SIGTERM');}
});
