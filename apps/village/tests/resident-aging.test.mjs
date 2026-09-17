import test from 'node:test';
import assert from 'node:assert/strict';
import {residentAgeYears,residentLifeStage,residentScale,residentMovementFactor,residentCanWork,residentCanGuard} from '../src/resident-aging.js';

test('resident age advances from the village world clock',()=>{
 const person={ageBaseYears:12,ageAnchorDay:24};
 assert.equal(residentAgeYears(person,36,12),13);
 assert.equal(residentLifeStage(residentAgeYears(person,36,12)).id,'youth');
});

test('growth and old age change presentation without changing world-space identity',()=>{
 assert.ok(residentScale(8)<residentScale(17));
 assert.equal(residentScale(18),1);
 assert.ok(residentScale(88)<1);
 assert.ok(residentMovementFactor(70)<residentMovementFactor(30));
});

test('work and guard thresholds are explicit',()=>{
 assert.equal(residentCanWork(15.99),false);
 assert.equal(residentCanWork(16),true);
 assert.equal(residentCanGuard(17.99),false);
 assert.equal(residentCanGuard(18),true);
});
