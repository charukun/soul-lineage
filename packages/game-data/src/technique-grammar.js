import { INSPIRATION_WEAPON_ARTS } from './inspiration-catalog.js';

export const techniqueGrammarRevision='technique-grammar-2';
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
  slash:{label:'斬り',prefix:'返',suffix:'斬り',footwork:['forward','sideR'],motifs:['handling','timing'],questions:['opening','recovery'],intent:{attack:.35},entryBands:['inside','contact','outside'],exit:'open'},
  diagonal:{label:'袈裟',prefix:'袈',suffix:'斬り',footwork:['forward','sideL'],motifs:['handling','angle'],questions:['opening','guard'],intent:{attack:.4},entryBands:['contact','outside'],exit:'open'},
  thrust:{label:'突き',prefix:'穿',suffix:'突き',footwork:['forward','chase'],motifs:['precision','advance'],questions:['reach','opening'],intent:{spacing:.3,attack:.3},entryBands:['contact','outside'],exit:'open'},
  back:{label:'返し',prefix:'返',suffix:'返し',footwork:['retreat','sideR'],motifs:['return','timing'],questions:['recovery','guard'],intent:{counter:.45},entryBands:['inside','contact'],exit:'neutral'},
  crosscut:{label:'十字',prefix:'交',suffix:'十字',footwork:['cross','sideR'],motifs:['angle','timing'],questions:['opening','crowd'],intent:{mobility:.3,attack:.3},entryBands:['inside','contact'],exit:'open'},
  uppercut:{label:'斬り上げ',prefix:'昇',suffix:'上げ',footwork:['forward','cross'],motifs:['angle','advance'],questions:['close','opening'],intent:{counter:.25,attack:.3},entryBands:['inside','contact'],exit:'open'},
  bash:{label:'打ち崩し',prefix:'崩',suffix:'崩し',footwork:['forward','stay'],motifs:['force','tool'],questions:['guard','close'],intent:{guard:.2,attack:.35},entryBands:['inside','contact'],exit:'neutral'},
  heavy:{label:'打ち下ろし',prefix:'重',suffix:'落とし',footwork:['stay','forward'],motifs:['force','tool'],questions:['recovery','guard'],intent:{attack:.55},entryBands:['inside','contact'],exit:'committed'},
  round:{label:'回し',prefix:'廻',suffix:'払い',footwork:['orbitR','orbitL'],motifs:['space','angle'],questions:['crowd','close'],intent:{mobility:.35},entryBands:['inside','contact'],exit:'open'},
  dash:{label:'踏み込み',prefix:'踏',suffix:'踏み',footwork:['rush','forward'],motifs:['advance','timing'],questions:['reach','opening'],intent:{attack:.4,mobility:.2},entryBands:['contact','outside'],exit:'committed'},
  bullrush:{label:'押し込み',prefix:'押',suffix:'押し',footwork:['rush','chase'],motifs:['force','advance'],questions:['guard','reach'],intent:{attack:.5},entryBands:['contact','outside'],exit:'committed'},
  meteor:{label:'落とし',prefix:'落',suffix:'落とし',footwork:['forward','stay'],motifs:['force','precision'],questions:['opening','recovery'],intent:{attack:.55},entryBands:['inside','contact'],exit:'committed'},
  pommel:{label:'柄打ち',prefix:'柄',suffix:'打ち',footwork:['stay','retreat'],motifs:['tool','return'],questions:['close','guard'],intent:{counter:.25,guard:.2},entryBands:['inside','contact'],exit:'neutral'},
  sweep:{label:'薙ぎ',prefix:'払',suffix:'払い',footwork:['orbitR','orbitL'],motifs:['space','return'],questions:['crowd','close'],intent:{spacing:.3,mobility:.2},entryBands:['inside','contact'],exit:'open'},
  leap:{label:'跳び込み',prefix:'跳',suffix:'跳び',footwork:['forward','rush'],motifs:['advance','balance'],questions:['reach','opening'],intent:{attack:.45,mobility:.2},entryBands:['contact','outside'],exit:'committed'},
  sky:{label:'穂先上げ',prefix:'掲',suffix:'上げ',footwork:['forward','stay'],motifs:['precision','angle'],questions:['close','opening'],intent:{counter:.3},entryBands:['inside','contact'],exit:'open'},
  spearwheel:{label:'槍回し',prefix:'廻',suffix:'回し',footwork:['orbitR','orbitL'],motifs:['space','handling'],questions:['crowd','guard'],intent:{spacing:.3,guard:.2},entryBands:['inside','contact'],exit:'open'},
  pierce:{label:'貫き',prefix:'貫',suffix:'穿ち',footwork:['chase','forward'],motifs:['precision','force'],questions:['reach','guard'],intent:{attack:.55},entryBands:['contact','outside'],exit:'committed'},
  jab:{label:'牽制',prefix:'牽',suffix:'牽制',footwork:['stay','retreat'],motifs:['timing','precision'],questions:['opening','reach'],intent:{spacing:.25},entryBands:['inside','contact'],exit:'neutral'},
  straight:{label:'正拳',prefix:'直',suffix:'正拳',footwork:['forward','stay'],motifs:['force','precision'],questions:['close','opening'],intent:{attack:.35},entryBands:['inside','contact'],exit:'open'},
  bodyblow:{label:'腹打ち',prefix:'懐',suffix:'打ち',footwork:['cross','forward'],motifs:['angle','force'],questions:['close','reach'],intent:{attack:.35,mobility:.2},entryBands:['inside'],exit:'open'},
  hook:{label:'回し拳',prefix:'廻',suffix:'回し',footwork:['orbitR','sideR'],motifs:['angle','force'],questions:['close','crowd'],intent:{attack:.35},entryBands:['inside','contact'],exit:'open'},
  risingfist:{label:'突き上げ',prefix:'昇',suffix:'上げ',footwork:['forward','stay'],motifs:['advance','force'],questions:['close','opening'],intent:{attack:.4},entryBands:['inside'],exit:'open'},
  oneinch:{label:'寸勁',prefix:'寸',suffix:'寸勁',footwork:['stay','forward'],motifs:['precision','force'],questions:['close','guard'],intent:{attack:.5},entryBands:['inside'],exit:'committed'},
  barrage:{label:'連打',prefix:'連',suffix:'連打',footwork:['forward','stay'],motifs:['timing','handling'],questions:['opening','recovery'],intent:{attack:.45},entryBands:['inside','contact'],exit:'committed'},
  rushfist:{label:'連環',prefix:'連',suffix:'連環',footwork:['rush','forward'],motifs:['advance','timing'],questions:['reach','crowd'],intent:{attack:.45,mobility:.2},entryBands:['contact','outside'],exit:'committed'},
  katanaKesa:{label:'袈裟',prefix:'袈',suffix:'斬り',footwork:['forward','sideR'],motifs:['handling','angle'],questions:['opening','guard'],intent:{attack:.4},entryBands:['contact','outside'],exit:'open'},
  katanaThrust:{label:'切っ先',prefix:'切',suffix:'突き',footwork:['forward','chase'],motifs:['precision','advance'],questions:['reach','opening'],intent:{spacing:.3,attack:.3},entryBands:['contact','outside'],exit:'open'},
  katanaDraw:{label:'居合',prefix:'抜',suffix:'居合',footwork:['stay','forward'],motifs:['timing','precision'],questions:['opening','recovery'],intent:{counter:.35,attack:.25},entryBands:['inside','contact'],exit:'open'},
  katanaReturn:{label:'逆袈裟',prefix:'返',suffix:'返し',footwork:['sideR','retreat'],motifs:['return','angle'],questions:['recovery','guard'],intent:{counter:.4,mobility:.15},entryBands:['inside','contact'],exit:'neutral'},
  guard:{label:'受け',prefix:'守',suffix:'受け',footwork:['stay','retreat'],motifs:['wait','precision'],questions:['guard','opening'],intent:{guard:.45,counter:.15},entryBands:['inside','contact','outside'],exit:'guarded'},
  ready:{label:'構え',prefix:'構',suffix:'構え',footwork:['stay','sideR'],motifs:['balance','patience'],questions:['opening','recovery'],intent:{guard:.2,spacing:.15},entryBands:['inside','contact','outside'],exit:'neutral'},
});

