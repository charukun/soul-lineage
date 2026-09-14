import test from 'node:test';
import assert from 'node:assert/strict';
import {firstHuntGuide,hasCompletedFirstHunt} from '../src/web/first-hunt-guide.js';
const profile=()=>({visits:{},equipped:[],unlocked:[]});
const game=()=>({finished:false,devour:null,fight:null,eaten:0,player:{x:0,z:10},village:{entry:{x:0,z:0},npcs:[]}});
test('guide starts with a terse scent cue and progresses only after real input',()=>{
 const g=game(),p=profile();const before=JSON.stringify([g,p]);
 assert.deepEqual(firstHuntGuide(g,p),{step:'sense',text:'嗅げ。'});
 assert.deepEqual(firstHuntGuide(g,p,{sensed:true}),{step:'approach',text:'人影へ。'});
 assert.equal(JSON.stringify([g,p]),before);
});
test('combat and devour use world cues instead of tutorial sentences',()=>{
 const g=game();g.eaten=1;g.fight={};assert.deepEqual(firstHuntGuide(g,profile(),{returning:true}),{step:'combat',text:'交戦。'});
 g.devour={};assert.deepEqual(firstHuntGuide(g,profile()),{step:'devour',text:'喰らえ。'});
});
test('near a fallen prey recommends stopping without explaining the mechanic',()=>{
 const g=game();g.village.npcs=[{x:0,z:10,dead:true,eaten:false}];assert.deepEqual(firstHuntGuide(g,profile()),{step:'stop',text:'止まれ。'});
 g.village.npcs[0].eaten=true;assert.equal(firstHuntGuide(g,profile()).step,'sense');
});
test('return with no prey cannot promise immediate escape',()=>assert.deepEqual(firstHuntGuide(game(),profile(),{returning:true}),{step:'need-prey',text:'まず、喰え。'}));
test('acquisition, lineage review and real exit distance form a complete terse guide',()=>{
 const g=game();g.eaten=1;const acquired=firstHuntGuide(g,profile());assert.deepEqual(acquired,{step:'lineage',text:'転生史へ。'});
 assert.deepEqual(firstHuntGuide(g,profile(),{lineageSeen:true}),{step:'return',text:'帰路へ。'});
 g.player.z=2.79;assert.deepEqual(firstHuntGuide(g,profile(),{lineageSeen:true}),{step:'escape',text:'輪で止まれ。'});
 g.player.z=2.8;assert.equal(firstHuntGuide(g,profile(),{lineageSeen:true}).step,'return');
});
test('every first-hunt cue stays short enough to feel like game language',()=>{
 const variants=[];const g=game(),p=profile();
 variants.push(firstHuntGuide(g,p),firstHuntGuide(g,p,{sensed:true}),firstHuntGuide(g,p,{returning:true}));
 g.fight={};variants.push(firstHuntGuide(g,p));g.fight=null;g.devour={};variants.push(firstHuntGuide(g,p));g.devour=null;g.eaten=1;
 variants.push(firstHuntGuide(g,p),firstHuntGuide(g,p,{lineageSeen:true}));g.player.z=2;variants.push(firstHuntGuide(g,p,{lineageSeen:true}));
 for(const cue of variants.filter(Boolean))assert.ok(cue.text.length<=8,`${cue.step}: ${cue.text}`);
});
test('legacy memorySeen state remains compatible with an in-progress saved guide',()=>{const g=game();g.eaten=1;assert.equal(firstHuntGuide(g,profile(),{memorySeen:true}).step,'return');});
test('guide follows the nearest unlocked alternate exit',()=>{
 const g=game();g.eaten=1;g.nearestEscape=()=>({id:'graveway',label:'墓道',x:-7,z:-25,distance:2.5});
 assert.equal(firstHuntGuide(g,profile(),{memorySeen:true}).step,'escape');
 g.nearestEscape=()=>({id:'graveway',label:'墓道',x:-7,z:-25,distance:4});
 assert.equal(firstHuntGuide(g,profile(),{memorySeen:true}).step,'return');
});
test('abandonment/defeat/zero-prey retreat does not complete first hunt',()=>{
 for(const status of ['abandoned','defeated','entered'])assert.equal(hasCompletedFirstHunt({visits:{one:{status,eaten:2}}}),false);
 assert.equal(hasCompletedFirstHunt({visits:{one:{status:'escaped',eaten:0}}}),false);
 for(const status of ['escaped','completed'])assert.equal(hasCompletedFirstHunt({visits:{one:{status,eaten:1}}}),true);
});
test('guide retires after successful real hunt or current result',()=>{
 assert.equal(firstHuntGuide(game(),{visits:{one:{status:'completed',eaten:1}}}),null);
 assert.equal(firstHuntGuide({...game(),finished:true},profile()),null);
});
