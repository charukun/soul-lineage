import {generatedTechniqueCandidates,generatedTechniqueNaming,inspirationCombatAnswerPool} from '@soul/game-data';
import {resolveTechnique,techniqueCatalog,techniqueName,techniqueDetail,compileBattleLoadout} from '@soul/johakyu-battle';
import {resolveBattlePresentation} from '@soul/johakyu-presentation/battle-presentation';

const PHASES=new Set(['jo','ha','kyu']);
const SWEEP=new Set(['slash','back','heavy','spin','sweep','diagonal','crosscut','round','hook','bodyblow','barrage','rushfist','uppercut','risingfist','meteor','bullrush']);
const FINISH=new Set(['heavy','round','barrage','rushfist','meteor','pierce','oneinch','risingfist']);
const OPEN=new Set(['guard','ready','back','slash','jab','thrust']);
export const battle2TechniqueLabel=techniqueName;
export function battle2TechniqueDefinition(id,options={}){return resolveTechnique(id,options);}
const supported=(row,weapon)=>{const technique=resolveTechnique(row?.id,{weapon});return Boolean(technique&&technique.stages.every(stage=>resolveBattlePresentation({...stage,weapon}).supported));};
const weightFor=(row,phase,encounterMode,spectacle=false)=>{
  const steps=row?.steps||[],kinds=steps.map(step=>step.kind),sweep=kinds.some(kind=>SWEEP.has(kind)),finish=kinds.some(kind=>FINISH.has(kind)),open=kinds.some(kind=>OPEN.has(kind)),moving=steps.some(step=>step.footwork&&step.footwork!=='stay');
  let weight=1+kinds.length*.55+(moving?.8:0);if(sweep)weight+=.65;if(encounterMode==='one-v-three'&&sweep)weight+=.8;if(phase==='kyu'&&finish)weight+=.55;if(phase==='jo'&&open)weight+=.35;if(phase==='ha'&&kinds.length>1)weight+=.25;if(spectacle&&kinds.length>=3)weight*=3;return weight;
};
const weightedPick=(rows,random=Math.random)=>{if(!rows.length)return null;const total=rows.reduce((sum,item)=>sum+item.weight,0),point=Math.max(0,Math.min(.999999,Number(random())||0))*total;let cursor=0;for(const item of rows){cursor+=item.weight;if(point<cursor)return item.row;}return rows.at(-1).row;};

export function battle2TechniqueCatalog({weapon='sword'}={}){return techniqueCatalog(weapon).filter(row=>row.id===`basic.${weapon}`).map(row=>({...row,meta:techniqueDetail(row.id,{weapon}).summary,supported:row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)})).filter(row=>row.supported);}
export const BATTLE2_TECHNIQUE_CATALOG=Object.freeze(battle2TechniqueCatalog());
export function battle2InspirationCatalog({weapon='sword'}={}){return battle2LearnedTechniqueRows(inspirationCombatAnswerPool(weapon).map(row=>row.id),{weapon});}
export function battle2LearnedTechniqueRows(ids,{weapon='sword'}={}){return [...new Set(ids||[])].map(id=>resolveTechnique(id,{weapon})).filter(row=>row&&row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)).map(row=>({...row,meta:techniqueDetail(row.id,{weapon,name:row.label}).summary}));}
export function battle2SelectionLabel(id){return techniqueName(id);}
export function battle2SelectionAllowed(id,{weapon='sword'}={}){if(!id||String(id).startsWith('combo:'))return false;try{return compileBattleLoadout({jo:id},weapon).jo.every(t=>t.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported));}catch{return false;}}
export function battle2SelectionTechniques(id,{weapon='sword'}={}){return compileBattleLoadout({jo:id},weapon).jo.map(t=>t.id);}
export function battle2TechniquePresentation(technique,{weapon='sword',phase='jo',stageIndex=0}={}){const stage=technique.stages?.[stageIndex]||technique.steps?.[stageIndex];return stage?resolveBattlePresentation({techniqueId:technique.id,stageIndex,weapon,phase,...stage}):{supported:false,reason:'missing-stage'};}

export function battle2InspirationCandidates({weapon='sword',phase='ha',seenIds=[],encounterMode='duel',spectacle=false}={}){
  const slot=PHASES.has(phase)?phase:'ha',seen=new Set(seenIds);
  return inspirationCombatAnswerPool(weapon).filter(row=>row.phases?.includes(slot)&&!row.executor&&!seen.has(row.id)&&supported(row,weapon)).map(row=>Object.freeze({row,weight:weightFor(row,slot,encounterMode,spectacle)}));
}
export function battle2UltimateCandidates({weapon='sword',phase='kyu',seenIds=[],encounterMode='duel'}={}){
  if(phase!=='kyu')return [];const seen=new Set(seenIds);
  return generatedTechniqueCandidates({weapon,phase:'kyu'}).filter(row=>!seen.has(row.id)&&supported(row,weapon)&&row.steps.length===3&&row.steps.some(step=>step.footwork&&step.footwork!=='stay')&&row.steps.some(step=>FINISH.has(step.kind))).map(row=>Object.freeze({row,weight:weightFor(row,'kyu',encounterMode,true)}));
}
export function pickBattle2Inspiration(options={},random=Math.random){
  const phase=PHASES.has(options.phase)?options.phase:'ha',seed=Number(options.seed)||0,base={...options,phase};
  if(phase==='kyu'&&options.mastered&&(options.spectacle||random()<.35)){
    const row=weightedPick(battle2UltimateCandidates(base),random);
    if(row){const naming=generatedTechniqueNaming(row,{seed,motifs:row.motifs||[]});return Object.freeze({id:row.id,name:`奥義・${naming.name}`,grade:'ultimate',ultimate:true});}
  }
  const candidates=battle2InspirationCandidates(base);
  const row=weightedPick(candidates,random);if(!row)return null;
  const naming=row.generated?generatedTechniqueNaming(row,{seed,motifs:row.motifs||[]}):null;
  return Object.freeze({id:row.id,name:naming?.displayName||techniqueName(row.id),grade:naming?.grade||'normal',ultimate:false});
}
