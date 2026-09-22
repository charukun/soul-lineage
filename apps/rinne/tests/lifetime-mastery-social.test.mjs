import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMuraLayout } from '@soul/world/mura';
import { generatedTechniqueCandidates } from '@soul/game-data';
import { createLife, rebirth } from '../src/rebuild/domain.js';
import { CoopWorld } from '../src/rebuild/coop-world.js';
import { evaluateSuiAwakening, inspirationMasteryProfile, inspirationRuleEffectsFor, validateInspiration } from '../src/rebuild/inspiration-state.js';

function maturedState(age,{tenyo=false}={}){
  const state=createLife({name:'試験者',seed:7});
  state.ageYears=age;state.ageSeconds=age*60;state.phase='living';
  state.inspiration.talents=tenyo?['tenyo']:[];
  state.inspiration.heritage=[
    {motif:'precision',strength:1,depth:1,sourceLifeId:'a',sourceName:'先代',generation:1,relation:'lineage'},
    {motif:'advance',strength:1,depth:1,sourceLifeId:'b',sourceName:'先々代',generation:1,relation:'lineage'},
    {motif:'timing',strength:1,depth:1,sourceLifeId:'c',sourceName:'三代前',generation:1,relation:'lineage'},
  ];
  for(let i=0;i<10;i++)state.inspiration.records['mastery-'+i]={stable:true,contexts:['village:open:duel:'+i,'frontier:open:group:'+i]};
  return state;
}

test('lifetime mastery makes secret and ultimate rules substantially more likely from mature adulthood onward',()=>{
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'}).find(item=>item.motifs.includes('precision'))||generatedTechniqueCandidates({weapon:'spear',phase:'ha'})[0];
  const young=inspirationMasteryProfile(maturedState(17),row);
  const mature=inspirationMasteryProfile(maturedState(52),row);
  const elder=inspirationMasteryProfile(maturedState(68),row);
  assert.ok(mature.mastery>young.mastery);
  assert.ok(mature.secretChance>young.secretChance);
  assert.ok(mature.ultimateChance>young.ultimateChance*3);
  assert.ok(elder.ultimateChance>=mature.ultimateChance);
});

test('young genius path remains possible instead of being age-locked',()=>{
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'}).find(item=>item.steps.length===3);
  let found=null;
  for(let seed=1;seed<=1000;seed++){
    const state=maturedState(17,{tenyo:true});state.seed=seed;
    const effects=inspirationRuleEffectsFor(state,row);
    if(effects.some(effect=>effect.rarity==='singular')){found={seed,effects};break;}
  }
  assert.ok(found,'a tenyo 17-year-old should retain a rare deterministic ultimate path');
  assert.equal(found.effects[0].impact,'rule');
  assert.ok(found.effects[0].unlockCondition);
});

test('congenital tenyo birth is rare, deterministic and emits village news with a social hook',()=>{
  let tenyo=null;
  for(let seed=1;seed<=5000;seed++){
    const state=createLife({name:'星子',seed});
    if(state.inspiration.talents.includes('tenyo')){tenyo=state;break;}
  }
  assert.ok(tenyo,'at least one deterministic tenyo seed should exist in a broad sample');
  const news=tenyo.events.find(event=>event.type==='village-news'&&event.tag==='天与');
  assert.ok(news);
  assert.match(news.text,/天与/);
  assert.equal(news.communityHook.kind,'protect-tenyo-child');
  assert.ok(news.communityHook.roles.includes('師匠候補'));
});

test('co-op village news and peer visibility expose community hooks to other players',()=>{
  const room=new CoopWorld({worldId:'social-hooks',ownerId:'owner',name:'親',layout:defaultMuraLayout()});
  room.addPlayer('friend','友','token');
  room.data.players.owner.life.inspiration.talents=['tenyo','sui'];
  room.broadcastVillageNews('owner',{text:'若き才能が村に現れた。',tag:'彗',communityHook:{kind:'rally-around-sui',roles:['師匠','共闘仲間']}});
  const friend=room.view('friend');
  assert.ok(friend.events.some(event=>event.type==='village-news'&&event.text.includes('若き才能')));
  const ownerPeer=friend.peers.find(peer=>peer.playerId==='owner');
  assert.ok(ownerPeer.talents.includes('tenyo'));
  assert.ok(ownerPeer.talents.includes('sui'));
  assert.ok(ownerPeer.socialHooks.some(hook=>hook.kind==='protect-tenyo-child'));
  assert.ok(ownerPeer.socialHooks.some(hook=>hook.kind==='rally-around-sui'));
});


test('彗 is a rare deterministic mid-life awakening, boosts mastery, survives save validation, and is not inherited',()=>{
  let awakened=null;
  for(let seed=1;seed<=5000;seed++){
    const state=createLife({name:'彗候補',seed});
    state.ageYears=32;state.ageSeconds=32*60;state.phase='living';
    state.inspiration.traces=Array.from({length:12},(_,index)=>({id:'trace-'+index,kind:['life','practice','observation','combat'][index%4],motifs:['precision'],text:'積み重ね',age:20+index*.5,place:'village',key:'k'+index,semanticKey:'s'+index,sourceId:'',sourceName:'',relation:''}));
    state.inspiration.serial=12;
    const before=inspirationMasteryProfile(state).mastery;
    const detail=evaluateSuiAwakening(state,{id:'skill.sui-test',name:'境の一手',motifs:['precision']});
    if(detail){awakened={state,before,detail};break;}
  }
  assert.ok(awakened,'a deterministic sui awakening should exist in a broad seed sample');
  assert.equal(awakened.detail.label,'彗');
  assert.equal(awakened.detail.axis,'精度');
  assert.ok(awakened.state.inspiration.talents.includes('sui'));
  assert.ok(inspirationMasteryProfile(awakened.state).mastery>awakened.before);
  assert.ok(awakened.state.events.some(event=>event.type==='village-news'&&event.tag==='彗'&&event.text.includes('彗')));
  validateInspiration(awakened.state);
  assert.ok(awakened.state.inspiration.talents.includes('sui'));
  const next=rebirth(awakened.state,{name:'次代'});
  assert.ok(!next.inspiration.talents.includes('sui'));
});


test('legacy gifted and prodigy saves migrate to 天与 and 彗 without duplicate public talent concepts',()=>{
  const state=createLife({name:'旧記録',seed:9});
  state.inspiration.talents=['gifted','prodigy'];
  state.inspiration.talentDetails={gifted:{label:'ギフテッド',axis:'観察眼'},prodigy:{label:'天賦の才',earnedAge:15}};
  validateInspiration(state);
  assert.deepEqual(state.inspiration.talents.sort(),['sui','tenyo']);
  assert.equal(state.inspiration.talentDetails.tenyo.label,'天与');
  assert.equal(state.inspiration.talentDetails.sui.label,'彗');
  assert.equal(state.inspiration.talentDetails.gifted,undefined);
  assert.equal(state.inspiration.talentDetails.prodigy,undefined);
});
