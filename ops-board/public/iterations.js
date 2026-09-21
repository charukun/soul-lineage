import { subscribe } from './view-state.js';

const $=selector=>document.querySelector(selector);
const el=(tag,className='',text=null)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==null&&text!==undefined)node.textContent=String(text);
  return node;
};
const svgEl=(tag,attrs={})=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  return node;
};
const parsed=value=>{
  const time=Date.parse(value||'');
  return Number.isFinite(time)?time:null;
};
const shortSha=value=>value?String(value).slice(0,10):'—';
const gameLabel=value=>({kuumetsu:'喰滅廻遊',rinne:'百年転生',village:'村づくり'})[value]||value||'自律改善';
const stateLabel=value=>({running:'進行中',active:'進行中',publishing:'DEV公開中',problem:'異常',complete:'完了'})[value]||value||'確認中';
const stateClass=value=>['running','active','publishing','problem','complete'].includes(value)?value:'active';
const stepDuration=(step,now=Date.now())=>{
  const raw=step?.durationMs,explicit=Number(raw);
  if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(explicit)&&explicit>=0)return explicit;
  const start=parsed(step?.startedAt),end=parsed(step?.completedAt);
  if(start!==null&&end!==null)return Math.max(0,end-start);
  if(step?.state==='running'&&start!==null)return Math.max(0,now-start);
  return null;
};
const formatSeconds=ms=>{
  if(!Number.isFinite(ms))return '未計測';
  const seconds=ms/1000;
  if(seconds<10)return seconds.toFixed(1)+'s';
  if(seconds<120)return Math.round(seconds)+'s';
  const minutes=Math.floor(seconds/60),rest=Math.round(seconds%60);
  return minutes+'m '+rest+'s';
};
const formatClock=value=>{
  const time=parsed(value);
  if(time===null)return '未記録';
  return new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(time);
};
const niceMax=value=>{
  if(!Number.isFinite(value)||value<=0)return 10;
  const magnitude=10**Math.floor(Math.log10(value));
  const normalized=value/magnitude;
  const nice=normalized<=1?1:normalized<=2?2:normalized<=5?5:10;
  return Math.max(10,nice*magnitude);
};

let currentState=null;
let gameFilter='all',statusFilter='all';

function createGraph(iteration){
  const wrap=el('div','iteration-chart-scroll');
  const svg=svgEl('svg',{class:'iteration-chart',viewBox:'0 0 760 210',role:'img','aria-label':'各ステップの所要時間'});
  const steps=iteration.steps||[],now=Date.now();
  const values=steps.map(step=>stepDuration(step,now));
  const measured=values.filter(Number.isFinite);
  if(!measured.length){
    const text=svgEl('text',{x:380,y:105,'text-anchor':'middle'});
    text.textContent='このiterationはstep timing未計測です';
    svg.append(text);wrap.append(svg);return wrap;
  }
  const left=44,right=18,top=20,bottom=42,w=760-left-right,h=210-top-bottom;
  const maxSeconds=niceMax(Math.max(...measured)/1000);
  for(const fraction of [0,.25,.5,.75,1]){
    const y=top+h-h*fraction;
    const grid=svgEl('line',{x1:left,y1:y,x2:left+w,y2:y,class:'grid'});
    const label=svgEl('text',{x:left-7,y:y+3,'text-anchor':'end'});
    label.textContent=Math.round(maxSeconds*fraction)+'s';
    svg.append(grid,label);
  }
  svg.append(svgEl('line',{x1:left,y1:top,x2:left,y2:top+h,class:'axis'}));
  svg.append(svgEl('line',{x1:left,y1:top+h,x2:left+w,y2:top+h,class:'axis'}));
  const points=[];
  const count=Math.max(steps.length,1);
  steps.forEach((step,index)=>{
    const x=left+(count===1?w/2:index*(w/(count-1)));
    const xlabel=svgEl('text',{x,y:top+h+18,'text-anchor':'middle'});
    xlabel.textContent=step.label||step.id;
    svg.append(xlabel);
    const value=values[index];
    if(!Number.isFinite(value))return;
    const sec=value/1000,y=top+h-(Math.min(sec,maxSeconds)/maxSeconds)*h;
    points.push({x,y,step,sec});
  });
  if(points.length>1){
    const path=svgEl('path',{class:'line',d:points.map((point,index)=>(index?'L':'M')+point.x.toFixed(1)+' '+point.y.toFixed(1)).join(' ')});
    svg.append(path);
  }
  for(const point of points){
    const circle=svgEl('circle',{cx:point.x,cy:point.y,r:4,class:'point'+(point.step.state==='running'?' running':'')});
    const value=svgEl('text',{x:point.x,y:Math.max(12,point.y-8),'text-anchor':'middle',class:'value'});
    value.textContent=point.sec<10?point.sec.toFixed(1)+'s':Math.round(point.sec)+'s';
    svg.append(circle,value);
  }
  wrap.append(svg);
  return wrap;
}

function progress(iteration){
  const root=el('div','iteration-progress');
  for(const step of iteration.steps||[]){
    const item=el('div','iteration-phase '+(step.state||'pending'));
    item.title=(step.label||step.id)+' · '+formatSeconds(stepDuration(step));
    item.append(el('i'),el('span','',step.label||step.id));
    root.append(item);
  }
  return root;
}

function timingGrid(iteration){
  const root=el('div','iteration-times');
  for(const step of iteration.steps||[]){
    const item=el('div','iteration-time');
    item.append(el('span','',step.label||step.id),el('strong','',formatSeconds(stepDuration(step))));
    root.append(item);
  }
  return root;
}

