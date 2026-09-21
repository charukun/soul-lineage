import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {World} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

const built=(id,kind,x=0,z=0)=>({id,kind,x,z,rot:0,material:'base',room:[],phase:'built',progress:1,level:1,recipe:{}});

test('facility output becomes carried cargo and enters stock only at storage',()=>{
 const world=new World(),sim=new Simulation(world),storage=built('test-storage','storage',12,0),logging=built('test-logging','logging',0,0);
 world.objects.push(storage,logging);
 const worker=world.people.find(p=>p.role==='mayor');
 worker.targetId=logging.id;worker.task='work';worker.skill=0;worker.purse=0;
 const before={wood:world.state.stock.wood,seed:world.state.stock.seed};

 sim.finish(worker);

 assert.equal(world.state.stock.wood,before.wood);
 assert.equal(world.state.stock.seed,before.seed);
 assert.deepEqual(worker.cargo?.items,{wood:5,seed:1});
 assert.equal(worker.cargo?.sourceId,logging.id);

 sim.decide(worker);
 assert.equal(worker.nextAction,'deliver');
 assert.equal(worker.targetId,storage.id);

 worker.task='deliver';worker.targetId=storage.id;worker.timer=0;
 sim.finish(worker);

 assert.equal(world.state.stock.wood,before.wood+5);
 assert.equal(world.state.stock.seed,before.seed+1);
 assert.equal(worker.cargo,undefined);
 assert.equal(world.deliveryReceipts.length,1);
 assert.deepEqual(world.deliveryReceipts[0].items,{wood:5,seed:1});
 assert.equal(world.deliveryReceipts[0].storageId,storage.id);
 assert.equal(world.deliveryReceipts[0].sourceId,logging.id);
});

test('hauler waits with cargo when there is no completed storage',()=>{
 const world=new World(),sim=new Simulation(world),worker=world.people.find(p=>p.role==='mayor');
 worker.cargo={sourceId:'facility',items:{wood:3}};
 sim.decide(worker);
 assert.equal(worker.task,'idle');
 assert.match(worker.status,/資材置き場/);
 assert.deepEqual(worker.cargo.items,{wood:3});
});

test('storage delivery has an anchored visual receipt and carried crate',async()=>{
 const [ui,css,view]=await Promise.all([
  readFile(new URL('../src/web/interface.js',import.meta.url),'utf8'),
  readFile(new URL('../src/web/consumer-game-ui.css',import.meta.url),'utf8'),
  readFile(new URL('../src/web/view.js',import.meta.url),'utf8')
 ]);
 assert.match(ui,/aria-label.*資材庫へ搬入/);
 assert.match(ui,/<b>\+\$\{formatDeliveryAmount\(n\)\}<\/b>/);
 assert.doesNotMatch(ui,/<small>資材庫へ搬入<\/small>/);
 assert.match(ui,/view\.project\(storage\.x,4\.8,storage\.z\)/);
 assert.match(css,/position:absolute;display:flex/);
 assert.doesNotMatch(css,/min-width:126px/);
 assert.match(css,/animation:muraDeliveryRise 1\.9s/);
 assert.match(view,/resource-cargo/);
});
