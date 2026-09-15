import { subscribe, disclosure } from './view-state.js';

const root = document.querySelector('#integration-flow');
const node = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; };
const format = value => { if(!Number.isFinite(value))return'未計測'; const min=Math.round(value/60000); return min<1?'<1分':min<60?`${min}分`:`${Math.floor(min/60)}時間${min%60?` ${min%60}分`:''}`; };
const fact = (label,value,note='',tone='') => { const box=node('div',`rs-flow-fact ${tone}`); box.append(node('span','',label),node('strong','',value)); if(note)box.append(node('small','',note)); return box; };
const metric = (label,data) => { const box=node('div','rs-flow-metric'); box.append(node('span','',label),node('strong','',`参考 ${format(data?.p50Ms)}`),node('small','',`過去の遅いケース ${format(data?.p95Ms)} · 実績 ${data?.samples||0}件`)); return box; };
const FAST_STAGES = new Set(['READY_WAIT','CI_FAILED','FAST_CHECK','FAST_CHECK_FAILED','VALIDATING']);
const MERGE_STAGES = new Set(['READY_RECONCILE','RECONCILE_UNKNOWN','INTEGRATING','TRAIN','DEFERRED','MERGE_READY']);
const humanRequiredCount = view => Array.isArray(view?.humanManual) ? view.humanManual.length : Array.isArray(view?.manual) ? view.manual.filter(item=>item?.manualKind==='human-required').length : Number(view?.counts?.human||0);
const recoverableCount = view => Array.isArray(view?.recoverableManual) ? view.recoverableManual.length : Array.isArray(view?.manual) ? view.manual.filter(item=>item?.manualKind==='work-recoverable').length : Number(view?.counts?.recoverableManual||0);
function notificationLine(view){
  const value=view?.notification||'not configured';
  if(value==='ntfy')return 'スマホ通知: ntfy到達確認済み';
  if(value==='not configured')return 'スマホ通知: 未設定（Integration / DEV成功判定とは別）';
  return `スマホ通知: ${value}（delivery observabilityのみ）`;
}
function legacyDiagnostics(view){
  const detail=node('div','rs-flow-detail');
  const latency=view?.flowControl?.latency||{};
  const grid=node('div','rs-flow-grid');
  grid.append(
    metric('履歴: Draft→Ready',latency.implementationToReady),
    metric('履歴: Ready→Merge',latency.readyToMerge),
    metric('履歴: Merge→DEV',latency.mergeToDev),
    metric('履歴: 実装開始 → DEV公開',latency.implementationToDev)
  );
  detail.append(grid);
  const reconciliation=view?.flowControl?.reconciliation;
  if(reconciliation){
    const counts=reconciliation.counts||{};
    detail.append(node('p','rs-note',`旧Reconciliation診断: Ready ${reconciliation.totalReady||counts.ready||0} · writer ${counts.writer||0} · validating ${counts.validating||0} · blocked ${counts.blocked||0}`));
  }
  const proof=view?.flowControl?.trainProof;
  detail.append(node('p','rs-note',proof ? `旧Virtual Train診断: ${proof.status||'unknown'} · ${(proof.candidates||[]).map(item=>`#${item.pr}`).join(' ')||'候補なし'}` : '旧Virtual Train診断: 証跡なし'));
  const quarantine=view?.counts?.quarantine||0;
  detail.append(node('p','rs-note',`自動修復用に隔離 ${quarantine}件 · これはFast Laneの通常待機件数には含めません。`));
  detail.append(node('p','rs-note',notificationLine(view)));
  detail.append(node('p','rs-note','旧Planner / Train / p50・p95は履歴診断です。現在のmerge authorityはFast Laneのexact-head fast check + serialized writerです。'));
  return detail;
}
function render(state){
  if(!root)return;
  root.replaceChildren();
  if(!state){root.append(node('p','empty','Fast Laneの状態を取得できていません'));return;}
  const integration=state.integration||{};
  const queue=Array.isArray(integration.queue)?integration.queue:[];
  const rescue=state.integrationRescue||{};
  const counts=rescue.counts||{};
  const fastCheck=queue.filter(item=>FAST_STAGES.has(item.stage));
  const mergeLane=queue.filter(item=>MERGE_STAGES.has(item.stage));
  const holds=queue.filter(item=>item.stage==='HOLD');
  const humanRequired=humanRequiredCount(rescue);
  const recoverable=recoverableCount(rescue);
  const repairWaiting=Number(counts.queued||0)+Number(counts.blocked||0)+Number(counts.retry||0)+recoverable;
  const repairActive=Number(counts.active||0);
  const dev=(state.environments||[]).find(item=>item.id==='dev')||{};
  const devAhead=Number(dev.deployQueue?.commitsAhead||0);
  const devFollowing=devAhead>0||dev.deployState==='deploying';
  const readyCount=queue.filter(item=>item.stage!=='READY_WAIT'||item.label!=='作業中').length;
  const tone=humanRequired?'burn_down':mergeLane.length||fastCheck.length?'busy':'normal';
  const headline=humanRequired?'人の確認が必要':mergeLane.length?'Fast Lane処理中':fastCheck.length?'Fast check中':devFollowing?'DEV追従中':repairWaiting||repairActive?'Repair後追い中':'ALL CLEAR';

  const overview=node('section',`rs-flow-overview mode-${tone}`);
  const head=node('div','rs-flow-simple-head');
  const status=node('div'); status.append(node('span','rs-flow-kicker','FAST LANE'),node('strong','',headline));
  head.append(status,node('span','rs-flow-waiting',`Ready ${readyCount}件`));
  overview.append(head);

  const facts=node('div','rs-flow-facts');
  facts.append(
    fact('FAST CHECK',`${fastCheck.length}件`,fastCheck.length?'対象PRだけ確認中。失敗しても他PRは進みます':'待ちなし',fastCheck.some(item=>item.stage==='CI_FAILED'||item.stage==='FAST_CHECK_FAILED')?'attention':''),
    fact('MERGE LANE',`${mergeLane.length}件`,mergeLane.length?'single writerが順次developへ反映':'待ちなし'),
    fact('MERGED → DEV',`${devAhead} commit`,devFollowing?'最新developだけを公開へ追従':'DEVはdevelopに追従済み'),
    fact('REPAIR',`${repairWaiting}件`,`${repairActive} worker active · 通常mergeとは別レーン`,humanRequired?'attention':'')
  );
  overview.append(facts);
  const blockedNote=holds.length?` 明示保留は ${holds.length}件あり、そのPRだけ停止しています。`:'';
  overview.append(node('p','rs-flow-explain',`Fast LaneはPR単位です。browser・DEV公開・Repairは後追いし、独立したReady PRのmergeを止めません。${blockedNote}`));
  overview.append(node('p',`rs-flow-action ${humanRequired?'needs-human':'auto-ok'}`,humanRequired?`あなたの判断が必要なPRが ${humanRequired}件あります。`:'いまはあなたの操作は不要です。通るPRから自動で流します。'));
  root.append(overview);

  root.append(disclosure('flow:technical','詳しい処理情報（開発用）',legacyDiagnostics(rescue),'rs-flow-disclosure'));
}
subscribe((state,error)=>{if(error)return;render(state);});
