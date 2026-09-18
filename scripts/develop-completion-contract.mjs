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
  assert.match(development,/Ready for review は終了状態ではない/);
  assert.match(development,/正常終了は `Merged` \/ `MERGED_TO_DEVELOP` だけ/);
  assert.match(executionPolicy,/Ready は対話的な実装作業の終了境界ではない/);
  assert.match(executionPolicy,/PRがReadyなだけの状態では成功の最終応答を返さず/);
  assert.match(developMerge,/same-task worker merges exact PR head to develop/);
  assert.match(preReady,/terminal=MERGED_TO_DEVELOP/);

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
  ]){
    assert.ok(!executionPolicy.includes(stale),`execution policy contains stale Ready-terminal wording: ${stale}`);
  }
  return true;
}
