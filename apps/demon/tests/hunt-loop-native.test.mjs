// Workspace integration coverage. Uses the real save store, group RaidSession and Tidebreak.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HuntProfileStore, HuntSession} from '../src/hunt/runtime.js';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {offerVillages} from '@soul/raid/world';
import {readProgress, chooseHunt, freshProgress, PROGRESS_KEY, huntPlan, settleProgress, bodyStats, preyValue} from '../src/hunt/balance.js';
import {renderLineage} from '../src/web/lineage.js';
import {worldDetailBudget,titleWorldDetailBudget} from '../src/web/world-detail-budget.js';

function setup() {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=new HuntProfileStore(storage,()=> 'native-hunt-loop',()=>1000);
  store.change(p=>{p.monsterSpecies='night-creature';});
  let game;
  const enter=()=>{
    const v=chooseHunt(offerVillages(store),store.read());store.claim(v);
    game=new HuntSession(v,store.read(),{
      consume(role,options){const first=store.consume(role,options);game.refreshProfile(store.read());return first;},
      learn(role,move){const first=store.learn(role,move);game.refreshProfile(store.read());return first;},
      battle(role){store.recordBattle(role);game.refreshProfile(store.read());},
      finish(status,n){store.finish(v.id,status,n,game.huntReceipt);game.refreshProfile(store.read());}
    });
    return game;
  };
  return {store,enter};
}

test('native Tidebreak accepts the upgraded tempo without replacing authored strikes',()=>{
  const {store,enter}=setup();
  store.change(p=>{p[PROGRESS_KEY]=freshProgress();p[PROGRESS_KEY].upgrades.fang=2;});
  const game=enter(), skills=game.skillSet(game.village.npcs[0]);
  const core=createTidebreakRuntime({seed:42});core.configure({...skills,hp:120,maxhp:120,enemyHp:38});
  const actual=core.loadout();
  for(const phase of ['jo','ha','kyu']){
    assert.equal(actual[phase].tempo,1.04);
    assert.equal(actual[phase].steps.length,3);
    assert.ok(actual[phase].steps.some(step=>step.kind!=='none'));
  }
  assert.equal(game.player.hp,120);assert.equal(game.player.growthScale,.65);
});

