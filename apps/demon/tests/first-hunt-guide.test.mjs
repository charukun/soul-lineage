import test from 'node:test';
import assert from 'node:assert/strict';
import {firstHuntGuide,hasCompletedFirstHunt} from '../src/web/first-hunt-guide.js';
const profile=()=>({visits:{},equipped:[],unlocked:[]});
const game=()=>({finished:false,devour:null,fight:null,eaten:0,player:{x:0,z:10},village:{entry:{x:0,z:0},npcs:[]}});
test('guide starts with scent and progresses only after real input',()=>{
 const g=game(),p=profile();const before=JSON.stringify([g,p]);
 assert.equal(firstHuntGuide(g,p).step,'sense');
 assert.equal(firstHuntGuide(g,p,{sensed:true}).step,'approach');
 assert.equal(JSON.stringify([g,p]),before);
});
test('combat explains retreat and devour still takes precedence',()=>{
 const g=game();g.eaten=1;g.fight={};const combat=firstHuntGuide(g,profile(),{returning:true});assert.equal(combat.step,'combat');assert.match(combat.text,/退く|離れ/);
 g.devour={};assert.equal(firstHuntGuide(g,profile()).step,'devour');
});
test('near a fallen prey recommends stopping, not movement',()=>{
 const g=game();g.village.npcs=[{x:0,z:10,dead:true,eaten:false}];assert.equal(firstHuntGuide(g,profile()).step,'stop');
 g.village.npcs[0].eaten=true;assert.equal(firstHuntGuide(g,profile()).step,'sense');
});
test('return with no prey cannot promise immediate escape',()=>assert.equal(firstHuntGuide(game(),profile(),{returning:true}).step,'need-prey'));
test('acquisition, lineage review and real exit distance form a complete guide',()=>{
 const g=game();g.eaten=1;const acquired=firstHuntGuide(g,profile());assert.equal(acquired.step,'lineage');assert.match(acquired.text,/転生史/);
 assert.equal(firstHuntGuide(g,profile(),{lineageSeen:true}).step,'return');
 g.player.z=2.79;assert.equal(firstHuntGuide(g,profile(),{lineageSeen:true}).step,'escape');
 g.player.z=2.8;assert.equal(firstHuntGuide(g,profile(),{lineageSeen:true}).step,'return');
});
test('legacy memorySeen state remains compatible with an in-progress saved guide',()=>{const g=game();g.eaten=1;assert.equal(firstHuntGuide(g,profile(),{memorySeen:true}).step,'return');});
test('abandonment/defeat/zero-prey retreat does not complete first hunt',()=>{
 for(const status of ['abandoned','defeated','entered'])assert.equal(hasCompletedFirstHunt({visits:{one:{status,eaten:2}}}),false);
 assert.equal(hasCompletedFirstHunt({visits:{one:{status:'escaped',eaten:0}}}),false);
 for(const status of ['escaped','completed'])assert.equal(hasCompletedFirstHunt({visits:{one:{status,eaten:1}}}),true);
});
test('guide retires after successful real hunt or current result',()=>{
 assert.equal(firstHuntGuide(game(),{visits:{one:{status:'completed',eaten:1}}}),null);
 assert.equal(firstHuntGuide({...game(),finished:true},profile()),null);
});
