import {INSPIRATION_WEAPON_ARTS} from '@soul/game-data';

const PHASES=new Set(['jo','ha','kyu']);
const SWEEP=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const FINISH=new Set(['heavy','round','barrage','rushfist','meteor','pierce','oneinch','risingfist']);
const OPEN=new Set(['guard','ready','back','slash','jab','thrust']);
const MOTION_LABELS=Object.freeze({
  slash:'斬り',diagonal:'袈裟',thrust:'突き',back:'返し',crosscut:'十字',uppercut:'斬り上げ',bash:'打ち崩し',
  heavy:'打ち下ろし',round:'回し',dash:'踏み込み',bullrush:'押し込み',meteor:'落とし',pommel:'柄打ち',sweep:'薙ぎ',
  leap:'跳び込み',sky:'穂先上げ',spearwheel:'槍回し',pierce:'貫き',jab:'牽制',straight:'正拳',bodyblow:'腹打ち',
  hook:'回し拳',risingfist:'突き上げ',oneinch:'寸勁',barrage:'連打',rushfist:'連環',katanaKesa:'袈裟',
  katanaThrust:'切っ先',katanaDraw:'居合',katanaReturn:'逆袈裟'
});
const PHASE_LABELS=Object.freeze({jo:'序',ha:'破',kyu:'急'});
const SIGN_TEXT=Object.freeze({
  jo:'この入りなら、次の動きへつながる。',
  ha:'この崩しなら、もう一手を重ねられる。',
  kyu:'この間なら、最後まで届く。'
});
export const REVIEW_INSPIRATION_TIMELINE=Object.freeze({camera:.55,spacing:1.35,stagger:2.35,reveal:3.15,execute:3.65,end:5.35});

const uniqueRows=rows=>{
  const seen=new Set();
  return rows.filter(row=>{const key=row.join('>');if(seen.has(key))return false;seen.add(key);return true;});
};
const step=kind=>Object.freeze({kind,footwork:'stay',charge:'none'});
const techniqueId=(weapon,phase,kinds)=>`review.${weapon}.${phase}.${kinds.join('-')}`;
const techniqueName=(arts,phase,kinds)=>`${arts.tag}・${PHASE_LABELS[phase]} ${kinds.map(kind=>MOTION_LABELS[kind]||kind).join('・')}`;

// Review-only combinations expand the canonical weapon arts without mutating gameplay learning.\nfunction generatedSequences(arts,phase){
  if(phase==='jo'){
    const open=[...new Set(arts.open)];
    return uniqueRows([
      ...open.map(a=>[a]),
      ...open.flatMap(a=>open.filter(b=>b!==a).map(b=>[a,b]))
    ]);
  }
  if(phase==='kyu'){
    const middle=[...new Set(arts.middle)],finish=[...new Set(arts.finish)];
    return uniqueRows([
      ...finish.map(a=>[a]),
      ...middle.flatMap(a=>finish.map(b=>[a,b])),
      ...middle.flatMap(a=>finish.flatMap(b=>finish.filter(c=>c!==b).map(c=>[a,b,c])))
    ]);
  }
  const open=[...new Set(arts.open)],middle=[...new Set(arts.middle)];
  return uniqueRows([
    ...middle.map(a=>[a]),
    ...open.flatMap(a=>middle.map(b=>[a,b])),
    ...open.flatMap(a=>middle.flatMap(b=>middle.filter(c=>c!==b).map(c=>[a,b,c])))
  ]);
}

const weightFor=(kinds,phase,encounterMode)=>{
  const sweep=kinds.some(kind=>SWEEP.has(kind)),finish=kinds.some(kind=>FINISH.has(kind)),open=kinds.some(kind=>OPEN.has(kind));
  let weight=1+Math.min(.6,kinds.length*.15);
  if(encounterMode==='one-v-three'&&sweep)weight+=.8;
  if(phase==='kyu'&&finish)weight+=.55;
  if(phase==='jo'&&open)weight+=.35;
  if(phase==='ha'&&kinds.length>1)weight+=.25;
  return weight;
};
const weightedPick=(rows,random=Math.random)=>{
  if(!rows.length)return null;
  const total=rows.reduce((sum,item)=>sum+item.weight,0),point=Math.max(0,Math.min(.999999,Number(random())||0))*total;
  let cursor=0;for(const item of rows){cursor+=item.weight;if(point<cursor)return item.row;}return rows.at(-1).row;
};

export function generatedReviewInspirationCandidates({weapon='fist',phase='ha',seenIds=[],encounterMode='duel'}={}){
  const arts=INSPIRATION_WEAPON_ARTS[weapon],slot=PHASES.has(phase)?phase:'ha',seen=new Set(seenIds);
  if(!arts)return [];
  return generatedSequences(arts,slot).map(kinds=>{
    const row=Object.freeze({
      id:techniqueId(weapon,slot,kinds),
      name:techniqueName(arts,slot,kinds),
      kind:'technique',
      weapons:Object.freeze([weapon]),
      phases:Object.freeze([slot]),
      steps:Object.freeze(kinds.map(step)),
      sign:SIGN_TEXT[slot]
    });
    return Object.freeze({row,weight:weightFor(kinds,slot,encounterMode)});
  }).filter(item=>!seen.has(item.row.id));
}

export function pickGeneratedReviewInspiration(options={},random=Math.random){
  return weightedPick(generatedReviewInspirationCandidates(options),random);
}

export function reviewInspirationCandidates(answers,{weapon='fist',phase='ha',learnedIds=[],encounterMode='duel'}={}){
  const learned=new Set(learnedIds),slot=PHASES.has(phase)?phase:'ha';
  return (answers||[]).filter(row=>
    ['technique','variant'].includes(row?.kind)&&row?.steps?.length&&!row.executor&&
    row.weapons?.includes(weapon)&&row.phases?.includes(slot)&&!learned.has(row.id)
  ).map(row=>Object.freeze({row,weight:weightFor(row.steps.map(item=>item.kind),slot,encounterMode)}));
}

export function pickReviewInspiration(answers,options={},random=Math.random){
  return weightedPick(reviewInspirationCandidates(answers,options),random);
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
