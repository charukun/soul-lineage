const REPOSITORY='charukun/soul-lineage';
const clean=(value,limit=500)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').trim().slice(0,limit);

function developSha(state={}){
  const dev=(state.environments||[]).find(item=>item.id==='dev');
  return clean(dev?.branchCommit||state?.controlTower?.sourceIdentity||state?.publicManifest?.validatedDevelop,80)||null;
}
function issuePrNumber(issue={}){
  if(Number.isFinite(Number(issue.prNumber)))return Number(issue.prNumber);
  const match=String(issue.url||'').match(/\/pull\/(\d+)/);
  return match?Number(match[1]):null;
}
function matchingSession(issue,state={}){
  const pr=issuePrNumber(issue);
  const run=String(issue.url||'').match(/\/actions\/runs\/(\d+)/)?.[1]||null;
  const sessions=Array.isArray(state.developmentSessions)?state.developmentSessions:[];
  return sessions.find(session=>pr&&session.pr?.number===pr)
    ||sessions.find(session=>run&&(session.steps||[]).some(step=>String(step.runId||'')===run))
    ||sessions.find(session=>issue.appId&&(session.targets||[]).some(target=>target.id===issue.appId))
    ||null;
}

export function issueRepairPayload(issue={},state={}){
  const session=matchingSession(issue,state);
  return Object.freeze({
    repository:REPOSITORY,
    observedAt:clean(state.generatedAt,80)||null,
    pulseSyncStatus:clean(state.syncStatus,40)||null,
    developSha:developSha(state),
    issue:Object.freeze({
      type:clean(issue.type,100)||'unknown',tone:clean(issue.tone,40)||null,title:clean(issue.title,220)||'PULSEで異常を検出',
      detail:clean(issue.detail,600)||null,url:clean(issue.url,600)||null,since:clean(issue.since,80)||null,
      appId:clean(issue.appId,100)||null,prNumber:issuePrNumber(issue),
    }),
    session:session?Object.freeze({
      prNumber:session.pr?.number||null,title:clean(session.title,240),state:clean(session.state,40),status:clean(session.status,40),
      branch:clean(session.branch,180)||null,headSha:clean(session.headSha,80)||null,validatedExactHead:clean(session.validatedExactHead,80)||null,
      mergeSha:clean(session.mergeSha,80)||null,repairAttempts:Number(session.repairAttempts)||0,
      targets:(session.targets||[]).map(target=>clean(target.label||target.id,100)).filter(Boolean),
    }):null,
  });
}

export function buildIssueRepairPrompt(issue={},state={}){
  const payload=issueRepairPayload(issue,state);
  const target=payload.session?.prNumber?'PR #'+payload.session.prNumber:payload.issue.prNumber?'PR #'+payload.issue.prNumber:'関連する現在のPR / Actions run';
  return [
    '対象Repository: '+REPOSITORY,
    '',
    'PULSEで検出されている異常を調査し、原因を解消してください。',
    '',
    '重要:',
    '- PULSEのsnapshotは参考情報です。表示内容だけを信じず、必ず現在のGitHub状態を正本として再確認してください。',
    '- 最新develop exact SHAとAGENTS.mdを最初に確認してください。',
    '- '+target+' が存在する場合は、その既存branch / PRを維持してください。異常解消のためだけにreplacement PRを作らないでください。',
    '- まず `npm run actions:summary -- --repo '+REPOSITORY+' --sha <exact-sha> [--pr <number>]` 相当の集約結果を確認し、failure digest / exact-head / freshness / affected scopeを優先して判断してください。個別logは集約結果で不足する場合だけ掘ってください。',
    '- source / workflow / infrastructureの根本原因だけを修正し、テスト・品質gate・browser assertion・Fast DEV gateを弱めて通さないでください。',
    '- 実装変更は最新developからの同じ作業branchへ反映し、必要最小限のfocused validationを選んでください。',
    '- 最終headは[astra-validate]付きでGitHub Actions hosted runnerの正式validationを通してください。',
    '- developが進んだ場合はSHAが変わっただけでreconcileせず、競合またはaffected scope overlapがある場合だけ取り込み・再検証してください。',
    '- 検証済みexact head、PR head、merge対象headを一致させ、問題が解消してReady条件を満たすなら同じセッションでdevelopへmergeしてください。',
    '- main / Productionは変更しないでください。',
    '- Ready後の通常CI、browser verification、DEV公開完了を不要にpollingしないでください。',
    '- 現在状態を確認した結果、異常がすでに後続成功等で解消済みなら再実行・再修正せず、その根拠を報告してください。',
    '',
    'PULSE参考snapshot:',
    'BEGIN_PULSE_ISSUE_DATA',
    JSON.stringify(payload,null,2),
    'END_PULSE_ISSUE_DATA',
    '',
    '途中確認は不要です。真のblockerが残る場合だけFAILEDとし、それ以外は修復・正式検証・freshness確認・develop mergeまで完遂してください。',
  ].join('\n');
}
