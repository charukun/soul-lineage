import test from 'node:test';
import assert from 'node:assert/strict';
import {muraBlocked,muraEntry,muraInteriorAt,muraInteriorEntry,muraLocalToWorld} from '@soul/world/mura';
import {World} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

test('resident walks through the shared doorway instead of teleporting across the wall',()=>{
  const world=new World(),home=world.object('b1'),person=world.people.find(p=>p.homeId===home.id),sim=new Simulation(world),outside=muraEntry(home,5),inside=muraInteriorEntry(home);
  person.x=outside.x;person.z=outside.z;person.task='idle';person.timer=0;person.insideId=null;
  assert.equal(sim.go(person,home,'home'),true);
  assert.deepEqual(person.destination,inside);
  for(let i=0;i<160&&person.task==='walk';i++)sim.walk(person,.25);
  assert.equal(person.task,'home');
  assert.equal(person.insideId,home.id);
  assert.equal(muraInteriorAt({objects:[home]},person.x,person.z)?.id,home.id);
});

test('resident can route back out through the same doorway',()=>{
  const world=new World(),home=world.object('b1'),person=world.people.find(p=>p.homeId===home.id),sim=new Simulation(world),inside=muraInteriorEntry(home),outside=muraEntry(home,5);
  person.x=inside.x;person.z=inside.z;person.insideId=home.id;person.task='idle';person.timer=0;
  assert.equal(sim.go(person,outside,'wander'),true);
  for(let i=0;i<160&&person.task==='walk';i++)sim.walk(person,.25);
  assert.equal(person.task,'wander');
  assert.equal(person.insideId,null);
  assert.equal(muraInteriorAt({objects:[home]},person.x,person.z),null);
});

test('navigation from behind a building goes around to its doorway without crossing a wall segment',()=>{
  const world=new World(),home=world.object('b1'),sim=new Simulation(world),start=muraLocalToWorld(home,0,-10),inside=muraInteriorEntry(home),path=sim.nav.route(start,inside);
  assert.ok(path?.length);
  let previous=start;
  for(const next of path){
    for(let i=1;i<=4;i++){
      const t=i/4,x=previous.x+(next.x-previous.x)*t,z=previous.z+(next.z-previous.z)*t;
      assert.equal(muraBlocked({objects:world.objects},x,z,.28),false,`route crossed a wall at ${x},${z}`);
    }
    previous=next;
  }
});
