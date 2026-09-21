const SCORE=Object.freeze({done:1,skipped:1,running:.62,problem:.4,waiting:.08,pending:.08});
const TONE=Object.freeze({done:'done',skipped:'skipped',running:'running',problem:'problem',waiting:'pending',pending:'pending'});

export function progressMiniModel(steps=[]){
  const clean=(Array.isArray(steps)?steps:[]).filter(step=>step&&step.id);
  const points=clean.map((step,index)=>Object.freeze({
    id:String(step.id),
    label:String(step.label||step.id),
    state:String(step.state||'pending'),
    score:SCORE[step.state]??SCORE.pending,
    tone:TONE[step.state]||'pending',
    index,
  }));
  const complete=points.filter(point=>['done','skipped'].includes(point.state)).length;
  const problem=points.find(point=>point.state==='problem')||null;
  const running=points.find(point=>point.state==='running')||null;
  const waiting=points.find(point=>['waiting','pending'].includes(point.state))||null;
  const current=problem||running||waiting||points.at(-1)||null;
  return Object.freeze({
    points:Object.freeze(points),
    complete,
    total:points.length,
    current,
    status:problem?'problem':running?'running':complete===points.length&&points.length?'complete':'waiting',
  });
}

export function renderProgressMini(steps=[],{
  documentRef=globalThis.document,
  className='',
  ariaLabel='工程進捗',
}={}){
  if(!documentRef)return null;
  const model=progressMiniModel(steps);
  const root=documentRef.createElement('div');
  root.className='rapid-progress-mini '+className;
  root.dataset.progressStatus=model.status;
  root.style.setProperty('--rapid-progress-count',String(Math.max(model.total,1)));
  root.setAttribute('role','img');
  root.setAttribute('aria-label',ariaLabel+' '+model.complete+'/'+model.total+(model.current?' 現在 '+model.current.label:''));

  const svg=documentRef.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 100 28');
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('aria-hidden','true');

  if(model.points.length){
    const left=4,right=4,top=4,bottom=4,width=100-left-right,height=28-top-bottom;
    const coords=model.points.map((point,index)=>{
      const x=model.points.length===1?50:left+index*(width/(model.points.length-1));
      const y=top+(1-point.score)*height;
      return {point,x,y};
    });
    const baseline=documentRef.createElementNS('http://www.w3.org/2000/svg','line');
    baseline.setAttribute('x1',String(left));baseline.setAttribute('x2',String(100-right));
    baseline.setAttribute('y1',String(28-bottom));baseline.setAttribute('y2',String(28-bottom));
    baseline.setAttribute('class','rapid-progress-baseline');
    svg.append(baseline);

    const path=documentRef.createElementNS('http://www.w3.org/2000/svg','polyline');
    path.setAttribute('points',coords.map(({x,y})=>x.toFixed(2)+','+y.toFixed(2)).join(' '));
    path.setAttribute('class','rapid-progress-line '+model.status);
    svg.append(path);

    for(const {point,x,y} of coords){
      const dot=documentRef.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx',x.toFixed(2));dot.setAttribute('cy',y.toFixed(2));dot.setAttribute('r','2.6');
      dot.setAttribute('class','rapid-progress-point '+point.tone+(model.current?.id===point.id?' current':''));
      svg.append(dot);
    }
  }

  const labels=documentRef.createElement('div');
  labels.className='rapid-progress-labels';
  for(const point of model.points){
    const label=documentRef.createElement('span');
    label.className='rapid-progress-label '+point.tone+(model.current?.id===point.id?' current':'');
    label.textContent=point.label;
    labels.append(label);
  }

  const meta=documentRef.createElement('div');
  meta.className='rapid-progress-mini-meta';
  const leftMeta=documentRef.createElement('span');
  leftMeta.textContent=model.complete+'/'+model.total;
  const current=documentRef.createElement('strong');
  current.textContent=model.current?'現在 '+model.current.label:'未記録';
  meta.append(leftMeta,current);

  root.append(svg,labels,meta);
  return root;
}
