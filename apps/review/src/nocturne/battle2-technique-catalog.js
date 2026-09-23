import {inspirationCombatAnswerPool} from '@soul/game-data';
import {resolveTechnique,techniqueCatalog,techniqueName,compileBattleLoadout} from '@soul/johakyu-battle';
import {resolveBattlePresentation} from '@soul/johakyu-presentation/battle-presentation';
export const battle2TechniqueLabel=techniqueName;
export function battle2TechniqueDefinition(id,options={}){return resolveTechnique(id,options);}
export function battle2TechniqueCatalog({weapon='sword'}={}){return techniqueCatalog(weapon).filter(row=>row.id===`basic.${weapon}`).map(row=>({...row,meta:row.stages.map(s=>s.kind).join(' / '),supported:row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)})).filter(row=>row.supported);}
export const BATTLE2_TECHNIQUE_CATALOG=Object.freeze(battle2TechniqueCatalog());
export function battle2InspirationCatalog({weapon='sword'}={}){return battle2LearnedTechniqueRows(inspirationCombatAnswerPool(weapon).map(row=>row.id),{weapon});}
export function battle2LearnedTechniqueRows(ids,{weapon='sword'}={}){return [...new Set(ids||[])].map(id=>resolveTechnique(id,{weapon})).filter(row=>row&&row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)).map(row=>({...row,meta:row.stages.map(s=>s.kind).join(' / ')}));}
export function battle2SelectionLabel(id){return techniqueName(id);}
export function battle2SelectionAllowed(id,{weapon='sword'}={}){if(!id||String(id).startsWith('combo:'))return false;try{return compileBattleLoadout({jo:id},weapon).jo.every(t=>t.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported));}catch{return false;}}
export function battle2SelectionTechniques(id,{weapon='sword'}={}){return compileBattleLoadout({jo:id},weapon).jo.map(t=>t.id);}
export function battle2TechniquePresentation(technique,{weapon='sword',phase='jo',stageIndex=0}={}){const stage=technique.stages?.[stageIndex]||technique.steps?.[stageIndex];return stage?resolveBattlePresentation({techniqueId:technique.id,stageIndex,weapon,phase,...stage}):{supported:false,reason:'missing-stage'};}
