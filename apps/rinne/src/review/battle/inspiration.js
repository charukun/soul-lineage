import {INSPIRATION_WEAPON_ARTS,generatedTechniqueCandidates} from '@soul/game-data';

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
export const REVIEW_INSPIRATION_TIMELINE=Object.freeze({nearMiss:.95,camera:1.45,spacing:1.75,stagger:2.0,silence:2.18,reveal:2.3,titleEnd:3.05,execute:3.05,impact:8.45,impactRelease:8.66,settle:9.55,afterglow:10.85,end:12.65});

const reviewArts=(open,middle,finish,tag)=>Object.freeze({
  open:Object.freeze(open),middle:Object.freeze(middle),finish:Object.freeze(finish),tag
});
const REVIEW_WEAPON_ARTS=Object.freeze({
  ...INSPIRATION_WEAPON_ARTS,
  dagger:reviewArts(['slash','thrust','back'],['back','crosscut','uppercut'],['crosscut','round','dash'],'短刃'),
  staff:reviewArts(['thrust','sweep','pommel'],['sweep','back','bash'],['round','sweep','bullrush'],'杖')
});

const uniqueRows=rows=>{
  const seen=new Set();
  return rows.filter(row=>{const key=row.join('>');if(seen.has(key))return false;seen.add(key);return true;});
};
const step=kind=>Object.freeze({kind,footwork:'stay',charge:'none'});
const techniqueId=(weapon,phase,kinds)=>`review.${weapon}.${phase}.${kinds.join('-')}`;
const techniqueName=(arts,phase,kinds)=>`${arts.tag}・${PHASE_LABELS[phase]} ${kinds.map(kind=>MOTION_LABELS[kind]||kind).join('・')}`;

