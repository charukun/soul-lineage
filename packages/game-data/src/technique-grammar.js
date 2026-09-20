import { INSPIRATION_WEAPON_ARTS } from './inspiration-catalog.js';

export const techniqueGrammarRevision='technique-grammar-1';
export const TECHNIQUE_GRAMMAR_PHASES=Object.freeze(['jo','ha','kyu']);

const extraArts=(open,middle,finish,tag)=>Object.freeze({
  open:Object.freeze(open),middle:Object.freeze(middle),finish:Object.freeze(finish),tag
});
export const TECHNIQUE_GRAMMAR_WEAPON_ARTS=Object.freeze({
  ...INSPIRATION_WEAPON_ARTS,
  dagger:extraArts(['slash','thrust','back'],['back','crosscut','uppercut'],['crosscut','round','dash'],'短刃'),
  staff:extraArts(['thrust','sweep','pommel'],['sweep','back','bash'],['round','sweep','bullrush'],'杖'),
});

const MOTION=Object.freeze({
  slash:{label:'斬り',prefix:'返',suffix:'斬り',footwork:'forward',motifs:['handling','timing'],questions:['opening','recovery'],intent:{attack:.35}},
  diagonal:{label:'袈裟',prefix:'袈',suffix:'斬り',footwork:'forward',motifs:['handling','angle'],questions:['opening','guard'],intent:{attack:.4}},
  thrust:{label:'突き',prefix:'穿',suffix:'突き',footwork:'forward',motifs:['precision','advance'],questions:['reach','opening'],intent:{spacing:.3,attack:.3}},
  back:{label:'返し',prefix:'返',suffix:'返し',footwork:'retreat',motifs:['return','timing'],questions:['recovery','guard'],intent:{counter:.45}},
  crosscut:{label:'十字',prefix:'交',suffix:'十字',footwork:'cross',motifs:['angle','timing'],questions:['opening','crowd'],intent:{mobility:.3,attack:.3}},
  uppercut:{label:'斬り上げ',prefix:'昇',suffix:'上げ',footwork:'forward',motifs:['angle','advance'],questions:['close','opening'],intent:{counter:.25,attack:.3}},
  bash:{label:'打ち崩し',prefix:'崩',suffix:'崩し',footwork:'forward',motifs:['force','tool'],questions:['guard','close'],intent:{guard:.2,attack:.35}},
  heavy:{label:'打ち下ろし',prefix:'重',suffix:'落とし',footwork:'stay',motifs:['force','tool'],questions:['recovery','guard'],intent:{attack:.55}},
  round:{label:'回し',prefix:'廻',suffix:'払い',footwork:'orbitR',motifs:['space','angle'],questions:['crowd','close'],intent:{mobility:.35}},
  dash:{label:'踏み込み',prefix:'踏',suffix:'踏み',footwork:'rush',motifs:['advance','timing'],questions:['reach','opening'],intent:{attack:.4,mobility:.2}},
  bullrush:{label:'押し込み',prefix:'押',suffix:'押し',footwork:'rush',motifs:['force','advance'],questions:['guard','reach'],intent:{attack:.5}},
  meteor:{label:'落とし',prefix:'落',suffix:'落とし',footwork:'forward',motifs:['force','precision'],questions:['opening','recovery'],intent:{attack:.55}},
  pommel:{label:'柄打ち',prefix:'柄',suffix:'打ち',footwork:'stay',motifs:['tool','return'],questions:['close','guard'],intent:{counter:.25,guard:.2}},
  sweep:{label:'薙ぎ',prefix:'払',suffix:'払い',footwork:'orbitR',motifs:['space','return'],questions:['crowd','close'],intent:{spacing:.3,mobility:.2}},
  leap:{label:'跳び込み',prefix:'跳',suffix:'跳び',footwork:'forward',motifs:['advance','balance'],questions:['reach','opening'],intent:{attack:.45,mobility:.2}},
  sky:{label:'穂先上げ',prefix:'掲',suffix:'上げ',footwork:'forward',motifs:['precision','angle'],questions:['close','opening'],intent:{counter:.3}},
  spearwheel:{label:'槍回し',prefix:'廻',suffix:'回し',footwork:'orbitR',motifs:['space','handling'],questions:['crowd','guard'],intent:{spacing:.3,guard:.2}},
  pierce:{label:'貫き',prefix:'貫',suffix:'穿ち',footwork:'chase',motifs:['precision','force'],questions:['reach','guard'],intent:{attack:.55}},
  jab:{label:'牽制',prefix:'牽',suffix:'牽制',footwork:'stay',motifs:['timing','precision'],questions:['opening','reach'],intent:{spacing:.25}},
  straight:{label:'正拳',prefix:'直',suffix:'正拳',footwork:'forward',motifs:['force','precision'],questions:['close','opening'],intent:{attack:.35}},
  bodyblow:{label:'腹打ち',prefix:'懐',suffix:'打ち',footwork:'cross',motifs:['angle','force'],questions:['close','reach'],intent:{attack:.35,mobility:.2}},
  hook:{label:'回し拳',prefix:'廻',suffix:'回し',footwork:'orbitR',motifs:['angle','force'],questions:['close','crowd'],intent:{attack:.35}},
  risingfist:{label:'突き上げ',prefix:'昇',suffix:'上げ',footwork:'forward',motifs:['advance','force'],questions:['close','opening'],intent:{attack:.4}},
  oneinch:{label:'寸勁',prefix:'寸',suffix:'寸勁',footwork:'stay',motifs:['precision','force'],questions:['close','guard'],intent:{attack:.5}},
  barrage:{label:'連打',prefix:'連',suffix:'連打',footwork:'forward',motifs:['timing','handling'],questions:['opening','recovery'],intent:{attack:.45}},
  rushfist:{label:'連環',prefix:'連',suffix:'連環',footwork:'rush',motifs:['advance','timing'],questions:['reach','crowd'],intent:{attack:.45,mobility:.2}},
  katanaKesa:{label:'袈裟',prefix:'袈',suffix:'斬り',footwork:'forward',motifs:['handling','angle'],questions:['opening','guard'],intent:{attack:.4}},
  katanaThrust:{label:'切っ先',prefix:'切',suffix:'突き',footwork:'forward',motifs:['precision','advance'],questions:['reach','opening'],intent:{spacing:.3,attack:.3}},
  katanaDraw:{label:'居合',prefix:'抜',suffix:'居合',footwork:'stay',motifs:['timing','precision'],questions:['opening','recovery'],intent:{counter:.35,attack:.25}},
  katanaReturn:{label:'逆袈裟',prefix:'返',suffix:'返し',footwork:'sideR',motifs:['return','angle'],questions:['recovery','guard'],intent:{counter:.4,mobility:.15}},
});

