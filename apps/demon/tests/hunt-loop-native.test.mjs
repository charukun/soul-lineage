// Workspace integration coverage. Uses the real save store, group RaidSession and Tidebreak.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HuntProfileStore, HuntSession} from '../src/hunt/runtime.js';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {offerVillages} from '@soul/raid/world';
import {readProgress, chooseHunt, freshProgress, PROGRESS_KEY, huntPlan, settleProgress, bodyStats, preyValue} from '../src/hunt/balance.js';

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
  Object.assign(game.player,game.village.entry);game.escapeHold=1.7;game.finish('escaped');
  assert.equal(readProgress(store.read()).essence,haul+6);assert.equal(readProgress(store.read()).chapter,1);
  assert.equal(store.upgrade('fang'),true);const kept=readProgress(store.read()).essence;
  const oldLife=store.read().currentLife.number;game=enter();assert.equal(game.huntStats().techniqueSpeed,109);
  game.consume(game.village.npcs[0]);game.finish('defeated');
  assert.equal(readProgress(store.read()).essence,kept);assert.equal(readProgress(store.read()).upgrades.fang,1);
  assert.equal(store.read().currentLife.number,oldLife+1);assert.ok(store.read().unlocked.includes('traveller'));
  assert.equal(readProgress(store.read()).lastResult.lost,game.carried);
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


test('hunt entry decoration is bounded and yields before the first batch',async()=>{
  const {decorationBatchPlan,scheduleDecorationBatches}=await import('../src/web/build-schedule.js');
  const plan=decorationBatchPlan({forestCount:100,edgeCount:130,batchSize:20});
  assert.equal(plan.filter(x=>x.kind==='forest').reduce((n,x)=>n+x.end-x.start,0),100);
  assert.equal(plan.filter(x=>x.kind==='edge').reduce((n,x)=>n+x.end-x.start,0),130);
  assert.ok(plan.every(x=>x.end-x.start<=20));
  const pending=[],ran=[];
  const cancel=scheduleDecorationBatches([()=>ran.push(1),()=>ran.push(2)],{schedule:fn=>(pending.push(fn),pending.length),cancel:()=>{}});
  assert.equal(ran.length,0,'entry task must not execute decoration synchronously');
  pending.shift()();assert.equal(ran.length,0,'first animation frame is reserved for the hunt core to paint');
  pending.shift()();assert.deepEqual(ran,[1]);
  pending.shift()();assert.deepEqual(ran,[1,2]);
  cancel();
  const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8'),view=readFileSync(new URL('../src/web/view.js',import.meta.url),'utf8');
  assert.match(main,/view\.build\(game\.village,\{deferDecoration:true\}\)/);
  assert.match(view,/decorationBatchPlan\(/);assert.match(view,/scheduleDecorationBatches\(/);
});