test('real consumption, extraction, save reopen, upgrade and death form one persistent loop',()=>{
  const {store,enter}=setup();let game=enter();
  game.consume(game.village.npcs[0]);game.consume(game.village.npcs[1]);
  const haul=game.carried;assert.ok(haul>=4);assert.equal(readProgress(store.read()).essence,0);
  assert.equal(game.goalReady(),true);assert.ok(game.player.growthScale<.8);
  // Regression: two real meals used to remain invisible in the current life.
  // Rendering must not move the existing finish-time counters or bank any loot.
  const liveProfile=store.read(),beforeRender=JSON.stringify(liveProfile);
  const beforeStorage=store.storage.getItem('kurai.nighthunt.v2');
  const beforeSession={eaten:game.eaten,carried:game.carried,finished:game.finished,profile:JSON.stringify(game.profile)};
  const live=renderLineage(liveProfile,{hunt:game});
  assert.match(live,/<span>捕食 <b>2<\/b><\/span>/,'active two-meal lineage must display the native session contribution');
  assert.match(live,/今回の狩り <b>捕食 2/);
  assert.match(live,/終了した狩り 0 ＋ 今回 2/);
  assert.match(live,new RegExp(`未確保の戦利品 <b>${haul}</b> · 帰還で確保`));
  assert.equal(liveProfile.currentLife.eaten,0,'ended-hunt counter stays authoritative');
  assert.equal(JSON.stringify(liveProfile),beforeRender);
  assert.equal(store.storage.getItem('kurai.nighthunt.v2'),beforeStorage,'view is never a writer');
  assert.deepEqual({eaten:game.eaten,carried:game.carried,finished:game.finished,profile:JSON.stringify(game.profile)},beforeSession);
  assert.doesNotMatch(renderLineage(liveProfile),/lineage-live/,'title/legacy callers have no live context');
  const noProjection=hunt=>assert.doesNotMatch(renderLineage(liveProfile,{hunt}),/lineage-live/);
  noProjection({...game,finished:true});
  noProjection({...game,village:{id:'unknown-visit'}});
  noProjection({...game,profile:{...liveProfile,id:'another-player'}});
  noProjection({...game,profile:{...liveProfile,currentLife:{...liveProfile.currentLife,number:99}}});
  noProjection({...game,profile:{...liveProfile,currentLife:{...liveProfile.currentLife,bornAt:999}}});
  for(const bad of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,'2']){
    noProjection({...game,eaten:bad});noProjection({...game,carried:bad});
  }
  assert.doesNotMatch(renderLineage({...liveProfile,currentLife:{...liveProfile.currentLife,eaten:Number.MAX_SAFE_INTEGER}},{hunt:game}),/lineage-live/);
  const legacy={...liveProfile};delete legacy.currentLife;
  assert.doesNotMatch(renderLineage(legacy,{hunt:game}),/lineage-live/);
  Object.assign(game.player,game.village.entry);game.escapeHold=1.7;game.finish('escaped');
  const settled=renderLineage(store.read(),{hunt:game});
  assert.match(settled,/<span>捕食 <b>2<\/b><\/span>/);
  assert.doesNotMatch(settled,/lineage-live/,'finished session cannot count the same meals twice');
  assert.doesNotMatch(renderLineage(store.read(),{hunt:{...game,finished:false}}),/lineage-live/,'closed visit rejects stale live context');
  assert.equal(readProgress(store.read()).essence,haul+6);assert.equal(readProgress(store.read()).chapter,1);
  assert.equal(store.upgrade('fang'),true);const kept=readProgress(store.read()).essence;
  const oldLife=store.read().currentLife.number;game=enter();assert.equal(game.huntStats().techniqueSpeed,109);
  game.consume(game.village.npcs[0]);game.finish('defeated');
  assert.equal(readProgress(store.read()).essence,kept);assert.equal(readProgress(store.read()).upgrades.fang,1);
  assert.equal(store.read().currentLife.number,oldLife+1);assert.ok(store.read().unlocked.includes('traveller'));
  assert.equal(readProgress(store.read()).lastResult.lost,game.carried);
  const reborn=renderLineage(store.read(),{hunt:game});
  assert.doesNotMatch(reborn,/lineage-live/,'defeated life must not project into its successor');
  const currentCard=reborn.split('<section class="adaptation-ledger">')[0];
  assert.match(currentCard,/<span>捕食 <b>0<\/b><\/span>/);
  assert.equal(store.read().lives.at(-1).eaten,3,'past-life meals remain recorded exactly once');
  for(const end of ['abandoned','interrupted']){
    const other=setup(),unfinished=other.enter();unfinished.consume(unfinished.village.npcs[0]);
    if(end==='abandoned')unfinished.finish('abandoned');else other.store.abandonInterrupted();
    const closed=other.store.read(),bytes=other.store.storage.getItem('kurai.nighthunt.v2');
    assert.doesNotMatch(renderLineage(closed,{hunt:unfinished}),/lineage-live/);
    assert.equal(closed.currentLife.eaten,end==='abandoned'?1:0,'existing end/interruption semantics are unchanged');
    assert.equal(other.store.storage.getItem('kurai.nighthunt.v2'),bytes);
    assert.equal(readProgress(closed).essence,0,'a menu or interrupted hunt does not bank rewards');
  }

  // Keep app regression tests inside the workspace; root tooling owns version comparison.
  for(const [species,meals] of [['night-bat',4],['night-creature',2],['grave-ogre',3]]){
    for(const condition of ['verifiedReturn','unverifiedReturn','defeat','forageReturn']){
      const profile={unlocked:[],monsterSpecies:species}, before=bodyStats(profile,0,species);
      const plan=huntPlan(profile,condition==='forageReturn'?'forage':'mission');
      const result=settleProgress(profile,condition==='defeat'?'defeated':'escaped',meals,{
        carried:meals*preyValue('traveller'),plan,targetEaten:false,returnVerified:condition!=='unverifiedReturn'
      });
      if(condition==='verifiedReturn'){
        assert.ok(result.gained>0);assert.equal(result.chapter,1);
        assert.ok(bodyStats(profile,0,species).tempo>before.tempo);
      }else if(condition==='forageReturn'){
        assert.ok(result.gained>0);assert.equal(result.chapter,0);
      }else{
        assert.equal(result.gained,0);assert.equal(result.chapter,0);
      }
    }
  }
  assert.throws(()=>huntPlan({},'unknown-route'),/狩りの経路/);
  const forgedSource={[PROGRESS_KEY]:{...freshProgress(),chapter:5}}, forgedPlan=huntPlan(forgedSource), untouched={};
  assert.throws(()=>settleProgress(untouched,'escaped',5,{carried:10,plan:forgedPlan,targetEaten:true,returnVerified:true}),/戦利品の記録/);
  assert.equal(readProgress(untouched).essence,0,'forged future chapter must not select a richer canonical bonus');
});

