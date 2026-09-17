import test from 'node:test';
import assert from 'node:assert/strict';
import {defs} from '@soul/world/mura/catalog';
import {createRinneBirthVillage} from '../src/rebuild/birth-village.js';

const halfExtents=o=>{
 const d=defs[o.kind],c=Math.abs(Math.cos(o.rot||0)),s=Math.abs(Math.sin(o.rot||0));
 return{x:c*d.w/2+s*d.d/2,z:s*d.w/2+c*d.d/2};
};

test('windward birth village is compact, walkable and facility footprints do not overlap',()=>{
 const layout=createRinneBirthVillage(),facilities=layout.objects.filter(o=>defs[o.kind]?.building);
 assert.equal(layout.revision,2);
 for(let i=0;i<facilities.length;i++)for(let j=i+1;j<facilities.length;j++){
  const a=facilities[i],b=facilities[j],ha=halfExtents(a),hb=halfExtents(b),gap=.75;
  const separated=Math.abs(a.x-b.x)>=ha.x+hb.x+gap||Math.abs(a.z-b.z)>=ha.z+hb.z+gap;
  assert.ok(separated,`${a.id} overlaps ${b.id}`);
 }
 const outer=new Set(['birth-watch-west','birth-watch-east','birth-farm','birth-wheat','birth-logging','birth-quarry','birth-carpenter','birth-orchard','birth-harbor']);
 const core=facilities.filter(o=>!outer.has(o.id));
 assert.ok(Math.max(...core.map(o=>Math.hypot(o.x,o.z)))<=33,'inhabited core must stay in a short walking radius');
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
