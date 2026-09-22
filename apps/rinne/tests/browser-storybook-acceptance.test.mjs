import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

/** Selected explicitly by Astra for the approved UI task. No production test API or save is changed. */
test('approved storybook pages render and commit real canonical choices on the exact head',{timeout:240000},async()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
  const app=resolve(root,'apps/rinne'),file=resolve(app,`storybook-acceptance-${process.pid}.html`),evidence=resolve(root,'.artifacts/storybook-acceptance');
  await mkdir(evidence,{recursive:true});
  if(!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','chromium'],{cwd:root,stdio:'inherit',timeout:120000});
  const index=await readFile(resolve(app,'index.html'),'utf8'),head=index.match(/<head>[\s\S]*?<\/head>/)[0],game=index.match(/<section id="game-screen"[\s\S]*?<\/section>/)[0].replace('is-loading','').replace('aria-busy="true"','aria-busy="false"');
  await writeFile(file,`<!doctype html><html lang="ja">${head}<body><main id="app" data-screen="game">${game}</main><script type="module">
  import {createGameplayUI} from './src/inspiration-gameplay-ui.js';
  import {createLife,serializeLife,deserializeLife} from './src/rebuild/domain.js';
  import {ensureCombatLoadout,setHeartSlot} from './src/combat-loadout.js';
  import {SUPPORT_SKILLS,ACTION_SKILLS} from './src/rebuild/skill-system.js';
  import {ensureInspiration} from './src/rebuild/inspiration-state.js';
  import {buildStorybookModel} from './src/storybook-model.js';
  const screen=document.querySelector('#game-screen');screen.dataset.gameplayUpgrade='true';screen.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;display:block';document.querySelector('#loading-card').remove();
  let state;
  const audio={ui(){},item(){},combat(){},unlock(){}};
  function fixture(age=20){const s=createLife({seed:619});s.ageYears=age;s.ageSeconds=age*60;s.phase=age>=4?'living':'birth';ensureInspiration(s);if(age>=7){s.inspiration.legacySkills=[...SUPPORT_SKILLS.map(v=>v.id),...ACTION_SKILLS.filter(v=>!v.id.startsWith('spark.')).map(v=>v.id)];s.knownSkills=[...new Set([...s.knownSkills,...s.inspiration.legacySkills])];s.equipment={weapon:'sword',armor:'cloth',shield:false};s.inventory={weapons:['fist','sword','dagger','great','spear','axe','staff'],armors:['cloth','light','heavy'],shields:[false,true]};}ensureCombatLoadout(s);if(age>=7)for(let i=0;i<3;i++)setHeartSlot(s,i,SUPPORT_SKILLS[i].id);return s;}
  const ui=createGameplayUI(screen,{stations:[],layout:{id:'acceptance',objects:[]},audio,requestEquip(kind,value){if(state.ageYears<7)return {ok:false,reason:'武具は7歳からです。'};if(state.combat)return {ok:false,reason:'戦闘中です。'};const changed=state.equipment[kind]!==value;state.equipment[kind]=value;return {ok:true,changed};}});
  window.acceptance={ui,fixture,build:__BUILD_INFO__,get state(){return state},set(s){state=s;ui.bindState(s)},snapshot(){return structuredClone(state.combatLoadout)},model(p){return buildStorybookModel(state,p)},roundtrip(){state=deserializeLife(serializeLife(state));ui.bindState(state)}};
  window.acceptance.set(fixture());window.acceptanceReady=true;
  </script></body></html>`);
  process.env.APP_ENV=process.env.APP_ENV||'dev';
  let server,browser;
  const errors=[];
  try{
    server=await createServer({configFile:resolve(app,'vite.config.js'),server:{host:'127.0.0.1',port:4187,strictPort:true}});await server.listen();
    browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:390,height:680},hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(15000);
    await page.goto(`http://127.0.0.1:4187/storybook-acceptance-${process.pid}.html`);await page.waitForFunction(()=>window.acceptanceReady);
    const build=await page.evaluate(()=>window.acceptance.build);if(process.env.GITHUB_SHA)assert.equal(build.commit,process.env.GITHUB_SHA,'browser must use the validated exact head');
    const names=[['heart','[data-heart]'],['technique','[data-techniques]'],['body','.rinne-primary-four [data-body]'],['items','[data-items]']];
    for(const [p,selector]of names){
      await page.locator(selector).click();await page.locator(`.rb-page[data-book-page="${p}"]`).waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.rb-page img')].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r})));});
      assert.equal(await page.locator('.rb-slot').count(),3,`${p}: canonical slot count`);
      assert.equal(await page.locator('.rinne-primary-four button').count(),4,'persistent 心技体装');
      assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.rb-page img')].filter(i=>!i.naturalWidth).length),0,`${p}: materialized artwork`);
      const close=await page.locator('[data-book-action="close"]').boundingBox();assert.ok(close&&close.x>=0&&close.y>=0&&close.x+close.width<=390&&close.y+close.height<=680,'close control reachable');
      await page.screenshot({path:resolve(evidence,`${p}.png`)});
    }
    await page.locator('[data-heart]').click();const before=await page.evaluate(()=>window.acceptance.snapshot()),tile=page.locator('.rb-tile').nth(4),id=await tile.getAttribute('data-book-id');await tile.click();assert.deepEqual(await page.evaluate(()=>window.acceptance.snapshot()),before,'preview and simulated mind balance must not mutate life');await page.locator('[data-book-action="equip"]').click();assert.equal(await page.evaluate(()=>window.acceptance.state.combatLoadout.heart.active[0]),id);
    await page.evaluate(()=>window.acceptance.roundtrip());assert.equal(await page.evaluate(()=>window.acceptance.state.combatLoadout.heart.active[0]),id,'chosen heart survives the canonical save codec');
    await page.locator('[data-items]').click();await page.locator('[data-book-id="armor:light"]').click();assert.equal(await page.evaluate(()=>window.acceptance.state.equipment.armor),'cloth');await page.locator('[data-book-action="equip"]').click();assert.equal(await page.evaluate(()=>window.acceptance.state.equipment.armor),'light');
    await page.keyboard.press('Escape');assert.equal(await page.locator('.rinne-core-menu').isVisible(),false);assert.equal(await page.locator('#game-screen').getAttribute('data-storybook-open'),null,'closing restores the game rather than leaving a ghost panel');
    await page.evaluate(()=>{window.acceptance.set(window.acceptance.fixture(0));window.acceptance.ui.open('items')});assert.equal(await page.locator('[data-book-action="equip"]').isDisabled(),true);assert.equal(await page.locator('[data-book-action="remove"]').isDisabled(),true);
    await page.evaluate(()=>{const s=window.acceptance.fixture();s.combat={training:false};window.acceptance.set(s);window.acceptance.ui.open('heart')});assert.equal(await page.locator('[data-book-action="equip"]').isDisabled(),true);
    await page.evaluate(()=>{const s=window.acceptance.fixture();window.acceptance.set(s);document.querySelector('#game').dataset.coopPlayer='test';window.acceptance.ui.open('body')});assert.equal(await page.locator('[data-book-action="equip"]').isDisabled(),true);
    await page.evaluate(()=>{delete document.querySelector('#game').dataset.coopPlayer;window.acceptance.set(window.acceptance.fixture());window.acceptance.ui.open('body')});
    for(const viewport of [{width:360,height:520},{width:740,height:360},{width:941,height:1672}]){await page.setViewportSize(viewport);await page.waitForTimeout(100);const nav=await page.locator('.rinne-primary-four').boundingBox();assert.ok(nav&&nav.x>=0&&nav.x+nav.width<=viewport.width+1&&nav.y+nav.height<viewport.height-10,'navigation fits '+JSON.stringify(viewport));await page.screenshot({path:resolve(evidence,`body-${viewport.width}x${viewport.height}.png`)});}
    assert.deepEqual(errors,[]);
    await writeFile(resolve(evidence,'receipt.json'),JSON.stringify({exactHead:build.commit,kind:'production-controller-browser-acceptance',scope:'isolated UI fixtures, not a full-life no-injection playthrough',pages:4,checks:['canonical-slots','four-core-controls','all-artwork-loaded','close-hit-target','preview-is-nonmutating','heart-confirm','canonical-save-roundtrip','equipment-confirm','escape-cleanup','age-gate','combat-readonly','shared-readonly','three-viewport-bounds'],errors},null,2));
    console.log(`Storybook acceptance passed on ${build.commit}: four pages, live canonical setters, read-only gates, save roundtrip, three viewport checks.`);
    await context.close();
  }finally{await browser?.close();await server?.close();await rm(file,{force:true});}
});