const unique=values=>[...new Set(values)];
const freezeStep=kind=>Object.freeze({kind,footwork:MOTION[kind]?.footwork||'stay',charge:'none'});
const sequenceKey=kinds=>kinds.join('-');
const techniqueId=(weapon,kinds)=>`gen1.${weapon}.${sequenceKey(kinds)}`;

function phaseSequences(arts,phase){
  const open=unique(arts.open||[]),middle=unique(arts.middle||[]),finish=unique(arts.finish||[]);
  if(phase==='jo')return [...open.map(a=>[a]),...open.flatMap(a=>open.filter(b=>b!==a).map(b=>[a,b]))];
  if(phase==='ha')return [...middle.map(a=>[a]),...open.flatMap(a=>middle.map(b=>[a,b])),...open.flatMap(a=>middle.flatMap(b=>middle.filter(c=>c!==b).map(c=>[a,b,c])))];
  return [...finish.map(a=>[a]),...middle.flatMap(a=>finish.map(b=>[a,b])),...middle.flatMap(a=>finish.flatMap(b=>finish.filter(c=>c!==b).map(c=>[a,b,c])))];
}
function plausible(kinds){
  if(!kinds.length||kinds.length>3||kinds.some(kind=>!MOTION[kind]))return false;
  if(kinds.some((kind,index)=>index&&kind===kinds[index-1]))return false;
  const lunges=kinds.filter(kind=>['dash','bullrush','leap','rushfist'].includes(kind)).length;
  return lunges<=1;
}
function techniqueName(kinds){
  if(kinds.length===1)return MOTION[kinds[0]].label.slice(0,7);
  const first=MOTION[kinds[0]],last=MOTION[kinds.at(-1)];
  const name=(first.prefix+last.suffix).replace(/[・･]/g,'');
  return name.length<=7?name:name.slice(0,7);
}
function semantics(kinds){
  const motions=kinds.map(kind=>MOTION[kind]);
  const motifs=unique(motions.flatMap(row=>row.motifs)).slice(0,5);
  const questions=unique(motions.flatMap(row=>row.questions)).slice(0,4);
  const intent={};
  for(const row of motions)for(const [key,value] of Object.entries(row.intent||{}))intent[key]=Number(((intent[key]||0)+value).toFixed(3));
  const footwork=motions.map(row=>row.footwork);
  const space=footwork.some(id=>id==='retreat')?'retreat':footwork.some(id=>['cross','sideL','sideR','orbitR','orbitL'].includes(id))?'side':'';
  return {motifs,questions,intent,space};
}
function buildRow(weapon,kinds,phases){
  const arts=TECHNIQUE_GRAMMAR_WEAPON_ARTS[weapon],meta=semantics(kinds),steps=kinds.map(freezeStep);
  const first=MOTION[kinds[0]].label,last=MOTION[kinds.at(-1)].label;
  return Object.freeze({
    id:techniqueId(weapon,kinds),name:techniqueName(kinds),kind:'technique',family:`generated.${weapon}.${MOTION[kinds[0]].prefix}.${MOTION[kinds.at(-1)].suffix}`,
    weapons:Object.freeze([weapon]),questions:Object.freeze(meta.questions),materials:Object.freeze([Object.freeze(['handling']),Object.freeze(unique([...meta.motifs,'observation','balance']).slice(0,5))]),
    motifs:Object.freeze(meta.motifs),intent:Object.freeze(meta.intent),bodyAffinity:Object.freeze({}),effort:Number((.88+kinds.length*.08).toFixed(2)),effects:Object.freeze({}),attributes:Object.freeze([]),specialEffects:Object.freeze([]),
    windows:Object.freeze([]),phases:Object.freeze([...phases]),steps:Object.freeze(steps),space:meta.space,limbs:['great','spear','axe','staff'].includes(weapon)?'twoArms':weapon==='fist'?'legs':'',
    mechanic:`${first}から${last}へ、姿勢と間合いをつないで成立させる。`,
    tradeoff:kinds.length>=3?'三手を通すため、途中で崩されると成立しにくい。':meta.space==='retreat'?'後ろに引く余地が必要。':meta.space==='side'?'横へ動く余地が必要。':'一手ごとの間合いが合わないと続かない。',
    generated:true,grammarRevision:techniqueGrammarRevision,tag:arts?.tag||weapon,
  });
}