const unique=values=>[...new Set(values)];
const footworkDefault=kind=>MOTION[kind]?.footwork?.[0]||'stay';
const legacyStep=kind=>Object.freeze({kind,footwork:footworkDefault(kind),charge:'none'});
const step=(kind,footwork)=>Object.freeze({kind,footwork,charge:'none'});
const sequenceKey=kinds=>kinds.join('-');
const legacyTechniqueId=(weapon,kinds)=>`gen1.${weapon}.${sequenceKey(kinds)}`;
const techniqueId=(weapon,steps)=>`gen2.${weapon}.${steps.map(row=>`${row.kind}~${row.footwork}`).join('_')}`;
const FOOTWORK_NAME=Object.freeze({retreat:'退',sideL:'廻',sideR:'廻',orbitL:'廻',orbitR:'廻',cross:'潜',rush:'踏',chase:'追',stay:'静',forward:''});
const RANGE_DELTA=Object.freeze({retreat:1,chase:-1,rush:-1,forward:-1,stay:0,cross:0,sideL:0,sideR:0,orbitL:0,orbitR:0});
const BAND_ORDER=Object.freeze(['inside','contact','outside']);

function phaseSequences(arts,phase){
  const open=unique([...(arts.open||[]),'ready','guard']),middle=unique([...(arts.middle||[]),'guard','ready']),finish=unique(arts.finish||[]);
  if(phase==='jo')return [...open.map(a=>[a]),...open.flatMap(a=>open.map(b=>[a,b]))];
  if(phase==='ha')return [...middle.map(a=>[a]),...open.flatMap(a=>middle.map(b=>[a,b])),...open.flatMap(a=>middle.flatMap(b=>middle.map(c=>[a,b,c])))];
  return [...finish.map(a=>[a]),...middle.flatMap(a=>finish.map(b=>[a,b])),...middle.flatMap(a=>finish.flatMap(b=>finish.map(c=>[a,b,c])))];
}
function legacyPhaseSequences(arts,phase){
  const open=unique(arts.open||[]),middle=unique(arts.middle||[]),finish=unique(arts.finish||[]);
  if(phase==='jo')return [...open.map(a=>[a]),...open.flatMap(a=>open.filter(b=>b!==a).map(b=>[a,b]))];
  if(phase==='ha')return [...middle.map(a=>[a]),...open.flatMap(a=>middle.map(b=>[a,b])),...open.flatMap(a=>middle.flatMap(b=>middle.filter(c=>c!==b).map(c=>[a,b,c])))];
  return [...finish.map(a=>[a]),...middle.flatMap(a=>finish.map(b=>[a,b])),...middle.flatMap(a=>finish.flatMap(b=>finish.filter(c=>c!==b).map(c=>[a,b,c])))];
}
function plausibleKinds(kinds){
  if(!kinds.length||kinds.length>3||kinds.some(kind=>!MOTION[kind]))return false;
  if(kinds.some((kind,index)=>index&&kind===kinds[index-1]&&['guard','ready'].includes(kind)))return false;
  const lunges=kinds.filter(kind=>['dash','bullrush','leap','rushfist'].includes(kind)).length;
  return lunges<=1;
}
function footworkPlans(kinds){
  let plans=[[]];
  for(const kind of kinds)plans=plans.flatMap(plan=>MOTION[kind].footwork.map(footwork=>[...plan,step(kind,footwork)]));
  return plans.filter(plan=>{
    const surges=plan.filter(row=>['rush','chase'].includes(row.footwork)).length;
    if(surges>1)return false;
    for(let i=1;i<plan.length;i++){
      const previous=MOTION[plan[i-1].kind];
      if(previous.exit==='committed'&&!['guard','ready','back','katanaReturn'].includes(plan[i].kind)&&!['retreat','sideL','sideR','orbitL','orbitR'].includes(plan[i].footwork))return false;
    }
    return true;
  });
}
function baseTechniqueName(kinds){
  if(kinds.length===1)return MOTION[kinds[0]].label.slice(0,7);
  const first=MOTION[kinds[0]],last=MOTION[kinds.at(-1)];
  return (first.prefix+last.suffix).replace(/[・･]/g,'').slice(0,7);
}
function techniqueName(steps){
  const kinds=steps.map(row=>row.kind),base=baseTechniqueName(kinds);
  const variant=steps.find(row=>row.footwork!==footworkDefault(row.kind));
  if(!variant)return base;
  const mark=FOOTWORK_NAME[variant.footwork]||'';
  return (mark+base).slice(0,7);
}
function semantics(steps){
  const motions=steps.map(row=>MOTION[row.kind]);
  const motifs=unique(motions.flatMap(row=>row.motifs)).slice(0,5);
  const questions=unique(motions.flatMap(row=>row.questions)).slice(0,4);
  const intent={};
  for(const row of motions)for(const [key,value] of Object.entries(row.intent||{}))intent[key]=Number(((intent[key]||0)+value).toFixed(3));
  const footwork=steps.map(row=>row.footwork);
  const space=footwork.some(id=>id==='retreat')?'retreat':footwork.some(id=>['cross','sideL','sideR','orbitR','orbitL'].includes(id))?'side':'';
  const rangeDelta=footwork.reduce((sum,id)=>sum+(RANGE_DELTA[id]||0),0);
  const entryBands=[...motions[0].entryBands],entryPosture=steps[0].kind==='guard'?'guarded':'neutral',exitPosture=motions.at(-1).exit;
  return {motifs,questions,intent,space,rangeDelta,entryBands,entryPosture,exitPosture};
}
function buildRow(weapon,steps,phases,{legacy=false}={}){
  const arts=TECHNIQUE_GRAMMAR_WEAPON_ARTS[weapon],meta=semantics(steps),kinds=steps.map(row=>row.kind);
  const first=MOTION[kinds[0]].label,last=MOTION[kinds.at(-1)].label;
  return Object.freeze({
    id:legacy?legacyTechniqueId(weapon,kinds):techniqueId(weapon,steps),name:legacy?baseTechniqueName(kinds):techniqueName(steps),kind:'technique',family:`generated.${weapon}.${MOTION[kinds[0]].prefix}.${MOTION[kinds.at(-1)].suffix}`,
    weapons:Object.freeze([weapon]),questions:Object.freeze(meta.questions),materials:Object.freeze([Object.freeze(['handling']),Object.freeze(unique([...meta.motifs,'observation','balance']).slice(0,5))]),
    motifs:Object.freeze(meta.motifs),intent:Object.freeze(meta.intent),bodyAffinity:Object.freeze({}),effort:Number((.88+steps.length*.08+Math.abs(meta.rangeDelta)*.02).toFixed(2)),effects:Object.freeze({}),attributes:Object.freeze([]),specialEffects:Object.freeze([]),
    windows:Object.freeze([]),phases:Object.freeze([...phases]),steps:Object.freeze(steps),space:meta.space,limbs:['great','spear','axe','staff'].includes(weapon)?'twoArms':weapon==='fist'?'legs':'',
    entryBands:Object.freeze(meta.entryBands),rangeDelta:meta.rangeDelta,entryPosture:meta.entryPosture,exitPosture:meta.exitPosture,
    mechanic:`${first}から${last}へ、足運びと間合いをつないで成立させる。`,
    tradeoff:steps.length>=3?'三手を通すため、姿勢か間合いを崩されると成立しにくい。':meta.space==='retreat'?'後ろに引く余地が必要。':meta.space==='side'?'横へ動く余地が必要。':'始動距離と足運びが噛み合わないと続かない。',
    generated:true,grammarRevision:legacy?'technique-grammar-1':techniqueGrammarRevision,tag:arts?.tag||weapon,
  });
}