// Legacy local sequence helpers remain for authored fallback inspection. Generated review techniques now use the same shared grammar as gameplay.
function generatedSequences(arts,phase){
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

const weightFor=(kinds,phase,encounterMode,steps=[],spectacle=false)=>{
  const sweep=kinds.some(kind=>SWEEP.has(kind)),finish=kinds.some(kind=>FINISH.has(kind)),open=kinds.some(kind=>OPEN.has(kind));
  const moving=steps.some(step=>step.footwork&&step.footwork!=='stay');
  let weight=1+kinds.length*.55+(moving?.8:0);
  if(sweep)weight+=.65;
  if(encounterMode==='one-v-three'&&sweep)weight+=.8;
  if(phase==='kyu'&&finish)weight+=.55;
  if(phase==='jo'&&open)weight+=.35;
  if(phase==='ha'&&kinds.length>1)weight+=.25;
  if(spectacle&&kinds.length>=3)weight*=3;
  return weight;
};
const weightedPick=(rows,random=Math.random)=>{
  if(!rows.length)return null;
  const total=rows.reduce((sum,item)=>sum+item.weight,0),point=Math.max(0,Math.min(.999999,Number(random())||0))*total;
  let cursor=0;for(const item of rows){cursor+=item.weight;if(point<cursor)return item.row;}return rows.at(-1).row;
};

export function generatedReviewInspirationCandidates({weapon='fist',phase='ha',seenIds=[],encounterMode='duel',spectacle=false}={}){
  const slot=PHASES.has(phase)?phase:'ha',seen=new Set(seenIds);
  return generatedTechniqueCandidates({weapon,phase:slot}).filter(row=>!seen.has(row.id)).map(row=>Object.freeze({
    row:Object.freeze({...row,sign:SIGN_TEXT[slot]}),
    weight:weightFor(row.steps.map(item=>item.kind),slot,encounterMode,row.steps,spectacle)
  }));
}
export function pickGeneratedReviewInspiration(options={},random=Math.random){
  return weightedPick(generatedReviewInspirationCandidates(options),random);
}

// Review-only mastery: a complete Jo/Ha/Kyu set with the same weapon unlocks
// a three-motion Kyu showcase. This does not grant a gameplay rule effect.
export function reviewUltimateCandidates({weapon='fist',phase='kyu',seenIds=[],encounterMode='duel'}={}){
  if(phase!=='kyu')return [];
  const seen=new Set(seenIds);
  return generatedTechniqueCandidates({weapon,phase:'kyu'}).filter(row=>
    row.steps.length===3&&!seen.has(row.id)&&
    row.steps.some(step=>step.footwork&&step.footwork!=='stay')&&
    row.steps.some(step=>FINISH.has(step.kind))
  ).map(row=>Object.freeze({row,weight:weightFor(row.steps.map(step=>step.kind),'kyu',encounterMode,row.steps,true)}));
}
export function pickReviewUltimate(options={},random=Math.random){
  return weightedPick(reviewUltimateCandidates(options),random);
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
  const t=Math.max(0,Number(elapsed)||0),m=REVIEW_INSPIRATION_TIMELINE,clamp01=value=>Math.max(0,Math.min(1,value)),smooth=value=>{const u=clamp01(value);return u*u*(3-2*u);},easeOut=value=>1-Math.pow(1-clamp01(value),3);
  if(t>=m.end)return Object.freeze({stage:'done',progress:1,elapsed:t,spacing:0,executeProgress:1,backstepProgress:1,nearMiss:0,targetStagger:0,strikeTravel:0,impactRecoil:0,cameraRelease:1,focus:'world',hitStop:false,cameraFov:40});
  let stage='premonition',start=0,end=m.camera;
  if(t>=m.afterglow){stage='afterglow';start=m.afterglow;end=m.end;}
  else if(t>=m.settle){stage='settle';start=m.settle;end=m.afterglow;}
  else if(t>=m.impact){stage='impact';start=m.impact;end=m.settle;}
  else if(t>=m.execute){stage='execute';start=m.execute;end=m.impact;}
  else if(t>=m.reveal){stage='reveal';start=m.reveal;end=m.execute;}
  else if(t>=m.silence){stage='silence';start=m.silence;end=m.reveal;}
  else if(t>=m.stagger){stage='stagger';start=m.stagger;end=m.silence;}
  else if(t>=m.spacing){stage='spacing';start=m.spacing;end=m.stagger;}
  else if(t>=m.camera){stage='camera';start=m.camera;end=m.spacing;}
  const progress=clamp01((t-start)/Math.max(.001,end-start));
  let nearMiss=0;
  if(t<m.nearMiss)nearMiss=Math.sin(clamp01(t/m.nearMiss)*Math.PI*.5);
  else if(t<m.camera)nearMiss=Math.cos(clamp01((t-m.nearMiss)/Math.max(.001,m.camera-m.nearMiss))*Math.PI*.5);
  const backstepProgress=clamp01((t-m.spacing)/Math.max(.001,m.stagger-m.spacing));
  const spacing=stage==='spacing'?(1-Math.pow(1-backstepProgress,4))*.075:stage==='stagger'||stage==='silence'||stage==='reveal'?.075:stage==='execute'?.075*(1-progress):0;
  let targetStagger=0;
  if(t>=m.camera&&t<m.afterglow)targetStagger=smooth((t-m.camera)/.42);
  else if(t>=m.afterglow)targetStagger=1-smooth(progress);
  let executeProgress=0;
  if(t>=m.execute){
    if(t<m.impact)executeProgress=easeOut((t-m.execute)/Math.max(.001,m.impact-m.execute))*.72;
    else if(t<m.impactRelease)executeProgress=.72;
    else if(t<m.settle)executeProgress=.72+smooth((t-m.impactRelease)/Math.max(.001,m.settle-m.impactRelease))*.28;
    else executeProgress=1;
  }
  const strikeTravel=stage==='execute'?easeOut(progress):stage==='impact'||stage==='settle'?1:stage==='afterglow'?1-smooth(progress):0;
  const impactRecoil=stage==='impact'?easeOut(progress):stage==='settle'?1:stage==='afterglow'?1-smooth(progress)*.55:0;
  const cameraRelease=stage==='execute'?smooth((progress-.56)/.44):stage==='impact'?1:stage==='settle'?.72:stage==='afterglow'?1-progress:0;
  const hitStop=t>=m.impact&&t<m.impactRelease;
  const focus=stage==='camera'||stage==='silence'||stage==='reveal'?'weapon':stage==='spacing'?'target':stage==='stagger'?'connection':stage==='execute'||stage==='impact'?'strike':'world';
  const cameraFov=stage==='premonition'?41:stage==='camera'?36:stage==='spacing'?41:stage==='stagger'?42:stage==='silence'?35:stage==='reveal'?38:stage==='execute'?42+cameraRelease*7:stage==='impact'?53:stage==='settle'?45:41-progress;
  return Object.freeze({stage,progress,elapsed:t,spacing,executeProgress,backstepProgress,nearMiss,targetStagger,strikeTravel,impactRecoil,cameraRelease,focus,hitStop,cameraFov});
}
