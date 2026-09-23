import {inspirationCombatAnswerPool} from '@soul/game-data';
import {resolveTechnique,techniqueCatalog,techniqueName,CHAIN_PRESETS,compileBattleLoadout} from '@soul/johakyu-battle';
import {resolveBattlePresentation} from '@soul/johakyu-presentation/battle-presentation';
export const battle2TechniqueLabel=techniqueName;
export function battle2TechniqueDefinition(id,options={}){return resolveTechnique(id,options);}
export const BATTLE2_COMBO_PRESETS=CHAIN_PRESETS;
export function battle2TechniqueCatalog({weapon='sword'}={}){return techniqueCatalog(weapon).map(row=>({...row,meta:row.stages.map(s=>s.kind).join(' / '),supported:row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)})).filter(row=>row.supported);}
export const BATTLE2_TECHNIQUE_CATALOG=Object.freeze(battle2TechniqueCatalog());
export function battle2InspirationCatalog({weapon='sword'}={}){return battle2LearnedTechniqueRows(inspirationCombatAnswerPool(weapon).map(row=>row.id),{weapon});}
export function battle2LearnedTechniqueRows(ids,{weapon='sword'}={}){return [...new Set(ids||[])].map(id=>resolveTechnique(id,{weapon})).filter(row=>row&&row.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported)).map(row=>({...row,meta:row.stages.map(s=>s.kind).join(' / ')}));}
export const battle2ComboSelection=id=>'combo:'+id;
export function battle2SelectionLabel(id){return id?.startsWith('combo:')?CHAIN_PRESETS.find(row=>row.id===id.slice(6))?.label||'連技':techniqueName(id);}
export function battle2SelectionAllowed(id,{weapon='sword'}={}){if(!id)return false;try{return compileBattleLoadout({jo:id},weapon).jo.every(t=>t.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported));}catch{return false;}}
export function battle2SelectionTechniques(id,{weapon='sword'}={}){return compileBattleLoadout({jo:id},weapon).jo.map(t=>t.id);}
export function battle2TechniquePresentation(technique,{weapon='sword',phase='jo',stageIndex=0}={}){const stage=technique.stages?.[stageIndex]||technique.steps?.[stageIndex];return stage?resolveBattlePresentation({techniqueId:technique.id,stageIndex,weapon,phase,...stage}):{supported:false,reason:'missing-stage'};}
