import { subscribe, disclosure } from './view-state.js';

const root = document.querySelector('#integration-flow');
const node = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; };
const format = value => { if(!Number.isFinite(value))return'未計測'; const min=Math.round(value/60000); return min<1?'<1分':min<60?`${min}分`:`${Math.floor(min/60)}時間${min%60?` ${min%60}分`:''}`; };
const modeLabels = { NORMAL:'順調', BUSY:'やや混雑', BURN_DOWN:'滞留を解消中' };
const stageLabels = {
  'Draft→Ready': { plain:'実装開始 → 統合待ち', short:'実装完了待ち', owner:'実装側' },
  'Ready→Merge': { plain:'統合待ち → develop反映', short:'Integration', owner:'Integration' },
  'Merge→DEV': { plain:'develop反映 → DEV公開', short:'DEV公開', owner:'DEV公開' }
};
function metric(label,data){ const box=node('div','rs-flow-metric'); box.append(node('span','',label),node('strong','',`通常 ${format(data?.p50Ms)}`),node('small','',`遅いケース ${format(data?.p95Ms)} · 実績 ${data?.samples||0}件`)); return box; }
function fact(label,value,note='',tone=''){ const box=node('div',`rs-flow-fact ${tone}`); box.append(node('span','',label),node('strong','',value)); if(note)box.append(node('small','',note)); return box; }
function proofLine(proof){ const line=node('p','rs-note'); if(!proof){line.textContent='Virtual Train: 未検証';return line;} const prs=(proof.candidates||[]).map(item=>`#${item.pr}`).join(' '); line.textContent=`Virtual Train: ${proof.status}${prs?` · ${prs}`:''}${proof.fast?` · fast ${proof.fast}`:''}${proof.browser?` · browser ${proof.browser}`:''}`; return line; }
function reconciliationBlock(plan){
  if(!plan)return null;
  const wrap=node('div','rs-flow-reconcile');
  const counts=plan.counts||{};
  wrap.append(node('p','rs-note',`Reconcile: Ready ${plan.totalReady||counts.ready||0} · writer ${counts.writer||0} · validating ${counts.validating||0} · Train ${counts.trains||0}/${counts.trainMembers||0} PR · repair ${counts.repair||0} · active ${counts.active||0} · blocked ${counts.blocked||0} · deferred ${counts.deferred||0}`));
  if(plan.actionableIdle)wrap.append(node('p','rs-note','repair可能な仕事があるのに repair executor が0です。次のreconcileで再配分します。'));
  const lanes=node('div','rs-flow-knowledge');
  for(const train of (plan.trains||[]).slice(0,4))lanes.append(node('span','rs-pill',`${train.id||'Train'} ${(train.members||[]).map(item=>`#${item.pr}`).join(' ')}`));
  for(const item of (plan.validating||[]).slice(0,3))lanes.append(node('span','rs-pill',`validating #${item.pr}`));
  for(const item of (plan.repair||[]).slice(0,3))lanes.append(node('span','rs-pill',`repair #${item.pr}${item.repairKind?` ${item.repairKind}`:''}`));
  for(const item of (plan.blocked||[]).slice(0,3))lanes.append(node('span','rs-pill',`blocked #${item.pr}`));
  if(lanes.childElementCount)wrap.append(lanes);
  return wrap;
}
function humanRequiredCount(view){
  if(Array.isArray(view?.humanManual)) return view.humanManual.length;
  if(Array.isArray(view?.manual)) return view.manual.filter(item=>item?.manualKind==='human-required').length;
  return Number(view?.counts?.human||0);
}
function notificationLine(view){
  const value=view?.notification||'not configured';
  if(value==='ntfy')return 'スマホ通知: ntfy到達確認済み';
  if(value==='not configured')return 'スマホ通知: 未設定（Integration / DEV成功判定とは別）';
  return `スマホ通知: ${value}（delivery observabilityのみ）`;
}
function render(view){
  if(!root)return; root.replaceChildren();
  if(!view?.available){root.append(node('p','empty','自動統合の状態を取得できていません'));return;}
  const latency=view.flowControl?.latency||{}, tuning=view.flowControl?.tuning||{}, reconciliation=view.flowControl?.reconciliation||null;
  const demand=reconciliation?.totalReady||reconciliation?.counts?.ready||view.counts?.waiting||0;
  const mode=reconciliation?.pressure?.mode||tuning.pressure?.mode||(demand>=10?'BURN_DOWN':demand>=5?'BUSY':'NORMAL');
  const candidates=[['Draft→Ready',latency.implementationToReady?.p95Ms],['Ready→Merge',latency.readyToMerge?.p95Ms],['Merge→DEV',latency.mergeToDev?.p95Ms]].filter(([,value])=>Number.isFinite(value)).sort((a,b)=>b[1]-a[1]);
  const bottleneck=candidates[0]?.[0]||null, stage=stageLabels[bottleneck]||null;
  const humanRequired=humanRequiredCount(view);
  const quarantine=view.counts?.quarantine||0;
  const modeLabel=modeLabels[mode]||mode;

  const overview=node('section',`rs-flow-overview mode-${String(mode).toLowerCase()}`);
  const head=node('div','rs-flow-simple-head');
  const status=node('div'); status.append(node('span','rs-flow-kicker','自動統合の状態'),node('strong','',modeLabel));
  head.append(status,node('span','rs-flow-waiting',`待機 ${demand}件`));
  overview.append(head);

  const facts=node('div','rs-flow-facts');
  facts.append(
    fact('待機中',`${demand}件`,demand>=10?'滞留を減らすモードで処理中':demand>=5?'少し混み合っています':'通常範囲',demand>=10?'attention':''),
    fact('主な詰まり',stage?.short||'未計測',stage?`${stage.owner}で時間がかかっています`:'十分な実績がまだありません')
  );
  overview.append(facts);

  let bottleneckText='まだ十分な実績がないため、主な遅れは判定できません。';
  if(bottleneck==='Draft→Ready') bottleneckText=`主な遅れは、作業中のPRが「統合待ち」になるまでです。統合待ちになった後のdevelop反映は通常 ${format(latency.readyToMerge?.p50Ms)} です。`;
  if(bottleneck==='Ready→Merge') bottleneckText=`主な遅れは、統合待ちになったPRをdevelopへ反映する工程です。通常 ${format(latency.readyToMerge?.p50Ms)}、遅いケースで ${format(latency.readyToMerge?.p95Ms)} かかっています。`;
  if(bottleneck==='Merge→DEV') bottleneckText=`主な遅れは、developへ入った変更をDEVへ公開する工程です。通常 ${format(latency.mergeToDev?.p50Ms)} です。`;
  overview.append(node('p','rs-flow-explain',bottleneckText));

  const action=node('p',`rs-flow-action ${humanRequired?'needs-human':'auto-ok'}`,humanRequired?`あなたの確認が必要なPRが ${humanRequired}件あります。`:'いまはあなたの操作は不要です。自動処理に任せてOKです。');
  overview.append(action);
  root.append(overview);

  const detail=node('div','rs-flow-detail');
  const grid=node('div','rs-flow-grid');
  grid.append(metric('実装開始 → 統合待ち',latency.implementationToReady),metric('統合待ち → develop反映',latency.readyToMerge),metric('develop反映 → DEV公開',latency.mergeToDev),metric('実装開始 → DEV公開',latency.implementationToDev));
  detail.append(grid,node('p','rs-note',`内部モード ${mode} · 待機 ${demand} · 自動修復用に隔離 ${quarantine}件 · bottleneck ${bottleneck||'未計測'}`));
  const topology=reconciliationBlock(reconciliation); if(topology)detail.append(topology);
  if(tuning.rescueConcurrency)detail.append(node('p','rs-note',`Auto tuning: Repair ${tuning.rescueConcurrency} workers · eval ${tuning.maxEvaluations} · Train ${tuning.trainSize} · ${tuning.reason||''}`));
  detail.append(proofLine(view.flowControl?.trainProof));
  detail.append(node('p','rs-note',notificationLine(view)));
  const knowledge=view.flowControl?.failureKnowledge||[];
  if(knowledge.length){ const list=node('div','rs-flow-knowledge'); for(const item of knowledge.slice(0,5)) list.append(node('span','rs-pill',`${item.kind} ${item.successfulRepairs||0}/${item.count||0}`)); detail.append(list); }
  detail.append(node('p','rs-note','ReconcilerはGitHubの現在状態から毎回planを再構築します。Train/repair/preflightは並列化できますが、develop writerと個別PRのexact-head/review/check/merge直前再確認、DEV gateは省略しません。'));
  root.append(disclosure('flow:technical','詳しい処理情報（開発用）',detail,'rs-flow-disclosure'));
}
subscribe((state,error)=>{if(error)return;render(state?.integrationRescue);});
