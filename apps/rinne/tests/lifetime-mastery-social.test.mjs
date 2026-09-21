import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMuraLayout } from '@soul/world/mura';
import { generatedTechniqueCandidates } from '@soul/game-data';
import { createLife } from '../src/rebuild/domain.js';
import { CoopWorld } from '../src/rebuild/coop-world.js';
import { inspirationMasteryProfile, inspirationRuleEffectsFor } from '../src/rebuild/inspiration-state.js';

function maturedState(age,{gifted=false}={}){
  const state=createLife({name:'試験者',seed:7});
  state.ageYears=age;state.ageSeconds=age*60;state.phase='living';
  state.inspiration.talents=gifted?['gifted']:[];
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
    const state=maturedState(17,{gifted:true});state.seed=seed;
    const effects=inspirationRuleEffectsFor(state,row);
    if(effects.some(effect=>effect.rarity==='singular')){found={seed,effects};break;}
  }
  assert.ok(found,'a gifted 17-year-old should retain a rare deterministic ultimate path');
  assert.equal(found.effects[0].impact,'rule');
  assert.ok(found.effects[0].unlockCondition);
});

test('congenital gifted birth is rare, deterministic and emits village news with a social hook',()=>{
  let gifted=null;
  for(let seed=1;seed<=5000;seed++){
    const state=createLife({name:'星子',seed});
    if(state.inspiration.talents.includes('gifted')){gifted=state;break;}
  }
  assert.ok(gifted,'at least one deterministic gifted seed should exist in a broad sample');
  const news=gifted.events.find(event=>event.type==='village-news'&&event.tag==='ギフテッド');
  assert.ok(news);
  assert.match(news.text,/ギフテッド/);
  assert.equal(news.communityHook.kind,'protect-gifted-child');
  assert.ok(news.communityHook.roles.includes('師匠候補'));
});

test('co-op village news and peer visibility expose community hooks to other players',()=>{
  const room=new CoopWorld({worldId:'social-hooks',ownerId:'owner',name:'親',layout:defaultMuraLayout()});
  room.addPlayer('friend','友','token');
  room.data.players.owner.life.inspiration.talents=['gifted','prodigy'];
  room.broadcastVillageNews('owner',{text:'若き才能が村に現れた。',tag:'天賦の才',communityHook:{kind:'rally-around-prodigy',roles:['師匠','共闘仲間']}});
  const friend=room.view('friend');
  assert.ok(friend.events.some(event=>event.type==='village-news'&&event.text.includes('若き才能')));
  const ownerPeer=friend.peers.find(peer=>peer.playerId==='owner');
  assert.ok(ownerPeer.talents.includes('gifted'));
  assert.ok(ownerPeer.talents.includes('prodigy'));
  assert.ok(ownerPeer.socialHooks.some(hook=>hook.kind==='protect-gifted-child'));
  assert.ok(ownerPeer.socialHooks.some(hook=>hook.kind==='rally-around-prodigy'));
});
