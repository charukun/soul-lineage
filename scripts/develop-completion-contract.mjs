import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const DEVELOP_SUCCESS_TERMINAL='MERGED_TO_DEVELOP';
export const LEGACY_READY_TERMINAL='READY_FOR_INTEGRATION';

export function verifyDevelopCompletionContract(root=process.cwd()){
  const read=path=>readFileSync(resolve(root,path),'utf8');
  const agents=read('AGENTS.md');
  const development=read('docs/DEVELOPMENT.md');
  const executionPolicy=read('docs/RINNE_PROJECT_EXECUTION_POLICY.md');
  const developMerge=read('docs/DEVELOP_MERGE.md');
  const preReady=read('scripts/pre-ready-reconcile.mjs');

  assert.match(agents,/Ready for review is transient, not a success terminal/);
  assert.match(agents,/MERGED_TO_DEVELOP/);
  assert.match(agents,/same task worker merges that exact validated head to `develop`/);
  assert.match(development,/Ready is not a handoff or success state/);
  assert.match(development,/Normal success is `MERGED_TO_DEVELOP`/);
  assert.match(executionPolicy,/Routine implementation finishes only after the same task worker merges the exact validated PR head to `develop`/);
  assert.match(executionPolicy,/Ready is not success/);
  assert.match(executionPolicy,/- develop merge commit SHA/);
  assert.match(developMerge,/same-task exact-head merge to develop/);
  assert.match(developMerge,/normal success is `MERGED_TO_DEVELOP`/);
  assert.match(preReady,/terminal=MERGED_TO_DEVELOP/);

  for(const source of [agents,development,executionPolicy,developMerge]){
    assert.match(source,/exact[- ]head|exact validated head|exact validated PR head/i);
  }

  const staleTerminalLine=/^\s*(?:Status:\s*)?READY_FOR_INTEGRATION\s*$/m;
  for(const [path,source] of [
    ['AGENTS.md',agents],
    ['docs/DEVELOPMENT.md',development],
    ['docs/RINNE_PROJECT_EXECUTION_POLICY.md',executionPolicy],
    ['docs/DEVELOP_MERGE.md',developMerge],
  ]){
    assert.doesNotMatch(source,staleTerminalLine,`${path} must not publish READY_FOR_INTEGRATION as a terminal state`);
  }

  for(const stale of [
    '同じ Ready PR のGitHub automation',
    'Ready は引き続き対話的な実装作業の終了境界',
    'Ready for review 化済み',
    '`implementation/handoff`',
  ]){
    assert.ok(!executionPolicy.includes(stale),`execution policy contains stale Ready-terminal wording: ${stale}`);
  }
  assert.ok(!development.includes('merge-forward してから handoff する'),'development must not route Ready into a handoff terminal');
  assert.ok(!development.includes('Ready handoff は変えない'),'transport docs must preserve same-task merge, not Ready handoff');
  return true;
}