const CACHE=new Map();
export function generatedTechniqueCandidates({weapon='fist',phase=null}={}){
  const arts=TECHNIQUE_GRAMMAR_WEAPON_ARTS[weapon];if(!arts)return [];
  let rows=CACHE.get(weapon);
  if(!rows){
    const bySequence=new Map();
    for(const slot of TECHNIQUE_GRAMMAR_PHASES)for(const kinds of phaseSequences(arts,slot)){
      if(!plausible(kinds))continue;
      const key=sequenceKey(kinds),entry=bySequence.get(key)||{kinds,phases:new Set()};entry.phases.add(slot);bySequence.set(key,entry);
    }
    rows=Object.freeze([...bySequence.values()].map(entry=>buildRow(weapon,entry.kinds,entry.phases)).sort((a,b)=>a.id.localeCompare(b.id)));
    CACHE.set(weapon,rows);
  }
  return phase?rows.filter(row=>row.phases.includes(phase)):rows;
}
export function generatedTechniqueById(id){
  const match=/^gen1\.([a-z]+)\.([A-Za-z0-9-]+)$/.exec(String(id||''));if(!match)return null;
  return generatedTechniqueCandidates({weapon:match[1]}).find(row=>row.id===id)||null;
}
export function isGeneratedTechniqueId(id){return /^gen1\./.test(String(id||''));}
export function generatedTechniqueCount(weapon=null){
  return weapon?generatedTechniqueCandidates({weapon}).length:Object.keys(TECHNIQUE_GRAMMAR_WEAPON_ARTS).reduce((sum,id)=>sum+generatedTechniqueCandidates({weapon:id}).length,0);
}
