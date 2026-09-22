import test from 'node:test';
import assert from 'node:assert/strict';
import {World,RESOURCE_NAMES} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';
import {activeDefenseProposal,recordDefensePressure,warningGuardPost} from '../src/game/defense-autonomy.js';

function give(world,n=100){for(const key of Object.keys(RESOURCE_NAMES))world.gain(key,n);}

test('repeated pressure creates advice but never places permanent defenses by itself',()=>{
 const world=new World();world.gain('wood',4);const before=world.objects.length,fire=world.objects.find(o=>o.kind==='campfire');
 const first=recordDefensePressure(world,{x:fire.x+60,z:fire.z},{source:'raid'});
 assert.equal(first.proposal,null);
 const second=recordDefensePressure(world,{x:fire.x+55,z:fire.z+3},{source:'raid'});
 assert.equal(second.created,true);assert.equal(second.proposal.kind,'fence');assert.equal(second.proposal.side,'東側');
 assert.equal(world.objects.length,before);
 assert.equal(activeDefenseProposal(world)?.kind,'fence');
 const restored=new World(JSON.parse(world.export()));
 assert.equal(activeDefenseProposal(restored)?.sector,'east');
});

test('a player-built defense near the suggested point resolves the advice',()=>{
 const world=new World();give(world);const fire=world.objects.find(o=>o.kind==='campfire');
 recordDefensePressure(world,{x:fire.x+60,z:fire.z});const {proposal}=recordDefensePressure(world,{x:fire.x+60,z:fire.z});
 assert.ok(proposal);world.objects.push({id:'manual-defense',kind:'fence',x:proposal.x,z:proposal.z,rot:0});
 assert.equal(activeDefenseProposal(world),null);
});

test('guards move toward the warned side before the raid reaches the village',()=>{
 const world=new World(),sim=new Simulation(world),guard=world.people.find(p=>p.id==='guard-npc');
 sim.startRaid();const stage=warningGuardPost(world,sim.raid,guard,0),before=Math.hypot(guard.x-stage.x,guard.z-stage.z);
 sim.guardStep(guard,.5);
 assert.match(guard.status,/先回り/);
 assert.ok(Math.hypot(guard.x-stage.x,guard.z-stage.z)<before);
});

test('guards autonomously repair damaged defensive fixtures after danger passes',()=>{
 const world=new World();give(world);const sim=new Simulation(world),guard=world.people.find(p=>p.id==='guard-npc');
 const placed=world.add('fence',0,25);assert.equal(placed.error,undefined);const fence=placed.object;
 fence.damage=20;guard.x=fence.x+1;guard.z=fence.z;guard.hunger=90;
 sim.guardStep(guard,1);
 assert.ok(fence.damage<20);
 assert.match(guard.status,/応急修理/);
});

test('raid resolution records the attack direction for future defense planning',()=>{
 const world=new World();world.gain('wood',10);const sim=new Simulation(world);
 sim.startRaid({immediate:true});const approach={...sim.raid.approach};sim.raid.monsters=[];sim.updateRaid(.1);
 assert.equal(world.state.defense.pressure.length,1);
 const firstSector=world.state.defense.pressure[0].sector;
 sim.startRaid({immediate:true});sim.raid.approach=approach;sim.raid.monsters=[];sim.updateRaid(.1);
 assert.equal(world.state.defense.pressure.find(r=>r.sector===firstSector).score,2);
 assert.ok(activeDefenseProposal(world));
});