const ATTACK_FAMILY=Object.freeze({
  thrust:'thrust',pierce:'thrust',katanaThrust:'thrust',jab:'thrust',straight:'thrust',oneinch:'thrust',
  slash:'slash',diagonal:'slash',crosscut:'slash',uppercut:'slash',katanaKesa:'slash',katanaDraw:'slash',katanaReturn:'slash',
  heavy:'heavy',meteor:'heavy',bash:'heavy',pommel:'heavy',
  sweep:'sweep',round:'sweep',spearwheel:'sweep',hook:'sweep',
  bodyblow:'fist',risingfist:'fist',barrage:'fist',rushfist:'fist'
});
const FAMILY_LABEL=Object.freeze({thrust:'突き',slash:'斬り',heavy:'打ち',sweep:'払い',fist:'拳'});
const SIGNATURE_KATAKANA=Object.freeze([
  'ドラゴンドライブ','ファントムエッジ','ブレイクラッシュ','ヴォイドピアス','ルナブレイク','アストラドライブ',
  'レイジングファング','ゼロスラスト','クロノブレイク','ナイトレイヴ'
]);
const SIGNATURE_JAPANESE_PREFIX=Object.freeze(['龍牙','迅雷','月影','天穿','星喰','虚空','鬼哭','蒼雷','黒曜','白閃']);
const SIGNATURE_JAPANESE_SUFFIX=Object.freeze(['穿','閃','砕','牙','輪','返し','落とし','連','衝','断']);
function nameHash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function nameUnit(seed,key){return nameHash(String(seed)+':'+key)/4294967295;}
export function techniqueArchetypeName(row){
  const steps=row?.steps||[],families=steps.map(step=>ATTACK_FAMILY[step.kind]).filter(Boolean);
  if(steps.length>=2&&families.length===steps.length&&new Set(families).size===1){
    const count=steps.length===2?'二段':steps.length===3?'三段':`${steps.length}段`;
    return (count+(FAMILY_LABEL[families[0]]||'技')).slice(0,7);
  }
  if(steps.length===3&&families.length===3){
    const dominant=[...new Set(families)].sort((a,b)=>families.filter(x=>x===b).length-families.filter(x=>x===a).length)[0];
    if(families.filter(x=>x===dominant).length>=2)return ('三連'+(FAMILY_LABEL[dominant]||'技')).slice(0,7);
  }
  return String(row?.name||'').replace(/[・･]/g,'').trim().slice(0,7);
}
function signatureStem(row){
  const families=(row?.steps||[]).map(step=>ATTACK_FAMILY[step.kind]).filter(Boolean);
  const dominant=families[0]||'thrust';
  return Object.freeze({thrust:'穿',slash:'閃',heavy:'砕',sweep:'輪',fist:'牙'})[dominant]||'閃';
}
export function generatedTechniqueNaming(row,{seed=0,motifs=[],specialEffects=null}={}){
  const base=techniqueArchetypeName(row);
  const effects=Array.isArray(specialEffects)?specialEffects:(row?.specialEffects||[]);
  const rules=effects.filter(effect=>effect?.impact==='rule');
  const ultimate=rules.some(effect=>effect?.rarity==='singular'&&String(effect?.unlockCondition||'').trim());
  const grade=ultimate?'ultimate':rules.length?'secret':'normal';
  const motifKey=[...(motifs||[])].sort().join(',');
  const individuality=nameUnit(seed,`signature:${row?.id}:${motifKey}`);
  const signature=rules.length>0||individuality<.14;
  let name=base,style='archetype';
  if(signature){
    const kata=nameUnit(seed,`script:${row?.id}:${motifKey}`)<.32;
    if(kata){name=SIGNATURE_KATAKANA[nameHash(`${seed}:${row?.id}:kata:${motifKey}`)%SIGNATURE_KATAKANA.length];style='katakana';}
    else{
      const prefix=SIGNATURE_JAPANESE_PREFIX[nameHash(`${seed}:${row?.id}:prefix:${motifKey}`)%SIGNATURE_JAPANESE_PREFIX.length];
      const suffix=SIGNATURE_JAPANESE_SUFFIX[nameHash(`${seed}:${row?.id}:suffix:${motifKey}`)%SIGNATURE_JAPANESE_SUFFIX.length]||signatureStem(row);
      name=(prefix+suffix).slice(0,7);style='chuunibyou';
    }
  }
  const title=grade==='ultimate'?'奥義':grade==='secret'?'秘技':'';
  return Object.freeze({baseName:base,name,displayName:title?`${title}・${name}`:name,style,grade,signature});
}
export function generatedTechniqueDisplayName(row,options={}){return generatedTechniqueNaming(row,options).displayName;}

