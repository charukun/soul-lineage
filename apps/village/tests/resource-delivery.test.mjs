import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {World,entry,validate} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

const built=(id,kind,x=0,z=0)=>({id,kind,x,z,rot:0,material:'base',room:[],phase:'built',progress:1,level:1,recipe:{}});

test('facility output queues for the mayor dog instead of turning a resident into a hauler',()=>{
 const world=new World(),sim=new Simulation(world),storage=built('test-storage','storage',12,0),logging=built('test-logging','logging',0,0);
 world.objects.push(storage,logging);
 const worker=world.people.find(p=>p.role==='mayor');
 worker.targetId=logging.id;worker.task='work';worker.skill=0;worker.purse=0;
 const before={wood:world.state.stock.wood,seed:world.state.stock.seed};

 sim.finish(worker);

 assert.equal(world.state.stock.wood,before.wood);
 assert.equal(world.state.stock.seed,before.seed);
 assert.equal(worker.cargo,undefined);
 assert.deepEqual(world.state.logistics.pending[0]?.items,{wood:5,seed:1});
 assert.equal(world.state.logistics.pending[0]?.sourceId,logging.id);
 assert.equal(sim.dog.species,'dog');
 assert.equal(sim.extras.some(actor=>actor.id==='mayor-dog'),false);
});

test('dog rendering is deferred until the simulation advances after the entry screen',()=>{
 const world=new World(),sim=new Simulation(world);
 assert.equal(sim.dogVisible,false);
 assert.equal(sim.extras.some(actor=>actor.id==='mayor-dog'),false);
 sim.dogStep(0);
 assert.equal(sim.dogVisible,true);
 assert.equal(sim.extras.some(actor=>actor.id==='mayor-dog'),true);
});

test('mayor dog picks up facility goods and delivers them to storage',()=>{
 const world=new World(),sim=new Simulation(world),storage=built('test-storage','storage',12,0),logging=built('test-logging','logging',0,0);
 world.objects.push(storage,logging);world.queueDelivery(logging.id,{wood:5,seed:1});
 Object.assign(sim.dog,entry(logging));sim.dogStep(.1);
 assert.deepEqual(world.state.logistics.active?.items,{wood:5,seed:1});
 assert.deepEqual(sim.dog.cargo,{wood:5,seed:1});

 Object.assign(sim.dog,entry(storage));sim.dogStep(.1);
 assert.equal(world.state.stock.wood,5);
 assert.equal(world.state.stock.seed,1);
 assert.equal(world.state.logistics.active,null);
 assert.equal(sim.dog.cargo,null);
 assert.equal(world.deliveryReceipts.length,1);
 assert.equal(world.deliveryReceipts[0].personId,'mayor-dog');
 assert.deepEqual(world.deliveryReceipts[0].items,{wood:5,seed:1});
});

test('legacy resident cargo migrates into dog logistics on load',()=>{
 const state=new World().state,worker=state.people.find(p=>p.role==='mayor');
 worker.cargo={sourceId:'b1',items:{wood:3}};
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.people.find(p=>p.id===worker.id).cargo,undefined);
 assert.deepEqual(restored.logistics.pending.at(-1).items,{wood:3});
});

test('storage delivery stays a small icon and delta treatment',async()=>{
 const [ui,css,view,models]=await Promise.all([
  readFile(new URL('../src/web/interface.js',import.meta.url),'utf8'),
  readFile(new URL('../src/web/consumer-game-ui.css',import.meta.url),'utf8'),
  readFile(new URL('../src/web/view.js',import.meta.url),'utf8'),
  readFile(new URL('../src/web/models.js',import.meta.url),'utf8')
 ]);
 assert.match(ui,/aria-label.*資材庫へ搬入/);
 assert.match(ui,/<b>\+\$\{formatDeliveryAmount\(n\)\}<\/b>/);
 assert.doesNotMatch(ui,/<small>資材庫へ搬入<\/small>/);
 assert.match(ui,/view\.project\(storage\.x,4\.8,storage\.z\)/);
 assert.match(css,/position:absolute;display:flex/);
 assert.doesNotMatch(css,/min-width:126px/);
 assert.match(css,/animation:muraDeliveryRise 1\.9s/);
 assert.match(view,/species==='dog'/);
 assert.match(models,/const g=baseAnimal\('wolf'\)/);
 assert.match(models,/species==='dog'\?dog\(\):baseAnimal/);
});
