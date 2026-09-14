import { subscribe } from './view-state.js';

const root = document.querySelector('#integration-flow');
const node = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; };
const format = value => { if(!Number.isFinite(value))return'未計測'; const min=Math.round(value/60000); return min<1?'<1m':min<60?`${min}m`:`${Math.floor(min/60)}h ${min%60}m`; };
function metric(label,data){ const box=node('div','rs-flow-metric'); box.append(node('span','',label),node('strong','',format(data?.p50Ms)),node('small','',`p95 ${format(data?.p95Ms)} · n=${data?.samples||0}`)); return box; }
function proofLine(proof){ const line=node('p','rs-note'); if(!proof){line.textContent='Virtual Train: 未検証';return line;} const prs=(proof.candidates||[]).map(item=>`#${item.pr}`).join(' '); line.textContent=`Virtual Train: ${proof.status}${prs?` · ${prs}`:''}${proof.fast?` · fast ${proof.fast}`:''}${proof.browser?` · browser ${proof.browser}`:''}`; return line; }
function reconciliationBlock(plan){
  if(!plan)return null;
  const wrap=node('div','rs-flow-reconcile');
  const counts=plan.counts||{};
  const headline=node('p','rs-note',`Reconcile: Ready ${plan.totalReady||counts.ready||0} · writer ${counts.writer||0} · validating ${counts.validating||0} · Train ${counts.trains||0}/${counts.trainMembers||0} PR · repair ${counts.repair||0} · active ${counts.active||0} · blocked ${counts.blocked||0} · deferred ${counts.deferred||0}`);
  wrap.append(headline);
  if(plan.actionableIdle)wrap.append(node('p','rs-note','実行可能な仕事があるのに executor が0です。次のreconcileで再配分します。'));
  const lanes=node('div','rs-flow-knowledge');
  for(const train of (plan.trains||[]).slice(0,4))lanes.append(node('span','rs-pill',`${train.id||'Train'} ${(train.members||[]).map(item=>`#${item.pr}`).join(' ')}`));
  for(const item of (plan.validating||[]).slice(0,3))lanes.append(node('span','rs-pill',`validating #${item.pr}`));
  for(const item of (plan.repair||[]).slice(0,3))lanes.append(node('span','rs-pill',`repair #${item.pr}${item.repairKind?` ${item.repairKind}`:''}`));
  for(const item of (plan.blocked||[]).slice(0,3))lanes.append(node('span','rs-pill',`blocked #${item.pr}`));
  if(lanes.childElementCount)wrap.append(lanes);
  return wrap;
}
function render(view){
  if(!root)return; root.replaceChildren();
  if(!view?.available){root.append(node('p','empty','Flow metrics 未取得'));return;}
  const latency=view.flowControl?.latency||{}, tuning=view.flowControl?.tuning||{}, reconciliation=view.flowControl?.reconciliation||null;
  const demand=reconciliation?.totalReady||reconciliation?.counts?.ready||view.counts?.waiting||0;
  const mode=reconciliation?.pressure?.mode||tuning.pressure?.mode||(demand>=10?'BURN_DOWN':demand>=5?'BUSY':'NORMAL');
  const candidates=[['Draft→Ready',latency.implementationToReady?.p95Ms],['Ready→Merge',latency.readyToMerge?.p95Ms],['Merge→DEV',latency.mergeToDev?.p95Ms]].filter(([,value])=>Number.isFinite(value)).sort((a,b)=>b[1]-a[1]);
  const bottleneck=candidates[0]?.[0]||'未計測';
  const head=node('div','rs-flow-head'); head.append(node('strong','',mode),node('span','',`Demand ${demand} · Quarantine ${view.counts?.quarantine||0} · bottleneck ${bottleneck}`));
  const grid=node('div','rs-flow-grid'); grid.append(metric('Draft→Ready',latency.implementationToReady),metric('Ready→Merge',latency.readyToMerge),metric('Merge→DEV',latency.mergeToDev),metric('Draft→DEV',latency.implementationToDev));
  root.append(head,grid);
  const topology=reconciliationBlock(reconciliation); if(topology)root.append(topology);
  if(tuning.rescueConcurrency)root.append(node('p','rs-note',`Auto tuning: Repair ${tuning.rescueConcurrency} workers · eval ${tuning.maxEvaluations} · Train ${tuning.trainSize} · ${tuning.reason||''}`));
  root.append(proofLine(view.flowControl?.trainProof));
  const knowledge=view.flowControl?.failureKnowledge||[];
  if(knowledge.length){ const list=node('div','rs-flow-knowledge'); for(const item of knowledge.slice(0,5)) list.append(node('span','rs-pill',`${item.kind} ${item.successfulRepairs||0}/${item.count||0}`)); root.append(list); }
  root.append(node('p','rs-note','ReconcilerはGitHubの現在状態から毎回planを再構築します。Train/repair/preflightは並列化できますが、develop writerと個別PRのexact-head/review/check/merge直前再確認、DEV gateは直列・省略なしです。'));
}
subscribe((state,error)=>{if(error)return;render(state?.integrationRescue);});