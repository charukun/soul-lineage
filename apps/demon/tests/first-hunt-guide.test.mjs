import test from 'node:test';
import assert from 'node:assert/strict';
import {firstHuntGuide,hasCompletedFirstHunt} from '../src/web/first-hunt-guide.js';
const profile=()=>({visits:{},equipped:[],unlocked:[]});
const game=()=>({finished:false,devour:null,fight:null,eaten:0,player:{x:0,z:10},village:{entry:{x:0,z:0},npcs:[]}});

test('guide starts with direct approach instead of requiring a tool button',()=>{
 const g=game(),p=profile();const before=JSON.stringify([g,p]);
 assert.equal(firstHuntGuide(g,p).step,'approach');
 assert.match(firstHuntGuide(g,p).text,/人影|滑らせ/);
 assert.equal(JSON.stringify([g,p]),before);
});

test('combat and devour keep the next action short and visible',()=>{
 const g=game();g.eaten=1;g.fight={};const combat=firstHuntGuide(g,profile(),{returning:true});assert.equal(combat.step,'combat');assert.match(combat.text,/自動|喰/);
 g.devour={};assert.equal(firstHuntGuide(g,profile()).step,'devour');
});

test('near a fallen prey recommends stopping, not movement',()=>{
 const g=game();g.village.npcs=[{x:0,z:10,dead:true,eaten:false}];assert.equal(firstHuntGuide(g,profile()).step,'stop');
 g.village.npcs[0].eaten=true;assert.equal(firstHuntGuide(g,profile()).step,'approach');
});

test('return with no prey cannot promise immediate escape',()=>assert.equal(firstHuntGuide(game(),profile(),{returning:true}).step,'need-prey'));

test('first acquisition leads to prey choice before the exit lesson',()=>{
 const g=game();g.eaten=1;const choice=firstHuntGuide(g,profile());assert.equal(choice.step,'choice');assert.match(choice.text,/選べ|身体/);
 g.eaten=2;assert.equal(firstHuntGuide(g,profile()).step,'return');
 g.player.z=2.79;assert.equal(firstHuntGuide(g,profile()).step,'escape');
 g.player.z=2.8;assert.equal(firstHuntGuide(g,profile()).step,'return');
});

test('legacy guide flags do not skip the new second-prey choice',()=>{const g=game();g.eaten=1;assert.equal(firstHuntGuide(g,profile(),{memorySeen:true,lineageSeen:true}).step,'choice');});

test('guide follows the nearest unlocked alternate exit after the choice loop',()=>{
 const g=game();g.eaten=2;g.nearestEscape=()=>({id:'graveway',label:'墓道',x:-7,z:-25,distance:2.5});
 assert.equal(firstHuntGuide(g,profile()).step,'escape');
 g.nearestEscape=()=>({id:'graveway',label:'墓道',x:-7,z:-25,distance:4});
 assert.equal(firstHuntGuide(g,profile()).step,'return');
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
