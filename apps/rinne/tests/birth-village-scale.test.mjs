import test from 'node:test';
import assert from 'node:assert/strict';
import {defs} from '@soul/world/mura/catalog';
import {createRinneBirthVillage} from '../src/rebuild/birth-village.js';
import {buildStations} from '../src/rebuild/locations.js';

const halfExtents=o=>{
 const d=defs[o.kind],c=Math.abs(Math.cos(o.rot||0)),s=Math.abs(Math.sin(o.rot||0));
 return{x:c*d.w/2+s*d.d/2,z:s*d.w/2+c*d.d/2};
};

test('windward birth village is compact, walkable and facility footprints do not overlap',()=>{
 const layout=createRinneBirthVillage(),facilities=layout.objects.filter(o=>defs[o.kind]?.building);
 assert.equal(layout.revision,4);
 for(let i=0;i<facilities.length;i++)for(let j=i+1;j<facilities.length;j++){
  const a=facilities[i],b=facilities[j],ha=halfExtents(a),hb=halfExtents(b),gap=.75;
  const separated=Math.abs(a.x-b.x)>=ha.x+hb.x+gap||Math.abs(a.z-b.z)>=ha.z+hb.z+gap;
  assert.ok(separated,`${a.id} overlaps ${b.id}`);
 }
 const inland=facilities.filter(o=>o.id!=='birth-harbor');
 assert.ok(Math.max(...inland.map(o=>Math.hypot(o.x,o.z)))<=72,'expanded inland village must remain inside the authored district ring');
 for(const kind of ['restaurant','tavern','armor','jeweler','tools','furniture','storage','clay','hunting','fishpond'])assert.ok(facilities.some(o=>o.kind===kind),`missing facility: ${kind}`);
 assert.ok(facilities.filter(o=>o.kind==='home').length>=4,'expanded village should include a visible residential quarter');
 assert.equal(layout.objects.find(o=>o.id==='birth-harbor').x,166,'harbor stays on the established east coast');
});

test('compact birth-village furniture remains inside its host building footprint',()=>{
 const layout=createRinneBirthVillage(),wall=.35;
 for(const host of layout.objects.filter(o=>o.room?.length)){
  const hd=defs[host.kind];
  for(const item of host.room){
   const d=defs[item.kind],c=Math.abs(Math.cos(item.rot||0)),s=Math.abs(Math.sin(item.rot||0));
   const hx=c*d.w/2+s*d.d/2,hz=s*d.w/2+c*d.d/2;
   assert.ok(Math.abs(item.x)+hx<=hd.w/2-wall+.001,`${host.id}/${item.id} exceeds width`);
   assert.ok(Math.abs(item.z)+hz<=hd.d/2-wall+.001,`${host.id}/${item.id} exceeds depth`);
  }
 }
});

test('compact smith equipment yard stays clear of village facilities',()=>{
 const layout=createRinneBirthVillage(),facilities=layout.objects.filter(o=>defs[o.kind]?.building),racks=buildStations(layout).filter(row=>row.equipment);
 assert.ok(racks.length>=12);
 for(const rack of racks)for(const facility of facilities){
  const h=halfExtents(facility),clear=Math.abs(rack.x-facility.x)>=h.x+.45||Math.abs(rack.z-facility.z)>=h.z+.45;
  assert.ok(clear,`${rack.id} intrudes ${facility.id}`);
 }
});
