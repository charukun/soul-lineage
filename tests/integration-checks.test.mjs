import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentChecks } from '../scripts/integration.mjs';

const app = { id: 15368, slug: 'github-actions' };
const check = (id, conclusion) => ({ id, name: 'Validate and build', app, status: 'completed', conclusion });

test('superseded cancelled check does not block a newer successful check', () => {
  const checks = currentChecks([
    check(100, 'success'),
    check(99, 'cancelled'),
    { id: 101, name: 'Request Integration', app, status: 'completed', conclusion: 'success' },
    { id: 102, name: 'Request Rescue observation', app, status: 'in_progress' },
  ]);
  assert.deepEqual(checks.map(x => [x.id, x.conclusion]), [[100, 'success']]);
});

test('newest check still fails closed when it is not successful', () => {
  const checks = currentChecks([
    check(102, 'failure'),
    check(101, 'success'),
  ]);
  assert.deepEqual(checks.map(x => [x.id, x.conclusion]), [[102, 'failure']]);
});

test('same check name from different providers remains independently required', () => {
  const checks = currentChecks([
    check(100, 'success'),
    { ...check(101, 'success'), app: { id: 999, slug: 'other-ci' } },
  ]);
  assert.equal(checks.length, 2);
});

test('GitHub repair recorder transport failure is independent of real browser quality and external checks',()=>{
  const checks=currentChecks([
    {id:11,name:'Dispatch browser repair state',status:'completed',conclusion:'failure',app:{id:1,slug:'github-actions'}},
    {id:12,name:'Affected browser smoke',status:'completed',conclusion:'failure',app:{id:1,slug:'github-actions'}},
    {id:13,name:'Dispatch browser repair state',status:'completed',conclusion:'failure',app:{id:2,slug:'external-quality'}},
  ]);
  assert.deepEqual(checks.map(check=>check.id),[13,12]);
  assert.ok(checks.every(check=>check.conclusion==='failure'));
});
