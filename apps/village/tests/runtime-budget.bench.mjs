// Deterministic CPU workload comparison, not an FPS or device benchmark.
// node apps/village/tests/runtime-budget.bench.mjs <baseline-git-ref>
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createFlowFieldRouter} from '@soul/world/flow-field';
import {createResidentNeighborhood} from '../src/resident-neighbors.js';

const baselineRef=process.argv[2];
if(!baselineRef)throw new Error('Pass the baseline git ref');
const source=execFileSync('git',['show',`${baselineRef}:packages/world/src/flow-field.js`],{encoding:'utf8'});
const baseline=await import(`data:text/javascript,${encodeURIComponent(source)}`);
const requests=Array.from({length:24},(_,i)=>({from:{x:(i%6)*2+2,z:(i%3)*2},to:{x:0,z:0},revision:Math.floor(i/4)}));
function measure(factory){
 const router=factory({worldStep:2,maxFields:32,maxCells:18000,radiusCells:128});let blockedReads=0,costReads=0;
 const start=performance.now();
 const paths=requests.map(request=>router.route({...request,isBlocked:()=>{blockedReads++;return false;},costAt:()=>{costReads++;return 0;}}));
 return {milliseconds:performance.now()-start,blockedReads,costReads,paths,snapshot:router.snapshot()};
}
const before=measure(baseline.createFlowFieldRouter),after=measure(createFlowFieldRouter);
assert.deepEqual(after.paths,before.paths);
const people=Array.from({length:96},(_,i)=>({id:i,x:(i%12)*.7,z:Math.floor(i/12)*.7})),neighbors=createResidentNeighborhood(.82);
for(const person of people)neighbors.query(person,people,0,1);
const summary=row=>({milliseconds:Number(row.milliseconds.toFixed(2)),blockedReads:row.blockedReads,costReads:row.costReads,fields:row.snapshot.fields,builds:row.snapshot.builds,expandedCells:row.snapshot.expandedCells});
console.log(JSON.stringify({baselineRef,routes:requests.length,identicalPaths:true,before:summary(before),after:summary(after),residentCandidates:{before:people.length*(people.length-1),after:neighbors.snapshot().candidates},limitations:'Synthetic Node CPU workload; elapsed times are diagnostic only. No smartphone FPS claim.'},null,2));
