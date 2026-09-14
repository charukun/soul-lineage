import { subscribe } from './view-state.js';

const root = document.querySelector('#integration-flow');
const node = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; };
const duration = (start, end) => {
  const a=Date.parse(start||''), b=Date.parse(end||'');
  return Number.isFinite(a)&&Number.isFinite(b)&&b>=a ? b-a : null;
};
const percentile = (values, q) => {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(q*sorted.length)-1))];
};
const format = value => {
  if(!Number.isFinite(value))return '未計測';
  const min=Math.round(value/60000);
  return min<1?'<1m':min<60?`${min}m`:`${Math.floor(min/60)}h ${min%60}m`;
};
function metric(label, values){
  const box=node('div','rs-flow-metric');
  box.append(node('span','',label),node('strong','',format(percentile(values,.5))),node('small','',`p95 ${format(percentile(values,.95))} · n=${values.filter(Number.isFinite).length}`));
  return box;
}
function render(view){
  if(!root)return;
  root.replaceChildren();
  if(!view?.available){root.append(node('p','empty','Flow metrics 未取得'));return;}
  const records=view.recent||[];
  const readyMerge=records.map(r=>duration(r.detectedAt,r.mergedAt)).filter(Number.isFinite);
  const mergeDev=records.map(r=>duration(r.mergedAt,r.devAt)).filter(Number.isFinite);
  const readyDev=records.map(r=>duration(r.detectedAt,r.devAt)).filter(Number.isFinite);
  const demand=(view.counts?.waiting||0)+(view.counts?.recoverableManual||0);
  const mode=demand>=10?'BURN_DOWN':demand>=5?'BUSY':'NORMAL';
  const candidates=[['Ready→Merge',percentile(readyMerge,.95)],['Merge→DEV',percentile(mergeDev,.95)]].filter(([,v])=>Number.isFinite(v));
  const bottleneck=candidates.sort((a,b)=>b[1]-a[1])[0]?.[0]||'未計測';
  const head=node('div','rs-flow-head'); head.append(node('strong','',mode),node('span','',`Demand ${demand} · bottleneck ${bottleneck}`));
  const grid=node('div','rs-flow-grid'); grid.append(metric('Ready→Merge',readyMerge),metric('Merge→DEV',mergeDev),metric('Ready→DEV',readyDev));
  root.append(head,grid,node('p','rs-note','RescueがReadyを検知した時刻を起点にした保持履歴内のp50/p95。BURN_DOWN中はrepair・古いReady・独立scope Trainを優先し、非緊急maintenance生成を抑制します。'));
}
subscribe((state,error)=>{if(error)return;render(state?.integrationRescue);});
