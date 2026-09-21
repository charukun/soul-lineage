import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { json, git, validateRecord, loadContext, checkHistoryChanges, checkPriorLearning, recordThemeKey, recordProblemKeys } from './contract.mjs';
import { captureProbe, compareReports, stable } from './probes.mjs';

export function activeExperimentsFromDiff(rows) {
  const active=[];
  for (const row of String(rows||'').split('\n').filter(Boolean)) {
    const [status,path]=row.split('\t');
    const match=path?.match(/^\.autonomous\/(village|kuumetsu|rinne)\/experiments\/([a-z0-9][a-z0-9-]{2,95})\.json$/);
    if (match && status === 'A') active.push({game:match[1],id:match[2]});
  }
  return active;
}

export function discoverActiveExperiments(root,{baseRef,headRef='HEAD'}={}) {
  const base=git(root,['rev-parse',baseRef || process.env.AUTONOMOUS_BASE_REF || 'origin/develop']);
  const head=git(root,['rev-parse',headRef]);
  const diff=git(root,['diff','--name-status','--no-renames',base,head,'--','.autonomous/village/experiments','.autonomous/kuumetsu/experiments','.autonomous/rinne/experiments']);
  return activeExperimentsFromDiff(diff);
}

export async function validateActiveExperiments(root, active = discoverActiveExperiments(root)) {
  assert.ok(Array.isArray(active) && active.length > 0 && active.length <= 2, 'one improvement theme, at most two related experiment records');
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
    const pr=record.schemaVersion===2?record.receipt.pullRequest:record.validation.receipt.pullRequest;
    assert.ok(Number.isSafeInteger(pr), 'bind the real Draft PR before final validation');
    const before = await captureProbe(root, game, { ref: base });
    const after = await captureProbe(root, game, { ref: head });
    const repeated = await captureProbe(root, game, { ref: head });
    assert.equal(stable(after), stable(repeated), 'same exact source/fixture must be deterministic');
    const comparison = compareReports(before, after);
    assert.equal(comparison.comparable, true);
    reports.push({
      game,id,themeKey:recordThemeKey(record),problemKeys:recordProblemKeys(record),
      workItems:record.schemaVersion===3?record.workItems.map(item=>({id:item.id,rootCauseKeys:item.rootCauseKeys,paths:item.paths})):[],
      experienceGoal:record.schemaVersion===3?record.experienceGoal:null,
      base,head,before,after,comparison,probeCoverageOnly:true
    });
  }
  assert.equal(new Set(reports.map(report => report.themeKey)).size, 1, 'one iteration = one improvement theme');
  for (const report of reports) console.log('AUTONOMOUS_EVIDENCE ' + JSON.stringify(report));
  return reports;
}
