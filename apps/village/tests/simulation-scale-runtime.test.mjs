import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/simulation-scale.js';
import {World} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

test('village fixed-step simulation advances only after a complete 30 Hz step',()=>{
 const world=new World(),sim=new Simulation(world),before=world.state.clock;sim.update(1/60);assert.equal(world.state.clock,before);sim.update(1/60);assert.ok(world.state.clock>before);const diag=globalThis.window?.__VILLAGE_SIMULATION_SCALE__?.snapshot?.();if(diag)assert.equal(diag.fixed.step,1/30);
});

test('distant resident keeps smooth path following while expensive AI cadence is reduced',()=>{
 const world=new World(),base=world.people[0],resident={...structuredClone(base),id:'scale-far-resident',name:'遠景住人',role:'resident',source:'local-npc',x:0,z:0,task:'walk',path:[{x:10,z:0}],timer:0,downed:false,remoteControlled:false};world.people.push(resident);const sim=new Simulation(world);sim.__simulationFocus={x:1000,z:1000};const before=resident.x;sim.update(1/30);assert.equal(resident.simulationTier,'dormant');assert.equal(resident.simulationHz,.5);assert.ok(resident.x>before,'walk authority should still run at the fixed step');
});
