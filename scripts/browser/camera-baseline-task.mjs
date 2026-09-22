// Isolated task-branch observation harness; never shipped with the game.
import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createLife,serializeLife} from '../../apps/rinne/src/rebuild/domain.js';
import {createFront} from '../../apps/rinne/src/rebuild/combat.js';
import {buildInteriors} from '../../apps/rinne/src/rebuild/locations.js';
import {defaultMuraLayout} from '@soul/world/mura';
const output='test-results/camera-before';await mkdir(output,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','apps/rinne/vite.config.js','--host','127.0.0.1','--port','5273','--strictPort'],{stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
let browser;const receipt={head,status:'running',realDevice:false,scenarios:[],errors:[]};
try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5273/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-sandbox']});
  for(const scenario of ['exploration','combat','interior']){
    const life=createLife({name:'カメラ確認',seed:742,villageIds:[defaultMuraLayout().id]});life.ageYears=22;life.ageSeconds=22*60;life.phase='living';life.lastDepartureCycle=4;life.equipment={weapon:scenario==='interior'?'spear':'sword',armor:'light',shield:true};life.knownSkills.push('basic.sword','basic.spear');life.position={x:0,z:0};
    if(scenario==='combat'){life.zone='frontier';life.front=0;life.frontState=createFront(0,life.seed);life.frontState.enemies.forEach((e,i)=>{e.dead=i>0;if(i===0){e.x=0;e.z=2.15;e.hp=900;e.maxHp=900;}});}
    if(scenario==='interior'){const room=buildInteriors(defaultMuraLayout())[0];life.interior={buildingId:room.id,returnPosition:{x:0,z:0}};life.position={x:0,z:0};}
    const context=await browser.newContext({viewport:{width:1100,height:800},reducedMotion:'reduce'});await context.tracing.start({screenshots:true,snapshots:true,sources:true});const page=await context.newPage();page.setDefaultTimeout(90000);
    page.on('pageerror',e=>receipt.errors.push(scenario+': '+e.message));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(scenario+': '+m.text());});
    await page.addInitScript(value=>localStorage.setItem('soul:v1:dev:rinne:local:life-v2',value),serializeLife(life));
    try{
      await page.goto('http://127.0.0.1:5273/',{waitUntil:'domcontentloaded'});await expect(page.locator('#title-screen')).toHaveAttribute('data-ready','true');
      if(await page.locator('#soul-brand-boot').count()){await expect(page.locator('#soul-brand-boot')).toHaveClass(/armed/);await page.locator('#soul-brand-boot').click();}
      await page.waitForFunction(()=>{const t=document.getElementById('title-screen');return t?.dataset.intro==='idle'||t?.dataset.skip==='ready';});
      if(await page.locator('#title-screen').getAttribute('data-intro')==='cinematic')await page.locator('#title-screen').click({position:{x:70,y:70}});
      await expect(page.locator('#title-screen')).toHaveAttribute('data-intro','idle');await page.locator('#continue-life').click();await expect(page.locator('#game')).toHaveAttribute('data-runtime','active');
      if(await page.locator('.rinneFirstRunSkip').isVisible())await page.locator('.rinneFirstRunSkip').click();
      await page.waitForTimeout(1500);
      const snap=async name=>{await page.screenshot({path:output+'/'+name+'.png'});receipt.scenarios.push({name,canvas:await page.locator('#game').evaluate(c=>({...c.dataset}))});};
      await snap(scenario);
      if(scenario==='exploration'){await page.locator('#camera-position').focus();await page.keyboard.press('Home');await page.waitForTimeout(1200);await snap('exploration-near');await page.keyboard.press('End');await page.waitForTimeout(1200);await snap('exploration-far');await page.setViewportSize({width:390,height:844});await page.keyboard.press('Home');await page.waitForTimeout(1000);await snap('exploration-mobile');}
    }finally{await context.tracing.stop({path:output+'/'+scenario+'-trace.zip'});await context.close();}
  }
  if(receipt.errors.length)throw Error(JSON.stringify(receipt.errors));receipt.status='passed';
}catch(error){receipt.status='failed';receipt.failure=error.stack;throw error;}
finally{await writeFile(output+'/receipt.json',JSON.stringify(receipt,null,2));await browser?.close();server.kill('SIGTERM');await writeFile(output+'/preview.log',serverLog);console.log('CAMERA_BASELINE '+JSON.stringify(receipt));}
