import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('peer-host chaos replay transfers authority and resynchronizes the old host',()=>{
  const output=execFileSync(process.execPath,['scripts/peer-host-chaos.mjs'],{encoding:'utf8'});
  const report=JSON.parse(output);
  assert.equal(report.ok,true);
  assert.equal(report.host,'b');
  assert.equal(report.epoch,2);
  assert.equal(report.applied.b,101);
  assert.ok(report.phaseTransitions>=4);
});
