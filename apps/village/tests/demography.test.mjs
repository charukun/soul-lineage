import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceVirtualCohorts,normalizeVirtualCohorts,planDemographicYear,recordDemographyHistory} from '../src/game/demography.js';

test('legacy virtual cohorts keep their original total',()=>{
 const cohorts=normalizeVirtualCohorts({adult:7,elder:3},10);
 assert.equal(cohorts.adult,7);
 assert.equal(cohorts.elder,3);
 assert.equal(cohorts.child+cohorts.youth+cohorts.adult+cohorts.elder,10);
});

test('healthy village can accumulate births but never exceeds infrastructure headroom',()=>{
 const plan=planDemographicYear({population:12,limit:20,openBeds:18,eligibleAdults:8,comfort:6,foodStock:60,birthCarry:.8});
 assert.ok(plan.births>=1,'healthy adult households should produce a birth');
 assert.ok(plan.births<=6,'births must fit free beds');
 assert.ok(plan.births<=8,'births must fit infrastructure limit');
 const impossible=planDemographicYear({population:0,limit:8,openBeds:8,eligibleAdults:2,comfort:8,foodStock:20,birthCarry:.9});
 assert.equal(impossible.pairs,0,'adult households cannot exceed the represented population');
 assert.equal(impossible.births,0,'an empty population cannot create a birth from contradictory adult input');
 // App-local causal regression; cross-revision orchestration belongs to root tooling.
 for(const foodStock of [64,62,60]){
  const supported={population:12,limit:20,openBeds:18,eligibleAdults:8,comfort:6,foodStock,birthCarry:.8};
  assert.ok(planDemographicYear(supported).births>0);
  for(const patch of [{foodStock:0},{openBeds:12},{eligibleAdults:0}]){
   assert.equal(planDemographicYear({...supported,...patch}).births,0);
  }
  assert.ok(planDemographicYear({...supported,foodStock:0}).departures>0);
 }
});

test('births stop and departures begin when the village cannot support its population',()=>{
 const plan=planDemographicYear({population:20,limit:15,openBeds:24,eligibleAdults:12,comfort:8,foodStock:0,birthCarry:.9});
 assert.equal(plan.births,0);
 assert.ok(plan.departures>=5,'population above the support limit should decline');
});

test('virtual residents move through age cohorts and elders eventually die',()=>{
 let cohorts=normalizeVirtualCohorts({child:13,youth:5,adult:44,elder:14});
 const result=advanceVirtualCohorts(cohorts);
 assert.equal(result.deaths,1);
 assert.equal(result.cohorts.child,12);
 assert.equal(result.cohorts.youth,5);
 assert.equal(result.cohorts.adult,44);
 assert.equal(result.cohorts.elder,14);
});

test('demography history updates the current year and remains bounded',()=>{
 let history=[];
 for(let year=1;year<=130;year++)history=recordDemographyHistory(history,{year,population:year,births:1,deaths:0,departures:0,children:1,youth:1,adults:year-2,elders:0});
 assert.equal(history.length,120);
 assert.equal(history[0].year,11);
 history=recordDemographyHistory(history,{year:130,population:77,births:2,deaths:1,departures:3,children:4,youth:5,adults:60,elders:8});
 assert.equal(history.length,120);
 assert.equal(history.at(-1).population,77);
 assert.equal(history.at(-1).departures,3);
});
