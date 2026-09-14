import { subscribe } from './view-state.js';

const root=document.querySelector('#integration-flow');
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const format=value=>{if(!Number.isFinite(value))return'未計測';const min=Math.round(value/60000);return min<1?'<1m':min<60?`${min}m`:`${Math.floor(min/60)}h ${min%60}m`;};
function metric(label,data){const box=node('div','rs-flow-metric');box.append(node('span','',label),node('strong','',format(data?.p50Ms)),node('small','',`p95 ${format(data?.p95Ms)} · n=${data?.samples||0}`));return box;}
function proofLine(proof){
  const line=node('p','rs-note');
  if(!proof){line.textContent='Virtual Train: 未検証';return line;}
  const prs=(proof.candidates||[]).map(item=>`#${item.pr}`).join(' ');
  line.textContent=`Virtual Train: ${proof.status}${prs?` · ${prs}`:''}${proof.fast?` · fast ${proof.fast}`:''}${proof.browser?` · browser ${proof.browser}`:''}`;
  return line;
}
function render(view){
  if(!root)return;root.replaceChildren();
  if(!view?.available){root.append(node('p','empty','Flow metrics 未取得'));return;}
  const latency=view.flowControl?.latency||{},tuning=view.flowControl?.tuning||{};
  const demand=view.counts?.waiting||0,mode=tuning.pressure?.mode||(demand>=10?'BURN_DOWN':demand>=5?'BUSY':'NORMAL');
  const candidates=[['Draft→Ready',latency.implementationToReady?.p95Ms],['Ready→Merge',latency.readyToMerge?.p95Ms],['Merge→DEV',latency.mergeToDev?.p95Ms]]
    .filter(([,value])=>Number.isFinite(value)).sort((a,b)=>b[1]-a[1]);
  const bottleneck=candidates[0]?.[0]||'未計測';
  const head=node('div','rs-flow-head');
  head.append(node('strong','',mode),node('span','',`Demand ${demand} · Quarantine ${view.counts?.quarantine||0} · bottleneck ${bottleneck}`));
  const grid=node('div','rs-flow-grid');
  grid.append(metric('Draft→Ready',latency.implementationToReady),metric('Ready→Merge',latency.readyToMerge),metric('Merge→DEV',latency.mergeToDev),metric('Draft→DEV',latency.implementationToDev));
  root.append(head,grid);
  if(tuning.rescueConcurrency)root.append(node('p','rs-note',`Auto tuning: Rescue ${tuning.rescueConcurrency} workers · eval ${tuning.maxEvaluations} · Train ${tuning.trainSize} · ${tuning.reason||''}`));
  root.append(proofLine(view.flowControl?.trainProof));
  root.append(node('p','rs-note','Draft作成時刻を実装開始のRepository基準として計測。チャット依頼時刻そのものではありません。Validated Virtual Trainは合成treeのfast/browser証拠で、個別PRのreview/check/merge直前再確認やDEV gateを省略しません。'));
}
subscribe((state,error)=>{if(error)return;render(state?.integrationRescue);});