import test from 'node:test';
import assert from 'node:assert/strict';
import {huntPresentationSnapshot,readHuntPresentation} from '../src/web/presentation-snapshot.js';
import {firstHuntDirectorState} from '../src/web/first-hunt-director.js';

test('lightweight advice matches the full game states through combat, consumption and completion',()=>{
 const game={village:{id:'test',npcs:[{id:'n',role:'traveller',x:1,z:1,dead:false,eaten:false}]},player:{x:0,z:0,autoRoam:false},eaten:0,time:0,finished:false},profile={unlocked:[],visits:{}};
 const check=()=>{const light=huntPresentationSnapshot({mode:'hunt',paused:false,game,profile}),full={mode:'hunt',paused:false,profile,player:game.player,npcs:game.village.npcs,eaten:game.eaten,finished:game.finished,combat:game.fight||null,devouring:!!game.devour};assert.deepEqual(firstHuntDirectorState(light),firstHuntDirectorState(full));return light;};
 check();game.fight={phase:'active'};check();game.fight=null;game.village.npcs[0].dead=true;check();game.devour={id:'n'};check();game.devour=null;game.eaten=1;game.village.npcs[0].eaten=true;profile.unlocked.push('traveller');check();game.eaten=2;check();profile.visits.night={status:'escaped',eaten:2};check();game.finished=true;check();
 const light=check();light.profile.unlocked.push('smith');light.profile.visits.night.eaten=100;light.npcs[0].x=99;assert.equal(profile.unlocked.length,1);assert.equal(profile.visits.night.eaten,2);assert.equal(game.village.npcs[0].x,1);
});
test('frame consumers use the small state without requesting diagnostics; legacy API remains supported',()=>{
 let diagnostics=0,reads=0;const api={presentationSnapshot(){reads++;return{mode:'hunt'};},snapshot(){diagnostics++;throw Error('full diagnostics should be explicit');}};
 for(let i=0;i<120;i++)assert.equal(readHuntPresentation(api).mode,'hunt');assert.equal(reads,120);assert.equal(diagnostics,0);
 assert.equal(readHuntPresentation({snapshot:()=>({mode:'title'})}).mode,'title');assert.equal(readHuntPresentation(null),null);
});
