import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/game/core.js';
import {prepareFreshFoundingVillage,bindFoundingPlacement,completeFounding,FOUNDING_MEMBER_IDS} from '../src/game/founding-onboarding.js';

test('fresh founding starts on empty land with four travelling founders',()=>{
 const world=new World();prepareFreshFoundingVillage(world);
 assert.equal(world.objects.length,0);
 assert.deepEqual(world.people.map(p=>p.id),[...FOUNDING_MEMBER_IDS]);
 assert.ok(world.people.every(p=>p.remoteControlled));
 assert.equal(world.people.find(p=>p.id==='logger-npc').foundingVocation,'logger');
 assert.equal(world.people.find(p=>p.id==='carpenter-npc').foundingVocation,'carpenter');
});

test('founder tents and workplaces bind to their owners as the tutorial advances',()=>{
 const world=new World();prepareFreshFoundingVillage(world);
 const loggerHome={id:'b10',kind:'loggerhome'},logging={id:'b11',kind:'logging'},carpenterHome={id:'b12',kind:'carpenterhome'},carpenter={id:'b13',kind:'carpenter'};
 bindFoundingPlacement(world,'loggerhome',loggerHome);bindFoundingPlacement(world,'logging',logging);
 bindFoundingPlacement(world,'carpenterhome',carpenterHome);bindFoundingPlacement(world,'carpenter',carpenter);
 assert.equal(world.people.find(p=>p.id==='logger-npc').homeId,'b10');
 assert.equal(world.people.find(p=>p.id==='logger-npc').jobId,'b11');
 assert.equal(world.people.find(p=>p.id==='carpenter-npc').homeId,'b12');
 assert.equal(world.people.find(p=>p.id==='carpenter-npc').jobId,'b13');
});

test('founding completion releases the four founders into normal simulation',()=>{
 const world=new World();prepareFreshFoundingVillage(world);completeFounding(world);
 assert.equal(world.state.tutorial.completed,true);
 assert.equal(world.state.onboarding.founding.completed,true);
 assert.ok(world.people.every(p=>!p.remoteControlled));
});
