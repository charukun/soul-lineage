import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World,RESOURCE_NAMES} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';
import {activeDefenseProposal} from '../src/game/defense-autonomy.js';
import {runDeveloperDefenseScenario} from '../src/game/developer-defense-tools.js';

function give(world,n=50){for(const key of Object.keys(RESOURCE_NAMES))world.gain(key,n);}

test('developer defense panel exposes all five direct verification actions',()=>{
 const source=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 for(const id of ['muraDevWildlife','muraDevRaidWarning','muraDevRaidNow','muraDevRepeatDirection','muraDevDamageDefense'])assert.match(source,new RegExp(`id=["']${id}["']`));
 assert.match(source,/runDeveloperDefenseScenario/);
 assert.match(source,/info\.environment==='prod'/);
});

test('wildlife scenario places a hostile wolf close enough to observe immediately',()=>{
 const world=new World(),sim=new Simulation(world),before=world.state.wildlife.filter(a=>a.hostile).length;
 const result=runDeveloperDefenseScenario('wildlife',{world,sim});
 assert.equal(result.ok,true);
 assert.equal(world.state.wildlife.filter(a=>a.hostile).length,before+1);
 assert.ok(result.focus);
});

test('raid controls can show warning first and then enter combat immediately',()=>{
 const world=new World(),sim=new Simulation(world);
 const warning=runDeveloperDefenseScenario('raid-warning',{world,sim});
 assert.equal(warning.ok,true);assert.equal(sim.raid.phase,'warning');
 const now=runDeveloperDefenseScenario('raid-now',{world,sim});
 assert.equal(now.ok,true);assert.equal(sim.raid.phase,'active');
});

test('same-direction shortcut produces a persistent defense proposal without auto-building it',()=>{
 const world=new World(),sim=new Simulation(world),before=world.objects.length;
 const result=runDeveloperDefenseScenario('repeat-direction',{world,sim});
 assert.equal(result.ok,true);
 assert.ok(activeDefenseProposal(world));
 assert.equal(world.objects.length,before);
 const restored=new World(JSON.parse(world.export()));
 assert.ok(activeDefenseProposal(restored));
});

test('damage shortcut guarantees a nearby damaged defense that guards can repair',()=>{
 const world=new World(),sim=new Simulation(world);give(world);
 const result=runDeveloperDefenseScenario('damage-defense',{world,sim});
 assert.equal(result.ok,true);
 const guard=world.people.find(p=>p.id==='guard-npc');
 const target=world.objects.filter(o=>o.damage>0).sort((a,b)=>Math.hypot(a.x-guard.x,a.z-guard.z)-Math.hypot(b.x-guard.x,b.z-guard.z))[0];
 assert.ok(target);const before=target.damage;
 for(let i=0;i<80&&target.damage>=before;i++)sim.guardStep(guard,.25);
 assert.ok(target.damage<before);
});
