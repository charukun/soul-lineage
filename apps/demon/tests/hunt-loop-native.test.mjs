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
  const main=read('../src/web/main.js'), boot=read('../src/main.js'), html=read('../index.html');
  assert.match(main,/new HuntFlowUi/);assert.match(main,/game\.huntReceipt/);
  assert.match(main,/game\.scentCooldown <= 0/);assert.match(main,/game\.finish\('abandoned'\)/);
  assert.doesNotMatch(main,/new FeastHud|firstHuntGuide\(/);
  assert.doesNotMatch(boot,/installFirstHuntDirector\(/);
  assert.doesNotMatch(html,/src="\.\/src\/web\/movement-only-play\.js"/);
});
