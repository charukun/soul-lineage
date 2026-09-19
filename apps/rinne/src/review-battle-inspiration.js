const PHASES=new Set(['jo','ha','kyu']);
const SWEEP=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const FINISH=new Set(['heavy','round','barrage','rushfist','meteor','pierce','oneinch','risingfist']);
const OPEN=new Set(['guard','ready','back','slash','jab','thrust']);
export const REVIEW_INSPIRATION_TIMELINE=Object.freeze({camera:.55,spacing:1.35,stagger:2.35,reveal:3.15,execute:3.65,end:5.35});

export function reviewInspirationCandidates(answers,{weapon='fist',phase='ha',learnedIds=[],encounterMode='duel'}={}){
  const learned=new Set(learnedIds),slot=PHASES.has(phase)?phase:'ha';
  return (answers||[]).filter(row=>
    ['technique','variant'].includes(row?.kind)&&row?.steps?.length&&!row.executor&&
    row.weapons?.includes(weapon)&&row.phases?.includes(slot)&&!learned.has(row.id)
  ).map(row=>{
    const kinds=row.steps.map(step=>step.kind),sweep=kinds.some(kind=>SWEEP.has(kind)),finish=kinds.some(kind=>FINISH.has(kind)),open=kinds.some(kind=>OPEN.has(kind));
    let weight=1+Math.min(.75,row.steps.length*.2);
    if(encounterMode==='one-v-three'&&sweep)weight+=1.15;
    if(slot==='kyu'&&finish)weight+=.9;
    if(slot==='jo'&&open)weight+=.55;
    if(slot==='ha'&&kinds.length>1)weight+=.4;
    return Object.freeze({row,weight});
  });
}

export function pickReviewInspiration(answers,options={},random=Math.random){
  const rows=reviewInspirationCandidates(answers,options);if(!rows.length)return null;
  const total=rows.reduce((sum,item)=>sum+item.weight,0),point=Math.max(0,Math.min(.999999,Number(random())||0))*total;
  let cursor=0;for(const item of rows){cursor+=item.weight;if(point<cursor)return item.row;}return rows.at(-1).row;
}

export function reviewInspirationSequenceFrame(elapsed){
  const t=Math.max(0,Number(elapsed)||0),m=REVIEW_INSPIRATION_TIMELINE;
  let stage='spark',start=0,end=m.camera;
  if(t>=m.end)return Object.freeze({stage:'done',progress:1,elapsed:t,spacing:0,executeProgress:1});
  if(t>=m.execute){stage='execute';start=m.execute;end=m.end;}
  else if(t>=m.reveal){stage='reveal';start=m.reveal;end=m.execute;}
  else if(t>=m.stagger){stage='stagger';start=m.stagger;end=m.reveal;}
  else if(t>=m.spacing){stage='spacing';start=m.spacing;end=m.stagger;}
  else if(t>=m.camera){stage='camera';start=m.camera;end=m.spacing;}
  const progress=Math.max(0,Math.min(1,(t-start)/Math.max(.001,end-start)));
  const spacing=stage==='spacing'?progress:stage==='stagger'||stage==='reveal'?1:stage==='execute'?1-progress:0;
  const executeProgress=stage==='execute'?progress:0;
  return Object.freeze({stage,progress,elapsed:t,spacing,executeProgress});
}
