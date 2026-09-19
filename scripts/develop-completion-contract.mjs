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
  const workflow=read('.github/workflows/astra-work-validation.yml');
  const preReady=read('scripts/pre-ready-reconcile.mjs');

  assert.match(agents,/Ready for review is transient, not a success terminal/);
  assert.match(agents,/MERGED_TO_DEVELOP/);
  assert.match(agents,/final reconciled head/);
  assert.match(agents,/\[astra-validate\]/);
  assert.match(development,/Ready is not a handoff or success state/);
  assert.match(development,/Normal success is `MERGED_TO_DEVELOP`/);
  assert.match(development,/Intermediate branch pushes are implementation details, not waiting points/);
  assert.match(executionPolicy,/same task worker merges the final reconciled PR head to `develop`/);
  assert.match(executionPolicy,/Ready is not success/);
  assert.match(executionPolicy,/single required merge validation/);
  assert.match(developMerge,/same-task merge to develop/);
  assert.match(developMerge,/\[astra-validate\]/);
  assert.match(workflow,/contains\(github\.event\.head_commit\.message, '\[astra-validate\]'\)/);
  assert.match(agents,/astra\/fast-dev-contract=error/);
  assert.match(agents,/recoverable self-inflicted violation/);
  assert.match(development,/Fast DEV execution contract/);
  assert.match(workflow,/origin\/develop:scripts\/fast-dev-contract\.mjs/);
  assert.match(workflow,/npm ci --ignore-scripts/);
  assert.match(workflow,/astra\/fast-dev-contract/);
  assert.match(preReady,/terminal=MERGED_TO_DEVELOP/);

  for(const source of [agents,development,executionPolicy,developMerge]){
    assert.match(source,/final[- ]head|exact[- ]head|final reconciled head/i);
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
