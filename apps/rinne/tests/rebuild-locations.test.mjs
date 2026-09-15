import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMuraLayout} from '@soul/world/mura';
import {buildStations,equipmentStations,nearestStation} from '../src/rebuild/locations.js';

test('default village exposes distinct automatic life-action places even before facilities are built',()=>{
  const stations=buildStations(defaultMuraLayout()),activities=stations.filter(s=>s.activity&&!s.port);
  const keys=new Set(activities.map(s=>`${s.x.toFixed(2)},${s.z.toFixed(2)}`));
  assert.equal(keys.size,activities.length);
  assert.deepEqual(new Set(activities.map(s=>s.activity)),new Set(['care','play','study','read','pray','train','forge']));
});

test('equipment is represented by physical proximity racks instead of a permanent menu',()=>{
  const stations=buildStations(defaultMuraLayout()),racks=equipmentStations(stations);
  assert.equal(racks.filter(s=>s.equipment.weapon).length,7);
  assert.equal(racks.filter(s=>s.equipment.armor).length,3);
  assert.equal(racks.filter(s=>Object.hasOwn(s.equipment,'shield')).length,2);
  for(const rack of racks)assert.equal(nearestStation(stations,{x:rack.x,z:rack.z}).id,rack.id);
});
