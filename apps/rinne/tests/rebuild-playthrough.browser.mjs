import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createLife,serializeLife,LIFE_SECONDS} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {buildStations} from '../src/rebuild/locations.js';
import {defaultMuraLayout} from '@soul/world/mura';

const text=async locator=>(await locator.textContent()||'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function verifyRebuildPlaythrough(browser,url,output,{recordVideo=false}={}){
  await mkdir(output,{recursive:true});
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce',...(recordVideo?{recordVideo:{dir:join(output,'video'),size:{width:390,height:844}}}:{})}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const stations=buildStations(defaultMuraLayout()),sword=stations.find(row=>row.id==='rack.weapon.sword'),port=stations.find(row=>row.id==='port-prayer');
  assert.ok(sword&&port,'default village must expose a sword rack and port');

  async function expectTone(tone){assert.equal(await page.locator('#game-screen').getAttribute('data-world-tone'),tone);}
  async function expectNonEmpty(locator,label){const value=await text(locator);assert.ok(value.length>0,`${label} must not be empty`);return value;}
  async function waitGame(){
    await page.locator('#game-screen').waitFor({state:'visible'});await page.locator('#loading-card').waitFor({state:'hidden'});
    await page.locator('#game').waitFor({state:'visible'});await page.locator('#back-title').waitFor({state:'visible'});
    assert.equal(await page.locator('#game').getAttribute('data-runtime'),'active');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'play surface must fit the viewport');
  }
  async function backToTitle(){
    if(await page.locator('#game-screen').isVisible().catch(()=>false)){await page.locator('#back-title').click();await page.locator('#title-screen').waitFor({state:'visible'});assert.equal(await page.locator('#game').getAttribute('data-runtime'),'prepared');}
  }
  async function saveKey(){const label=(await text(page.locator('#build-label'))).split('·')[0].trim().toLowerCase();return `soul:v1:${label||'local'}:rinne:local:life-v2`;}
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
    await expectNonEmpty(page.locator('.title-copy'),'title copy');assert.equal(await page.locator('.crest').count(),1);key=await saveKey();

    // Birth: the world, mother-led tour and real movement input must all work.
    await page.locator('#new-life').click();await waitGame();await expectTone('village');
    assert.match(await text(page.locator('#life-stage')),/誕生/);await expectNonEmpty(page.locator('#objective'),'birth objective');await expectNonEmpty(page.locator('#objective-badge'),'birth objective badge');
    assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'true');assert.equal(await page.locator('.objective-card').isHidden(),true,'birth tour must teach through the world instead of the objective card');
    await page.locator('#dialogue').waitFor({state:'visible'});await expectNonEmpty(page.locator('#dialogue-text'),'birth dialogue');await expectNonEmpty(page.locator('#move-hint'),'movement hint');
    const canvas=page.locator('#game'),box=await canvas.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width*.48,box.y+box.height*.62);await page.mouse.down();await page.mouse.move(box.x+box.width*.64,box.y+box.height*.52,{steps:6});await sleep(450);await page.mouse.up();assert.equal(await page.locator('#move-hint').isHidden(),true,'movement input should dismiss the first-use hint');

    // Growth: accelerated world time must leave the birth tour and enter normal play.
    for(let i=0;i<3;i++)await page.locator('#clock-rate').click();assert.equal(await page.locator('#clock-rate').evaluate(node=>node.value),'20');
    await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('2/6'),null,{timeout:18000});assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'false');await page.locator('.objective-card').waitFor({state:'visible'});await expectTone('village');await page.screenshot({path:join(output,'01-village-growth.png')});

    // Equipment: proximity to the actual sword rack must produce a usable weapon.
    const prep=stateAt(8,42);prep.position={x:sword.x+1.35,z:sword.z};await load(prep);assert.match(await text(page.locator('#life-stage')),/支度/);await expectTone('village');
    prep.position={x:sword.x,z:sword.z};await load(prep);await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('装備'),null,{timeout:4000});assert.match(await text(page.locator('#toast')),/装備/);await page.screenshot({path:join(output,'02-equipment.png')});

    // Heart / Technique / Body: all three pages must open and the technique page must support
    // extra combos, favored tags, and a costly manual one-motion. Keep a single final evidence
    // frame that also includes the bottom 心技体 rail.
    const loadout=stateAt(20,142);loadout.zone='frontier';loadout.front=0;loadout.lastDepartureCycle=4;loadout.position={x:0,z:0};loadout.equipment.weapon='sword';
    loadout.knownSkills.push('basic.sword','skill.balance','skill.distance','skill.breath','skill.focus','skill.flow-step','action.guard-step','action.slip','action.lunge');
    const loadoutFront=createFront(0,loadout.seed);loadoutFront.enemies.forEach((enemy,index)=>{enemy.dead=index!==0;if(index===0){enemy.x=0;enemy.z=2.15;enemy.maxHp=900;enemy.hp=900;}});loadout.frontState=loadoutFront;await load(loadout);await expectTone('frontier');
    await page.locator('[data-heart]').click();await page.locator('.upgrade-panel[data-type="heart"]').waitFor({state:'visible'});assert.ok(await page.locator('.heart-list .heart-skill').count()>=4,'heart page must list learned hearts');
    await page.locator('[data-body]').click();await page.locator('.upgrade-panel[data-type="body"]').waitFor({state:'visible'});assert.ok(await page.locator('.body-loadout-section').count()===3,'body page must expose stance, style, and zanshin');
    await page.locator('[data-techniques]').click();await page.locator('.upgrade-panel[data-type="technique"]').waitFor({state:'visible'});await page.locator('.combo-add').click();assert.ok(await page.locator('.combo-tab:not(.combo-add)').count()>=2,'technique page must add a second combo');
    await page.locator('.favored-tag').first().click();assert.equal(await page.locator('.favored-tag').first().getAttribute('data-active'),'true');
    await page.locator('.one-motion-actions button').first().click();await page.locator('.technique-picker-list .heart-skill').filter({hasText:'受け流し歩法'}).first().click();
    await page.waitForFunction(()=>!document.querySelector('[data-one-motion]')?.hidden,null,{timeout:4000});assert.match(await text(page.locator('.one-motion-card')),/受け流し歩法/);assert.match(await text(page.locator('[data-one-motion]')),/受け流し歩法/);
    await page.screenshot({path:join(output,'00-heart-technique-body-evidence.png'),fullPage:true});

    // Departure: an equipped adult standing at the port must reach the frontier.
    const departure=stateAt(15,43);departure.equipment.weapon='sword';departure.knownSkills.push('basic.sword');departure.position={x:port.x,z:port.z};departure.lastDepartureCycle=2;await load(departure);assert.match(await text(page.locator('#life-stage')),/出立/);await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第1前線'),null,{timeout:5000});await expectTone('frontier');await page.screenshot({path:join(output,'03-frontier-arrival.png')});

    // Combat: contact combat must resolve a nearby enemy without a manual attack button.
    const battle=stateAt(20,44);battle.zone='frontier';battle.front=0;battle.lastDepartureCycle=4;battle.position={x:0,z:0};battle.equipment.weapon='sword';battle.knownSkills.push('basic.sword');battle.skillWeights.jo={'basic.sword':100};const battleFront=createFront(0,battle.seed);battleFront.enemies.forEach((enemy,index)=>{enemy.x=index===0?.55:5+index*.35;enemy.z=index===0?.35:-4.8;});battle.frontState=battleFront;await load(battle);await expectTone('frontier');await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('撃破'),null,{timeout:7000});

    // Cleared fronts must accept ordinary movement and advance the campaign.
    const cleared=stateAt(25,45);cleared.zone='frontier';cleared.front=0;cleared.lastDepartureCycle=5;cleared.position={x:0,z:-5.55};cleared.equipment.weapon='sword';const clearFront=createFront(0,cleared.seed);for(const enemy of clearFront.enemies){enemy.hp=0;enemy.dead=true;}clearFront.cleared=true;cleared.frontState=clearFront;await load(cleared);await expectTone('frontier');await page.keyboard.down('ArrowUp');await sleep(650);await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第2前線'),null,{timeout:4000});

    // Final clear must return the same life home.
    const final=stateAt(40,46);final.zone='frontier';final.front=5;final.lastDepartureCycle=8;final.position={x:0,z:4.5};final.equipment.weapon='sword';const finalFront=createFront(5,final.seed);for(const enemy of finalFront.enemies){enemy.hp=0;enemy.dead=true;}finalFront.cleared=true;final.frontState=finalFront;await load(final);await expectTone('frontier');await page.keyboard.down('ArrowDown');await sleep(650);await page.keyboard.up('ArrowDown');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('凱旋'),null,{timeout:4000});await expectTone('home');await page.screenshot({path:join(output,'04-homecoming.png')});

    // Downed state must recover without ending the life.
    const downed=stateAt(30,47);downed.zone='frontier';downed.front=1;downed.lastDepartureCycle=6;downed.position={x:0,z:0};downed.down={elapsed:39.2};downed.hp=0;downed.frontState=createFront(1,downed.seed);await load(downed);await expectTone('frontier');assert.match(await text(page.locator('#objective-badge')),/秒/);await page.waitForFunction(()=>!document.getElementById('life-stage')?.textContent.includes('救助'),null,{timeout:4000});await expectTone('home').catch(async()=>expectTone('village'));

    // Lifespan end must expose a valid rebirth choice and start a fresh generation.
    const old=stateAt(99.99,48);old.ageSeconds=LIFE_SECONDS-.35;old.ageYears=old.ageSeconds/60;old.clockRate=20;old.lastDepartureCycle=20;old.equipment={weapon:'spear',armor:'light',shield:true};old.knownSkills.push('basic.spear','skill.step');old.defeats=12;old.returns=3;await load(old);await page.locator('.life-end-dialog[open]').waitFor({state:'visible',timeout:5000});await page.waitForFunction(()=>document.getElementById('game-screen')?.dataset.worldTone==='rebirth');await expectTone('rebirth');assert.match(await text(page.locator('.life-end-summary')),/12/);assert.match(await text(page.locator('.life-end-help')),/0歳/);assert.ok(await page.locator('.rinne-choice-list .rinne-choice').count()>0);await page.screenshot({path:join(output,'05-life-end.png')});await page.locator('#rebirth').click();await page.waitForFunction(()=>document.getElementById('generation')?.textContent?.includes('2代目'),null,{timeout:5000});await expectTone('village');assert.match(await text(page.locator('#life-stage')),/誕生/);assert.match(await text(page.locator('#toast')),/2代目.*0歳/);await page.screenshot({path:join(output,'06-rebirth.png')});

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
  const {verifyCoopPlay}=await import('./coop-play.browser.mjs');await verifyCoopPlay(browser,url,join(output,'friend-play'));
}
