import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlowFieldRouter} from '../src/flow-field.js';

const clear=()=>false;
test('a nearby route expands a local frontier and resumes it for more distant residents',()=>{
 const router=createFlowFieldRouter({worldStep:1,maxCells:18000,radiusCells:128});
 const request=from=>router.route({from,to:{x:0,z:0},isBlocked:clear});
 assert.equal(request({x:0,z:0}).length,0);assert.equal(router.snapshot().expandedCells,0);
 assert.equal(request({x:2,z:0}).length,2);const near=router.snapshot();assert.ok(near.expandedCells<40);
 assert.equal(request({x:12,z:0}).length,12);const farther=router.snapshot();assert.equal(farther.builds,1);assert.ok(farther.expandedCells>near.expandedCells);assert.ok(farther.expandedCells<1000);
 assert.equal(request({x:2,z:0}).length,2);assert.equal(router.snapshot().expandedCells,farther.expandedCells);
});
test('cached goal frontiers remain independent and honor obstacle revisions and edge collisions',()=>{
 const router=createFlowFieldRouter({worldStep:1,maxFields:2,maxCells:1000,radiusCells:12});
 const request=(goal,revision=1)=>router.route({from:{x:0,z:0},to:{x:goal,z:0},revision,isBlocked:(x,z)=>Math.abs(x)>10||Math.abs(z)>10,isSegmentBlocked:(ax,az,bx,bz)=>revision===2&&((ax<2&&bx>=2)||(bx<2&&ax>=2))&&Math.min(az,bz)<3});
 const direct=request(4);assert.equal(direct.length,4);request(-4);assert.deepEqual(request(4),direct);assert.equal(router.snapshot().builds,2);
 const around=request(4,2);assert.ok(around.some(p=>p.z>=3));let previous={x:0,z:0};for(const p of around){assert.ok(!((previous.x<2&&p.x>=2)||(p.x<2&&previous.x>=2))||Math.min(previous.z,p.z)>=3);previous=p;}
 assert.equal(router.snapshot().fields,2);router.clear();assert.equal(router.snapshot().fields,0);
});
test('field expansion budget does not reset on repeated requests, and diagonals cannot cut corners',()=>{
 const router=createFlowFieldRouter({worldStep:1,maxCells:10,radiusCells:20});
 const request=()=>router.route({from:{x:10,z:0},to:{x:0,z:0},isBlocked:clear});
 assert.equal(request(),null);assert.equal(request(),null);assert.equal(router.snapshot().expandedCells,10);
 const corner=createFlowFieldRouter({worldStep:1,maxCells:100,radiusCells:3});
 assert.equal(corner.route({from:{x:1,z:1},to:{x:0,z:0},isBlocked:(x,z)=>(x===0&&z===1)||(x===1&&z===0)||x<0||z<0||x>1||z>1}),null);
});
test('weighted paths agree with an independent shortest-distance calculation',()=>{
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 const blocked=(x,z)=>x<0||z<0||x>8||z>8||(x===4&&z!==6),traffic=(x,z)=>z===6?16:0;
 const from={x:1,z:1},to={x:7,z:2},key=p=>`${p.x},${p.z}`,distance=new Map([[key(from),0]]),pending=[{...from,cost:0}];
 let best;
 while(pending.length){pending.sort((a,b)=>a.cost-b.cost);const p=pending.shift();if(p.cost!==distance.get(key(p)))continue;if(key(p)===key(to)){best=p.cost;break;}
  for(const[dx,dz]of directions){const n={x:p.x+dx,z:p.z+dz};if(blocked(n.x,n.z)||(dx&&dz&&(blocked(p.x+dx,p.z)||blocked(p.x,p.z+dz))))continue;const cost=p.cost+(dx&&dz?1.41421356237:1)*(1-.2*Math.min(1,traffic(p.x,p.z)/16));if(cost>=(distance.get(key(n))??Infinity))continue;distance.set(key(n),cost);pending.push({...n,cost});}
 }
 const router=createFlowFieldRouter({worldStep:1,maxCells:100,radiusCells:10});const path=router.route({from,to,isBlocked:blocked,costAt:traffic});assert.ok(path);let cost=0,previous=from;
 for(const p of path){cost+=(p.x!==previous.x&&p.z!==previous.z?1.41421356237:1)*(1-.2*Math.min(1,traffic(previous.x,previous.z)/16));previous=p;}
 assert.ok(Math.abs(cost-best)<1e-8,`${cost} != ${best}`);
});
