// Specialist check for the single-image procedural candidate and its actual selection view.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,stat} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import * as THREE from 'three';
import {createReferenceChibi} from '../packages/assets/src/procedural-character/create-reference-chibi.js';

test('front and side have real volume and render in character selection',{timeout:300000},async()=>{
  const model=createReferenceChibi(THREE),head=model.getObjectByName('Cranium');
  const headBox=new THREE.Box3().setFromObject(head),torsoBox=new THREE.Box3().setFromObject(model.getObjectByName('Continuous grey sleeveless suit'));
  assert.ok(headBox.max.z-headBox.min.z>.7,'head needs rounded front-to-back depth');
  assert.ok(torsoBox.max.z-torsoBox.min.z>.42,'torso needs a real side profile');
  execFileSync('npm',['run','build:review'],{stdio:'inherit',timeout:120000});
  if(!await import('node:fs').then(fs=>fs.existsSync(chromium.executablePath())))
    execFileSync('npx',['playwright','install','--with-deps','chromium'],{stdio:'inherit',timeout:150000});
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','apps/review/vite.config.js','--host','127.0.0.1','--port','5298','--strictPort'],{stdio:'ignore'});
  let browser;
  try{
    for(let i=0;i<120;i++){
      try{if((await fetch('http://127.0.0.1:5298/')).ok)break;}catch{}
      if(server.exitCode!==null)throw Error('Review preview stopped');
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:5298/review-character-forge?character=reference-chibi-front-20260923');
    await page.locator('.forge-panel[data-ready="true"]').waitFor({timeout:60000});
    assert.match(await page.locator('.forge-status').innerText(),/正面図チビキャラ/);
    assert.equal(await page.locator('[data-forge-candidate="reference-chibi-front-20260923"]').getAttribute('aria-pressed'),'true');
    const output='test-results/reference-chibi';await mkdir(output,{recursive:true});
    await page.locator('.forge-page').screenshot({path:output+'/front.png'});
    await page.locator('.review-stage-controls__button').click();
    await page.locator('[data-forge-view="side"]').click();
    assert.equal(await page.locator('.forge-panel').getAttribute('data-view'),'side');
    const snapshot=await page.locator('#forge-stage').evaluate(canvas=>canvas.characterForgeSnapshot());
    assert.equal(snapshot.id,'reference-chibi-front-20260923');
    await page.locator('.forge-page').screenshot({path:output+'/side.png'});
    assert.ok((await stat(output+'/side.png')).size>15000,'side screenshot should contain a rendered scene');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();server.kill('SIGTERM');}
});
