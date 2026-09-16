import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {KAYKIT_MODEL_BY_KEY} from '@soul/characters';
import {createLife,serializeLife,LIFE_SECONDS} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {buildStations} from '../src/rebuild/locations.js';
import {defaultMuraLayout} from '@soul/world/mura';

const text=async locator=>(await locator.textContent()||'').trim();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const REBUILT_MODEL_ID='reconstructed-wayfarer.reference.v1';
const SOURCE_PROFILE={version:1,face:'classic',hair:'original',body:'balanced',outfit:'uniform',accessory:'none'};

async function captureRebuildThreeView(browser,url,output){
  const source=KAYKIT_MODEL_BY_KEY.knight;
  assert.equal(source.runtime.url,'./simulator/assets/kaykit/Knight.glb');
  assert.equal(source.license,'CC0-1.0');
  const context=await browser.newContext({viewport:{width:1280,height:940},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  try{
    const reviewURL=new URL('./characters.html',url).href,response=await page.goto(reviewURL,{waitUntil:'domcontentloaded'});assert.ok(response?.ok(),'character review must answer successfully');
    await page.waitForFunction(()=>window.characterStudio?.review?.ready===true&&window.characterStudio?.workspace,null,{timeout:90000});
    await page.evaluate(()=>window.characterStudio.workspace.configure({view:'single',motion:'rest',rotate:false,paused:true}));
    const canvas=page.locator('#stage');await canvas.waitFor({state:'visible'});
    const captures=[];
    const take=async(kind,preset)=>{
      await page.evaluate(({kind,preset,profile,modelId})=>{
        const {workspace,review}=window.characterStudio;
        workspace.configure({view:'single',motion:'rest',rotate:false,paused:true});
        if(kind==='source'){
          workspace.selectModel(null);
          const actor=review.actors[review.settings.selected];
          actor.appearanceController?.setIdentity(null);
          actor.appearanceController?.setProfile(profile);
        }else{
          workspace.selectModel(modelId);
        }
        review.aim(preset);
      },{kind,preset,profile:SOURCE_PROFILE,modelId:REBUILT_MODEL_ID});
      if(kind==='rebuilt')await page.waitForFunction(id=>window.characterStudio?.workspace?.modelId===id,REBUILT_MODEL_ID);
      else await page.waitForFunction(()=>window.characterStudio?.workspace?.modelId===null);
      await page.waitForTimeout(220);
      const state=await page.evaluate(()=>{
        const studio=window.characterStudio,actor=studio.review.actors[studio.review.settings.selected];
        return {modelId:studio.workspace.modelId,subject:document.querySelector('#subject')?.textContent||'',referenceMeshes:actor.visual.getObjectByName(`reference-character:${studio.workspace.modelId}`)?.children?.length??0};
      });
      const buffer=await canvas.screenshot({type:'png'});captures.push({kind,preset,state,buffer});
      await mkdir(join(output,'three-view'),{recursive:true});
      await canvas.screenshot({path:join(output,'three-view',`${kind}-${preset}.png`)});
    };
    for(const preset of ['front','side','back'])await take('source',preset);
    for(const preset of ['front','side','back'])await take('rebuilt',preset);
    assert.deepEqual(errors,[]);
    assert.ok(captures.slice(0,3).every(row=>row.state.modelId===null),'source evidence must render the raw default source selection');
    assert.ok(captures.slice(3).every(row=>row.state.modelId===REBUILT_MODEL_ID),'rebuilt evidence must render the reconstructed model');

    const labels={front:'正面',side:'横',back:'背面'};
    const cells=captures.map(row=>`<figure><img src="data:image/png;base64,${row.buffer.toString('base64')}" alt="${row.kind} ${row.preset}"><figcaption>${labels[row.preset]}</figcaption></figure>`).join('');
    const evidence=await context.newPage();
    await evidence.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#10191b;color:#f2eadb;font-family:Arial,sans-serif;padding:36px}h1{font-size:28px;margin:0 0 8px}p{margin:4px 0 24px;color:#b8c5c2}.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}.meta section{border:1px solid #51615e;padding:16px;background:#172427}.meta strong{display:block;font-size:18px;margin-bottom:8px}.meta small{display:block;line-height:1.55;color:#c8d1cf}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.row-title{grid-column:1/-1;font-size:20px;font-weight:700;margin-top:6px}.grid figure{margin:0;border:1px solid #51615e;background:#1d2c2f;padding:10px}.grid img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#1e3036}.grid figcaption{text-align:center;padding:9px 0 2px;font-weight:700}.foot{margin-top:18px;font-size:12px;color:#8fa09d}
    </style></head><body><h1>Source → AI Rebuild / Three-view Evidence</h1><p>同一Visual Review・同一camera presetで、元モデルと再構築モデルを正面 / 横 / 背面から実描画。</p><div class="meta"><section><strong>元モデル: KayKit Knight</strong><small>ID: ${source.id}<br>File: Knight.glb<br>Revision: ${source.source.revision}<br>Blob: ${source.source.gitBlobSha}<br>License: ${source.license}</small></section><section><strong>再構築: Wayfarer</strong><small>ID: ${REBUILT_MODEL_ID}<br>Geometry: runtime procedural rebuild<br>Source geometry / texture: reused = false<br>Style: armored knight → itinerant wayfarer</small></section></div><div class="grid"><div class="row-title">元モデル / KayKit Knight.glb</div>${cells.slice(0,cells.indexOf('<figure',cells.indexOf('<figure')+1))}</div></body></html>`);
    // Rebuild the sheet explicitly to avoid fragile HTML slicing while keeping the captured bytes canonical.
    const sourceCells=captures.slice(0,3).map(row=>`<figure><img src="data:image/png;base64,${row.buffer.toString('base64')}"><figcaption>${labels[row.preset]}</figcaption></figure>`).join('');
    const rebuiltCells=captures.slice(3).map(row=>`<figure><img src="data:image/png;base64,${row.buffer.toString('base64')}"><figcaption>${labels[row.preset]}</figcaption></figure>`).join('');
    await evidence.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#10191b;color:#f2eadb;font-family:Arial,sans-serif;padding:36px}h1{font-size:28px;margin:0 0 8px}p{margin:4px 0 24px;color:#b8c5c2}.meta{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px}.meta section{border:1px solid #51615e;padding:16px;background:#172427}.meta strong{display:block;font-size:18px;margin-bottom:8px}.meta small{display:block;line-height:1.55;color:#c8d1cf}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.row-title{grid-column:1/-1;font-size:20px;font-weight:700;margin-top:6px}.grid figure{margin:0;border:1px solid #51615e;background:#1d2c2f;padding:10px}.grid img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#1e3036}.grid figcaption{text-align:center;padding:9px 0 2px;font-weight:700}.foot{margin-top:18px;font-size:12px;color:#8fa09d}</style></head><body><h1>Source → AI Rebuild / Three-view Evidence</h1><p>同一Visual Review・同一camera presetで、元モデルと再構築モデルを正面 / 横 / 背面から実描画。</p><div class="meta"><section><strong>元モデル: KayKit Knight</strong><small>ID: ${source.id}<br>File: Knight.glb<br>Revision: ${source.source.revision}<br>Blob: ${source.source.gitBlobSha}<br>License: ${source.license}</small></section><section><strong>再構築: Wayfarer</strong><small>ID: ${REBUILT_MODEL_ID}<br>Geometry: runtime procedural rebuild<br>Source geometry / texture: reused = false<br>Style: armored knight → itinerant wayfarer</small></section></div><div class="grid"><div class="row-title">元モデル / KayKit Knight.glb</div>${sourceCells}<div class="row-title">再構築モデル / Wayfarer</div>${rebuiltCells}</div><div class="foot">Generated from the PR-head browser render. Not a concept mockup.</div></body></html>`);
    await evidence.screenshot({path:join(output,'00-source-vs-wayfarer-three-view.png'),fullPage:true});
  }finally{await context.close();}
}

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
    await expectNonEmpty(page.locator('.title-copy'),'title copy');assert.equal(await page.locator('.crest').count(),1);key=await saveKey();

    // Birth: the world, mother-led tour and real movement input must all work.
    await page.locator('#new-life').click();await waitGame();await expectTone('village');
    assert.match(await text(page.locator('#life-stage')),/誕生/);await expectNonEmpty(page.locator('#objective'),'birth objective');await expectNonEmpty(page.locator('#objective-badge'),'birth objective badge');
    assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'true');assert.equal(await page.locator('.objective-card').isHidden(),true,'birth tour must teach through the world instead of the objective card');
    await page.locator('#dialogue').waitFor({state:'visible'});await expectNonEmpty(page.locator('#dialogue-text'),'birth dialogue');
    await expectNonEmpty(page.locator('#move-hint'),'movement hint');
    const canvas=page.locator('#game'),box=await canvas.boundingBox();assert.ok(box);await page.mouse.move(box.x+box.width*.48,box.y+box.height*.62);await page.mouse.down();await page.mouse.move(box.x+box.width*.64,box.y+box.height*.52,{steps:6});await sleep(450);await page.mouse.up();
    assert.equal(await page.locator('#move-hint').isHidden(),true,'movement input should dismiss the first-use hint');

    // Growth: accelerated world time must leave the birth tour and enter normal play.
    for(let i=0;i<3;i++)await page.locator('#clock-rate').click();assert.equal(await page.locator('#clock-rate').evaluate(node=>node.value),'20');
    await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('2/6'),null,{timeout:18000});
    assert.equal(await page.locator('#game-screen').getAttribute('data-birth-tour'),'false');await page.locator('.objective-card').waitFor({state:'visible'});await expectTone('village');await page.screenshot({path:join(output,'01-village-growth.png')});

    // Equipment: proximity to the actual sword rack must produce a usable weapon.
    const prep=stateAt(8,42);prep.position={x:sword.x+1.35,z:sword.z};await load(prep);assert.match(await text(page.locator('#life-stage')),/支度/);await expectTone('village');
    prep.position={x:sword.x,z:sword.z};await load(prep);await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('装備'),null,{timeout:4000});
    assert.match(await text(page.locator('#toast')),/装備/);await page.screenshot({path:join(output,'02-equipment.png')});

    // Departure: an equipped adult standing at the port must reach the frontier.
    const departure=stateAt(15,43);departure.equipment.weapon='sword';departure.knownSkills.push('basic.sword');departure.position={x:port.x,z:port.z};departure.lastDepartureCycle=2;await load(departure);
    assert.match(await text(page.locator('#life-stage')),/出立/);await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第1前線'),null,{timeout:5000});await expectTone('frontier');
    await page.screenshot({path:join(output,'03-frontier-arrival.png')});

    // Combat: contact combat must resolve a nearby enemy without a manual attack button.
    const battle=stateAt(20,44);battle.zone='frontier';battle.front=0;battle.lastDepartureCycle=4;battle.position={x:0,z:0};battle.equipment.weapon='sword';battle.knownSkills.push('basic.sword');battle.skillWeights.jo={'basic.sword':100};
    const battleFront=createFront(0,battle.seed);battleFront.enemies.forEach((enemy,index)=>{enemy.x=index===0?.55:5+index*.35;enemy.z=index===0?.35:-4.8;});battle.frontState=battleFront;await load(battle);await expectTone('frontier');
    await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('撃破'),null,{timeout:7000});

    // Cleared fronts must accept ordinary movement and advance the campaign.
    const cleared=stateAt(25,45);cleared.zone='frontier';cleared.front=0;cleared.lastDepartureCycle=5;cleared.position={x:0,z:-5.55};cleared.equipment.weapon='sword';const clearFront=createFront(0,cleared.seed);for(const enemy of clearFront.enemies){enemy.hp=0;enemy.dead=true;}clearFront.cleared=true;cleared.frontState=clearFront;await load(cleared);await expectTone('frontier');
    await page.keyboard.down('ArrowUp');await sleep(650);await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('第2前線'),null,{timeout:4000});

    // Final clear must return the same life home.
    const final=stateAt(40,46);final.zone='frontier';final.front=5;final.lastDepartureCycle=8;final.position={x:0,z:4.5};final.equipment.weapon='sword';const finalFront=createFront(5,final.seed);for(const enemy of finalFront.enemies){enemy.hp=0;enemy.dead=true;}finalFront.cleared=true;final.frontState=finalFront;await load(final);await expectTone('frontier');
    await page.keyboard.down('ArrowDown');await sleep(650);await page.keyboard.up('ArrowDown');await page.waitForFunction(()=>document.getElementById('life-stage')?.textContent.includes('凱旋'),null,{timeout:4000});await expectTone('home');await page.screenshot({path:join(output,'04-homecoming.png')});

    // Downed state must recover without ending the life.
    const downed=stateAt(30,47);downed.zone='frontier';downed.front=1;downed.lastDepartureCycle=6;downed.position={x:0,z:0};downed.down={elapsed:39.2};downed.hp=0;downed.frontState=createFront(1,downed.seed);await load(downed);await expectTone('frontier');
    assert.match(await text(page.locator('#objective-badge')),/秒/);await page.waitForFunction(()=>!document.getElementById('life-stage')?.textContent.includes('救助'),null,{timeout:4000});await expectTone('home').catch(async()=>expectTone('village'));

    // Lifespan end must expose a valid rebirth choice and start a fresh generation.
    const old=stateAt(99.99,48);old.ageSeconds=LIFE_SECONDS-.35;old.ageYears=old.ageSeconds/60;old.clockRate=20;old.lastDepartureCycle=20;old.equipment={weapon:'spear',armor:'light',shield:true};old.knownSkills.push('basic.spear','skill.step');old.defeats=12;old.returns=3;await load(old);
    await page.locator('.life-end-dialog[open]').waitFor({state:'visible',timeout:5000});await page.waitForFunction(()=>document.getElementById('game-screen')?.dataset.worldTone==='rebirth');await expectTone('rebirth');assert.match(await text(page.locator('.life-end-summary')),/12/);assert.match(await text(page.locator('.life-end-help')),/0歳/);assert.ok(await page.locator('.rinne-choice-list .rinne-choice').count()>0);await page.screenshot({path:join(output,'05-life-end.png')});
    await page.locator('#rebirth').click();await page.waitForFunction(()=>document.getElementById('generation')?.textContent?.includes('2代目'),null,{timeout:5000});await expectTone('village');assert.match(await text(page.locator('#life-stage')),/誕生/);assert.match(await text(page.locator('#toast')),/2代目.*0歳/);await page.screenshot({path:join(output,'06-rebirth.png')});

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
  if(recordVideo)await captureRebuildThreeView(browser,url,output);
  const {verifyCoopPlay}=await import('./coop-play.browser.mjs');
  await verifyCoopPlay(browser,url,join(output,'friend-play'));
}