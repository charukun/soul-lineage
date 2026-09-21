import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {World,TUTORIAL,defs} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

test('first-run tutorial introduces the log seat and table as a leisure pair',()=>{
 const kinds=TUTORIAL.map(step=>step.kind),seat=kinds.indexOf('logseat'),table=kinds.indexOf('logtable');
 assert.ok(seat>=0);assert.equal(table,seat+1);
 assert.equal(defs.logseat.leisure,'seat');
 assert.equal(defs.logtable.leisure,'table');
 assert.match(TUTORIAL[table].text,/くつろぐ/);
});

test('residents choose a nearby completed log leisure pair and relax there',()=>{
 const world=new World(),sim=new Simulation(world),p=world.people.find(p=>p.role==='mayor');
 world.objects.push({id:'log-seat-test',kind:'logseat',x:p.x+3,z:p.z,rot:0},{id:'log-table-test',kind:'logtable',x:p.x+4,z:p.z,rot:0});
 p.jobId=null;p.hunger=90;world.state.time=10;sim.random=()=>0;
 sim.decide(p);
 assert.equal(p.nextAction,'relax');
 assert.equal(p.targetId,'log-seat-test');
 const before=p.happiness;p.task='relax';p.targetId='log-seat-test';sim.finish(p);
 assert.ok(p.happiness>before);
 assert.match(p.memories[0].text,/丸太の席/);
});

test('village renderer provides dedicated rustic props for the tutorial pair',async()=>{
 const source=await readFile(new URL('../src/web/models.js',import.meta.url),'utf8');
 assert.match(source,/\['logseat','logtable'\]/);
 assert.match(source,/function rusticProp/);
});
