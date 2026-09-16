import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentNeighborhood} from '../src/resident-neighbors.js';
import {personalSpaceDesiredVelocity} from '@soul/rendering/motion-runtime';
const steer=(p,neighbors)=>personalSpaceDesiredVelocity({position:p,neighbors,preferredVelocity:{x:.1,z:.2},radius:.82,maxSuggestion:.18,maxSpeed:2.8});
test('spatial resident queries preserve the existing steering, including cell edges and hidden/downed residents',()=>{
 const people=Array.from({length:96},(_,i)=>({id:`p${i}`,x:(i%12)*.45-3,z:Math.floor(i/12)*.45-2,hidden:i%13===0,downed:i%17===0}));
 people.push({id:'bad',x:NaN,z:0});const neighborhood=createResidentNeighborhood();
 for(const p of people.slice(0,96)){
  const nearby=neighborhood.query(p,people,1),all=people.filter(o=>o!==p&&!o.hidden&&!o.downed&&Number.isFinite(o.x)&&Number.isFinite(o.z));
  const a=steer(p,nearby),b=steer(p,all);for(const key of ['x','z'])assert.ok(Math.abs(a.bias[key]-b.bias[key])<1e-12);
 }
 assert.equal(neighborhood.snapshot().builds,1);assert.ok(neighborhood.snapshot().candidates<96*95/4);
});
test('spatial index rebuilds for each frame and save/revision replacement, dropping removed residents',()=>{
 const people=[{id:'a',x:0,z:0},{id:'b',x:.3,z:0}],n=createResidentNeighborhood();assert.equal(n.query(people[0],people,1).length,1);
 people[1].x=4;assert.equal(n.query(people[0],people,2).length,0);
 people[1].x=.2;assert.equal(n.query(people[0],people,2,1).length,1);
 people.pop();assert.equal(n.query(people[0],people,3,1).length,0);assert.equal(n.snapshot().records,1);
});