const V2_CACHE=new Map(),V1_CACHE=new Map();
function legacyCandidates(weapon){
  const arts=TECHNIQUE_GRAMMAR_WEAPON_ARTS[weapon];if(!arts)return [];
  if(V1_CACHE.has(weapon))return V1_CACHE.get(weapon);
  const bySequence=new Map();
  for(const slot of TECHNIQUE_GRAMMAR_PHASES)for(const kinds of legacyPhaseSequences(arts,slot)){
    if(!plausibleKinds(kinds))continue;
    const key=sequenceKey(kinds),entry=bySequence.get(key)||{kinds,phases:new Set()};entry.phases.add(slot);bySequence.set(key,entry);
  }
  const rows=Object.freeze([...bySequence.values()].map(entry=>buildRow(weapon,entry.kinds.map(legacyStep),entry.phases,{legacy:true})).sort((a,b)=>a.id.localeCompare(b.id)));
  V1_CACHE.set(weapon,rows);return rows;
}
export function generatedTechniqueCandidates({weapon='fist',phase=null}={}){
  const arts=TECHNIQUE_GRAMMAR_WEAPON_ARTS[weapon];if(!arts)return [];
  let rows=V2_CACHE.get(weapon);
  if(!rows){
    const byStructure=new Map();
    for(const slot of TECHNIQUE_GRAMMAR_PHASES)for(const kinds of phaseSequences(arts,slot)){
      if(!plausibleKinds(kinds))continue;
      for(const steps of footworkPlans(kinds)){
        const key=steps.map(row=>`${row.kind}~${row.footwork}`).join('_'),entry=byStructure.get(key)||{steps,phases:new Set()};
        entry.phases.add(slot);byStructure.set(key,entry);
      }
    }
    rows=Object.freeze([...byStructure.values()].map(entry=>buildRow(weapon,entry.steps,entry.phases)).sort((a,b)=>a.id.localeCompare(b.id)));
    V2_CACHE.set(weapon,rows);
  }
  return phase?rows.filter(row=>row.phases.includes(phase)):rows;
}
export function generatedTechniqueById(id){
  const value=String(id||'');
  const legacy=/^gen1\.([a-z]+)\.([A-Za-z0-9-]+)$/.exec(value);
  if(legacy)return legacyCandidates(legacy[1]).find(row=>row.id===value)||null;
  const current=/^gen2\.([a-z]+)\.([A-Za-z0-9~_-]+)$/.exec(value);
  if(!current)return null;
  return generatedTechniqueCandidates({weapon:current[1]}).find(row=>row.id===value)||null;
}
export function isGeneratedTechniqueId(id){return /^gen[12]\./.test(String(id||''));}
export function generatedTechniqueCount(weapon=null){
  return weapon?generatedTechniqueCandidates({weapon}).length:Object.keys(TECHNIQUE_GRAMMAR_WEAPON_ARTS).reduce((sum,id)=>sum+generatedTechniqueCandidates({weapon:id}).length,0);
}
