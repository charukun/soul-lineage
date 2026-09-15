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

  async function waitGame(){
    await page.locator('#game-screen').waitFor({state:'visible'});await page.locator('#loading-card').waitFor({state:'hidden'});
    await page.locator('#objective').waitFor({state:'visible'});assert.equal(await page.locator('#waypoint-arrow').count(),1);
  }
  async function backToTitle(){
    if(await page.locator('#game-screen').isVisible().catch(()=>false)){await page.locator('#back-title').click();await page.locator('#title-screen').waitFor({state:'visible'});}
  }
  async function saveKey(){
    const label=(await text(page.locator('#build-label'))).split('·')[0].trim().toLowerCase();return `soul:v1:${label||'local'}:rinne:local:life-v2`;
  }
  let key='';
  async function load(state){
    await backToTitle();if(!key)key=await saveKey();const value=serializeLife(state);
    await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key,value});await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#continue-life').waitFor({state:'visible'});await page.locator('#continue-life').click();await waitGame();
  }
  const stateAt=(age,seed=41)=>{const state=createLife({name:'導線テスト',seed});state.ageYears=age;state.ageSeconds=age*60;if(age>=4)state.phase='living';return state;};

  try{
    const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.ok(response?.ok(),'rinne preview must answer successfully');
    assert.match(await text(page.locator('.tagline')),/暮らし、戦い、遺し/);key=await saveKey();

    await page.locator('#new-life').click();await waitGame();
    assert.match(await text(page.locator('#life-stage')),/誕生/);assert.match(await text(page.locator('#objective-detail')),/4歳/);assert.equal(await text(page.locator('#waypoint-label')),'村の広場');
    await page.locator('#talk').click();assert.match(await text(page.locator('#dialogue-text')),/大きくなりなさい/);
    const canvas=page.locator('#game'),box=await canvas.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width*.48,box.y+box.height*.62);await page.mouse.down();await page.mouse.move(box.x+box.width*.64,box.y+box.height*.52,{steps:6});await sleep(450);await page.mouse.up();
    await page.locator('#clock-rate').selectOption('20');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('村で育つ'),null,{timeout:18000});
    assert.match(await text(page.locator('#objective-detail')),/8秒|7歳/);await page.screenshot({path:join(output,'01-village-growth.png')});

    const prep=stateAt(8,42);prep.position={x:sword.x+1.35,z:sword.z};await load(prep);
    assert.match(await text(page.locator('#life-stage')),/旅支度/);assert.match(await text(page.locator('#objective')),/武具/);assert.equal(await text(page.locator('#waypoint-label')),'片手剣');
    prep.position={x:sword.x,z:sword.z};await load(prep);await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('片手剣'),null,{timeout:4000});
    assert.match(await text(page.locator('#toast')),/持ち替えた/);await page.screenshot({path:join(output,'02-equipment.png')});

    const departure=stateAt(15,43);departure.equipment.weapon='sword';departure.knownSkills.push('basic.sword');departure.position={x:port.x,z:port.z};departure.lastDepartureCycle=2;await load(departure);
    assert.match(await text(page.locator('#life-stage')),/出立/);assert.match(await text(page.locator('#objective-detail')),/自動戦闘/);assert.equal(await text(page.locator('#waypoint-label')),'港');
    await page.waitForFunction(()=>document.getElementById('place')?.textContent.includes('第1前線'),null,{timeout:5000});
    assert.match(await text(page.locator('#objective')),/敵へ近づき|接触戦闘/);assert.equal(await page.locator('#talk').isHidden(),true);await page.screenshot({path:join(output,'03-frontier-arrival.png')});

    const battle=stateAt(20,44);battle.zone='frontier';battle.front=0;battle.lastDepartureCycle=4;battle.position={x:0,z:0};battle.equipment.weapon='sword';battle.knownSkills.push('basic.sword');battle.skillWeights.jo={'basic.sword':100};
    const battleFront=createFront(0,battle.seed);battleFront.enemies.forEach((enemy,index)=>{enemy.x=index===0?.55:5+index*.35;enemy.z=index===0?.35:-4.8;});battle.frontState=battleFront;await load(battle);
    await page.waitForFunction(()=>document.getElementById('move-hint')?.textContent.includes('接触戦闘中'),null,{timeout:4000});
    await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('敵が崩れた'),null,{timeout:7000});assert.match(await text(page.locator('#objective-detail')),/敵は残り/);

    const cleared=stateAt(25,45);cleared.zone='frontier';cleared.front=0;cleared.lastDepartureCycle=5;cleared.position={x:0,z:-5.55};cleared.equipment.weapon='sword';const clearFront=createFront(0,cleared.seed);for(const enemy of clearFront.enemies){enemy.hp=0;enemy.dead=true;}clearFront.cleared=true;cleared.frontState=clearFront;await load(cleared);
    assert.equal(await text(page.locator('#waypoint-label')),'次の前線');assert.match(await text(page.locator('#objective')),/奥の門/);
    await page.keyboard.down('ArrowUp');await sleep(650);await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>document.getElementById('place')?.textContent.includes('第2前線'),null,{timeout:4000});

    const final=stateAt(40,46);final.zone='frontier';final.front=5;final.lastDepartureCycle=8;final.position={x:0,z:4.5};final.equipment.weapon='sword';const finalFront=createFront(5,final.seed);for(const enemy of finalFront.enemies){enemy.hp=0;enemy.dead=true;}finalFront.cleared=true;final.frontState=finalFront;await load(final);
    assert.equal(await text(page.locator('#waypoint-label')),'帰還地点');assert.match(await text(page.locator('#objective')),/凱旋/);await page.keyboard.down('ArrowDown');await sleep(650);await page.keyboard.up('ArrowDown');
    await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('凱旋'),null,{timeout:4000});assert.match(await text(page.locator('#place')),/MURAAAAAAA|船上で祈る/);await page.screenshot({path:join(output,'04-homecoming.png')});

    const downed=stateAt(30,47);downed.zone='frontier';downed.front=1;downed.lastDepartureCycle=6;downed.position={x:0,z:0};downed.down={elapsed:39.2};downed.hp=0;downed.frontState=createFront(1,downed.seed);await load(downed);
    assert.match(await text(page.locator('#life-stage')),/救助/);assert.match(await text(page.locator('#objective-detail')),/村へ戻/);await page.waitForFunction(()=>!document.getElementById('place')?.textContent.includes('前線'),null,{timeout:4000});

    const old=stateAt(99.99,48);old.ageSeconds=LIFE_SECONDS-.35;old.ageYears=old.ageSeconds/60;old.clockRate=20;old.lastDepartureCycle=20;old.equipment={weapon:'spear',armor:'light',shield:true};old.knownSkills.push('basic.spear','skill.step');old.defeats=12;old.returns=3;await load(old);
    await page.locator('.life-end-dialog[open]').waitFor({state:'visible',timeout:5000});assert.match(await text(page.locator('.life-end-summary')),/12体/);assert.match(await text(page.locator('.life-end-help')),/受け継がれ/);await page.screenshot({path:join(output,'05-life-end.png')});
    await page.locator('#rebirth').click();await page.waitForFunction(()=>document.getElementById('generation')?.textContent==='2代目',null,{timeout:5000});assert.match(await text(page.locator('#life-stage')),/誕生/);assert.match(await text(page.locator('#toast')),/また、生まれた/);await page.screenshot({path:join(output,'06-rebirth.png')});

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
}