function copyPanel(iteration){
  const panel=el('section','iteration-panel iteration-copy');
  panel.append(el('h3','','改修内容'));
  panel.append(el('p','',iteration.improvementSummary||iteration.theme||'改修内容はまだtelemetryへ記録されていません。'));
  if(iteration.changes?.length){
    const list=el('ul');
    iteration.changes.forEach(value=>list.append(el('li','',value)));
    panel.append(list);
  }
  if(iteration.rootCauses?.length){
    panel.append(el('h3','','ROOT CAUSES'));
    const list=el('ul');
    iteration.rootCauses.forEach(item=>list.append(el('li','',item.summary?((item.key?item.key+' · ':'')+item.summary):(item.key||'root cause'))));
    panel.append(list);
  }
  if(iteration.changedPaths?.length){
    panel.append(el('h3','','CHANGED PATHS'));
    const paths=el('div','iteration-paths');
    iteration.changedPaths.forEach(value=>paths.append(el('code','',value)));
    panel.append(paths);
  }
  if(iteration.verdict){
    panel.append(el('h3','','VERDICT'),el('p','',iteration.verdict));
  }
  return panel;
}

function card(iteration){
  const article=el('article','iteration-card '+stateClass(iteration.status));
  article.dataset.iterationId=iteration.id||'';
  const head=el('div','iteration-card-head');
  const title=el('div');
  const line=el('div','iteration-titleline');
  line.append(
    el('span','iteration-game',gameLabel(iteration.game)),
    el('span','iteration-number','Iteration '+(iteration.iteration??'?')+(iteration.iterations?'/'+iteration.iterations:'')),
    el('span','iteration-runkey','run '+(iteration.runKey||'legacy')),
    el('span','iteration-state '+stateClass(iteration.status),stateLabel(iteration.status)),
  );
  title.append(line,el('h2','',iteration.theme||iteration.title||'テーマ記録待ち'));
  const current=(iteration.steps||[]).find(step=>step.id===iteration.currentStep)||(iteration.steps||[]).find(step=>step.state==='running');
  const currentBox=el('div','iteration-current');
  currentBox.append(el('span','','現在地'),el('strong','',current?.label||stateLabel(iteration.status)));
  head.append(title,currentBox);
  article.append(head,progress(iteration));

  const grid=el('div','iteration-grid');
  const chartPanel=el('section','iteration-panel');
  chartPanel.append(el('h3','','STEP DURATION · 秒'));
  chartPanel.append(createGraph(iteration),timingGrid(iteration));
  grid.append(chartPanel,copyPanel(iteration));
  article.append(grid);

  const meta=el('div','iteration-meta');
  const total=(iteration.steps||[]).map(step=>stepDuration(step)).filter(Number.isFinite).reduce((sum,value)=>sum+value,0);
  meta.append(el('span','','計測合計 '+formatSeconds(total||null)));
  meta.append(el('span','','更新 '+formatClock(iteration.updatedAt)));
  meta.append(el('span','','telemetry '+(iteration.telemetry||'inferred')));
  if(iteration.pr?.url){
    const link=el('a','','PR #'+iteration.pr.number+' ↗');
    link.href=iteration.pr.url;link.target='_blank';link.rel='noreferrer';meta.append(link);
  }
  if(iteration.validatedHead)meta.append(el('span','','validated '+shortSha(iteration.validatedHead)));
  if(iteration.mergeSha)meta.append(el('span','','merge '+shortSha(iteration.mergeSha)));
  if(iteration.repairAttempts)meta.append(el('span','','repair '+iteration.repairAttempts));
  article.append(meta);
  return article;
}

function filtered(iterations){
  return iterations.filter(item=>{
    if(gameFilter!=='all'&&item.game!==gameFilter)return false;
    if(statusFilter==='all')return true;
    if(statusFilter==='complete')return item.status==='complete';
    if(statusFilter==='problem')return item.status==='problem';
    if(statusFilter==='active')return item.status!=='complete'&&item.status!=='problem';
    return true;
  });
}

function render(){
  const state=currentState;
  const root=$('#iteration-list');
  if(!state){root.replaceChildren(el('div','iteration-empty','イテレーション状態を取得しています'));return;}
  const all=Array.isArray(state.autonomousIterations)?state.autonomousIterations:[];
  const active=all.filter(item=>item.status!=='complete');
  const complete=all.filter(item=>item.status==='complete');
  const runKeys=new Set(all.map(item=>item.runKey).filter(Boolean));
  $('#iteration-running-count').textContent=String(active.length);
  $('#iteration-complete-count').textContent=String(complete.length);
  $('#iteration-session-count').textContent=String(runKeys.size);
  $('#iteration-updated-at').textContent=formatClock(state.generatedAt);
  const sync=$('#iteration-sync-state');
  sync.textContent=state.syncStatus==='ok'
    ?'GitHub / Actions / autonomous telemetry を '+formatClock(state.generatedAt)+' に照合'
    :'最新同期はdegradedです。Last Known Goodを含む場合があります。';
  const rows=filtered(all);
  root.replaceChildren();
  if(!rows.length){
    root.append(el('div','iteration-empty',all.length?'このフィルタに一致するiterationはありません':'記録された自律iterationはまだありません'));
    return;
  }
  rows.forEach(item=>root.append(card(item)));
}

$('#iteration-game-filter')?.addEventListener('change',event=>{gameFilter=event.target.value;render();});
$('#iteration-status-filter')?.addEventListener('change',event=>{statusFilter=event.target.value;render();});
subscribe((state,error)=>{
  if(state)currentState=state;
  const sync=$('#iteration-sync-state');
  if(error&&sync)sync.textContent='再同期中: '+error.message;
  render();
});
setInterval(()=>{if(currentState&&currentState.autonomousIterations?.some(item=>item.steps?.some(step=>step.state==='running')))render();},5000);
