const TONE=Object.freeze({done:'done',skipped:'skipped',running:'running',problem:'problem',waiting:'pending',pending:'pending'});

const parseAt=value=>{
  const ms=Date.parse(value||'');
  return Number.isFinite(ms)?ms:null;
};

export function progressStepDurationMs(step,now=Date.now()){
  const raw=step?.durationMs,explicit=Number(raw);
  if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(explicit)&&explicit>=0)return explicit;
  const start=parseAt(step?.startedAt),end=parseAt(step?.completedAt);
  if(start!==null&&end!==null)return Math.max(0,end-start);
  if(step?.state==='running'&&start!==null)return Math.max(0,now-start);
  return null;
}

export function progressDurationLabel(ms){
  if(!Number.isFinite(ms))return '';
  const seconds=Math.max(0,ms)/1000;
  return (seconds<10?seconds.toFixed(1):String(Math.round(seconds)))+'s';
}

export function progressMiniModel(steps=[],now=Date.now()){
  const clean=(Array.isArray(steps)?steps:[]).filter(step=>step&&step.id);
  const points=clean.map((step,index)=>{
    const durationMs=progressStepDurationMs(step,now);
    return Object.freeze({
      id:String(step.id),
      label:String(step.label||step.id),
      state:String(step.state||'pending'),
      tone:TONE[step.state]||'pending',
      index,
      durationMs,
      durationLabel:progressDurationLabel(durationMs),
      measured:Number.isFinite(durationMs),
    });
  });
  const complete=points.filter(point=>['done','skipped'].includes(point.state)).length;
  const problem=points.find(point=>point.state==='problem')||null;
  const running=points.find(point=>point.state==='running')||null;
  const waiting=points.find(point=>['waiting','pending'].includes(point.state))||null;
  const current=problem||running||waiting||points.at(-1)||null;
  const measured=points.filter(point=>point.measured);
  const measuredTotalMs=measured.reduce((sum,point)=>sum+point.durationMs,0);
  return Object.freeze({
    points:Object.freeze(points),
    measured:Object.freeze(measured),
    measuredTotalMs,
    complete,
    total:points.length,
    current,
    status:problem?'problem':running?'running':complete===points.length&&points.length?'complete':'waiting',
  });
}

export function renderProgressMini(steps=[],{
  documentRef=globalThis.document,
  className='',
  ariaLabel='工程時間',
  now=Date.now(),
}={}){
  if(!documentRef)return null;
  const model=progressMiniModel(steps,now);
  const root=documentRef.createElement('div');
  root.className='rapid-progress-mini '+className;
  root.dataset.progressStatus=model.status;
  root.style.setProperty('--rapid-progress-count',String(Math.max(model.total,1)));
  const measuredCopy=model.measured.map(point=>point.label+' '+point.durationLabel).join('、');
  root.setAttribute('role','img');
  root.setAttribute('aria-label',ariaLabel+(measuredCopy?' '+measuredCopy:' 未計測')+(model.current?' 現在 '+model.current.label:''));

  const svg=documentRef.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 100 30');
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('aria-hidden','true');

  if(model.points.length){
    const left=4,right=4,top=3,baselineY=22,width=100-left-right,height=baselineY-top;
    const maxDuration=Math.max(1,...model.measured.map(point=>point.durationMs));
    const coords=model.points.map((point,index)=>{
      const x=model.points.length===1?50:left+index*(width/(model.points.length-1));
      const ratio=point.measured?Math.max(.08,point.durationMs/maxDuration):0;
      const y=point.measured?baselineY-ratio*height:baselineY;
      return {point,x,y};
    });

    const baseline=documentRef.createElementNS('http://www.w3.org/2000/svg','line');
    baseline.setAttribute('x1',String(left));baseline.setAttribute('x2',String(100-right));
    baseline.setAttribute('y1',String(baselineY));baseline.setAttribute('y2',String(baselineY));
    baseline.setAttribute('class','rapid-progress-baseline');
    svg.append(baseline);

    for(const {x} of coords){
      const guide=documentRef.createElementNS('http://www.w3.org/2000/svg','line');
      guide.setAttribute('x1',x.toFixed(2));guide.setAttribute('x2',x.toFixed(2));
      guide.setAttribute('y1',String(top));guide.setAttribute('y2',String(baselineY));
      guide.setAttribute('class','rapid-progress-guide');
      svg.append(guide);
    }

    const segments=[];
    let currentSegment=[];
    for(const coord of coords){
      if(coord.point.measured)currentSegment.push(coord);
      else if(currentSegment.length){segments.push(currentSegment);currentSegment=[];}
    }
    if(currentSegment.length)segments.push(currentSegment);
    for(const segment of segments){
      if(segment.length<2)continue;
      const path=documentRef.createElementNS('http://www.w3.org/2000/svg','polyline');
      path.setAttribute('points',segment.map(({x,y})=>x.toFixed(2)+','+y.toFixed(2)).join(' '));
      path.setAttribute('class','rapid-progress-line '+model.status);
      svg.append(path);
    }

    for(const {point,x,y} of coords){
      const dot=documentRef.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',x.toFixed(2));dot.setAttribute('cy',y.toFixed(2));
      dot.setAttribute('r',point.measured?'2.5':'1.7');
      dot.setAttribute('class','rapid-progress-point '+point.tone+(point.measured?' measured':' unmeasured')+(model.current?.id===point.id?' current':''));
      svg.append(dot);
    }
  }

  const labels=documentRef.createElement('div');
  labels.className='rapid-progress-labels';
  for(const point of model.points){
    const label=documentRef.createElement('span');
    label.className='rapid-progress-label '+point.tone+(model.current?.id===point.id?' current':'');
    const name=documentRef.createElement('strong');
    name.textContent=point.label;
    const duration=documentRef.createElement('small');
    duration.textContent=point.durationLabel||'—';
    const source=clean[point.index];
    const explicit=source?.durationMs;
    if(point.state==='running'&&(explicit===null||explicit===undefined||explicit==='')&&parseAt(source?.startedAt)!==null){
      duration.dataset.progressLiveStart=source.startedAt;
    }
    label.append(name,duration);
    labels.append(label);
  }

  const meta=documentRef.createElement('div');
  meta.className='rapid-progress-mini-meta';
  const leftMeta=documentRef.createElement('span');
  leftMeta.textContent='計測 '+model.measured.length+'/'+model.total;
  const current=documentRef.createElement('strong');
  current.textContent=model.current?'現在 '+model.current.label+(model.current.durationLabel?' · '+model.current.durationLabel:''):'未記録';
  meta.append(leftMeta,current);

  root.append(svg,labels,meta);
  return root;
}


export function tickProgressDurations(documentRef=globalThis.document,now=Date.now()){
  if(!documentRef?.querySelectorAll)return;
  for(const node of documentRef.querySelectorAll('[data-progress-live-start]')){
    const start=parseAt(node.dataset.progressLiveStart);
    if(start===null)continue;
    node.textContent=progressDurationLabel(Math.max(0,now-start));
  }
}
