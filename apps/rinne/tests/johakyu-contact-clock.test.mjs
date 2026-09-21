import test from 'node:test';
import assert from 'node:assert/strict';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat-core.js';
import {tidebreakLoadoutFor} from '../src/rebuild/tidebreak-loadout.js';
function setup(){const state=createLife({seed:6});Object.assign(state,{id:'clock-fixture',phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0}});state.equipment.weapon='sword';state.knownSkills.push('basic.sword');state.skillWeights.jo={'basic.sword':100};const front=createFront(0,6);front.enemies[0].x=.5;front.enemies[0].z=.5;return{state,front};}
test('policy refresh preserves time, actor identity, current attack and hit history',()=>{
 const {state}=setup(),runtime=createTidebreakRuntime({seed:6,weapon:'sword'}),loadout=tidebreakLoadoutFor(state);
 runtime.configure({encounterReady:true,weapon:'sword',loadout,positions:{hero:{x:0,z:0,yaw:0},enemy:{x:0,z:1.4,yaw:Math.PI}}});
 let before;for(let i=0;i<600;i++){before=runtime.step(1/60);if(before.hero.attack&&before.hero.progress>.15)break;}
 assert.ok(before.hero.attack,'a real attack must be in progress');
 for(let i=0;i<30;i++)runtime.setPolicy({loadout,mindset:i%2?'balanced':'guard'});
 const after=runtime.state();assert.deepEqual(after,before,'policy refresh cannot spend time, damage, RNG or replay a pose');
 const next=runtime.step(1/60);assert.equal(next.hero.id,before.hero.id);assert.ok(next.time>before.time);
});
test('100ms host ticks preserve the same physical combat time as 60Hz ticks',()=>{
 const a=setup(),b=structuredClone(a),ae=[],be=[];
 for(let i=0;i<20;i++)ae.push(...tickFront(a.state,a.front,.1));
 for(let i=0;i<120;i++)be.push(...tickFront(b.state,b.front,1/60));
 assert.ok(ae.some(e=>e.type==='player-hit'));assert.deepEqual(ae,be);
 assert.deepEqual(a.front,b.front);assert.deepEqual(a.state,b.state);
});
test('invalid real-time deltas and zero duration cannot advance a battle',()=>{
 const {state,front}=setup(),before=structuredClone({state,front});
 for(const dt of [-1,NaN,Infinity,1])assert.throws(()=>tickFront(state,front,dt),/real-time/);
 assert.deepEqual(tickFront(state,front,0),[]);assert.deepEqual({state,front},before);
});
