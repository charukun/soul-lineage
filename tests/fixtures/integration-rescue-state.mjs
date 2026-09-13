// Test-only source. Never imported by public PULSE assets or its Worker.
import { newState, conflictScope, event } from '../../scripts/integration-rescue-policy.mjs';
export function rescueFixture(now = Date.now(), empty = false) {
  const s = newState(); s.config.maxConcurrency=6; s.coordinator={configured:true,phase:'observing',heartbeatAt:new Date(now).toISOString()};s.updatedAt=new Date(now).toISOString();
  if(empty)return s;
  const put=(pr,state,scope,extra={})=>{
    const r={pr,state,title:`${scope.split('/').at(-1)} reconciliation`,scope:conflictScope([`${scope}/src/online.js`,`${scope}/src/raid.js`,`${scope}/tests/browser.spec.js`]),
      reason:'MERGE_CONFLICT',currentStep:state,currentAction:'develop側のinterfaceを維持しながらPRの変更を移植中',
      rescueId:`wave-14-pr-${pr}-a1`,claimedBy:`1400/pr-${pr}/a1`,wave:'wave-14',runId:'1400',attempt:1,maxAttempts:3,
      headSha:'a'.repeat(40),developSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),detectedAt:new Date(now-20*60000).toISOString(),
      claimedAt:new Date(now-4*60000).toISOString(),heartbeatAt:new Date(now-8000).toISOString(),updatedAt:new Date(now-5000).toISOString(),
      dependencies:[],blockedBy:[],risk:'GREEN',riskReason:'Independent scopes',priority:{label:'HIGH',score:70,explanation:'repair +100, risk penalty'},...extra};s.records[pr]=r;return r;
  };
  put(120,'RESOLVING','apps/village',{lease:'r120',currentFile:'apps/village/src/online.js'});
  put(124,'VALIDATING','apps/character-workshop',{lease:'r124',risk:'YELLOW',currentAction:'競合解消完了。対象テストを検証中'});
  put(128,'ANALYZING','apps/demon',{lease:'r128'});
  put(131,'PUSHING','docs',{lease:'r131',currentAction:'検証成功。headとdevelopの最終確認中'});
  put(125,'BLOCKED_BY_RESCUE','apps/village',{lease:null,risk:'RED',blockedBy:[120],dependencies:[120],waitingReason:'同一schemaを変更しているPR #120のdevelop統合待ち'});
  put(139,'QUEUED','apps/rinne',{lease:null,claimedBy:null,claimedAt:null,reason:'DEVELOP_ADVANCED'});
  put(140,'FAILED_RETRYABLE','apps/rinne',{lease:null,attempt:2,failureReason:'test failure',failures:[{attempt:1,workerId:'1399/pr-140/a1',reason:'test failure',at:new Date(now-60000).toISOString()}]});
  put(142,'FAILED_MANUAL','packages/game-data',{lease:null,attempt:3,risk:'RED',failureReason:'Product specification conflict: save schema',currentAction:'保存仕様が矛盾しています。PRで仕様判断が必要です。'});
  put(145,'STALE','apps/legacy',{lease:'r145',heartbeatAt:new Date(now-12*60000).toISOString(),currentAction:'Worker heartbeat lost; runner terminationを確認中'});
  const done=put(119,'CHECKING','apps/village',{lease:null,returnedAt:new Date(now-2*60000).toISOString(),pushedAt:new Date(now-3*60000).toISOString(),pushedSha:'d'.repeat(40),resolution:'semantic merge',currentAction:'push完了。通常Integrationの再評価待ち',validation:{status:'passed',command:'trusted fast validation',head:'d'.repeat(40)}});
  event(s,done,'RETURNED_TO_INTEGRATION','PR #119 returned to Integration',now-2*60000);
  const merged=put(118,'MERGED','docs',{lease:null,claimedAt:new Date(now-35*60000).toISOString(),pushedAt:new Date(now-31*60000).toISOString(),returnedAt:new Date(now-30*60000).toISOString(),mergedAt:new Date(now-10*60000).toISOString(),mergeCommit:'e'.repeat(40),pushedSha:'f'.repeat(40),validation:{status:'passed',command:'trusted fast validation',head:'f'.repeat(40)},currentAction:'Rescue後のdevelop統合を確認'});
  event(s,merged,'RETURNED_TO_INTEGRATION','PR #118 returned to Integration',now-30*60000);event(s,merged,'MERGED','PR #118 merged after Rescue',now-10*60000);
  event(s,s.records[145],'STALE','Worker 1398 lost heartbeat',now-60000);
  event(s,s.records[140],'CLAIMED','Recovered by Worker 1400/pr-140/a2',now-50000);
  s.waves=[{id:'wave-14',startedAt:new Date(now-4*60000).toISOString(),prs:[120,124,128,131],rescueIds:[120,124,128,131].map(pr=>s.records[pr].rescueId)}];
  return s;
}