test('main boot has one HUD owner, automatic sensing, and no menu extraction exploit',()=>{
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const main=read('../src/web/main.js'), boot=read('../src/main.js'), brandStart=read('../src/brand-start.js'), bootGate=read('../../../packages/shared-ui/src/boot-gate.js'), html=read('../index.html');
  assert.match(main,/renderLineage\(profile, \{hunt: mode === 'hunt' \? game : null\}\)/,'only the active gameplay caller projects live meals');
  assert.match(main,/label:'近づく', text:'自動戦闘'/,'first hunt guide must explain the contact-to-auto-combat transition');
  assert.match(main,/label:'離れたい', text:'滑らせて距離を取る'/,'first hunt guide must preserve swipe as the spacing and disengage input');
  const combatReadout=read('../src/web/combat-readout-flow.js');
  assert.match(combatReadout,/combat-feed-baseline">自動戦闘 · スワイプで間合い</,'active combat readout must keep the player agency contract visible');
  const huntFlow=read('../src/web/hunt-flow-ui.js');
  assert.match(huntFlow,/fight:\{kicker:'戦いかた', title:'近づけば、自動戦闘'/,'fight guide must preserve the automatic-combat contract when it replaces the entry guide');
  assert.match(huntFlow,/label:'スワイプ', text:'間合いを変える'/,'fight guide must keep the remaining player input explicit');
  assert.match(huntFlow,/label:'離れたい', text:'敵と逆へ距離を取る'/,'fight guide must explain disengage without implying manual attacks');
  assert.match(huntFlow,/duration:token === 'fight' \? 7000 : 3600/,'first fight guidance must remain readable through the initial combat transition');
  assert.match(main,/new HuntFlowUi/);assert.match(main,/game\.huntReceipt/);
  assert.match(main,/game\.scentCooldown <= 0/);assert.match(main,/game\.finish\('abandoned'\)/);
  assert.doesNotMatch(main,/new FeastHud|firstHuntGuide\(/);
  assert.doesNotMatch(boot,/installFirstHuntDirector\(/);
  assert.doesNotMatch(html,/src="\.\/src\/web\/movement-only-play\.js"/);
  assert.equal(bootGate.includes('\\n#'),false,'brand gate CSS must use real newlines before selectors');
  assert.match(bootGate,/\.scorpion\{[^}]*opacity:1/,'brand identity must be visible before animation can advance');
  assert.match(bootGate,/\.bolts\{[^}]*opacity:1/);
  assert.match(bootGate,/\.wordmark\{[^}]*opacity:1/);
  assert.doesNotMatch(bootGate,/@keyframes pa(?:Scorpion|Bolts)\{0%\{opacity:0/,'brand animation must not blank the first paint');
  for(const token of ['@keyframes paLoaderIn','@keyframes paLoadPulse','@keyframes paTouchIn','.armed .touch']) assert.ok(bootGate.includes(token));
  const feastHud=read('../src/web/feast-hud.js');
  assert.match(feastHud,/prey\.power/,'next-prey guidance must carry power in its own tracker');
  assert.match(feastHud,/setAttribute\('aria-label','次に狙う力 /);
  assert.doesNotMatch(feastHud,/objective\.querySelector\('small'\)\.textContent='次に狙う力'/,'feast guidance must not overwrite the mission objective');
  const flow=read('../src/web/hunt-flow-ui.js'),hud=read('../src/web/hunt-minimal-hud.css');
  assert.match(flow,/haulNode\.hidden = game\.carried <= 0 && !ready/,'zero-stake haul must not compete with prey progress');
  assert.match(flow,/pressureNode\.hidden = risk\.level <= 0/,'quiet pressure must stay latent');
  assert.match(flow,/this\.bag\.dataset\.pressure = String\(risk\.level\)/,'risk level must drive the visual hierarchy');
  assert.match(hud,/hunt-bag\[data-pressure="3"\]/,'high pressure must have a distinct HUD treatment');
});


test('mobile world detail budget reduces synchronous decorative generation without touching hunt rules',()=>{ const mobile=worldDetailBudget(673),full=worldDetailBudget(1440);assert.deepEqual(mobile,{forestTrees:56,edgeProps:72,tier:'mobile'});assert.deepEqual(full,{forestTrees:100,edgeProps:130,tier:'full'});assert.ok(mobile.forestTrees<full.forestTrees&&mobile.edgeProps<full.edgeProps);});


test('title preview defers full hunt-world density until the player enters a hunt',()=>{
  const title=titleWorldDetailBudget(673),hunt=worldDetailBudget(673),desktop=worldDetailBudget(1440);
  assert.deepEqual(title,{forestTrees:18,edgeProps:24,graves:4,architectureEntities:4,tier:'title-mobile'});
  assert.deepEqual(hunt,{forestTrees:56,edgeProps:72,tier:'mobile'});
  assert.deepEqual(desktop,{forestTrees:100,edgeProps:130,tier:'full'});
  assert.ok(title.forestTrees<hunt.forestTrees&&title.edgeProps<hunt.edgeProps);
  const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const main=read('../src/web/main.js'),view=read('../src/web/view.js');
  assert.match(main,/view\.build\(game\.village,\{titlePreview:true\}\)/);
  assert.match(view,/if\(!titlePreview\)for\(const n of w\.npcs\)this\.addHuman\(n\)/);
  assert.match(view,/title&&this\.titlePreview/);
});
