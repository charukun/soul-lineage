import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createLife,serializeLife,LIFE_SECONDS} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {buildStations} from '../src/rebuild/locations.js';
import {defaultMuraLayout} from '@soul/world/mura';

const text=async locator=>(await locator.textContent()||'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function verifyRebuildPlaythrough(browser,url,output){
  await mkdir(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const stations=buildStations(defaultMuraLayout()),sword=stations.find(row=>row.id==='rack.weapon.sword'),port=stations.find(row=>row.id==='port-prayer');
  assert.ok(sword&&port,'default village must expose a sword rack and port');

  async function compactHud(){
    assert.equal(await page.locator('#objective-detail').count(),0,'normal HUD must not carry an explanation paragraph');
    assert.ok((await text(page.locator('#objective'))).length<=10,'objective must stay terse');
    assert.ok((await text(page.locator('#objective-badge'))).length<=10,'badge must stay terse');
    assert.equal(await page.locator('[data-context-action]').count(),0,'retired contextual action buttons must stay out of the play HUD');
    assert.equal(await page.locator('[id^="waypoint"]').count(),0,'retired waypoint chrome must stay out of the play HUD');
    assert.equal(await page.locator('.world-vignette').count(),1,'world material overlay must remain mounted');
    assert.equal(await page.locator('#chapter-mark').count(),1,'life chapters need a transient game-world title treatment');
  }
  async function expectTone(tone){assert.equal(await page.locator('#game-screen').getAttribute('data-world-tone'),tone);}
  async function waitGame(){
    await page.locator('#game-screen').waitFor({state:'visible'});await page.locator('#loading-card').waitFor({state:'hidden'});
    await page.locator('#game').waitFor({state:'visible'});await page.locator('#back-title').waitFor({state:'visible'});assert.equal(await page.locator('#game').getAttribute('data-runtime'),'active');await compactHud();
  }
  async function backToTitle(){
    if(await page.locator('#game-screen').isVisible().catch(()=>false)){await page.locator('#back-title').click();await page.locator('#title-screen').waitFor({state:'visible'});assert.equal(await page.locator('#game').getAttribute('data-runtime'),'prepared');}
  }
  async function saveKey(){
    const label=(await text(page.locator('#build-label'))).split('·')[0].trim().toLowerCase();return `soul:v1:${label||'local'}:rinne:local:life-v2`;
  }
  let key='';
  async function load(state){
    await backToTitle();if(!key)key=await saveKey();const value=serializeLife(state);
    await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key,value});await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#title-screen').waitFor({state:'visible'});assert.equal(await page.locator('#game').getAttribute('data-runtime'),'prepared');
    await page.locator('#continue-life').waitFor({state:'visible'});await page.locator('#continue-life').click();await waitGame();
  }
  const stateAt=(age,seed=41)=>{const state=createLife({name:'導線テスト',seed,villageIds:[defaultMuraLayout().id]});state.ageYears=age;state.ageSeconds=age*60;if(age>=4)state.phase='living';return state;};

  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.ok(response?.ok(),'rinne preview must answer successfully');
    await page.locator('#title-screen').waitFor({state:'visible'});assert.equal(await page.locator('#game').getAttribute('data-runtime'),'prepared');
    assert.match(await text(page.locator('.title-copy')),/暮らし、戦い、遺し/);assert.equal(await page.locator('.crest').count(),1);key=await saveKey();

    await page.locator('#new-life').click();await waitGame();await expectTone('village');
    assert.equal(await text(page.locator('#life-stage')),'1/6 誕生');assert.equal(await text(page.locator('#objective')),'母と村巡り');assert.equal(await text(page.locator('#objective-badge')),'自立 4歳');
    assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'true');assert.equal(await page.locator('.objective-card').isHidden(),true,'birth tour must teach through the world instead of the objective card');assert.equal(await page.locator('#talk').count(),0,'retired talk button must not return');
    await page.locator('#dialogue').waitFor({state:'visible'});assert.match(await text(page.locator('#dialogue-text')),/お外は初めて|村を見てまわろう/);
    assert.equal(await text(page.locator('#move-hint')),'スワイプで母を動かせる');
    const canvas=page.locator('#game'),box=await canvas.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width*.48,box.y+box.height*.62);await page.mouse.down();await page.mouse.move(box.x+box.width*.64,box.y+box.height*.52,{steps:6});await sleep(450);await page.mouse.up();
    assert.equal(await page.locator('#move-hint').isHidden(),true,'control hint should disappear after the first movement');
    await page.locator('#clock-rate').selectOption('20');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('2/6 村'),null,{timeout:18000});
    assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'false');await page.locator('.objective-card').waitFor({state:'visible'});assert.equal(await text(page.locator('#objective-badge')),'武具 7歳');await expectTone('village');await compactHud();await page.screenshot({path:join(output,'01-village-growth.png')});

    const prep=stateAt(8,42);prep.position={x:sword.x+1.35,z:sword.z};await load(prep);
    assert.equal(await text(page.locator('#life-stage')),'3/6 支度');assert.equal(await text(page.locator('#objective')),'武具を選ぶ');assert.equal(await page.locator('#talk').count(),0);await expectTone('village');
    prep.position={x:sword.x,z:sword.z};await load(prep);await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('装備'),null,{timeout:4000});
    assert.match(await text(page.locator('#toast')),/片手剣 装備/);assert.equal(await page.locator('#talk').count(),0);await page.screenshot({path:join(output,'02-equipment.png')});

    const departure=stateAt(15,43);departure.equipment.weapon='sword';departure.knownSkills.push('basic.sword');departure.position={x:port.x,z:port.z};departure.lastDepartureCycle=2;await load(departure);
    assert.equal(await text(page.locator('#life-stage')),'4/6 出立');assert.equal(await text(page.locator('#objective')),'港へ');assert.equal(await text(page.locator('#objective-badge')),'出航');assert.equal(await page.locator('#talk').count(),0);
    await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第1前線'),null,{timeout:5000});await expectTone('frontier');
    assert.match(await text(page.locator('#objective')),/敵へ|戦闘/);assert.equal(await page.locator('#talk').count(),0);await compactHud();await page.screenshot({path:join(output,'03-frontier-arrival.png')});

    const battle=stateAt(20,44);battle.zone='frontier';battle.front=0;battle.lastDepartureCycle=4;battle.position={x:0,z:0};battle.equipment.weapon='sword';battle.knownSkills.push('basic.sword');battle.skillWeights.jo={'basic.sword':100};
    const battleFront=createFront(0,battle.seed);battleFront.enemies.forEach((enemy,index)=>{enemy.x=index===0?.55:5+index*.35;enemy.z=index===0?.35:-4.8;});battle.frontState=battleFront;await load(battle);await expectTone('frontier');
    await page.waitForFunction(()=>document.getElementById('objective')?.textContent==='戦闘',null,{timeout:4000});
    await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('撃破'),null,{timeout:7000});assert.match(await text(page.locator('#objective-badge')),/敵 /);await compactHud();

    const cleared=stateAt(25,45);cleared.zone='frontier';cleared.front=0;cleared.lastDepartureCycle=5;cleared.position={x:0,z:-5.55};cleared.equipment.weapon='sword';const clearFront=createFront(0,cleared.seed);for(const enemy of clearFront.enemies){enemy.hp=0;enemy.dead=true;}clearFront.cleared=true;cleared.frontState=clearFront;await load(cleared);await expectTone('frontier');
    assert.equal(await text(page.locator('#objective')),'奥へ');
    await page.keyboard.down('ArrowUp');await sleep(650);await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第2前線'),null,{timeout:4000});

    const final=stateAt(40,46);final.zone='frontier';final.front=5;final.lastDepartureCycle=8;final.position={x:0,z:4.5};final.equipment.weapon='sword';const finalFront=createFront(5,final.seed);for(const enemy of finalFront.enemies){enemy.hp=0;enemy.dead=true;}finalFront.cleared=true;final.frontState=finalFront;await load(final);await expectTone('frontier');
    assert.equal(await text(page.locator('#objective')),'帰還へ');await page.keyboard.down('ArrowDown');await sleep(650);await page.keyboard.up('ArrowDown');
    await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('凱旋'),null,{timeout:4000});await expectTone('home');await compactHud();await page.screenshot({path:join(output,'04-homecoming.png')});

    const downed=stateAt(30,47);downed.zone='frontier';downed.front=1;downed.lastDepartureCycle=6;downed.position={x:0,z:0};downed.down={elapsed:39.2};downed.hp=0;downed.frontState=createFront(1,downed.seed);await load(downed);await expectTone('frontier');
    assert.equal(await text(page.locator('#objective')),'救助待ち');assert.match(await text(page.locator('#objective-badge')),/秒/);assert.equal(await page.locator('#talk').count(),0);await page.waitForFunction(()=>!document.getElementById('life-stage')?.textContent.includes('救助'),null,{timeout:4000});await expectTone('home').catch(async()=>expectTone('village'));

    const old=stateAt(99.99,48);old.ageSeconds=LIFE_SECONDS-.35;old.ageYears=old.ageSeconds/60;old.clockRate=20;old.lastDepartureCycle=20;old.equipment={weapon:'spear',armor:'light',shield:true};old.knownSkills.push('basic.spear','skill.step');old.defeats=12;old.returns=3;await load(old);
    await page.locator('.life-end-dialog[open]').waitFor({state:'visible',timeout:5000});await page.waitForFunction(()=>document.getElementById('game-screen')?.dataset.worldTone==='rebirth');await expectTone('rebirth');assert.match(await text(page.locator('.life-end-summary')),/12撃破/);assert.match(await text(page.locator('.life-end-help')),/次の人生は0歳/);assert.equal(await page.locator('#rebirth-village').count(),1);await page.screenshot({path:join(output,'05-life-end.png')});
    await page.locator('#rebirth').click();await page.waitForFunction(()=>document.getElementById('generation')?.textContent==='2代目',null,{timeout:5000});await expectTone('village');assert.equal(await text(page.locator('#life-stage')),'1/6 誕生');assert.equal(await text(page.locator('#toast')),'2代目 · 0歳');await page.screenshot({path:join(output,'06-rebirth.png')});

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
  const {verifyCoopPlay}=await import('./coop-play.browser.mjs');
  await verifyCoopPlay(browser,url,join(output,'friend-play'));
}