import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chooseFamilyOrigin} from './family-origin.browser.mjs';

const requested=String(process.env.ASTRA_COMMIT_MESSAGE||'').split(/\r?\n/).some(line=>line.trim()==='Astra-Test: apps/rinne/tests/family-origin-browser.test.mjs');
const browserPath=()=>{for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser'])try{return execFileSync('which',[name],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}throw Error('Chromium is required for the selected family browser test');};
const waitForServer=async url=>{for(let i=0;i<450;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}throw Error('RINNE Vite server did not start');};

test('family ritual starts after Start without replacing the title, then resumes the same life',{skip:!requested,timeout:240000},async()=>{
  const root=process.cwd(),dir=resolve(root,'artifacts/browser/rinne-family-origin');await mkdir(dir,{recursive:true});
  const {chromium}=await import('playwright');
  const server=spawn('npm',['run','dev','--workspace','@soul/rinne'],{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  let log='',browser,page;for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-12000);});
  const checks=[],errors=[];
  const shot=async name=>{const bytes=await page.screenshot({type:'jpeg',quality:50});await writeFile(resolve(dir,`${name.replace(/\.png$/,'')}.jpg`),bytes);console.log(`RINNE_FAMILY_IMAGE ${name} ${bytes.toString('base64')}`);};
  try{
    await waitForServer('http://127.0.0.1:5173/');
    browser=await chromium.launch({headless:true,executablePath:browserPath(),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce'});
    page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
    const ready=async()=>{
      await page.waitForFunction(()=>document.querySelector('#title-screen')?.dataset.ready==='true',null,{timeout:90000});
      if(await page.locator('#soul-brand-boot').count()){
        await page.waitForSelector('#soul-brand-boot.armed',{timeout:90000});
        await page.locator('#soul-brand-boot').click();
        await page.locator('#soul-brand-boot').waitFor({state:'detached'});
      }
      await page.waitForFunction(()=>document.querySelector('#title-screen')?.dataset.intro==='idle',null,{timeout:30000});
    };
    const titleIsCanonical=async()=>{
      assert.equal(await page.locator('.family-return-world').count(),0,'family art must never be injected into the game title');
      assert.equal(await page.locator('.title-family-caption').count(),0,'family caption must never replace title copy');
      assert.equal(await page.locator('#title-screen').getAttribute('data-family'),null,'title state must remain independent of family state');
      assert.equal(await page.locator('#title-cinematic-video').count(),1,'the existing opening movie element remains intact');
    };
    const stage=async index=>page.waitForSelector(`dialog.family-origin[open][data-step="${index}"]`);
    const rawSave=()=>page.evaluate(()=>{const key=Object.keys(localStorage).find(key=>key.endsWith(':rinne:local:life-v2'));return key?localStorage.getItem(key):null;});
    const readSave=async()=>JSON.parse(await rawSave()||'null');

    await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await ready();assert.equal(await rawSave(),null);await titleIsCanonical();await shot('00-title-untouched');
    await page.locator('#new-life').click();await stage(0);
    assert.equal(await page.locator('.family-origin').getAttribute('data-motion'),'off');
    assert.equal(await page.locator('.family-origin').getAttribute('data-scene'),'deepwater');
    assert.equal(await page.locator('.family-memory-orb').count(),3);
    assert.equal(await page.locator('.family-memory-choice').count(),0,'retired flat-card selector must not exist');
    assert.equal(await page.locator('.family-deepwater').count(),1);
    assert.equal(await page.locator('.family-story-prompt').textContent(),'どこへ帰る？');
    assert.equal(await page.locator('.family-ancestral-gate').count(),0);
    assert.equal(await page.locator('.family-ritual-progress').count(),0);
    const overflow=await page.locator('.family-origin').evaluate(dialog=>({scroll:dialog.scrollWidth,width:dialog.clientWidth}));assert.ok(overflow.scroll<=overflow.width+1,'mobile ritual overflows horizontally');
    await shot('01-ritual-mobile');
    await page.locator('[data-answer="wa"]').click();await stage(1);await page.locator('[data-origin-back]').click();await stage(0);assert.equal(await page.locator('[data-answer="wa"]').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');assert.equal(await page.locator('.family-origin').count(),0);assert.equal(await rawSave(),null);await titleIsCanonical();checks.push('deep-water story exists only after Start; back and Escape preserve the untouched title and empty save');

    await page.locator('#new-life').click();await chooseFamilyOrigin(page,{capture:shot});
    await page.waitForFunction(()=>document.querySelector('#game-screen')?.dataset.runtime==='active',null,{timeout:30000});
    await page.waitForFunction(()=>Object.keys(localStorage).some(key=>key.endsWith(':rinne:local:life-v2')),null,{timeout:10000});
    const first=await readSave();assert.equal(first.family.cultureId,'wa');assert.equal(first.family.traditionId,'katana');assert.equal(first.family.ethosId,'discern');assert.equal(first.family.origin,'chosen');assert.equal(first.equipment.weapon,'fist');assert.equal(first.generation,1);checks.push('Japanese katana family is durably saved as a newborn without weapon lock');

    const skip=page.locator('.rinneFirstRunSkip');if(await skip.isVisible())await skip.click();
    await page.locator('.family-memory-trigger').click();await page.waitForSelector('.family-memory-dialog[open]');assert.match(await page.locator('.family-memory-dialog').textContent(),/刀の家伝/);await shot('04-family-record');await page.locator('.family-memory-close').click();
    await page.locator('#back-title').click();await ready();await titleIsCanonical();await shot('05-title-still-untouched');checks.push('returning to title keeps the original title surface rather than family artwork');

    const beforeCancel=await rawSave();await page.locator('#new-life').click();await stage(0);
    await page.setViewportSize({width:844,height:390});const box=await page.locator('[data-answer="forest"]').boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=844,'landscape memory stays inside screen');
    await page.locator('[data-answer="forest"]').click();await stage(1);await page.locator('[data-answer="seek"]').click();await stage(2);await page.locator('[data-answer="staff"]').click();await stage(3);
    assert.equal(await page.locator('[data-origin-confirm]').isDisabled(),true,'replacement requires explicit acknowledgement');await page.locator('.family-story-replace').click();assert.equal(await page.locator('[data-replace-family]').isChecked(),true);assert.equal(await page.locator('[data-origin-confirm]').isEnabled(),true);
    await page.locator('[data-origin-cancel]').click();assert.equal(await rawSave(),beforeCancel);checks.push('landscape story and acknowledged replacement can be cancelled without touching the saved life');

    await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'domcontentloaded'});await ready();await titleIsCanonical();await page.locator('#continue-life').click();await page.waitForFunction(()=>document.querySelector('#game-screen')?.dataset.runtime==='active',null,{timeout:30000});assert.equal(await page.locator('.family-origin').count(),0);
    await page.locator('#back-title').click();await ready();await titleIsCanonical();const continued=await readSave();assert.equal(continued.id,first.id);assert.deepEqual(continued.family,first.family);assert.equal(continued.generation,first.generation);assert.ok(continued.ageSeconds>=first.ageSeconds);checks.push('Continue bypasses the ritual and resumes the same person, family and generation');

    assert.deepEqual(errors,[]);await writeFile(resolve(dir,'result.json'),JSON.stringify({head:process.env.GITHUB_SHA,checks,errors},null,2));console.log('RINNE_FAMILY_PLAYTEST '+JSON.stringify({head:process.env.GITHUB_SHA,checks,errors}));await context.close();
  }catch(error){console.error(log);if(page){console.error('RINNE_FAMILY_FAILURE '+JSON.stringify({checks,errors,screen:await page.evaluate(()=>({title:document.querySelector('#title-screen')?.dataset,boot:document.querySelector('#boot-status')?.textContent})).catch(()=>null)}));await shot('failure').catch(()=>{});}throw error;}finally{await browser?.close();if(process.platform==='win32')server.kill('SIGTERM');else try{process.kill(-server.pid,'SIGTERM');}catch{}}
});
