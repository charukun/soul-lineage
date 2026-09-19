import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { json, git, validateRecord, loadContext, checkHistoryChanges, checkPriorLearning } from './contract.mjs';
import { captureProbe, compareReports, stable } from './probes.mjs';

// Called inside the existing develop-completion test, not through another CI job.
export async function validateActiveExperiments(root, active) {
  assert.ok(Array.isArray(active) && active.length > 0 && active.length <= 2, 'one root cause, at most the two related game records');
  const head = git(root, ['rev-parse', 'HEAD']);
  const base = git(root, ['rev-parse', process.env.AUTONOMOUS_BASE_REF || 'origin/develop']);
  git(root, ['merge-base', '--is-ancestor', base, head]);
  if (process.env.HEAD_SHA) assert.equal(head, process.env.HEAD_SHA, 'checkout must be exact runner head');
  assert.equal(checkHistoryChanges(root, base, head), true);
  const reports = [];
  for (const { game, id } of active) {
    const context = loadContext(root, game), entry = context.recent.find(row => row.id === id);
    assert.ok(entry, 'active experiment must be present in the bounded recent index');
    const record = json(resolve(root, '.autonomous', game, entry.path));
    assert.equal(validateRecord(record), true);
    assert.equal(checkPriorLearning(root, record), true);
    assert.ok(Number.isSafeInteger(record.validation.receipt.pullRequest), 'bind the real Draft PR before final validation');
    const before = await captureProbe(root, game, { ref: base });
    const after = await captureProbe(root, game, { ref: head });
    const repeated = await captureProbe(root, game, { ref: head });
    assert.equal(stable(after), stable(repeated), 'same exact source/fixture must be deterministic');
    const comparison = compareReports(before, after);
    assert.equal(comparison.comparable, true);
    reports.push({ game, id, problemKey: record.problemKey, base, head, before, after, comparison });
  }
  assert.equal(new Set(reports.map(r => r.problemKey)).size, 1, 'one iteration = one primary problem');
  for (const report of reports) console.log('AUTONOMOUS_EVIDENCE ' + JSON.stringify(report));
  return reports;
}
