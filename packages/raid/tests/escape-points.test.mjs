import test from 'node:test';
import assert from 'node:assert/strict';
import {RaidSession} from '../session.js';
const village={id:'escape-test',name:'escape-test',seed:77,target:'traveller',raidScale:'small',source:'generated',weather:'fog'};
const profile=equipped=>({equipped,form:'hollow',echo:null});
test('ordinary raids expose the authored entry as the only return point',()=>{
 const g=new RaidSession(village,profile([]));
 assert.deepEqual(g.escapePoints(),[{id:'entry',label:'村口',x:g.village.entry.x,z:g.village.entry.z}]);
 assert.equal(g.nearestEscape().id,'entry');
});
test('gravekeeper memory exposes the same rear exit used by raid completion',()=>{
 const g=new RaidSession(village,profile(['gravekeeper']));g.village.npcs=[];
 const points=g.escapePoints();assert.equal(points.length,2);const grave=points.find(p=>p.id==='graveway');
 assert.deepEqual(grave,{id:'graveway',label:'墓道',x:-7,z:-25});
 g.player.x=-7;g.player.z=-24;assert.equal(g.nearestEscape().id,'graveway');
 g.player.x=grave.x;g.player.z=grave.z;g.eaten=1;
 for(let i=0;i<110&&!g.finished;i++)g.tick(1/60,{x:0,z:0,amount:0});
 assert.equal(g.finished,true);
});
test('nearest exit switches back to the village entry when it is closer',()=>{
 const g=new RaidSession(village,profile(['gravekeeper']));
 g.player.x=g.village.entry.x;g.player.z=g.village.entry.z;
 assert.equal(g.nearestEscape().id,'entry');assert.equal(g.nearestEscape().distance,0);
});
