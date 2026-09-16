import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMuraLayout} from '@soul/world/mura';
import {buildInteriors,buildStations,equipmentStations,nearestStation,normalizeLayout} from '../src/rebuild/locations.js';

test('Rinne enriches a sparse shared village locally without mutating the shared default',()=>{
  const shared=defaultMuraLayout(),before=shared.objects.length,layout=normalizeLayout(shared);
  assert.equal(shared.objects.length,before);
  assert.ok(layout.objects.filter(row=>row.phase==='built').length>=10);
  for(const kind of ['home','dojo','school','smith','clinic','guardpost'])assert.ok(layout.objects.some(row=>row.kind===kind&&row.phase==='built'));
});

test('default village exposes distinct automatic life-action places and a visible dummy',()=>{
  const stations=buildStations(defaultMuraLayout()),activities=stations.filter(s=>s.activity&&!s.port&&!s.interiorId);
  const keys=new Set(activities.map(s=>`${s.x.toFixed(2)},${s.z.toFixed(2)}`));
  assert.equal(keys.size,activities.length);
  assert.deepEqual(new Set(activities.map(s=>s.activity)),new Set(['care','play','study','read','pray','train','forge','practice']));
  const dummy=stations.find(row=>row.trainingDummy);assert.ok(dummy);assert.equal(dummy.activity,'practice');
});

test('enterable buildings derive housing inspiration stations from installed room objects',()=>{
  const layout=normalizeLayout(defaultMuraLayout()),interiors=buildInteriors(layout),home=interiors.find(row=>row.kind==='home');
  assert.ok(home);assert.ok(home.room.length>=4);assert.ok(home.stations.some(row=>row.housingTrait&&row.sourceKind==='bed'&&row.activity==='breathe'));
  assert.ok(home.stations.some(row=>row.housingTrait&&row.sourceKind==='shelf'&&row.activity==='read'));
  assert.ok(home.stations.some(row=>row.exitInterior));
  const stations=buildStations(layout),door=stations.find(row=>row.enterInterior&&row.buildingId===home.id);assert.ok(door);
  const bed=stations.find(row=>row.interiorId===home.id&&row.sourceKind==='bed');assert.equal(nearestStation(stations,{x:bed.x,z:bed.z},{interiorId:home.id}).id,bed.id);
  assert.notEqual(nearestStation(stations,{x:bed.x,z:bed.z})?.id,bed.id);
});

test('equipment is represented by physical proximity racks instead of a permanent menu',()=>{
  const stations=buildStations(defaultMuraLayout()),racks=equipmentStations(stations);
  assert.equal(racks.filter(s=>s.equipment.weapon).length,7);
  assert.equal(racks.filter(s=>s.equipment.armor).length,3);
  assert.equal(racks.filter(s=>Object.hasOwn(s.equipment,'shield')).length,2);
  for(const rack of racks)assert.equal(nearestStation(stations,{x:rack.x,z:rack.z}).id,rack.id);
});
